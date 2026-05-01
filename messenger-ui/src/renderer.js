const { ipcRenderer } = require('electron');
const UIManager = require('./ui/ui_manager.js');
const AuthManager = require('./managers/auth_manager.js');
const ProfileManager = require('./managers/profile_manager.js');
const NetworkManager = require('./managers/network_manager.js');
const InputManager = require('./managers/input_manager.js');
const ChatManager = require('./managers/chat_manager.js');
const SidebarManager = require('./managers/sidebar_manager.js');

let myNickname = '';
let currentDialogs = [];
const onlineUsers = new Set();

const network = new NetworkManager(ipcRenderer);
const input = new InputManager(network);
const chat = new ChatManager(network);
const sidebar = new SidebarManager(network);

// --- Initialization of UI-modules ---
UIManager.initNavMenu();
AuthManager.init(ipcRenderer);
ProfileManager.init(ipcRenderer);

function switchChat(chatName) {
    input.setup(chatName, myNickname, currentDialogs);
    chat.openChat(chatName, myNickname, onlineUsers);
}

document.addEventListener('switch-chat', (e) => switchChat(e.detail));

UIManager.initContextMenu(
    chat.messengerContainer,
    () => myNickname,
    ipcRenderer,
    (msgId, oldText) => input.setEdit(msgId, oldText),
    (msgId, oldText) => input.setReply(msgId, oldText),
    (msgId, oldText, sender) => input.openForwardModal(msgId, oldText, sender),
);

// === PACKET HANDLERS ===
network.handlers = {
    auth_response: (data) => {
        if (data.status === 'success') {
            myNickname = data.username;
            AuthManager.onAuthSuccess();

            const placeholder = document.getElementById('my-avatar-placeholder');
            if (placeholder) {
                const avatarImg = document.createElement('img');
                avatarImg.src = UIManager.getAvatarUrl(myNickname, 32);
                avatarImg.className = 'avatar-img';
                avatarImg.alt = myNickname;
                placeholder.textContent = '';
                placeholder.appendChild(img);
                placeholder.style.background = 'transparent';
            }

            network.send('get_dialogs');
        } else {
            AuthManager.showError(data.message);
        }
    },

    chat_msg: (data) => {
        if (data.from === chat.activeChat || data.from === myNickname || data.to === chat.activeChat) {
            const c = chat.messengerContainer;
            const isNearBottom = c.scrollHeight - c.scrollTop <= c.clientHeight + 100;

            UIManager.addMessage(
                c, data.from, data.text, data.id, data.timestamp,
                data.from === myNickname, data.is_read === 1, chat.readObserver,
                null, data.reply_to_id, data.reply_text, data.forward_from,
                data.forward_text,
            );

            if (data.from === myNickname || isNearBottom) {
                c.scrollTop = c.scrollHeight;
            }
        }

        if (data.from !== myNickname) {
            const isFile = data.text && data.text.startsWith('http://localhost:');
            const previewText = isFile ? '📎 [file attached]' : data.text;
            chat.triggerNotification(data.from, previewText);
        }
        sidebar.requestDialogsDebounced();
    },

    dialogs_list: (data) => {
        currentDialogs = data.data;
        input.currentDialogs = currentDialogs;
        sidebar.renderDialogs(currentDialogs, myNickname, switchChat);
    },

    history: (data) => {
        if (!data.data || data.chat_with !== chat.activeChat) return;
        if (data.data.length === 0) {
            chat.hasMoreHistory = false;
            chat.isLoadingHistory = false;
            return;
        }

        const c = chat.messengerContainer;
        if (chat.oldestMsgId === 0) {
            c.innerHTML = '';
            c.appendChild(chat.topSentinel);
            chat.historyObserver.observe(chat.topSentinel);

            let firstUnreadFound = false;
            let dividerElement = null;

            data.data.forEach((m) => {
                if (m.from !== myNickname && m.is_read !== 1 && !firstUnreadFound) {
                    firstUnreadFound = true;
                    dividerElement = document.createElement('div');
                    dividerElement.className = 'unread-divider';
                    dividerElement.innerHTML = '<span>New messages</span>';
                    c.appendChild(dividerElement);
                }
                UIManager.addMessage(
                    c, m.from, m.text, m.id, m.time, m.from === myNickname,
                    m.is_read === 1, chat.readObserver, null, m.reply_to_id,
                    m.reply_text, m.forward_from, m.forward_text,
                );

                if (chat.oldestMsgId === 0 || m.id < chat.oldestMsgId) {
                    chat.oldestMsgId = m.id;
                }
            });
            requestAnimationFrame(() => {
                if (dividerElement) {
                    dividerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    c.scrollTop = c.scrollHeight;
                }
            });
        } else {
            const oldScrollHeight = c.scrollHeight;
            for (let i = data.data.length - 1; i >= 0; i--) {
                const m = data.data[i];
                UIManager.addMessage(
                    c, m.from, m.text, m.id, m.time, m.from === myNickname,
                    m.is_read === 1, chat.readObserver, topSentinel,
                    m.reply_to_id, m.forward_from, m.forward_text,
                );
                if (m.id < chat.oldestMsgId) 
                    chat.oldestMsgId = m.id;
            }
            if (oldScrollHeight > 0) {
                c.scrollTop = c.scrollHeight - oldScrollHeight;
            }
        }
        chat.isLoadingHistory = false;
    },

    status: (data) => {
        data.online ? onlineUsers.add(data.user) : onlineUsers.delete(data.user);
        if (chat.activeChat === data.user)
            chat.setChatStatus(data.online);
    },

    user_list: (data) => {
        if (data.users) {
            onlineUsers.clear();
            data.users.forEach((u) => onlineUsers.add(u));
        }
    },

    typing: (data) => chat.showTyping(data.from),

    msg_deleted: (data) => {
        const msgEl = chat.messengerContainer.querySelector(`.message[data-id="${data.id}"]`);
        if (msgEl) msgEl.remove();
    },

    msg_edited: (data) => {
        const msgEl = chat.messengerContainer.querySelector(`.message[data-id="${data.id}"]`);
        UIManager.setMessageEdited(msgEl, data.text);
    },

    msg_read: (data) => {
        if (chat.activeChat !== data.by) return;
        chat.messengerContainer.querySelectorAll('.message.own .read-receipt i').forEach((icon) => {
            icon.className = 'ph ph-checks';
        });
    },

    system: (data) => {
        if (!data.text) return;
        UIManager.addMessage(
            chat.messengerContainer, 'System', data.text, null,
            'now', false, false, null, null, 0, '', '', '',
        );
    },

    search_results: (data) => {
        if (!input.forwardModal.classList.contains('hidden')) {
            const fakeDialogs = data.users.map((u) => ({
                chat_name: u,
                text: 'Global search result',
                time: 'now',
                unread_count: 0,
            }));
            input.renderForwardList(fakeDialogs);
        } else {
            sidebar.renderSearchResults(data.users, switchChat);
        }
    },

    user_profile: (data) => {
        ProfileManager.fillProfileData(data);
    },

    username_changed: (data) => {
        myNickname = data.new_name;
        network.send('get_dialogs' );
    },
};

