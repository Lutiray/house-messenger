#ifndef LOGGER_HPP
#define LOGGER_HPP

#include <string>
#include <iostream>
#include <mutex>
#include <chrono>
#include <iomanip>
#include <fstream>
#include <sstream>

class Logger {
public:
    enum class Level { LogDEBUG, LogINFO, LogWARNING, LogERROR };

    static void info(const std::string& msg) { log(Level::LogINFO, msg); }
    static void warn(const std::string& msg) { log(Level::LogWARNING, msg); }
    static void debug(const std::string& msg) { log(Level::LogDEBUG, msg); }

    static void error(const std::string& msg, int LogERRORCode = 0) {
        std::string full_msg = msg;
        if (LogERRORCode != 0) {
            full_msg += " (LogERROR code: " + std::to_string(LogERRORCode) + ")";
        }
        log(Level::LogERROR, full_msg);
    }

private:
    static std::mutex _logMutex;

    static void log(Level level, const std::string& message);
    static std::string levelToString(Level level);
};

#endif