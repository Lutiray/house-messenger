cmake_minimum_required(VERSION 3.10)
project(messenger-server)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Threads REQUIRED)

include_directories(include)
include_directories(external)

set(SOURCES
    src/main.cpp
    src/network/server.cpp
    src/network/command_handler.cpp
    src/auth/auth_handler.cpp
    src/db/database_manager.cpp
    src/utils/logger.cpp
    src/utils/winsock_manager.cpp
    external/sqlite3.c
)

add_executable(messenger-server ${SOURCES})

if (WIN32)
    target_link_libraries(messenger-server PRIVATE ws2_32)
endif()

target_link_libraries(messenger-server PRIVATE Threads::Threads)

