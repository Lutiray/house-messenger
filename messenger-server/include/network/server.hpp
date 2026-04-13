#ifndef SERVER_HPP
#define SERVER_HPP

#include <winsock2.h>
#include <vector>
#include <mutex>
#include <map>
#include <string>
#include <thread>
#include "db/database_manager.hpp"
#include "json.hpp"
#include "interfaces/interfaces.hpp"

class Server : public IMessageSender, public IUserRegistry{
public:
    Server(int port, DatabaseManager& db);
    ~Server();

    void start();
    void stop();
    void send_json(SOCKET sock, const nlohmann::json &j) override;
    void broadcast_message(const nlohmann::json &j, SOCKET sender_socket) override;
    
    SOCKET find_socket_by_nick(const std::string& nick) override;
    nlohmann::json get_user_list_json() override;

    DatabaseManager& getDatabase() { return (_db); }
    

private:
    int _port;
    SOCKET _server_fd;
    bool _is_running;
    DatabaseManager& _db;

    std::vector<SOCKET> _clients;
    std::map<SOCKET, std::string> _nicknames;
    std::mutex _clients_mutex;

    std::vector<std::thread> _client_threads; 
    std::mutex _threads_mutex;
    
    bool setup_server();
    void handle_client(SOCKET client_socket);
    void setup_client_session(SOCKET sock, const std::string &name);
    void process_client_messages(SOCKET sock, const std::string &name);
    void cleanup_client_session(SOCKET sock, const std::string &name);
    void remove_client(SOCKET sock);
    void handle_new_connection(SOCKET client_socket);    
};

#endif