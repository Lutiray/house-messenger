#ifndef AUTH_HANDLER_HPP
#define AUTH_HANDLER_HPP

#include <string>
#include "interfaces/interfaces.hpp"

class DatabaseManager;

class AuthHandler {
public:
    AuthHandler(IDatabaseService& db, SOCKET client_socket);
    std::string authenticate();

private:
    IDatabaseService& _db; 
    SOCKET _socket;

    void send_json(const nlohmann::json &j);
    void send_auth_response(const std::string &type, const std::string &status, const std::string &message, const std::string &username);
    bool validate_input(const std::string &u_name, const std::string &password, const std::string &type);
    void raw_send(const std::string &data);
};

#endif