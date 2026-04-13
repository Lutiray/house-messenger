#include "network/command_handler.hpp"
#include <sstream>
#include "utils/logger.hpp"

using json = nlohmann::json;

CommandHandler::CommandHandler(IMessageSender& sender, 
                               IUserRegistry& registry, 
                               IDatabaseService& db, 
                               SOCKET sender_sock, 
                               const std::string& sender_name)
    : _sender(sender), _registry(registry), _db(db), 
      _sender_sock(sender_sock), _sender_name(sender_name) {}

std::string CommandHandler::trim(const std::string& str) {
    size_t first = str.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return ("");
    size_t last = str.find_last_not_of(" \t\r\n");
    return (str.substr(first, (last - first + 1)));
}

void CommandHandler::reply(const std::string& msg) {
    _sender.send_json(_sender_sock, {{"type", "system"}, {"content", msg}});
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

void CommandHandler::handle(const std::string& text){
    std::string clean_text = trim(text);
    if (clean_text.empty()) return;

    if (clean_text[0] == '{') {
        try {
            auto j = json::parse(clean_text);
            std::string type = j.value("type", "");

            if (type == "ping") {
                _sender.send_json(_sender_sock, {{"type", "pong"}});
            }
            else if (type == "search_user") {
                std::string query = j.value("query", "");

                if (!query.empty() && query[0] == '@') {
                    query = query.substr(1);
                }

                if (!query.empty()) {
                    json result = _db.searchUsers(query);
                    _sender.send_json(_sender_sock, result);
                }
            }
            else if (type == "typing") {
                std::string target = j.value("to", "");
                SOCKET target_sock = _registry.find_socket_by_nick(target);
                if (target_sock != INVALID_SOCKET) {
                    json typing_alert = {{"type", "typing"}, {"from", _sender_name}};
                    _sender.send_json(target_sock, typing_alert);
                }
            }
            else if (type == "delete_msg") {
                int msg_id = j.value("id", -1);
                if (msg_id != -1 && _db.deleteMessage(msg_id, _sender_name)) {
                    json reply = {{"type", "msg_deleted"}, {"id", msg_id}};
                    _sender.broadcast_message(reply, INVALID_SOCKET);
                }
            }
            else if (type == "edit_msg") {
                int msg_id = j.value("id", -1);
                std::string new_text = j.value("text", "");
                if (msg_id != -1 && !new_text.empty() && _db.editMessage(msg_id, _sender_name, new_text)) {
                    json reply = {{"type", "msg_edited"}, {"id", msg_id}, {"text", new_text}};
                    _sender.broadcast_message(reply, INVALID_SOCKET);
                }
            }
            else if (type == "mark_read") {
                std::string from_user = j.value("from", "");
                if (!from_user.empty()) {
                    if (_db.markChatAsRead(from_user, _sender_name)) {
                        
                        SOCKET target_sock = _registry.find_socket_by_nick(from_user);
                        if (target_sock != INVALID_SOCKET) {
                            json reply = {
                                {"type", "msgs_read"}, 
                                {"by", _sender_name}
                            };
                            _sender.send_json(target_sock, reply);
                        }
                    }
                }
            }
            else if (type == "send_msg") {
                std::string target = j.value("to", "");
                std::string content = j.value("content", "");

                if (target.empty() || target == "general") {
                    reply("[System] General chat is temporarily disabled while we upgrade to channels.");
                } else {
                    cmd_whisper(target, content);
                }
            }
            else if (type == "get_history") {
                std::string target_user = j.value("user", "");
                if(!target_user.empty()) {
                    json history_data = _db.getChatHistory(_sender_name, target_user);
                    _sender.send_json(_sender_sock, history_data);
                }
            }
        } catch (const json::exception& e){
            Logger::error("JSON parse error from " + _sender_name + ": " + e.what());
        }
    } else {
        reply("[System] Server now accepts only JSON packets. Please update your client.");
    }
}

void CommandHandler::cmd_whisper(const std::string& target_nick, const std::string& message){
    if (_db.getUserId(target_nick) == -1) {
        reply("[Server] User '" + target_nick + "' not found in database.");
        return;
    }
    int new_id = _db.saveMessage(_sender_name, message, target_nick);

    json j = build_chat_message(message, target_nick, true, new_id);

    if (target_nick == _sender_name) {
        j["is_saved"] = true;
        _sender.send_json(_sender_sock, j);
        return;
    }

    SOCKET target_sock = _registry.find_socket_by_nick(target_nick);
    if (target_sock != INVALID_SOCKET) {
        _sender.send_json(target_sock, j);
    } else {
        Logger::debug("User " + target_nick + " is offline. Message cached in DB.");
    }
    _sender.send_json(_sender_sock, j);
}

