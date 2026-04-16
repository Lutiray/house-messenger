#include "network/command_handler.hpp"
#include "utils/string_utils.hpp" 
#include "utils/logger.hpp"

using json = nlohmann::json;

CommandHandler::CommandHandler(IMessageSender& sender, 
                               IUserRegistry& registry, 
                               IDatabaseService& db, 
                               SOCKET sender_sock, 
                               const std::string& sender_name)
    : _sender(sender), _registry(registry), _db(db), 
      _sender_sock(sender_sock), _sender_name(sender_name) {}


void CommandHandler::reply(const std::string& msg) {
    _sender.send_json(_sender_sock, {{"type", "system"}, {"text", msg}});
}

json CommandHandler::build_chat_message(const std::string& text, const std::string& target, bool is_private, int msg_id) {
    json j = {
        {"type", "chat_msg"},
        {"id", msg_id},
        {"from", _sender_name},
        {"text", text},
        {"is_private", is_private},
        {"timestamp", "now"}
    };
    if (is_private && !target.empty()) {
        j["to"] = target;
    }
    return (j);
}

void CommandHandler::handle(const std::string& raw){
    std::string text = StringUtils::trim(raw);
    if (text.empty()) return;

    if (text.front() != '{') {
        reply("Server accepts only JSON packets. Please update your client.");
        return;
    }
        
    try {
        auto j = json::parse(text);
        std::string type = j.value("type", "");

        if (type == "ping") { handle_ping(); }
        else if (type == "search_user") { handle_search(j); }
        else if (type == "typing") { handle_typing(j); }
        else if (type == "delete_msg") { handle_delete(j); }
        else if (type == "edit_msg") { handle_edit(j); }
        else if (type == "mark_read") { handle_mark_read(j); }
        else if (type == "send_msg") { handle_send_message(j); }
        else if (type == "get_history") { handle_get_history(j); }
        else if (type == "get_dialogs") { handle_get_dialogs(); }
        else {
            Logger::debug("Unknown packet type from " + _sender_name + ": " + type);
        }
    } catch (const json::exception& e){
        Logger::error("JSON parse error from " + _sender_name + ": " + e.what());
    }
}

void CommandHandler::handle_ping() {
    _sender.send_json(_sender_sock, {{"type", "pong"}});
}

void CommandHandler::handle_search(const json& j) {
     std::string query = j.value("query", "");
    if (!query.empty() && query.front() == '@') {
        query = query.substr(1);
    }
    if (!query.empty()) {
        _sender.send_json(_sender_sock, _db.searchUsers(query));
    }
}

void CommandHandler::handle_typing(const json& j) {
    std::string target = j.value("to", "");
    SOCKET target_sock = _registry.find_socket_by_nick(target);
    if (target_sock != INVALID_SOCKET) {
        _sender.send_json(target_sock, {{"type", "typing"}, {"from", _sender_name}});
    }            
}

void CommandHandler::handle_delete(const json& j) {
    int msg_id = j.value("id", -1);
    if (msg_id != -1 && _db.deleteMessage(msg_id, _sender_name)) {
        _sender.broadcast_message({{"type", "msg_deleted"}, {"id", msg_id}}, INVALID_SOCKET);
    }
}

void CommandHandler::handle_edit(const json& j) {
    int msg_id = j.value("id", -1);
    std::string new_text = j.value("text", "");
    if (msg_id != -1 && !new_text.empty() && _db.editMessage(msg_id, _sender_name, new_text)) {
        _sender.broadcast_message({{"type", "msg_edited"}, {"id", msg_id}, {"text", new_text}}, INVALID_SOCKET);
    }
}

void CommandHandler::handle_mark_read(const json& j) {
    std::string from_user = j.value("from", "");
    if (from_user.empty()) return;

    if (_db.markChatAsRead(from_user, _sender_name)) {
        SOCKET target_sock = _registry.find_socket_by_nick(from_user);
        if (target_sock != INVALID_SOCKET) {
            _sender.send_json(target_sock, {{"type", "msg_read"}, {"by", _sender_name}});
        }
    }
}

void CommandHandler::handle_send_message(const json& j) {
    std::string target = j.value("to", "");
    std::string content = j.value("content", "");

    if (target.empty() || target == "general") {
        reply("General chat is temporarily disabled.");
        return;
    }
    if (content.empty()) return;

    cmd_whisper(target, content);
}

void CommandHandler::handle_get_history(const json& j) {
    std::string target_user = j.value("user", "");
    
    int before_id = j.value("before_id", 0); 

    if (target_user.empty()) {
        Logger::error("handle_get_history: target_user is empty");
        return;
    }

    json history = _db.getChatHistory(_sender_name, target_user, before_id);
    _sender.send_json(_sender_sock, history);
}

void CommandHandler::handle_get_dialogs() {
    _sender.send_json(_sender_sock, _db.getDialogsList(_sender_name));
}

void CommandHandler::cmd_whisper(const std::string& target_nick, const std::string& message){
    if (_db.getUserId(target_nick) == -1) {
        reply("User '" + target_nick + "' not found.");
        return;
    }

    int new_id = _db.saveMessage(_sender_name, message, target_nick);
    json msg = build_chat_message(message, target_nick, true, new_id);

    if (target_nick == _sender_name) {
        msg["is_saved"] = true;
        _sender.send_json(_sender_sock, msg);
        return;
    }

    SOCKET target_sock = _registry.find_socket_by_nick(target_nick);
    if (target_sock != INVALID_SOCKET) {
        _sender.send_json(target_sock, msg);
        _sender.send_json(target_sock, _db.getDialogsList(target_nick));
    } else {
        Logger::debug("User " + target_nick + " is offline, message saved to DB.");
    }
    _sender.send_json(_sender_sock, msg);
}

