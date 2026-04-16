#include "db/database_manager.hpp"
#include "db/sql_queries.hpp"
#include "db/stmt_guard.hpp"
#include "utils/logger.hpp"
#include "picosha2.h"
#include <chrono>
#include <random>
#include <iomanip>
#include <sstream>

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

    sqlite3_exec(_db, "PRAGMA journal_mode=WAL;",    nullptr, nullptr, nullptr);
    sqlite3_exec(_db, "PRAGMA foreign_keys = ON;",   nullptr, nullptr, nullptr);
    sqlite3_exec(_db, "PRAGMA synchronous = NORMAL;", nullptr, nullptr, nullptr);
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

    int current_version = 0;
    {
        StmtGuard stmt;
        if (sqlite3_prepare_v2(_db, "PRAGMA user_version;", -1, stmt.ptr(), nullptr) == SQLITE_OK) {
            if (stmt.step() == SQLITE_ROW) {
                current_version = sqlite3_column_int(stmt, 0);
            }
        }
    }

    if (current_version >= 3) return true;
    Logger::info("Migrating database to version 3...");
 
    const char* migrations[] = {
        SQL::CREATE_USERS,
        SQL::CREATE_CHANNELS,
        SQL::CREATE_CHANNEL_MEMBERS,
        SQL::CREATE_MESSAGES,
        SQL::CREATE_INDEXES
    };

    char* errMsg = nullptr;
    for (const char* sql : migrations) {
        if (sqlite3_exec(_db, sql, nullptr, nullptr, &errMsg) != SQLITE_OK) {
            Logger::error("SQL Init Error: " + std::string(errMsg));
            sqlite3_free(errMsg);
            return false;
        }
    }
    sqlite3_exec(_db, "PRAGMA user_version = 3;", nullptr, nullptr, nullptr);
    return true;
}

json DatabaseManager::parseMessageRow(sqlite3_stmt* stmt) {
    json m;
    m["id"] = sqlite3_column_int(stmt, 0);

    const char* nameOrSender = (const char*)sqlite3_column_text(stmt, 1);
    const char* text = (const char*)sqlite3_column_text(stmt, 2);
    const char* time = (const char*)sqlite3_column_text(stmt, 3);

    m["from"] = nameOrSender ? nameOrSender : "Unknown";
    m["text"] = text ? text : "";
    m["time"] = time ? time : "";
    m["is_edited"] = sqlite3_column_int(stmt, 4);
    m["is_read"] = sqlite3_column_int(stmt, 5);
    return m;
}

std::string DatabaseManager::generateSalt() {
    auto seed = std::chrono::high_resolution_clock::now().time_since_epoch().count();
    std::mt19937_64 rng(seed ^ reinterpret_cast<uint64_t>(this));
    std::ostringstream ss;
    ss << std::hex << rng() << rng();
    return ss.str().substr(0, 16);
}

std::string DatabaseManager::hashPassword(const std::string& password, const std::string& salt) {
    return picosha2::hash256_hex_string(salt + password);
}

bool DatabaseManager::registerUser(const std::string& username, const std::string& password,
                                const std::string& email, const std::string& phone) {
    std::lock_guard<std::mutex> lock(_db_mutex);

    std::string salt = generateSalt();
    std::string hashed = hashPassword(password, salt);

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::INSERT_USER, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return false;

    sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 2, hashed.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, salt.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 4, email.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 5, phone.c_str(), -1, SQLITE_STATIC);

    return stmt.step() == SQLITE_DONE;
}

bool DatabaseManager::checkAuth(const std::string& username, const std::string& password) {
    std::lock_guard<std::mutex> lock(_db_mutex);

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::SELECT_USER_AUTH, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return false;

    sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_STATIC);
    if (stmt.step() != SQLITE_ROW) return false;
            
    const char* stored_hash = (const char*)sqlite3_column_text(stmt, 0);
    const char* stored_salt = (const char*)sqlite3_column_text(stmt, 1);
    if (!stored_hash || !stored_salt) return false;

    return hashPassword(password, std::string(stored_salt)) == std::string(stored_hash);
}

int DatabaseManager::getUserIdInternal(const std::string& username) {
    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::SELECT_USER_ID, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return -1;
    sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_STATIC);
    return (stmt.step() == SQLITE_ROW) ? sqlite3_column_int(stmt, 0) : -1;
}

int DatabaseManager::getUserId(const std::string& username) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    return getUserIdInternal(username);
}

int DatabaseManager::saveMessage(const std::string& sender_nick, const std::string& content,
                                 const std::string& receiver_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);
 
    int sender_id   = getUserIdInternal(sender_nick);
    int receiver_id = getUserIdInternal(receiver_nick);
    if (sender_id == -1 || receiver_id == -1) return -1;
 
    int channel_id = getOrCreateDirectChannel(sender_id, receiver_id);
 
    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::INSERT_MESSAGE, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return -1;
 
    sqlite3_bind_int (stmt, 1, channel_id);
    sqlite3_bind_int (stmt, 2, sender_id);
    sqlite3_bind_text(stmt, 3, content.c_str(), -1, SQLITE_STATIC);
 
    if (stmt.step() != SQLITE_DONE) return -1;
    return (int)sqlite3_last_insert_rowid(_db);
}

bool DatabaseManager::deleteMessage(int msg_id, const std::string& owner_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    int owner_id = getUserIdInternal(owner_nick);
    if (owner_id == -1) return false;

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::DELETE_MESSAGE, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return false;

    sqlite3_bind_int(stmt, 1, msg_id);
    sqlite3_bind_int(stmt, 2, owner_id);
    return stmt.step() == SQLITE_DONE;
}

bool DatabaseManager::editMessage(int msg_id, const std::string& owner_nick, const std::string& new_text) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    int owner_id = getUserIdInternal(owner_nick);
    if (owner_id == -1) return false;

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::EDIT_MESSAGE, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return false;

    sqlite3_bind_text(stmt, 1, new_text.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_int(stmt, 2, msg_id);
    sqlite3_bind_int(stmt, 3, owner_id);
    return stmt.step() == SQLITE_DONE;
}

json DatabaseManager::getDialogsList(const std::string& my_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    json dialogs = json::array();

    int my_id = getUserIdInternal(my_nick);
    if (my_id == -1) return {{"type", "dialogs_list"}, {"data", dialogs}};

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::GET_DIALOGS, -1, stmt.ptr(), nullptr) != SQLITE_OK) {
        Logger::error("GET_DIALOGS SQL Error: " + std::string(sqlite3_errmsg(_db)));    
        return {{"type", "dialogs_list"}, {"data", dialogs}};
}

    sqlite3_bind_int(stmt, 1, my_id);
    sqlite3_bind_int(stmt, 2, my_id);
        
    while (stmt.step() == SQLITE_ROW) {
        dialogs.push_back(parseMessageRow(stmt));
    }

    return {{"type", "dialogs_list"}, {"data", dialogs}};
}

json DatabaseManager::getChatHistory(const std::string& my_nick, const std::string& other_nick, int before_id) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    json data = json::array();

    int my_id = getUserIdInternal(my_nick);
    int other_id = getUserIdInternal(other_nick);
    if (my_id == -1 || other_id == -1) return {{"type", "history"}, {"data", data}};

    int channel_id = getOrCreateDirectChannel(my_id, other_id);

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::GET_HISTORY, -1, stmt.ptr(), nullptr) != SQLITE_OK) {
        Logger::error("GET_HISTORY SQL Error: " + std::string(sqlite3_errmsg(_db)));
        return {{"type", "history"}, {"data", data}};
    }

    sqlite3_bind_int(stmt, 1, channel_id);
    sqlite3_bind_int(stmt, 2, my_id);
    sqlite3_bind_int(stmt, 3, channel_id);
    sqlite3_bind_int(stmt, 4, before_id);
    sqlite3_bind_int(stmt, 5, before_id);
 
    while (stmt.step() == SQLITE_ROW)
        data.push_back(parseMessageRow(stmt));
 
    return {{"type", "history"}, {"data", data}, {"chat_with", other_nick}};
}

int DatabaseManager::findDirectChannel(int user1_id, int user2_id) {
    int min_id = (((user1_id < user2_id)) ? user1_id : user2_id);
    int max_id = (((user1_id > user2_id)) ? user1_id : user2_id);
    std::string name = "dm_" + std::to_string(min_id) + "_" + std::to_string(max_id);
 
    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::FIND_DIRECT_CHANNEL, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return -1;
 
    sqlite3_bind_text(stmt, 1, name.c_str(), -1, SQLITE_STATIC);
    return (stmt.step() == SQLITE_ROW) ? sqlite3_column_int(stmt, 0) : -1;
}

bool DatabaseManager:: markChatAsRead(const std::string& sender_nick, const std::string& receiver_nick) {
    std::lock_guard<std::mutex> lock(_db_mutex);

    int sender_id = getUserIdInternal(sender_nick);
    int receiver_id = getUserIdInternal(receiver_nick);
    if (sender_id == -1 || receiver_id == -1) return false;

    int channel_id = getOrCreateDirectChannel(sender_id, receiver_id);

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::MARK_READ, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return false;

    sqlite3_bind_int(stmt, 1, channel_id);
    sqlite3_bind_int(stmt, 2, channel_id);
    sqlite3_bind_int(stmt, 3, receiver_id);
    return stmt.step() == SQLITE_DONE;
}

int DatabaseManager::getOrCreateDirectChannel(int user1_id, int user2_id) {
    int existing = findDirectChannel(user1_id, user2_id);
    if (existing != -1) return existing;
    
    int min_id = (((user1_id < user2_id)) ? user1_id : user2_id);
    int max_id = (((user1_id > user2_id)) ? user1_id : user2_id);
    std::string name = "dm_" + std::to_string(min_id) + "_" + std::to_string(max_id);

    {
        StmtGuard stmt;
        if (sqlite3_prepare_v2(_db, SQL::INSERT_CHANNEL, -1, stmt.ptr(), nullptr) == SQLITE_OK) {
            sqlite3_bind_text(stmt, 1, name.c_str(), -1, SQLITE_STATIC);
            stmt.step();
        }
    }
    int new_id = (int)sqlite3_last_insert_rowid(_db);
 
    {
        StmtGuard stmt;
        if (sqlite3_prepare_v2(_db, SQL::INSERT_CHANNEL_MEMBERS, -1, stmt.ptr(), nullptr) == SQLITE_OK) {
            sqlite3_bind_int(stmt, 1, new_id);
            sqlite3_bind_int(stmt, 2, user1_id);
            sqlite3_bind_int(stmt, 3, new_id);
            sqlite3_bind_int(stmt, 4, user2_id);
            stmt.step();
        }
    }
    return new_id;
}

json DatabaseManager::searchUsers(const std::string& query) {
    std::lock_guard<std::mutex> lock(_db_mutex);
    json users = json::array();

    StmtGuard stmt;
    if (sqlite3_prepare_v2(_db, SQL::SEARCH_USERS, -1, stmt.ptr(), nullptr) != SQLITE_OK)
        return {{"type", "search_results"}, {"users", users}};
 
    std::string like_query = query + "%";
    sqlite3_bind_text(stmt, 1, like_query.c_str(), -1, SQLITE_STATIC);
 
    while (stmt.step() == SQLITE_ROW) {
        const char* name = (const char*)sqlite3_column_text(stmt, 0);
        if (name) users.push_back(name);
    }
 
    return {{"type", "search_results"}, {"users", users}};
}


