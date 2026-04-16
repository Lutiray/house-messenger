#pragma once
#include <sqlite3.h>
 
class StmtGuard {
public:
    StmtGuard() : _stmt(nullptr) {}
 
    ~StmtGuard() {
        if (_stmt) sqlite3_finalize(_stmt);
    }
 
    StmtGuard(const StmtGuard&)            = delete;
    StmtGuard& operator=(const StmtGuard&) = delete;
 
    sqlite3_stmt** ptr() { return &_stmt; }
 
    operator sqlite3_stmt*() { return _stmt; }

    int step() { return sqlite3_step(_stmt); }
 
    bool is_valid() const { return _stmt != nullptr; }
 
private:
    sqlite3_stmt* _stmt;
};