#include "auth/auth_handler.hpp"
#include "utils/logger.hpp"
#include "interfaces/interfaces.hpp"

using json = nlohmann::json;

AuthHandler::AuthHandler(IDatabaseService& db, SOCKET client_socket)
    : _db(db), _socket(client_socket) {}

void AuthHandler::raw_send(const std::string& data) {
    if (send(_socket, data.c_str(), (int)data.size(), 0) == SOCKET_ERROR){
        Logger::error("AuthHandler::raw_send failed. Socket: " + std::to_string(_socket) + ", Data size: " + std::to_string(data.size()));
    }
}

void AuthHandler::send_json(const json& j) {
    raw_send(j.dump() + "\n");
}

void AuthHandler::send_auth_response(const std::string& type, const std::string& status, const std::string& message, const std::string& username) {
    json resp;
    resp["type"] = type;
    resp["status"] = status;
    if (!message.empty()) resp["message"] = message;

    if (!username.empty()) {
        resp["username"] = username;
        resp["user_id"] = _db.getUserId(username);
    }
    send_json(resp);
}

bool AuthHandler::validate_input(const std::string& u_name, const std::string& password, const std::string& type) {
    if (u_name.empty() || password.empty()){
        send_auth_response(type, "error", "Fields cannot be empty", "");
        return (false);
    }
    return (true);
}

std::string AuthHandler::authenticate() {
    std::string internal_buffer;
    char socket_buffer[4096];

    while (true) {
        int bytes = recv(_socket, socket_buffer, sizeof(socket_buffer) - 1, 0);
        if (bytes <= 0) return ("");

        internal_buffer.append(socket_buffer, bytes);

        size_t pos = 0;
        while((pos = internal_buffer.find('\n')) != std::string::npos) {
            std::string line = internal_buffer.substr(0, pos);
            internal_buffer.erase(0, pos + 1);

            if (line.empty()) continue;

            try {
                auto j = json::parse(line);
                std::string type = j.value("type", "");

                if (type == "login" || type == "register") {
                    std::string user = j.value("username", "");
                    std::string pass = j.value("password", "");

                    if (!validate_input(user, pass, "auth_response")) continue;

                    bool success = false;
                    std::string msg;

                    if (type == "login") {
                    success = _db.checkAuth(user, pass);
                    msg = success ? "Welcome back!" : "Invalid credentials";
                    } else {
                    std::string email = j.value("email", "");
                    std::string phone = j.value("phone", "");
                    
                    success = _db.registerUser(user, pass, email, phone);
                    msg = success ? "Registered successfully!" : "Username taken or DB error";
                    }

                    if (success) {
                        send_auth_response("auth_response", "success", msg, user);
                        return user; 
                    } else {
                        send_auth_response("auth_response", "error", msg, "");
                    }
                }
            } catch (const std::exception& e) {
                Logger::error("Auth Parse Error: " + std::string(e.what()) + " Data: " + line);
                send_auth_response("auth_response", "error", "Please use JSON format", "");
            }
        }
    }
}
