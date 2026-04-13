#include "utils/winsock_manager.hpp"

bool WinSockManager::initialize() {
    WSADATA wsaData;
    int result = WSAStartup(MAKEWORD(2, 2), &wsaData);

    if (result != 0) {
        Logger::error("WSAStartup failed", result);
        return false;
    }

    if (LOBYTE(wsaData.wVersion) != 2 || HIBYTE(wsaData.wVersion) != 2) {
        Logger::error("WinSock version 2.2 not available");
        WSACleanup();
        return false;
    }

    Logger::info("WinSock initialized successfully.");
    return true;
}

void WinSockManager::cleanup() {
    WSACleanup();
    Logger::info("WinSock cleaned up.");
}