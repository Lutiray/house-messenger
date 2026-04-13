cmake_minimum_required(VERSION 3.10)
project(messenger-client)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)
include_directories(external)

add_executable(messenger-client
    src/main.cpp
    src/network/client.cpp
)

target_link_libraries(messenger-client ws2_32)
