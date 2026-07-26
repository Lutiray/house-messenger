# 💬 Desktop Messenger (C++ / Electron)
 
A high-performance, Telegram-style desktop chat application featuring a custom multithreaded TCP server written in modern C++ and a sleek, cross-platform graphical user interface built with Electron.
 
![Project Status](https://img.shields.io/badge/status-active_development-brightgreen)
![C++](https://img.shields.io/badge/C++-17%2F20-00599C?logo=c%2B%2B)
![Electron](https://img.shields.io/badge/Electron-UI-47848F?logo=electron)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)
 
## 📌 About the Project
 
This project bridges the gap between low-level systems programming and modern frontend technologies. Unlike standard chat applications that rely on existing web-socket libraries, this messenger implements a custom TCP networking protocol from scratch, handling client synchronization, message persistence, and real-time state updates.
 
The architecture departs from simple global "broadcast" chat rooms, moving toward a professional **private dialogue system** with offline message delivery and persistent chat history.
 
## ✨ Key Features
 
* **Custom TCP Server** — Built with modern C++, handling concurrent client connections via robust multi-threading and thread-safe resource management (`std::mutex`, `std::lock_guard`).
* **Telegram-Style Communication** — Supports private messaging (PM), targeted user chats, and a special **"Saved Messages"** feature (messaging oneself).
* **Guaranteed Offline Delivery** — Messages sent to offline users are safely cached in the database and automatically pushed to the recipient upon their next login.
* **Smart Protocol & Framing** — Uses JSON payloads (`nlohmann/json`) over TCP with newline-delimited framing (`\n`) to prevent TCP packet coalescence (sticky packets).
* **Data Persistence & Security** — Integrated SQLite database for storing user profiles and chat history. Passwords are secured using salted cryptographic hashing; all queries utilize prepared statements to prevent SQL injection.
* **IPC Bridge** — Seamless Inter-Process Communication (IPC) between the Electron JavaScript renderer and the native C++ client backend.
* **Native Desktop Notifications** — Integrates with OS-level notifications to alert users of incoming private messages when the app is minimized or unfocused.
## 🛠️ Tech Stack
 
| Component | Technology / Library | Description |
| :--- | :--- | :--- |
| **Backend Server** | C++17 / C++20 | Core server logic, socket programming (WinSock/POSIX), multithreading |
| **Database** | SQLite3 | Embedded SQL database for users, contacts, and message history |
| **Serialization** | `nlohmann/json` | Fast and reliable JSON parsing for network packets |
| **Frontend UI** | Electron, HTML5, CSS3, JS | Cross-platform desktop interface |
| **Bridge / Client** | C++ Client & Node IPC | Connects UI events to native TCP socket streams |
| **Build System** | CMake, npm | Cross-platform compilation and dependency management |
 
## 🏗️ Architecture Overview
 
```
┌────────────────────────┐
│   Electron UI (Renderer) │
└────────────┬────────────┘
             │  IPC / Events
             ▼
┌────────────────────────┐        TCP / JSON Protocol        ┌──────────────────────────────┐
│   C++ Client Backend    │ ───────────────────────────────► │  C++ Multithreaded Server     │
└────────────────────────┘ ◄─────────────────────────────── └───────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                                ┌──────────────────────────┐
                                                                │      SQLite Database      │
                                                                └──────────────────────────┘
```
 
**Authentication:** Users register/login via Username, Email, or Phone. The server validates credentials against salted hashes in SQLite and returns a session confirmation.
 
**Command Handling:** The `CommandHandler` module routes incoming JSON payloads (`broadcast`, `private_msg`, `user_list`) and legacy terminal commands (`/w`, `/list`).
 
**State Management:** The server maintains an active registry of connected sockets and broadcasts real-time status updates (Online/Offline) without spamming chat histories with system join/leave logs.
 
## 📂 Project Structure
 
```
messenger/
├── messenger-server/                # C++ TCP server source
│   ├── src/
│   ├── include/
│   ├── external/
│   └── CMakeLists.txt
├── messenger-client/            # Native C++ client backend (bridges IPC <-> TCP)
│   ├── src/
│   └── include/
│   ├── external/
│   └── CMakeLists.txt
├── messenger-ui/              # Electron front-end
│   ├── src/
│   ├── package.json
│   └── main.js
├── CMakeLists.txt           # Root monorepo CMake build script
├── .gitignore               # Global git ignore rules
└── README.md
```
 
## Getting Started
 
### Prerequisites
 
* **C++ Compiler:** GCC, Clang, or MSVC (supporting C++17 or higher)
* **CMake:** Version 3.15+
* **Node.js:** Version 16+ and npm

---

### Option A: Build Everything at Once (Recommended Monorepo Build)

You can compile both the C++ server and C++ client simultaneously from the project root:

```bash
# 1. Generate build files from root
mkdir build && cd build
cmake ..

# 2. Build both server and client (executables will be placed in /bin at the root)
cmake --build . --config Release

# 3. Launch the server (from project root)
./bin/Release/messenger-server.exe   
# Windows (or ./bin/messenger-server on Linux/Mac)
```

### Option B: Build Modularly (Individual Components)
If you prefer to build components independently:

```bash
# 1. Build & Run the Server:
cd messenger-server
mkdir build && cd build
cmake ..
cmake --build . --config Release

# Run server
./bin/Release/messenger-server.exe

# 2. Build the C++ Client Backend:
cd messenger-client
mkdir build && cd build
cmake ..
cmake --build . --config Release

# 3. Launch the Electron Client UI
Once the server is running and the C++ client is compiled:

# From the project root
cd messenger-ui

# Install Node dependencies
npm install

# Start the desktop app
npm start
```
 
## 📡 Protocol Overview
 
Messages are exchanged as newline-delimited JSON objects, e.g.:
 
```json
{"type": "private_msg", "to": "alice", "from": "bob", "body": "Hey!", "timestamp": 1732541200}
```
 
Supported message types include:
 
| Type | Description |
| :--- | :--- |
| `login` / `register` | Authenticate or create a new account |
| `private_msg` | Send a direct message to another user |
| `broadcast` | Legacy global chat message |
| `user_list` | Request the list of online users |
| `history` | Fetch cached/offline messages on login |
 
## 🗺️ Roadmap / Future Enhancements
 
* [ ] **Dockerization** — Containerize the C++ Linux server and SQLite database using Docker & Docker Compose for one-click cloud deployment.
* [ ] **Contact List Management** — Implement explicit friend requests and contact filtering.
* [ ] **Read Receipts** — Add message status flags (Sent, Delivered, Read).
* [ ] **End-to-End Encryption (E2EE)** — Implement Diffie-Hellman key exchange and AES encryption for private chats.
* [ ] **Group Chats** — Support multi-user rooms in addition to 1:1 dialogues.
* [ ] **File Transfer** — Allow sending images and documents over the existing protocol.
* [ ] **Cross-Session Sync** — Support multiple simultaneous client sessions per user.