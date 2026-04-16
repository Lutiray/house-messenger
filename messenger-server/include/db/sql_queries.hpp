#pragma once
 
namespace SQL {
 
// --- DDL: Creating tables and indexes ---
constexpr const char* CREATE_USERS =
    "CREATE TABLE IF NOT EXISTS users ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
    "username TEXT UNIQUE NOT NULL, "
    "password TEXT NOT NULL, "
    "password_salt TEXT NOT NULL DEFAULT '', "
    "email TEXT UNIQUE, "
    "phone TEXT UNIQUE"
    ");";
 
constexpr const char* CREATE_CHANNELS =
    "CREATE TABLE IF NOT EXISTS channels ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
    "is_group INTEGER DEFAULT 0, "
    "name TEXT"
    ");";
 
constexpr const char* CREATE_CHANNEL_MEMBERS =
    "CREATE TABLE IF NOT EXISTS channel_members ("
    "channel_id INTEGER, "
    "user_id INTEGER, "
    "last_read_msg_id INTEGER DEFAULT 0, "
    "PRIMARY KEY (channel_id, user_id), "
    "FOREIGN KEY (channel_id) REFERENCES channels(id), "
    "FOREIGN KEY (user_id) REFERENCES users(id)"
    ");";
 
constexpr const char* CREATE_MESSAGES =
    "CREATE TABLE IF NOT EXISTS messages ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
    "channel_id INTEGER, "
    "sender_id INTEGER, "
    "content TEXT, "
    "is_edited INTEGER DEFAULT 0, "
    "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, "
    "FOREIGN KEY (channel_id) REFERENCES channels(id), "
    "FOREIGN KEY (sender_id) REFERENCES users(id)"
    ");";
 
constexpr const char* CREATE_INDEXES =
    "CREATE INDEX IF NOT EXISTS idx_msg_channel ON messages(channel_id);"
    "CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id);"
    "CREATE INDEX IF NOT EXISTS idx_members_user ON channel_members(user_id);";
 
// --- Users ---
constexpr const char* INSERT_USER =
    "INSERT INTO users (username, password, password_salt, email, phone) "
    "VALUES (?, ?, ?, ?, ?);";
 
constexpr const char* SELECT_USER_AUTH =
    "SELECT password, password_salt FROM users WHERE username = ?;";
 
constexpr const char* SELECT_USER_ID =
    "SELECT id FROM users WHERE username = ?;";
 
constexpr const char* SEARCH_USERS =
    "SELECT username FROM users WHERE username LIKE ? LIMIT 15;";
 
// --- Messengers ---
constexpr const char* INSERT_MESSAGE =
    "INSERT INTO messages (channel_id, sender_id, content) VALUES (?, ?, ?);";
 
constexpr const char* DELETE_MESSAGE =
    "DELETE FROM messages WHERE id = ? AND sender_id = ?;";
 
constexpr const char* EDIT_MESSAGE =
    "UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND sender_id = ?;";

constexpr const char* GET_HISTORY =
    "SELECT * FROM ( "
    "SELECT m.id, u.username, m.content, m.timestamp, "
    "m.is_edited, "
    "CASE WHEN m.id <= ( "
    "SELECT last_read_msg_id FROM channel_members "
    "WHERE channel_id = ? AND user_id = ? "
    ") THEN 1 ELSE 0 END AS is_read "
    "FROM messages m "
    "JOIN users u ON m.sender_id = u.id "
    "WHERE m.channel_id = ? AND (? = 0 OR m.id < ?) "
    "ORDER BY m.timestamp DESC LIMIT 50 "
    ") ORDER BY timestamp ASC;";
 
// --- Dialogs ---
constexpr const char* GET_DIALOGS =
    "SELECT m.id, "
    "(SELECT u2.username FROM channel_members cm2 "
    "JOIN users u2 ON cm2.user_id = u2.id "
    "WHERE cm2.channel_id = c.id AND cm2.user_id != ?) AS chat_name, "
    "m.content, m.timestamp, "
    "m.is_edited, "
    "CASE WHEN m.id <= cm.last_read_msg_id THEN 1 ELSE 0 END AS is_read "
    "FROM channel_members cm "
    "JOIN channels c ON cm.channel_id = c.id "
    "JOIN ("
    "SELECT channel_id, MAX(id) AS last_msg_id "
    "FROM messages GROUP BY channel_id "
    ") latest ON c.id = latest.channel_id "
    "JOIN messages m ON m.id = latest.last_msg_id "
    "WHERE cm.user_id = ? "
    "ORDER BY m.timestamp DESC;";
 
// --- Channels ---
constexpr const char* FIND_DIRECT_CHANNEL =
    "SELECT id FROM channels WHERE name = ? AND is_group = 0;";
 
constexpr const char* INSERT_CHANNEL =
    "INSERT INTO channels (is_group, name) VALUES (0, ?);";
 
constexpr const char* INSERT_CHANNEL_MEMBERS =
    "INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?), (?, ?);";
 
// --- Readed ---
constexpr const char* MARK_READ =
    "UPDATE channel_members SET last_read_msg_id ="
    "(SELECT MAX(id) FROM messages WHERE channel_id = ?) "
    "WHERE channel_id = ? AND user_id = ?;";
 
}