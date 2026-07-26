cmake_minimum_required(VERSION 3.15)
project(MessengerClient VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
    set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/bin)
endif()

file(GLOB_RECURSE CLIENT_SOURCES "src/*.cpp")

add_executable(messenger-client ${CLIENT_SOURCES})

target_include_directories(messenger-client PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/external
)

if (WIN32)
    target_link_libraries(messenger-client PRIVATE ws2_32)
else()
    find_package(Threads REQUIRED)
    target_link_libraries(messenger-client PRIVATE Threads::Threads)
endif()

if (MSVC)
    target_compile_options(messenger-client PRIVATE /W4)
else()
    target_compile_options(messenger-client PRIVATE -Wall -Wextra -Wpedantic)
endif()