#include "db/database_manager.hpp"
#include "utils/logger.hpp"
#include <chrono>

using json = nlohmann::json;

DatabaseManager::DatabaseManager(const std::string& _path) : _path(_path), _db(nullptr) {}

DatabaseManager::~DatabaseManager() {
    close();
}

bool DatabaseManager::open() {
    std::lock_guard<std::mutex> lock(_db_mutex);
    if (sqlite3_open(_path.c_str(), &_db) != SQLITE_OK) {
        Logger::error("Cant't open database: " + std::string(sqlite3_errmsg(_db)));
        return (false);
    }
    sqlite3_exec(_db, "PRAGMA foreign_keys = ON;", nullptr, nullptr, nullptr);
    return true;
}

bool DatabaseManager::close() {
    std::lock_guard<std::mutex> lock(_db_mutex);
    if (_db) {
        sqlite3_close(_db);
        _db = nullptr;
    }
    return (true);
}

bool DatabaseManager::init() {
    std::lock_guard<std::mutex> lock(_db_mutex);
    char* errMsg = nullptr;

    int current_version = 0;
    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(_db, "PRAGMA user_version;", -1, &stmt, nullptr) == SQLITE_OK) {
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            current_version = sqlite3_column_int(stmt, 0);
        }
        sqlite3_finalize(stmt);
    }

    if (current_version < 2) {
        Logger::info("Migrating database to version 2 (Channel Architecture)...");

        const char* users_sql = "CREATE TABLE IF NOT EXISTS users ("
                                "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                                "username TEXT UNIQUE NOT NULL,"
                                "password TEXT NOT NULL,"
                                "email TEXT UNIQUE,"         
                                "phone TEXT UNIQUE"          
                                ");";

        const char* channels_sql = "CREATE TABLE IF NOT EXISTS channels ("
                                   "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                                   "is_group INTEGER DEFAULT 0,"
                                   "name TEXT"
                                   ");";
        
        const char* members_sql = "CREATE TABLE IF NOT EXISTS channel_members ("
                                  "channel_id INTEGER,"
                                  "user_id INTEGER,"
                                  "last_read_msg_id INTEGER DEFAULT 0,"
                                  "PRIMARY KEY(channel_id, user_id),"
                                  "FOREIGN KEY(channel_id) REFERENCES channels(id),"
                                  "FOREIGN KEY(user_id) REFERENCES users(id)"
                                  ");";
        
        const char* msgs_sql = "CREATE TABLE IF NOT EXISTS messages ("
                               "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                               "channel_id INTEGER,"
                               "sender_id INTEGER,"
                               "content TEXT,"
                               "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,"
                               "FOREIGN KEY(channel_id) REFERENCES channels(id),"
                               "FOREIGN KEY(sender_id) REFERENCES users(id)"
                               ");";
        
        if (sqlite3_exec(_db, users_sql, nullptr, nullptr, &errMsg) != SQLITE_OK ||
            sqlite3_exec(_db, channels_sql, nullptr, nullptr, &errMsg) != SQLITE_OK ||
            sqlite3_exec(_db, members_sql, nullptr, nullptr, &errMsg) != SQLITE_OK ||
            sqlite3_exec(_db, msgs_sql, nullptr, nullptr, &errMsg) != SQLITE_OK) {
            Logger::error("SQL Init Error: " + std::string(errMsg)); 
            sqlite3_free(errMsg);
            return (false);
        }
        sqlite3_exec(_db, "PRAGMA user_version = 2;", nullptr, nullptr, nullptr);
    }
    return (true);
}

json DatabaseManager::parseMessageRow(sqlite3_stmt* stmt) {
    json m;
    m["id"] = sqlite3_column_int(stmt, 0);

    const char* user = (const char*)sqlite3_column_text(stmt, 1);
    const char* text = (const char*)sqlite3_column_text(stmt, 2);
    const char* time = (const char*)sqlite3_column_text(stmt, 3);

    m["from"] = user ? user : "Unknown";
    m["text"] = text ? text : "";
    m["time"] = time ? time : "";
    m["is_read"] = sqlite3_column_int(stmt, 4);

    return m;
}

bool DatabaseManager::registerUser(const std::string& username, const std::string& password,
                                const std::string& email, const std::string& phone) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    std::string hashedPassword = hashPassword(password);

    const char* sql = "INSERT INTO users (username, password, email, phone) VALUES (?, ?, ?, ?);";
    sqlite3_stmt* stmt;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return (false);
    }

    sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 2, hashedPassword.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, email.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 4, phone.c_str(), -1, SQLITE_STATIC);

    bool success = (sqlite3_step(stmt) == SQLITE_DONE);
    sqlite3_finalize(stmt);
    return (success);
}

bool DatabaseManager::checkAuth(const std::string& username, const std::string& password) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    std::string hashedPassword = hashPassword(password);

    const char* sql = "SELECT password FROM users WHERE username = ?;";
    sqlite3_stmt* stmt;
    bool authenticated = false;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_STATIC);
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            const char* stored_hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            if (stored_hash) {
                authenticated = (stored_hash == hashedPassword);
            }
        }
    }
    sqlite3_finalize(stmt);
    return (authenticated);
}

int DatabaseManager::getUserIdInternal(const std::string& username) {
    const char* sql = "SELECT id FROM users WHERE username = ?;";
    sqlite3_stmt* stmt;
    int id = -1;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_STATIC);
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            id = sqlite3_column_int(stmt, 0);
        }
    }
    sqlite3_finalize(stmt);
    return (id);
}

int DatabaseManager::getUserId(const std::string& username) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    return (getUserIdInternal(username));
}

int DatabaseManager::saveMessage(const std::string& sender_nick, const std::string& content, const std::string& receiver_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);

    int sender_id = getUserIdInternal(sender_nick);
    if (sender_id == -1) return -1;

    int channel_id = 0;
    if (!receiver_nick.empty()) {
        int receiver_id = getUserIdInternal(receiver_nick);
        if (receiver_id == -1) return -1; 
        channel_id = getOrCreateDirectChannel(sender_id, receiver_id);
    } else return -1;

    const char* sql = "INSERT INTO messages (channel_id, sender_id, content) VALUES (?, ?, ?);";
    sqlite3_stmt* stmt;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) != SQLITE_OK) return (false);

    sqlite3_bind_int(stmt, 1, channel_id);
    sqlite3_bind_int(stmt, 2, sender_id);
    sqlite3_bind_text(stmt, 3, content.c_str(), -1, SQLITE_STATIC);
    
    int new_msg_id = -1;
    if (sqlite3_step(stmt) == SQLITE_DONE) {
        new_msg_id = (int)sqlite3_last_insert_rowid(_db);
    }
    sqlite3_finalize(stmt);
    return new_msg_id;
}

std::string DatabaseManager::hashPassword(const std::string& password) {
    std::string salt = "super_secret_salt_123";
    std::string salted_pass = password + salt;
    
    size_t h1 = std::hash<std::string>{}(salted_pass);
    size_t h2 = std::hash<std::string>{}(salted_pass + "pepper");
    
    std::stringstream ss;
    ss << std::hex << h1 << h2;
    return ss.str();
}

json DatabaseManager::getDialogsList(const std::string& my_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    json dialogs = json::array();
    int my_id = getUserIdInternal(my_nick);

    if (my_id == -1) return {{"type", "dialogs_list"}, {"data", dialogs}};

    const char* sql = "SELECT m.id, "
                      "  (SELECT u2.username FROM channel_members cm2 JOIN users u2 ON cm2.user_id = u2.id WHERE cm2.channel_id = c.id AND cm2.user_id != ?) as chat_name, "
                      "  m.content, m.timestamp, "
                      "  CASE WHEN m.id <= cm.last_read_msg_id THEN 1 ELSE 0 END as is_read "
                      "FROM channel_members cm "
                      "JOIN channels c ON cm.channel_id = c.id "
                      "JOIN ("
                      "  SELECT channel_id, MAX(id) as last_msg_id "
                      "  FROM messages GROUP BY channel_id"
                      ") latest ON c.id = latest.channel_id "
                      "JOIN messages m ON m.id = latest.last_msg_id "
                      "WHERE cm.user_id = ? "
                      "ORDER BY m.timestamp DESC;";
    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_int(stmt, 1, my_id);
        sqlite3_bind_int(stmt, 2, my_id);
        
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            dialogs.push_back(parseMessageRow(stmt));
        }
    }
    sqlite3_finalize(stmt);

    return {{"type", "dialogs_list"}, {"data", dialogs}};
}

json DatabaseManager::getChatHistory(const std::string& my_nick, const std::string& other_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    json data = json::array();

    int my_id = getUserIdInternal(my_nick);
    int other_id = getUserIdInternal(other_nick);
    if (my_id == -1 || other_id == -1) return {{"type", "history"}, {"data", data}};

    int channel_id = getOrCreateDirectChannel(my_id, other_id);

    const char* sql = "SELECT m.id, u.username, m.content, m.timestamp, "
                      "  CASE WHEN m.id <= (SELECT last_read_msg_id FROM channel_members WHERE channel_id = ? AND user_id = ?) THEN 1 ELSE 0 END as is_read "
                      "FROM messages m JOIN users u ON m.sender_id = u.id "
                      "WHERE m.channel_id = ? "
                      "ORDER BY m.timestamp ASC LIMIT 100;";
    
    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_int(stmt, 1, channel_id);
        sqlite3_bind_int(stmt, 2, other_id);
        sqlite3_bind_int(stmt, 3, channel_id);
        
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            data.push_back(parseMessageRow(stmt));
        }
    }
    sqlite3_finalize(stmt);
    
    return {{"type", "history"}, {"data", data}, {"chat_with", other_nick}};
}

bool DatabaseManager::deleteMessage(int msg_id, const std::string& owner_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    int owner_id = getUserIdInternal(owner_nick);
    if (owner_id == -1) return false;

    const char* sql = "DELETE FROM messages WHERE id = ? AND sender_id = ?;";
    sqlite3_stmt* stmt;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;

    sqlite3_bind_int(stmt, 1, msg_id);
    sqlite3_bind_int(stmt, 2, owner_id);

    bool success = (sqlite3_step(stmt) == SQLITE_DONE);
    sqlite3_finalize(stmt);
    return success;
}

bool DatabaseManager::editMessage(int msg_id, const std::string& owner_nick, const std::string& new_text) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    int owner_id = getUserIdInternal(owner_nick);
    if (owner_id == -1) return false;

    const char* sql = "UPDATE messages SET content = ? WHERE id = ? AND sender_id = ?;";
    sqlite3_stmt* stmt;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;
    
    sqlite3_bind_text(stmt, 1, new_text.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_int(stmt, 2, msg_id);
    sqlite3_bind_int(stmt, 3, owner_id);
    
    bool success = (sqlite3_step(stmt) == SQLITE_DONE);
    sqlite3_finalize(stmt);
    return success;
}

bool DatabaseManager:: markChatAsRead(const std::string& sender_nick, const std::string& receiver_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    int sender_id = getUserIdInternal(sender_nick);
    int receiver_id = getUserIdInternal(receiver_nick);
    if (sender_id == -1 || receiver_id == -1) return false;

    int channel_id = getOrCreateDirectChannel(sender_id, receiver_id);
   const char* sql = "UPDATE channel_members SET last_read_msg_id = "
                      "(SELECT MAX(id) FROM messages WHERE channel_id = ?) "
                      "WHERE channel_id = ? AND user_id = ?;";
    sqlite3_stmt* stmt;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;

    sqlite3_bind_int(stmt, 1, channel_id);
    sqlite3_bind_int(stmt, 2, channel_id);
    sqlite3_bind_int(stmt, 3, receiver_id);

    bool success = (sqlite3_step(stmt) == SQLITE_DONE);
    sqlite3_finalize(stmt);
    return success;
}

int DatabaseManager::getOrCreateDirectChannel(int user1_id, int user2_id) {
    int  min_id = (user1_id < user2_id) ? user1_id : user2_id;
    int max_id = (user1_id > user2_id) ? user1_id : user2_id;
    std::string dm_name = "dm_" + std::to_string(min_id) + "_" + std::to_string(max_id);

    const char* find_sql = "SELECT id FROM channels WHERE name = ? AND is_group = 0;";
    sqlite3_stmt* stmt;
    if (sqlite3_prepare_v2(_db, find_sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, dm_name.c_str(), -1, SQLITE_STATIC);
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            int chan_id = sqlite3_column_int(stmt, 0);
            sqlite3_finalize(stmt);
            return chan_id;
        }
    }
    sqlite3_finalize(stmt);

    const char* insert_chan = "INSERT INTO channels (is_group, name) VALUES (0, ?);";
    if (sqlite3_prepare_v2(_db, insert_chan, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, dm_name.c_str(), -1, SQLITE_STATIC);
        sqlite3_step(stmt);
    }
    int new_chan_id = (int)sqlite3_last_insert_rowid(_db);
    sqlite3_finalize(stmt);

    const char* insert_members = "INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?), (?, ?);";
    if (sqlite3_prepare_v2(_db, insert_members, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_int(stmt, 1, new_chan_id);
        sqlite3_bind_int(stmt, 2, user1_id);
        sqlite3_bind_int(stmt, 3, new_chan_id);
        sqlite3_bind_int(stmt, 4, user2_id);
        sqlite3_step(stmt);
    }
    sqlite3_finalize(stmt);

    return new_chan_id;
}

json DatabaseManager::searchUsers(const std::string& query) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    json users = json::array();

    const char* sql = "SELECT username FROM users WHERE username LIKE ? LIMIT 15;";
    sqlite3_stmt* stmt;

    if (sqlite3_prepare_v2(_db, sql, -1, &stmt, nullptr) == SQLITE_OK) {
        std::string like_query = query + "%";
        sqlite3_bind_text(stmt, 1, like_query.c_str(), -1, SQLITE_STATIC);

        while (sqlite3_step(stmt) == SQLITE_ROW) {
            const char* name = (const char*)sqlite3_column_text(stmt, 0);
            if (name) {
                users.push_back(name);
            }
        }
    }
    sqlite3_finalize(stmt);

    return {{"type", "search_results"}, {"users", users}};
}
