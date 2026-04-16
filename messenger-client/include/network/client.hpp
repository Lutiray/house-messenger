#ifndef CLIENT_HPP
#define CLIENT_HPP

#include <winsock2.h>
#include <string>
#include <thread>
#include <atomic>
#include <functional>
#include <mutex>
#include "json.hpp"

class Client {
public:
    using MessageCallback = std::function<void(const nlohmann::json&)>;
    Client(const std::string& ip, int port);
    ~Client();

    bool connectToServer();
    void stop();

    void login(const std::string& username, const std::string& password);
    void registerUser(const std::string& username, const std::string& password,
                        const std::string& email = "", const std::string& phone = "");
    void sendChatMessage(const std::string& text);
    void set_message_callback(MessageCallback cb) { _ui_callback = cb; }
    void send_json(const nlohmann::json& j);

    bool is_authenticated() const { return _is_authenticated; }
    std::string get_my_nickname() const { return _my_nickname; }

private:
    SOCKET _client_fd;
    std::string _server_ip;
    std::thread _ping_thread;
    int _port;
    std::atomic<bool> _is_running;
    std::atomic<bool> _is_authenticated{false};
    std::string _my_nickname;
    std::string _read_buffer;
    std::thread _receive_thread;
    std::mutex _buffer_mutex;

    MessageCallback _ui_callback = nullptr;

    bool init_winsock();
    void receive_loop();
    void ping_loop();
    void handle_json_packet(const nlohmann::json& j);
};

#endif