#ifndef DB_MANAGER_HPP
#define DB_MANAGER_HPP

#include "sqlite3.h"
#include <string>
#include <mutex>
#include "interfaces/interfaces.hpp"

class DatabaseManager : public IDatabaseService {
public:
    DatabaseManager(const std::string& db_path);
    ~DatabaseManager();

    bool open();
    bool close();
    bool init();

    json parseMessageRow(sqlite3_stmt *stmt);
    json getDialogsList(const std::string& my_nick) override;
    json getChatHistory(const std::string &my_nick, const std::string &other_nick) override;
    
    bool registerUser(const std::string &username, const std::string &password, 
        const std::string &email, const std::string &phone) override;
    bool checkAuth(const std::string& username, const std::string& password) override;
    bool deleteMessage(int msg_id, const std::string& owner_nick) override;
    bool editMessage(int msg_id, const std::string& owner_nick, const std::string& new_text) override;
    bool markChatAsRead(const std::string &sender_nick, const std::string &receiver_nick) override;
    int getOrCreateDirectChannel(int user1_id, int user2_id);
    json searchUsers(const std::string &query) override;
    int saveMessage(const std::string &sender_nick, const std::string &text, const std::string &receiver_nick) override;
    int getUserId(const std::string& username) override;

private:
    sqlite3* _db;
    std::mutex _db_mutex;
    std::string _path;
    std::string hashPassword(const std::string& password);
    int getUserIdInternal(const std::string &username);
};

#endif