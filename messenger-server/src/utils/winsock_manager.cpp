#include "utils/winsock_manager.hpp"

#ifdef _WIN32
    #include <winsock2.h>
#endif

bool WinSockManager::initialize() {
#ifdef _WIN32
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
#else
    Logger::info("POSIX Sockets ready (Linux/macOS).");
        return true;
#endif
}

void WinSockManager::cleanup() {
#ifdef _WIN32
    WSACleanup();
    Logger::info("WinSock cleaned up (Windows).");
#else
    Logger::info("POSIX Sockets cleaned up (Linux/macOS).");
#endif
}