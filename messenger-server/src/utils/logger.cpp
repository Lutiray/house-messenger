#include "utils/logger.hpp"

std::mutex Logger::_logMutex;

std::string Logger::levelToString(Level level) {
    switch (level) {
        case Level::LogDEBUG:   return "DEBUG";
        case Level::LogINFO:    return "INFO";
        case Level::LogWARNING: return "WARN";
        case Level::LogERROR:   return "ERROR";
        default:             return "UNKNOWN";
    }
}

void Logger::log(Level level, const std::string& msg) {
    std::lock_guard<std::mutex> lock(_logMutex);
    
    auto now = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
    auto tm_struct = std::localtime(&now);
    
    std::ostringstream ss;
    ss << "[" << std::put_time(tm_struct, "%Y-%m-%d %H:%M:%S") << "] "
       << "[" << levelToString(level) << "] " << msg;

    const std::string line = ss.str();

    switch (level) {
        case Level::LogERROR:   std::cout << "\033[1;31m"; break;
        case Level::LogWARNING: std::cout << "\033[1;33m"; break;
        case Level::LogINFO:    std::cout << "\033[1;32m"; break;
        case Level::LogDEBUG:   std::cout << "\033[1;36m"; break;
        default: break;
    }
    std::cout << line << "\033[0m" << std::endl;

    static std::ofstream log_file("server_log.txt", std::ios::app);
    if (log_file.is_open()) {
        log_file << line << "\n";
        log_file.flush();
    }
}
