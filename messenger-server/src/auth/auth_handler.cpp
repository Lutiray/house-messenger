#include "auth/auth_handler.hpp"
#include "utils/logger.hpp"
#include "utils/string_utils.hpp"
#include "interfaces/interfaces.hpp"

using json = nlohmann::json;

AuthHandler::AuthHandler(IDatabaseService& db, SOCKET client_socket)
    : _db(db), _socket(client_socket) {}

void AuthHandler::raw_send(const std::string& data) {
    if (send(_socket, data.c_str(), (int)data.size(), 0) == SOCKET_ERROR){
        Logger::error("AuthHandler::raw_send failed. Socket: " + std::to_string(_socket));
    }
}

void AuthHandler::send_json(const json& j) {
    raw_send(j.dump() + "\n");
}

void AuthHandler::send_auth_response(const std::string& status, const std::string& message, const std::string& username) {
    json resp;
    resp["type"] = "auth_response";
    resp["status"] = status;
    if (!message.empty()) resp["message"] = message;

    if (!username.empty()) {
        resp["username"] = username;
        resp["user_id"] = _db.getUserId(username);
    }
    send_json(resp);
}

bool AuthHandler::validate_input(const std::string& username, const std::string& password) {
    if (StringUtils::is_blank(username) || StringUtils::is_blank(password)){
        send_auth_response("error", "Fields cannot be empty", "");
        return false;
    }

    if (!StringUtils::is_valid_username(username)) {
        send_auth_response("error", "Username must be 4 - 32 characters, only letters, digits and _", "");
        return false;
    }
    return true;
}

std::string AuthHandler::authenticate() {
    std::string internal_buffer;
    char socket_buffer[4096];

    while (true) {
        int bytes = recv(_socket, socket_buffer, sizeof(socket_buffer) - 1, 0);
        if (bytes <= 0) return ("");

        socket_buffer[bytes] = '\0';
        internal_buffer.append(socket_buffer, bytes);

        size_t pos;
        while((pos = internal_buffer.find('\n')) != std::string::npos) {
            std::string line = internal_buffer.substr(0, pos);
            internal_buffer.erase(0, pos + 1);

            if (StringUtils::is_blank(line)) continue;

            try {
                auto j = json::parse(line);
                std::string type = j.value("type", "");

                if (type != "login" && type != "register") continue;
                    
                std::string user = StringUtils::trim(j.value("username", ""));
                std::string pass = j.value("password", "");

                if (!validate_input(user, pass)) continue;

                bool success = false;
                std::string msg;

                if (type == "login") {
                    success = _db.checkAuth(user, pass);
                    msg = success ? "Welcome back!" : "Invalid credentials";
                } else {
                    std::string email = j.value("email", "");
                    std::string phone = j.value("phone", "");
                    success = _db.registerUser(user, pass, email, phone);
                    msg = success ? "Registered successfully!" : "Username already taken";
                }

                send_auth_response(success ? "success" : "error", msg, success ? user : "");
                if (success) return user;    
            } catch (const std::exception& e) {
                Logger::error("Auth Parse Error: " + std::string(e.what()));
                send_auth_response("error", "Invalid JSON format", "");
            }
        }
    }
}
