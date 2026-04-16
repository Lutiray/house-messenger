#include "network/server.hpp"
#include "utils/winsock_manager.hpp"
#include "json.hpp"
#include "auth/auth_handler.hpp"
#include "utils/logger.hpp"
#include "network/command_handler.hpp"

using json = nlohmann::json;

inline int get_net_error() {
#ifdef _WIN32
    return WSAGetLastError();
#else
    return errno;
#endif
}

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
        Logger::error("Failed to send data to socket", get_net_error());
    }
}

void Server::start() {
    if (!setup_server()) { return; }

    _is_running = true;
    Logger::debug("Server is listening on port " + std::to_string(_port));
    
    while(_is_running) {
        sockaddr_in client_addr{};

#ifdef _WIN32
    int addr_len = sizeof(client_addr);
#else
    socklen_t addr_len = sizeof(client_addr);
#endif
        SOCKET client_socket = ::accept(_server_fd, (struct sockaddr*)&client_addr, &addr_len);
        
        if (client_socket != INVALID_SOCKET) {
            Logger::info("Connection accepted, starting auth...");
            handle_new_connection(client_socket);
        } else if (_is_running) {
            Logger::error("accept() failed: ", get_net_error());
        }
    }
}

bool Server::setup_server() {
    _server_fd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if(_server_fd == INVALID_SOCKET) return false;

    sockaddr_in service{};
    service.sin_family = AF_INET;
    service.sin_addr.s_addr = INADDR_ANY;
    service.sin_port = htons(_port);

    if (bind(_server_fd, (struct sockaddr*)&service, sizeof(service)) == SOCKET_ERROR) {
        Logger::error("bind( failed): ", get_net_error());
        closesocket(_server_fd);
        return false;
    }

    if (listen(_server_fd, SOMAXCONN) == SOCKET_ERROR) {
        Logger::error("listen() failed: ", get_net_error());
        closesocket(_server_fd);
        return false;
    }

    Logger::debug("Server ready on port " + std::to_string(_port));
    return true;
}

void Server::handle_new_connection(SOCKET client_socket) {
    {
        std::lock_guard<std::mutex> lock(_clients_mutex);
        _clients.push_back(client_socket);
    }

    std::thread(&Server::handle_client, this, client_socket).detach();
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

    CommandHandler handler(*this, *this, _db, sock, name);

    while (_is_running) {
        int bytes = recv(sock, socket_buffer, sizeof(socket_buffer) - 1, 0);
        if (bytes <= 0) break;

        socket_buffer[bytes] = '\0';
        internal_buffer.append(socket_buffer, bytes);
        
        size_t pos;
        while ((pos = internal_buffer.find('\n')) != std::string::npos) {
            std::string line = internal_buffer.substr(0, pos);
            internal_buffer.erase(0, pos + 1);
            
            if (line.empty()) continue;

            try {
                handler.handle(line);
            } catch (const std::exception& e) {
                Logger::error("Handler error for " + name + ": " + e.what());
            }
        }
    }
}

void Server::cleanup_client_session(SOCKET sock, const std::string& name) {
    {
        std::lock_guard<std::mutex> lock(_clients_mutex);
        _nicknames.erase(sock);
        _clients.erase(std::remove(_clients.begin(), _clients.end(), sock), _clients.end());
    }
    closesocket(sock);
 
    if (!name.empty()) {
        broadcast_message({{"type", "status"}, {"user", name}, {"online", false}}, INVALID_SOCKET);
        Logger::info("Session ended for: " + name);
    }
}

void Server::broadcast_message(const json& j, SOCKET sender_socket) {
    std::string s = j.dump() + "\n";
    std::lock_guard<std::mutex> lock(_clients_mutex);

    for (SOCKET client : _clients) {
        if (client == sender_socket) continue;
        if (send(client, s.c_str(), (int)s.size(), 0) == SOCKET_ERROR) {
            Logger::error("Broadcast failed for socket: " + std::to_string(client));
        }
    }
}

void Server::remove_client(SOCKET sock) {
    {
        std::lock_guard<std::mutex> lock(_clients_mutex);
        _nicknames.erase(sock);
        _clients.erase(std::remove(_clients.begin(), _clients.end(), sock), _clients.end());
    }
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
        _clients.clear();
        _nicknames.clear();
    }
}
