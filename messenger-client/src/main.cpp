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
                std::cout << "{\"type\":\"system\",\"content\":\"Connected to server\"}" << std::endl;
            } else {
                std::cout << "{\"type\":\"system\",\"content\":\"Connection failed\"}" << std::endl;
            }
            continue;
        }
        else if (input.rfind("/reg ", 0) == 0) {
            std::stringstream ss(input.substr(5));
            std::string u, p, email, phone;
            
            ss >> u >> p >> email >> phone; 
            
            if (!u.empty() && !p.empty()) {
                client.registerUser(u, p, email, phone);
            } else {
                std::cout << "{\"type\":\"system\",\"content\":\"Usage: /reg <user> <pass> [email] [phone]\"}" << std::endl;
            }
        } 
        else if (input.rfind("/login ", 0) == 0) {
            std::stringstream ss(input.substr(7));
            std::string u, p;
            if (ss >> u >> p) client.login(u, p);
        }
        else {
            client.sendChatMessage(input);
        }
    }

    client.stop();
    return 0;
}