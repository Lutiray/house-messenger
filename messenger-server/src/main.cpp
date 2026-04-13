#include "network/server.hpp"
#include "db/database_manager.hpp"
#include <iostream>
#include "network/file_server.hpp"
#include <thread>

int main()
{
    DatabaseManager db("messenger.db");

    if (db.open()){
        std::cout << "Database opened successfully!" << std::endl;
        if (db.init()) {
            std::cout << "Tables initialized." << std::endl;
        }
    } else {
        return (-1);
    }

    std::thread file_thread([]() {
        FileServer::start(8081);
    });
    file_thread.detach();

    Server myServer(8080, db);

    myServer.start();

    return (0);
}