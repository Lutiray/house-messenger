#pragma once
#include <string>
#include <algorithm>
#include <regex>

namespace StringUtils {
    inline std::string trim(const std::string& str) {
        const std::string ws = " \t\r\n";
        size_t first = str.find_first_not_of(ws);
        if (first == std::string::npos) return ("");
        size_t last = str.find_last_not_of(ws);
        return (str.substr(first, (last - first + 1)));
    }

    inline bool is_valid_username(const std::string& name) {
        if (name.size() < 4 || name.size() > 32) return false;
        return std::regex_match(name, std::regex("^[a-zA-Z0-9_]+$"));
    }

    inline bool is_blank(const std::string& str) {
        return trim(str).empty();
    }
}