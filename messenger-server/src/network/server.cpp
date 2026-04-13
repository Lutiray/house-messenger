#include "network/server.hpp"
#include "utils/winsock_manager.hpp"
#include "json.hpp"
#include "auth/auth_handler.hpp"
#include "utils/logger.hpp"
#include "network/command_handler.hpp"
#include <algorithm>

using json = nlohmann::json;

Server::Server(int port, DatabaseManager& db) 
            : _port(port), _db(db), _server_fd(INVALID_SOCKET), _is_running(false) {
    if (!WinSockManager::initialize()) {
        throw std::runtime_error("Network initialization failed");
    }
}

Server::~Server() {
    stop();
    WinSockManager::cleanup();
    Logger::info("Server stopped and cleaned up");
}

void Server::send_json(SOCKET sock, const json& j) {
    std::string s = j.dump() + "\n";
    if (send(sock, s.c_str(), (int)s.size(), 0) == SOCKET_ERROR) {
        Logger::error("Failed to send data to socket", WSAGetLastError());
    }
}

void Server::start() {
    if (!setup_server()) { return; }

    _is_running = true;
    Logger::debug("Server is listening on port " + std::to_string(_port));
    while(_is_running) {
        sockaddr_in client_addr;
        int addr_len = sizeof(client_addr);
        SOCKET client_socket = ::accept(_server_fd, (struct sockaddr*)&client_addr, &addr_len);
        if (client_socket != INVALID_SOCKET) {
            Logger::info("--- Connection accepted, waiting for auth ---");
            handle_new_connection(client_socket);
        } else if (_is_running) {
            Logger::error("accept() failed: ", WSAGetLastError());
        }
    }
}

bool Server::setup_server() {
    _server_fd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if(_server_fd == INVALID_SOCKET) return (false);

    Logger::debug("Server started on port " + std::to_string(_port) + ". Waiting for connections...");

    sockaddr_in service;
    service.sin_family = AF_INET; //IPv4
    service.sin_addr.s_addr = INADDR_ANY;
    service.sin_port = htons(_port);

    if (bind(_server_fd, (SOCKADDR*)&service, sizeof(service)) == SOCKET_ERROR) {
        Logger::error("bind( failed): ", WSAGetLastError());
        closesocket(_server_fd);
        return (false);
    }

    if (listen(_server_fd, SOMAXCONN) == SOCKET_ERROR) {
        Logger::error("listen() failed: ", WSAGetLastError());
        return (false);
    }
    return (true);
}

void Server::handle_new_connection(SOCKET client_socket) {
    {
        std::lock_guard<std::mutex> lock(_clients_mutex);
        _clients.push_back(client_socket);
    }
    Logger::info("--- New connection established ---");

    std::thread client_thread(&Server::handle_client, this, client_socket);
    
    {
        std::lock_guard<std::mutex> lock(_threads_mutex);
        _client_threads.push_back(std::move(client_thread));
    }
}

void Server::handle_client(SOCKET client_socket) {
    Logger::info("New client thread started: " + std::to_string(client_socket));
    AuthHandler auth(_db, client_socket);
    std::string name = auth.authenticate();

    if (name.empty()) {
        remove_client(client_socket);
        return;
    }

    setup_client_session(client_socket, name);

    try {
        process_client_messages(client_socket, name);
    } catch (const std::exception& e) {
        Logger::error("Stream error for " + name + ": " + e.what());
    }

    cleanup_client_session(client_socket, name);
}

void Server::setup_client_session(SOCKET sock, const std::string& name) {
    {
        std::lock_guard<std::mutex> lock(_clients_mutex);
        _nicknames[sock] = name;
    }

    send_json(sock, get_user_list_json());
    send_json(sock, _db.getDialogsList(name));

    broadcast_message({{"type", "status"}, {"user", name}, {"online", true}}, sock);
    Logger::info("Session started for: " + name);
}

void Server::process_client_messages(SOCKET sock, const std::string& name) {
    std::string internal_buffer;
    char socket_buffer[4096];

    while (_is_running) {
        int bytes = recv(sock, socket_buffer, sizeof(socket_buffer) - 1, 0);
        if (bytes <= 0) break;

        internal_buffer.append(socket_buffer, bytes);
        size_t pos;
        while ((pos = internal_buffer.find('\n')) != std::string::npos) {
            std::string line = internal_buffer.substr(0, pos);
            internal_buffer.erase(0, pos + 1);
            
            if (line.empty()) continue;

            try {
                CommandHandler handler(*this, *this, _db, sock, name);
                handler.handle(line);
            } catch (const std::exception& e) {
                Logger::error("Handler error for " + name + ": " + e.what());
            }
        }
    }
}

void Server::cleanup_client_session(SOCKET sock, const std::string& name) {
    remove_client(sock);
    if (!name.empty()) {
        broadcast_message({{"type", "status"}, {"user", name}, {"online", false}}, INVALID_SOCKET);
        Logger::info("Session cleaned up for: " + name);
    }
}

void Server::broadcast_message(const json& j, SOCKET sender_socket) {
    std::string s = j.dump() + "\n";
    std::lock_guard<std::mutex> lock(_clients_mutex);

    for (SOCKET client : _clients) {
        if (client == sender_socket) continue;

        if (send(client, s.c_str(), (int)s.size(), 0) == SOCKET_ERROR) {
            Logger::error("Broadcast failed for one client socket");
        }
    }
}

void Server::remove_client(SOCKET sock) {
    std::lock_guard<std::mutex> lock(_clients_mutex);
    _nicknames.erase(sock);
    _clients.erase(std::remove(_clients.begin(), _clients.end(), sock), _clients.end());
    closesocket(sock);
}

SOCKET Server::find_socket_by_nick(const std::string& nick) {
    std::lock_guard<std::mutex> lock(_clients_mutex);
    for (auto const& [sock, name] : _nicknames) {
        if (name == nick) return (sock);
    }
    return (INVALID_SOCKET);
}

json Server::get_user_list_json() {
    json list = json::array();
    std::lock_guard<std::mutex> lock(_clients_mutex);
    for (auto const& [sock, name] : _nicknames) {
        list.push_back(name);
    }
    return {{"type", "user_list"}, {"users", list}};
}

void Server::stop() {
    _is_running = false;

    if (_server_fd != INVALID_SOCKET) {
        closesocket(_server_fd);
        _server_fd = INVALID_SOCKET;
    }

    {
        std::lock_guard<std::mutex> lock(_clients_mutex);
        for (SOCKET client : _clients) {
            closesocket(client);
        }
    }

    {
        std::lock_guard<std::mutex> lock(_threads_mutex);
        for (auto& th : _client_threads) {
            if (th.joinable()) th.join();
        }
        _client_threads.clear();
    }
}
