cmake_minimum_required(VERSION 3.15)
project(MessengerServer VERSION 1.0.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
    set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/bin)
endif()

file(GLOB_RECURSE SERVER_SOURCES "src/*.cpp")
set(SQLITE_SOURCE "external/sqlite3.c")

add_executable(messenger-server ${SERVER_SOURCES} ${SQLITE_SOURCE})

target_include_directories(messenger-server PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/external
)

if (WIN32)
    target_link_libraries(messenger-server PRIVATE ws2_32)
else()
    find_package(Threads REQUIRED)
    target_link_libraries(messenger-server PRIVATE Threads::Threads ${CMAKE_DL_LIBS})
endif()

if (MSVC)
    target_compile_options(messenger-server PRIVATE /W4)
else()
    target_compile_options(messenger-server PRIVATE -Wall -Wextra -Wpedantic)
endif()