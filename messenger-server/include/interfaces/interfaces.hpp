#ifndef INTERFACES_HPP
#define INTERFACES_HPP

#include <string>
#include "json.hpp"

#ifdef _WIN32
    #include <winsock2.h>
#else
    typedef int SOCKET;
#endif

using json = nlohmann::json;

/**
 * Interface for sending messages.
 * Don't let CommandHandler know about realization of socket on the server.
 */
class IMessageSender{
public:
    virtual ~IMessageSender() = default;
    virtual void send_json(SOCKET sock, const json& j) = 0;
    virtual void broadcast_message(const json& j, SOCKET skip_sock) = 0;
};

/**
 * Interface for searching for active users.
 */
class IUserRegistry {
public:
    virtual ~IUserRegistry() = default;
    virtual SOCKET find_socket_by_nick(const std::string& nick) = 0;
    virtual json get_user_list_json() = 0;
};

/**
 * Interface for working with database (messages and users).
 */

class IDatabaseService {
public:
    virtual ~IDatabaseService() = default;
    
    virtual int getUserId(const std::string& username) = 0;
    virtual int saveMessage(const std::string& sender_nick, 
                             const std::string& content, 
                             const std::string& receiver_nick) = 0;
    
    virtual bool checkAuth(const std::string& username, const std::string& password) = 0;
    virtual bool registerUser(const std::string& username, const std::string& password, 
                              const std::string& email, const std::string& phone) = 0;
    virtual bool deleteMessage(int msg_id, const std::string& owner_nick) = 0;
    virtual bool editMessage(int msg_id, const std::string& owner_nick, const std::string& new_text) = 0;
    virtual bool markChatAsRead(const std::string &sender_nick, const std::string &receiver_nick) = 0;

    virtual json getChatHistory(const std::string &my_nick, const std::string &other_nick) = 0;
    virtual json getDialogsList(const std::string& my_nick) = 0;
    virtual json searchUsers(const std::string &query) = 0;
};

#endif