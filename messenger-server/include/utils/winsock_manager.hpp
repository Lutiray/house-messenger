#ifndef WINSOCK_MANAGER_HPP
#define WINSOCK_MANAGER_HPP

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <string>
#include "utils/logger.hpp"

class WinSockManager {
public:
    static bool initialize();
    static void cleanup();

private:
    WinSockManager() = delete;
};

#endif