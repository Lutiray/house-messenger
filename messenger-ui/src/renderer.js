const { ipcRenderer } = require('electron');
const UIManager = require('./ui_manager.js');

let myNickname = "";
let lastTypingTime = 0;
let activeChat = null;
let editingMsgId = null;
const onlineUsers = new Set();

// --- DOM-elements ---
const authScreen            = document.getElementById('auth-screen');
const chatScreen            = document.getElementById('chat-screen');
const regScreen             = document.getElementById('reg-screen');
const authStatus            = document.getElementById('auth-status');
const regStatus             = document.getElementById('reg-status');
const messageForm           = document.getElementById('message-form');
const messageInput          = document.getElementById('message-input');
const messagesContainer     = document.getElementById('messenger-container');
const userListContainer     = document.getElementById('user-list');

const currentChatNameUI     = document.getElementById('current-chat-name');
const myAvatarPlaceholder   = document.querySelector('.my-avatar-placeholder');
const typingIndicator       = document.getElementById('typing-indicator');

// Buttons
const regBtn                = document.getElementById('reg-btn');
const goToLoginBtn          = document.getElementById('go-to-login');
const loginBtn              = document.getElementById('login-btn');
const regSubmitBtn          = document.getElementById('reg-submit-btn');
const exitBtn               = document.getElementById('exit-btn');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');

// Fields of auth
const loginUserInp          = document.getElementById('username');
const loginPassInp          = document.getElementById('password');
const regUserInp            = document.getElementById('reg-username');
const regPassInp            = document.getElementById('reg-password');
const regPassConfInp        = document.getElementById('reg-password-confirm');
const regEmailInp           = document.getElementById('reg-email');
const regPhoneInp           = document.getElementById('reg-phone');

const emptyChatState        = document.getElementById('empty-chat-state');
const activeChatArea        = document.getElementById('active-chat-area');
const chatSubtitleUI        = document.getElementById('chat-subtitle');

const editIndicator         = document.getElementById('edit-indicator');
const editPreviewText       = document.getElementById('edit-preview-text');
const cancelEditBtn         = document.getElementById('cancel-edit-btn');
const searchInput           = document.getElementById('user-search-input');

const toggleDetailsBtn = document.getElementById('toggle-details-btn');
const closeDetailsBtn = document.getElementById('close-details-btn');
const chatDetailsPanel = document.getElementById('chat-details-panel');
const attachBtn = document.getElementById('attach-btn');
const fileUploadInput = document.getElementById('file-upload-input');

// --- Initialization of UI-modules ---
UIManager.initNavMenu();
UIManager.initContextMenu(messagesContainer, () => myNickname, ipcRenderer, (msgId, oldText) => {
    editingMsgId = msgId;
    messageInput.value = oldText;
    editPreviewText.textContent = oldText;
    editIndicator.classList.remove('hidden');
    messageInput.focus();
});

cancelEditBtn.onclick = () => {
    editingMsgId = null;
    messageInput.value = '';
    editIndicator.classList.add('hidden');
};

const readObserver = new IntersectionObserver((entries, observer) => {
    let sendersToMark = new Set();

    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const sender = entry.target.dataset.sender;
            if (sender && sender === activeChat) {
                sendersToMark.add(sender);
            }
            observer.unobserve(entry.target);
        }
    });

    sendersToMark.forEach(sender => {
        ipcRenderer.send('to-cpp', JSON.stringify({ type: "mark_read", from: sender }));
    });
}, { threshold: 0.6 });

function setChatStatus(isOnline) {
    if (!chatSubtitleUI) return;

    chatSubtitleUI.textContent = isOnline ? 'Online' : 'Offline';
    chatSubtitleUI.classList.toggle('status-online', isOnline);
    chatSubtitleUI.classList.toggle('status-offline', !isOnline);
}

let dialogsDebounceTimer = null;
function requestDialogsDebounced(delay = 500) {
    clearTimeout(dialogsDebounceTimer);
    dialogsDebounceTimer = setTimeout(() => {
        ipcRenderer.send('to-cpp', JSON.stringify({type: 'get_dialogs'}));
    }, delay);
}

function openChat(chatName) {
    activeChat = chatName;
    currentChatNameUI.innerText = chatName;
    
    setChatStatus(onlineUsers.has(chatName));
    
    emptyChatState.classList.add('hidden');
    activeChatArea.classList.remove('hidden');

    document.querySelectorAll('.dialog-item').forEach(el => {
        el.classList.toggle('active', el.querySelector('.dialog-name')?.textContent === chatName);
    });

    messagesContainer.innerHTML = '';
    ipcRenderer.send('to-cpp', JSON.stringify({type: 'get_history', user: chatName}));
    messageInput.focus();
}

//  === GLOSSARY OF PACKAGE PROCESSORS ===
const PacketHandlers = {

    'auth_response': (data) => {
        if (data.status === 'success') {
            myNickname = data.username; 
            authScreen.classList.add('hidden');
            regScreen.classList.add('hidden');
            chatScreen.classList.remove('hidden');

            if (myAvatarPlaceholder) {
                const img = document.createElement('img');
                img.src = UIManager.getAvatarUrl(myNickname, 32);
                img.className = 'my-avatar-img';
                img.alt = myNickname;
                myAvatarPlaceholder.innerHTML = '';
                myAvatarPlaceholder.appendChild(img);
                myAvatarPlaceholder.style.background = 'transparent';
            }

            ipcRenderer.send('to-cpp', JSON.stringify({ type: 'get_dialogs' }));
        } else {
            if (authStatus) authStatus.textContent = data.message;
            if (regStatus)  regStatus.textContent  = data.message;
        }
    },

    'chat_msg': (data) => {
        if (data.from === activeChat || data.from === myNickname || data.to === activeChat) {
            const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;

            UIManager.addMessage(
                messagesContainer,
                data.from,
                data.text,
                data.id,
                data.timestamp,
                data.from === myNickname,
                data.is_read === 1,
                readObserver
            );

            if (data.from === myNickname || isNearBottom) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
        requestDialogsDebounced();
    },

    'dialogs_list': (data) => {
        UIManager.renderDialogsList(userListContainer, data.data, myNickname, openChat);
    },

    'history': (data) => {
        if (!data.data || data.data.length === 0) return;
        
        let firstUnreadFound = false;
        let dividerElement = null;

        data.data.forEach(m => {
            const isOwn = m.from === myNickname;
            const isRead = m.is_read === 1;

            if (!isOwn && !isRead && !firstUnreadFound){
                firstUnreadFound = true;

                dividerElement = document.createElement('div');
                dividerElement.className = 'unread-divider';
                dividerElement.innerHTML = '<span>New messages</span>';
                messagesContainer.appendChild(dividerElement);
            }

            UIManager.addMessage(
                messagesContainer,
                m.from,
                m.text,
                m.id,
                m.time,
                m.from === myNickname,
                m.is_read === 1,
                readObserver
            );
        });

        setTimeout(() => {
            if (dividerElement) {
                dividerElement.scrollIntoView({behavior: 'smooth', block: 'center'});
            } else {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 50)
    },

    'status': (data) => {
        data.online ? onlineUsers.add(data.user) : onlineUsers.delete(data.user);
        if (activeChat === data.user) {
            setChatStatus(data.online);
        }
    },

    'user_list': (data) => {
        if (data.users) {
            onlineUsers.clear();
            data.users.forEach(u => onlineUsers.add(u));
        }
    },

    'typing': (data) => {
        if (!typingIndicator || data.from !== activeChat) return;
        typingIndicator.textContent = `${data.from} is typing...`;
        typingIndicator.classList.remove('hidden');
        
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
            typingIndicator.classList.add('hidden');
        }, 3000);
    },

    'msg_deleted': (data) => {
        const msgEl = document.querySelector(`.message[data-id="${data.id}"]`);
        if (msgEl) msgEl.remove();
    },

    'msg_edited': (data) => {
        const msgEl = messagesContainer.querySelectorAll('.message.own .read-receipt i');
        if (msgToEdit) {
            const textElement = msgToEdit.querySelector('.msg-text');
            UIManager.setMessageEdited(msgEl, data.text);
        }
    },

    'msgs_read': (data) => {
        if (activeChat !== data.by) return;
        const receipts = messagesContainer.querySelectorAll('.message.own .read-receipt i');
        receipts.forEach(icon => {
            icon.className = 'ph ph-checks';
            icon.style.color = 'var(--accent)';
        });
    },

    'system': (data) => {
        if (!data.text) return;
        UIManager.addMessage(messagesContainer, 'System', data.text, null, 'now', false, false, null);
    },

    'search_results': (data) => {
        userListContainer.innerHTML = '';
        if (!data.users || data.users.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-dialogs-msg';
            empty.textContent = 'No users found';
            userListContainer.appendChild(empty);
            return;
        }

        data.users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'dialog-item';
            
            const avatar = document.createElement('img');
            avatar.src = UIManager.getAvatarUrl(user, 40);
            avatar.className = 'dialog-avatar';
            avatar.alt = user;

            const info = document.createElement('div');
            info.className = 'dialog-info';

            const header = document.createElement('div');
            header.className = 'dialog-header';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'dialog-name';
            nameSpan.textContent = user;

            const tagSpan = document.createElement('span');
            tagSpan.className = 'dialog-time';
            tagSpan.textContent = 'Search';

            const textSpan = document.createElement('span');
            textSpan.className = 'dialog-text';
            textSpan.textContent = 'Global search result';

            header.appendChild(nameSpan);
            header.appendChild(tagSpan);
            info.appendChild(header);
            info.appendChild(textSpan);

            li.appendChild(avatar);
            li.appendChild(info);

            li.onclick = () => {
                searchInput.value = '';
                requestDialogsDebounced(0);
                openChat(user);
            };

            userListContainer.appendChild(li);
        });
    },  
};

ipcRenderer.on('from-cpp', (event, rawJson) => {
    try {
        const packets = rawJson.split('\n').filter(p => p.trim() !== '');
        packets.forEach(packet => {
            const data = JSON.parse(packet);
            if (PacketHandlers[data.type]){
                PacketHandlers[data.type](data);
            } else {
                console.warn("[Client] Unknown packet type from server:", data.type);
            }
        });
    } catch (e) {
        console.log("Non-JSON output from C++: ", rawJson);
    }
});

// --- Auth ---
regBtn.onclick = () => {
    authScreen.classList.add('hidden');
    regScreen.classList.remove('hidden');
    if (authStatus) authStatus.textContent = '';
};

goToLoginBtn.onclick = (e) => {
    e.preventDefault(); 
    regScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    if (regStatus) regStatus.textContent = '';
};

loginBtn.onclick = () => {
    const user = loginUserInp.value.trim();
    const password = loginPassInp.value;
    if (!user || !password) {
        authStatus.textContent = 'Please fill in all fields';
        return;
    }

    ipcRenderer.send('to-cpp', '/connect');
    setTimeout(() => ipcRenderer.send('to-cpp', `/login ${user} ${password}`), 100);
};

regSubmitBtn.onclick = () => {
    const user = regUserInp.value.trim();
    const pass = regPassInp.value;
    const confirm = regPassConfInp.value;
    const email = regEmailInp.value.trim() || "none";
    const phone = regPhoneInp.value.trim() || "none";

    if (!user || !pass) {
        regStatus.textContent = 'Username and password are required';
        return;
    }

    if (pass !== confirm) {
        regStatus.textContent = 'Passwords do not match!';
        return;
    }

    ipcRenderer.send('to-cpp', '/connect');
    setTimeout(() => ipcRenderer.send('to-cpp', `/reg ${user} ${pass} ${email} ${phone}`), 100);
};

exitBtn.onclick = () => {
    ipcRenderer.send('to-cpp', '/exit');
    ipcRenderer.send('restart-app');
};

// --- Post a message ---
messageInput.addEventListener('input', () => {
    if (!activeChat) return;
    const now = Date.now();
    if (now - lastTypingTime > 2000) {
        lastTypingTime = now;
        ipcRenderer.send('to-cpp', JSON.stringify({ type: "typing", to: activeChat }));
    }
});

messageForm.onsubmit = (e) => {
    e.preventDefault();
    if (!activeChat) return;

    const text = messageInput.value.trim();
    if (!text) return;

    if (editingMsgId) {
        ipcRenderer.send('to-cpp', JSON.stringify({ type: 'edit_msg', id: editingMsgId, text }));
        editingMsgId = null;
        editIndicator.classList.add('hidden');
    } else {
        ipcRenderer.send('to-cpp', JSON.stringify({ type: 'send_msg', to: activeChat, content: text }));
    }

    messageInput.value = '';
};

if (messagesContainer && scrollBottomBtn) {
    messagesContainer.addEventListener('scroll', () => {
        const distanceFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
        
        if (distanceFromBottom > 150) {
            scrollBottomBtn.classList.remove('hidden');
        } else {
            scrollBottomBtn.classList.add('hidden');
        }
    });

    scrollBottomBtn.addEventListener('click', () => {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    });
}

if (attachBtn && fileUploadInput) {
    attachBtn.onclick = () => {
        if (!activeChat) return;
        fileUploadInput.click();
    };

    fileUploadInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        messageInput.placeholder = "Uploading file...";
        messageInput.disabled = true;

        try {
            const uploadUrl = `http://localhost:8081/upload`;
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'filename': encodeURIComponent(file.name) 
                },
                body: file
            });

            const data = await response.json();

            if (data.status === 'success') {
                ipcRenderer.send('to-cpp', JSON.stringify({
                    type: 'send_msg',
                    to: activeChat,
                    content: data.url
                }));
            } else {
                console.error("Upload error from server: ", data.error);
            }
        } catch (error) {
            console.error("Fetch failed: ", error);
        } finally {
            messageInput.placeholder = "Type something...";
            messageInput.disabled = false;
            fileUploadInput.value = '';
        }
    };
}

// --- Serach ---
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.startsWith('@') && query.length > 1) {
            ipcRenderer.send('to-cpp', JSON.stringify({ type: "search_user", query}));
        } 
        else if (query === '' || query === '@') {
            requestDialogsDebounced(0);
        }
    });
}

// --- Detail's panel ---
if (toggleDetailsBtn && closeDetailsBtn && chatDetailsPanel) {
    toggleDetailsBtn.onclick = () => chatDetailsPanel.classList.toggle('hidden');
    closeDetailsBtn.onclick  = () => chatDetailsPanel.classList.add('hidden');
}
