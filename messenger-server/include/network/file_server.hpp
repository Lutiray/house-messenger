#pragma once
#include "httplib.h"
#include "json.hpp"
#include <iostream>
#include <fstream>
#include <filesystem>
#include <chrono>

using json = nlohmann::json;

class FileServer {
public:
    static void start(int port = 8081) {
        httplib::Server svr;

        if (!std::filesystem::exists("./uploads")) {
            std::filesystem::create_directory("./uploads");
        }

        svr.set_mount_point("/files", "./uploads");

        svr.Options("/uploads", [](const httplib::Request &req, httplib::Response &res) {
            res.set_header("Access-Control-Allow-Origin", "*");
            res.set_header("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.set_header("Access-Control-Allow-Headers", "filename"); 
            res.status = 200;
        });

        svr.Post("/upload", [port](const httplib::Request &req, httplib::Response &res) {
           res.set_header("Access-Control-Allow-Origin", "*");

            if (req.body.empty()) {
                res.status = 400;
                res.set_content(json({{"error", "No file uploaded"}}).dump(), "application/json");
                return;
            }

            std::string original_filename = "unknown_file.dat";
            if (req.has_header("filename")) {
                original_filename = req.get_header_value("filename");
            }
            auto now = std::chrono::system_clock::now().time_since_epoch().count();
            std::string unique_filename = std::to_string(now) + "_" + original_filename;
            std::string filepath = "./uploads/" + unique_filename;

            std::ofstream ofs(filepath, std::ios::binary);
            ofs << req.body;
            ofs.close();

            if (!ofs) {
                res.status = 500;
                res.set_content(json({{"error", "Failed to save file"}}).dump(), "application/json");
                return;
            }

           std::string file_url = "http://localhost:" + std::to_string(port) + "/files/" + unique_filename;
            json response = {
                {"status", "success"},
                {"url", file_url},
                {"filename", original_filename}
            };
            res.set_content(response.dump(), "application/json");
        });

        std::cout << "[FileServer] Listening on http://0.0.0.0:" << port << std::endl;
        svr.listen("0.0.0.0", port);
    }
};
