#ifndef COMMAND_HANDLER_HPP
#define COMMAND_HANDLER_HPP

#include <string>
#include <map>
#include <functional>
#include "interfaces/interfaces.hpp"

class CommandHandler {
public:
    CommandHandler(IMessageSender& sender, 
                   IUserRegistry& registry, 
                   IDatabaseService& db, 
                   SOCKET sender_sock, 
                   const std::string& sender_name);

    void handle(const std::string& text);

private:
    using CommandAction = std::function<void(const std::string&)>;

    void cmd_whisper(const std::string& target_nick, const std::string& message);
    void reply(const std::string& msg);
    void handle_ping();
    void handle_search(const json &j);
    void handle_typing(const json &j);
    void handle_delete(const json &j);
    void handle_edit(const json &j);
    void handle_mark_read(const json &j);
    void handle_send_message(const json &j);
    void handle_get_history(const json &j);
    void handle_get_dialogs();

    json build_chat_message(const std::string &text, const std::string &target, bool is_private = false, int msg_id = -1);

    IMessageSender& _sender;
    IUserRegistry& _registry;
    IDatabaseService& _db;

    SOCKET _sender_sock;
    std::string _sender_name;
};

#endif