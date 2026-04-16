#include "network/client.hpp"
#include <iostream>
#include <chrono>
#include <thread>
#include <WS2tcpip.h>

using json = nlohmann::json;

Client::Client(const std::string& ip, int port)
    : _server_ip(ip), _port(port), _client_fd(INVALID_SOCKET), _is_running(false) , 
    _is_authenticated(false), _ui_callback(nullptr) {
    
    if (!init_winsock()){
        std::cerr << "Failed to initialize Winsock" << std::endl;
    }
}

Client::~Client() {
    stop();
    WSACleanup();
    std::cout << "Client stopped and cleaned up." << std::endl;
}

bool Client::init_winsock() {
    WSADATA wsaData;
    int result = WSAStartup(MAKEWORD(2, 2), &wsaData);

    if (result != 0) {
        std::cerr << "WSAStartup failed with error." << result << std::endl;
        return (false);
    }

    if (LOBYTE(wsaData.wVersion) != 2 || HIBYTE(wsaData.wVersion) != 2) {
        std::cerr << "Version 2.2 od Winsock not available" << std::endl;
        WSACleanup();
        return (false);
    }
    return (true);
}

bool Client::connectToServer() {
    if (_client_fd != INVALID_SOCKET) {
        closesocket(_client_fd);
        _client_fd = INVALID_SOCKET;
    }

    if (_receive_thread.joinable()) {
        _receive_thread.join();
    }

    _client_fd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (_client_fd == INVALID_SOCKET) return false;

    sockaddr_in server_addr{};
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(_port);
    inet_pton(AF_INET, _server_ip.c_str(), &server_addr.sin_addr);

    if (connect(_client_fd, (struct sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
        std::cerr << "Connect failed with error: " << WSAGetLastError() <<  std::endl;
        closesocket(_client_fd);
        _client_fd = INVALID_SOCKET;
        return false;
    }

    _is_running = true;
    _receive_thread = std::thread(&Client::receive_loop, this);

    return true;
}

void Client::send_json(const json& j) {
    if (_client_fd == INVALID_SOCKET) return;
    std::string s = j.dump() + "\n";
    send(_client_fd, s.c_str(), (int)s.size(), 0);
}

void Client::login(const std::string& username, const std::string& password) {
    send_json({{"type", "login"}, {"username", username}, {"password", password}});
}

void Client::registerUser(const std::string& username, const std::string& password, 
                          const std::string& email, const std::string& phone) {
    send_json({
        {"type", "register"}, 
        {"username", username}, 
        {"password", password},
        {"email", email},
        {"phone", phone}
    });
}

void Client::sendChatMessage(const std::string& text) {
    if (text.empty()) return;
    send_json({{"type", "send_msg"}, {"to", "general"}, {"content", text}});
}

void Client::receive_loop() {
    char buffer[4096];
    while (_is_running) {
        if (_client_fd == INVALID_SOCKET) break;

        int bytes = recv(_client_fd, buffer, sizeof(buffer) - 1, 0);
        if (bytes > 0) {
            std::lock_guard<std::mutex> lock(_buffer_mutex);
            _read_buffer.append(buffer, bytes);

            size_t pos;
            while ((pos = _read_buffer.find('\n')) != std::string::npos) {
                std::string packet = _read_buffer.substr(0, pos);
                _read_buffer.erase(0, pos + 1);

                if (packet.empty()) continue;
                try {
                    handle_json_packet(json::parse(packet));
                } catch (const std::exception& e) {
                    std::cerr << "[Client] Failed to parse JSON: " << packet << std::endl;
                }
            }
        } else {
            std::cout << "{\"type\":\"system\",\"text\":\"Lost connection to server.\"}" << std::endl;
            _is_running = false;
            break;
        }
    }
}

void Client::handle_json_packet(const json& j) {
    std::string type = j.value("type", "unknown");
    if (type == "pong") return; 
    
    std::cout << j.dump() << std::endl;
    
    if (_ui_callback) _ui_callback(j);

    if (type == "auth_response" && j.value("status", "") == "success") {
        _is_authenticated = true;
        _my_nickname = j.value("username", "");

        if (_ping_thread.joinable()) _ping_thread.join();
        _ping_thread = std::thread(&Client::ping_loop, this);
    }
}

void Client::ping_loop() {
    while (_is_running) {
        std::this_thread::sleep_for(std::chrono::seconds(10));
        if (_client_fd != INVALID_SOCKET && _is_authenticated) {
            send_json({{"type", "ping"}});
        }
    }
}

void Client::stop() {
    _is_running = false;
    _is_authenticated = false;

    if (_client_fd != INVALID_SOCKET) {
        closesocket(_client_fd);
        _client_fd = INVALID_SOCKET;
    }

    if (_receive_thread.joinable()) _receive_thread.join();

    if (_ping_thread.joinable()) _ping_thread.join();
}
