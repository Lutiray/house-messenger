const { ipcRenderer } = require('electron');
const UIManager = require('./ui_manager.js');
const AuthManager = require('./auth_manager.js');
const ProfileManager = require('./profile_manager.js');

let myNickname = '';
let ipcBuffer = '';
let lastTypingTime = 0;
let activeChat = null;
let editingMsgId = null;
let oldestMsgId = 0;
let isLoadingHistory = false;
let hasMoreHistory = true;
let replyingToId = null;
const onlineUsers = new Set();

const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messengerContainer = document.getElementById('messenger-container');
const userListContainer = document.getElementById('user-list');
const currentChatNameUI = document.getElementById('current-chat-name');
const typingIndicator = document.getElementById('typing-indicator');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');

const emptyChatState = document.getElementById('empty-chat-state');
const activeChatArea = document.getElementById('active-chat-area');
const chatSubtitleUI = document.getElementById('chat-subtitle');
const editIndicator = document.getElementById('edit-indicator');
const editPreviewText = document.getElementById('edit-preview-text');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const searchInput = document.getElementById('user-search-input');
const toggleDetailsBtn = document.getElementById('toggle-details-btn');
const closeDetailsBtn = document.getElementById('close-details-btn');
const chatDetailsPanel = document.getElementById('chat-details-panel');
const attachBtn = document.getElementById('attach-btn');
const myAvatarPlaceholder = document.getElementById('my-avatar-placeholder');
const fileUploadInput = document.getElementById('file-upload-input');
const headerAvatar = document.getElementById('current-chat-avatar');
const replyIndicator = document.getElementById('reply-indicator');
const replyPreviewText = document.getElementById('reply-preview-text');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');

// --- Initialization of UI-modules ---
UIManager.initNavMenu();
AuthManager.init(ipcRenderer);
ProfileManager.init(ipcRenderer);

UIManager.initContextMenu(
    messengerContainer,
    () => myNickname,
    ipcRenderer,
    (msgId, oldText) => {
        editingMsgId = msgId;
        replyingToId = null;
        if (replyIndicator)
            replyIndicator.classList.add('hidden');

        messageInput.value = oldText;
        editPreviewText.textContent = oldText;
        editIndicator.classList.remove('hidden');
        messageInput.focus();
    },

    (msgId, oldText) => {
        replyingToId = msgId;
        editingMsgId = null;
        if (editIndicator)
            editIndicator.classList.add('hidden');
        const preview = oldText.length > 60 ? oldText.slice(0, 60) + '...' : oldText;
        if (replyPreviewText)
            replyPreviewText.textContent = preview;
        if (replyIndicator) 
            replyIndicator.classList.remove('hidden');
        messageInput.focus();
    }
);

cancelEditBtn.onclick = () => {
    editingMsgId = null;
    messageInput.value = '';
    editIndicator.classList.add('hidden');
};

if (cancelReplyBtn) {
    cancelReplyBtn.onclick = () => {
        replyingToId = null;
        replyIndicator.classList.add('hidden');
    };
}

// --- Observers ---
const readObserver = new IntersectionObserver(
    (entries, observer) => {
        const sendersToMark = new Set();
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const sender = entry.target.dataset.sender;
                if (sender && sender === activeChat) {
                    sendersToMark.add(sender);
                }
                observer.unobserve(entry.target);
            }
        });

        sendersToMark.forEach((sender) => {
            ipcRenderer.send('to-cpp', JSON.stringify({ type: 'mark_read', from: sender }));
        });
    },
    { threshold: 0.6 },
);

const topSentinel = document.createElement('div');
topSentinel.style.height = '1px';

const historyObserver = new IntersectionObserver(
    (entries) => {
        if (entries[0].isIntersecting && !isLoadingHistory && hasMoreHistory && activeChat) {
            isLoadingHistory = true;
            ipcRenderer.send(
                'to-cpp',
                JSON.stringify({
                    type: 'get_history',
                    user: activeChat,
                    before_id: oldestMsgId,
                }),
            );
        }
    },
    { root: messengerContainer, threshold: 0.1 },
);

// --- Helpers ---
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
        ipcRenderer.send('to-cpp', JSON.stringify({ type: 'get_dialogs' }));
    }, delay);
}

function openChat(chatName) {
    activeChat = chatName;

    if (messengerContainer)
        messengerContainer.classList.add('private-chat');
    if (headerAvatar) 
        headerAvatar.classList.remove('hidden');

    replyingToId = null;
    editingMsgId = null;
    if (replyIndicator) 
        replyIndicator.classList.add('hidden');
    if (editIndicator) 
        editIndicator.classList.add('hidden');

    if (chatName === myNickname) {
        currentChatNameUI.textContent = 'Saved Messages';
        if (headerAvatar) {
            headerAvatar.src = 'https://ui-avatars.com/api/?name=SM&background=5b7cff&color=fff';
        }
        if (typeof chatSubtitleUI !== 'undefined' && chatSubtitleUI) {
            chatSubtitleUI.textContent = 'your personal cloud';
            chatSubtitleUI.className = 'chat-subtitle status-online';
        }
    } else {
        currentChatNameUI.innerText = chatName;
        setChatStatus(onlineUsers.has(chatName));

        if (headerAvatar) {
            const dialogNames = Array.from(document.querySelectorAll('.dialog-name'));
            const dialogItem = dialogNames.find((el) => el.textContent === chatName);

            if (dialogItem) {
                const img = dialogItem.closest('.dialog-item').querySelector('.dialog-avatar');
                headerAvatar.src = img ? img.src : UIManager.getAvatarUrl(chatName, 40);
            } else {
                headerAvatar.src = UIManager.getAvatarUrl(chatName, 40);
            }
        }
    }

    emptyChatState.classList.add('hidden');
    activeChatArea.classList.remove('hidden');

    document.querySelectorAll('.dialog-item').forEach((el) => {
        const nameInList = el.querySelector('.dialog-name')?.textContent;
        const targetName = chatName === myNickname ? 'Saved Messages' : chatName;
        el.classList.toggle('active', nameInList === targetName);
    });

    oldestMsgId = 0;
    hasMoreHistory = true;
    isLoadingHistory = false;

    if (typeof historyObserver !== 'undefined' && typeof topSentinel !== 'undefined') {
        historyObserver.unobserve(topSentinel);
    }

    messengerContainer.textContent = '';
    ipcRenderer.send('to-cpp', JSON.stringify({ type: 'get_history', user: chatName }));
    messageInput.focus();
}

// === PACKET HANDLERS ===
const PacketHandlers = {
    auth_response: (data) => {
        if (data.status === 'success') {
            myNickname = data.username;
            AuthManager.onAuthSuccess();

            if (myAvatarPlaceholder) {
                const img = document.createElement('img');
                img.src = UIManager.getAvatarUrl(myNickname, 32);
                img.className = 'avatar-img';
                img.alt = myNickname;
                myAvatarPlaceholder.innerHTML = '';
                myAvatarPlaceholder.appendChild(img);
                myAvatarPlaceholder.style.background = 'transparent';
            }

            ipcRenderer.send('to-cpp', JSON.stringify({ type: 'get_dialogs' }));
        } else {
            AuthManager.showError(data.message);
        }
    },

    chat_msg: (data) => {
        if (data.from === activeChat || data.from === myNickname || data.to === activeChat) {
            const isNearBottom =
                messengerContainer.scrollHeight - messengerContainer.scrollTop <= messengerContainer.clientHeight + 100;

            UIManager.addMessage(
                messengerContainer,
                data.from, data.text,
                data.id, data.timestamp,
                data.from === myNickname,
                data.is_read === 1,
                readObserver, null,
                data.reply_to_id,
                data.reply_text
            );

            if (data.from === myNickname || isNearBottom) {
                messengerContainer.scrollTop = messengerContainer.scrollHeight;
            }
        }
        requestDialogsDebounced();
    },

    dialogs_list: (data) => {
        UIManager.renderDialogsList(userListContainer, data.data, myNickname, openChat);
    },

    history: (data) => {
        if (!data.data || data.chat_with !== activeChat) return;

        if (data.data.length === 0) {
            hasMoreHistory = false;
            isLoadingHistory = false;
            return;
        }

        const isInitialLoad = oldestMsgId === 0;

        if (isInitialLoad) {
            messengerContainer.innerHTML = '';
            messengerContainer.appendChild(topSentinel);
            historyObserver.observe(topSentinel);

            let firstUnreadFound = false;
            let dividerElement = null;

            data.data.forEach((m) => {
                const isOwn = m.from === myNickname;
                const isRead = m.is_read === 1;

                if (!isOwn && !isRead && !firstUnreadFound) {
                    firstUnreadFound = true;
                    dividerElement = document.createElement('div');
                    dividerElement.className = 'unread-divider';
                    dividerElement.innerHTML = '<span>New messages</span>';
                    messengerContainer.appendChild(dividerElement);
                }

                UIManager.addMessage(
                    messengerContainer,
                    m.from, m.text,
                    m.id, m.time,
                    m.from === myNickname,
                    m.is_read === 1,
                    readObserver, null,
                    m.reply_to_id, m.reply_text
                );

                if (oldestMsgId === 0 || m.id < oldestMsgId) {
                    oldestMsgId = m.id;
                }
            });

            requestAnimationFrame(() => {
                if (dividerElement) {
                    dividerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    messengerContainer.scrollTop = messengerContainer.scrollHeight;
                }
            });
        } else {
            const oldScrollHeight = messengerContainer.scrollHeight;
            for (let i = data.data.length - 1; i >= 0; i--) {
                const m = data.data[i];
                UIManager.addMessage(
                    messengerContainer,
                    m.from, m.text,
                    m.id, m.time,
                    m.from === myNickname,
                    m.is_read === 1,
                    readObserver, topSentinel,
                    m.reply_to_id, m.reply_text
                );
                if (m.id < oldestMsgId)
                    oldestMsgId = m.id;
            }
            if (oldScrollHeight > 0) {
                messengerContainer.scrollTop = messengerContainer.scrollHeight - oldScrollHeight;
            }
        }
        isLoadingHistory = false;
    },

    status: (data) => {
        data.online ? onlineUsers.add(data.user) : onlineUsers.delete(data.user);
        if (activeChat === data.user) {
            setChatStatus(data.online);
        }
    },

    user_list: (data) => {
        if (data.users) {
            onlineUsers.clear();
            data.users.forEach((u) => onlineUsers.add(u));
        }
    },

    typing: (data) => {
        if (!typingIndicator || data.from !== activeChat || activeChat === myNickname) return;
        typingIndicator.textContent = `${data.from} is typing...`;
        typingIndicator.classList.remove('hidden');
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
            typingIndicator.classList.add('hidden');
        }, 3000);
    },

    msg_deleted: (data) => {
        const msgEl = messengerContainer.querySelector(`.message[data-id="${data.id}"]`);
        if (msgEl) msgEl.remove();
    },

    msg_edited: (data) => {
        const msgEl = messengerContainer.querySelector(`.message[data-id="${data.id}"]`);
        UIManager.setMessageEdited(msgEl, data.text);
    },

    msg_read: (data) => {
        if (activeChat !== data.by) return;
        messengerContainer.querySelectorAll('.message.own .read-receipt i').forEach((icon) => {
            icon.className = 'ph ph-checks';
        });
    },

    system: (data) => {
        if (!data.text) return;
        UIManager.addMessage(messengerContainer, 'System', data.text, null, 'now', false, false, null);
    },

    search_results: (data) => {
        userListContainer.textContent = '';
        if (!data.users || data.users.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-dialogs-msg';
            empty.textContent = 'No users found';
            userListContainer.appendChild(empty);
            return;
        }

        data.users.forEach((user) => {
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

    user_profile: (data) => {
        ProfileManager.fillProfileData(data);
    },

    username_changed: (data) => {
        myNickname = data.new_name;
        ipcRenderer.send('to-cpp', JSON.stringify({ type: 'get_dialogs' }));
    },
};

// --- IPC ---
ipcRenderer.on('from-cpp', (event, rawData) => {
    ipcBuffer += rawData.toString();
    
    let newlineIdx;

    while ((newlineIdx = ipcBuffer.indexOf('\n')) !== -1) {
        const packetStr = ipcBuffer.slice(0, newlineIdx).trim();
        
        ipcBuffer = ipcBuffer.slice(newlineIdx + 1);
        
        if (!packetStr) continue;
        
        try {
            const data = JSON.parse(packetStr);
            if (PacketHandlers[data.type]) {
                PacketHandlers[data.type](data);
            } else {
                console.warn("[Client] Unknown packet type from server:", data.type);
            }
        } catch (e) {
            console.error("JSON Parse Error. Packet was:", packetStr, "Error:", e.message);
        }
    }
});

// --- Messaging ---
messageInput.addEventListener('input', () => {
    if (!activeChat || activeChat === myNickname) return;
    const now = Date.now();
    if (now - lastTypingTime > 2000) {
        lastTypingTime = now;
        ipcRenderer.send('to-cpp', JSON.stringify({ type: 'typing', to: activeChat }));
    }
});

messageForm.onsubmit = (e) => {
    e.preventDefault();
    if (!activeChat) return;

    const text = messageInput.value.trim();
    if (!text) return;

    if (editingMsgId) {
        ipcRenderer.send(
            'to-cpp',
            JSON.stringify({
                type: 'edit_msg',
                id: Number(editingMsgId),
                text,
            }),
        );
        editingMsgId = null;
        if (editIndicator) editIndicator.classList.add('hidden');
    } else {
        ipcRenderer.send('to-cpp', JSON.stringify({
            type: 'send_msg',
            to: activeChat,
            content: text,
            reply_to_id: replyingToId ? Number(replyingToId) : 0
        }));

        replyingToId = null;
        if (replyIndicator) replyIndicator.classList.add('hidden');
    }
    messageInput.value = '';
};

// --- Scroll button ---
if (messengerContainer && scrollBottomBtn) {
    messengerContainer.addEventListener('scroll', () => {
        const distanceFromBottom =
            messengerContainer.scrollHeight - messengerContainer.scrollTop - messengerContainer.clientHeight;
        scrollBottomBtn.classList.toggle('hidden', distanceFromBottom <= 150);
    });
    scrollBottomBtn.addEventListener('click', () => {
        messengerContainer.scrollTo({
            top: messengerContainer.scrollHeight,
            behavior: 'smooth',
        });
    });
}

// --- File upload ---
if (attachBtn && fileUploadInput) {
    attachBtn.onclick = () => {
        if (!activeChat) return;
        fileUploadInput.click();
    };

    fileUploadInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        messageInput.placeholder = 'Uploading file...';
        messageInput.disabled = true;

        try {
            const response = await fetch(`http://localhost:8081/upload`, {
                method: 'POST',
                headers: { filename: encodeURIComponent(file.name), },
                body: file,
            });
            const data = await response.json();
            if (data.status === 'success') {
                ipcRenderer.send('to-cpp', JSON.stringify({
                        type: 'send_msg',
                        to: activeChat,
                        content: data.url,
                        reply_to_id: replyingToId ? Number(replyingToId) : 0
                }));
                replyingToId = null;
                if (replyIndicator) replyIndicator.classList.add('hidden');
            } else {
                console.error('Upload error from server: ', data.error);
            }
        } catch (error) {
            console.error('Fetch failed: ', error);
        } finally {
            messageInput.placeholder = 'Type something...';
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
            ipcRenderer.send('to-cpp', JSON.stringify({ type: 'search_user', query }));
        } else if (query === '' || query === '@') {
            requestDialogsDebounced(0);
        }
    });
}

// --- Details panel ---
if (toggleDetailsBtn && closeDetailsBtn && chatDetailsPanel) {
    toggleDetailsBtn.onclick = () => chatDetailsPanel.classList.toggle('hidden');
    closeDetailsBtn.onclick = () => chatDetailsPanel.classList.add('hidden');
}
