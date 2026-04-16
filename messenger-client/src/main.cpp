#include "network/client.hpp"
#include <iostream>
#include <string>
#include <sstream>

int main() {
    std::setvbuf(stdout, NULL, _IONBF, 0);

    Client client("127.0.0.1", 8080);

    if (!client.connectToServer()) {
        std::cout << "{\"type\":\"system\",\"content\":\"Failed to connect to server\"}" << std::endl;
        return 1;
    }

    std::string input;
    while (std::getline(std::cin, input)) {
        if (input.empty()) continue;
        if (input == "/exit") break;

        if (input == "/connect") { 
            if (client.connectToServer()) {
                std::cout << "{\"type\":\"system\",\"text\":\"Connected to server\"}" << std::endl;
            } else {
                std::cout << "{\"type\":\"system\",\"text\":\"Connection failed\"}" << std::endl;
            }
            continue;
        }
        
        if (input.rfind("/reg ", 0) == 0) {
            std::stringstream ss(input.substr(5));
            std::string username, password, email, phone;
            
            ss >> username >> password >> email >> phone; 
            
            if (!username.empty() && !password.empty()) {
                client.registerUser(username, password, email, phone);
            } else {
                std::cout << "{\"type\":\"system\",\"text\":\"Usage: /reg <user> <pass> [email] [phone]\"}" << std::endl;
            }
        } 
        
        if (input.rfind("/login ", 0) == 0) {
            std::stringstream ss(input.substr(7));
            std::string username, password;
            if (ss >> username >> password) {
                client.login(username, password);
            } else {
                std::cout << R"({"type":"system","text":"Usage: /login <user> <pass>"})" << std::endl;
            }
            continue;
        }

        if (!input.empty() && input.front() == '{') {
            try {
                client.send_json(nlohmann::json::parse(input));
            } catch (...) {
                std::cerr << "[main] Invalid JSON from stdin: " << input << std::endl;
            }
            continue;
        }

        client.sendChatMessage(input);
    }

    client.stop();
    return 0;
}