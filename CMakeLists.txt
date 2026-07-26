cmake_minimum_required(VERSION 3.15)
project(DesktopMessenger VERSION 1.0.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/bin)

message(STATUS "Configuring Desktop Messenger Monorepo...")

add_subdirectory(messenger-server)
add_subdirectory(messenger-client)

message(STATUS "Build targets 'messenger-server' and 'messenger-client' added successfully.")