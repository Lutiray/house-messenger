const UIManager = require('../ui/ui_manager.js');

class ChatManager {
    constructor(network) {
        this.activeChat = null;
        this.myNickname = '';
        this.oldestMsgId = 0;
        this.isLoadingHistory = false;
        this.hasMoreHistory = true;

        this.network = network;

        this.messengerContainer = document.getElementById('messenger-container');
        this.scrollBottomBtn = document.getElementById('scroll-bottom-btn');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.emptyChatState = document.getElementById('empty-chat-state');
        this.activeChatArea = document.getElementById('active-chat-area');
        this.headerAvatar = document.getElementById('current-chat-avatar');
        this.currentChatNameUI = document.getElementById('current-chat-name');
        this.chatSubtitleUI = document.getElementById('chat-subtitle');

        this.activeChat = null;
        this.myNickname = '';
        this.oldestMsgId = 0;
        this.isLoadingHistory = false;
        this.hasMoreHistory = true;

        this.topSentinel = document.createElement('div');
        this.topSentinel.style.height = '1px';

        this.notificationSound = new Audio('../assets/mixkit-dry-pop-up-notification-alert-2356.wav');
        this.notificationSound.volume = 0.5;

        this.initObservers();
        this.initEvents();
    }

    initObservers() {
        this.readObserver = new IntersectionObserver(
            (entries, observer) => {
                const sendersToMark = new Set();
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const sender = entry.target.dataset.sender;
                        if (sender && sender === this.activeChat) {
                            sendersToMark.add(sender);
                        }
                        observer.unobserve(entry.target);
                    }
                });

                sendersToMark.forEach((sender) => {
                    this.network.send('mark_read', { from: sender });
                });
            },
            { threshold: 0.6 },
        );

        this.historyObserver = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !this.isLoadingHistory && this.hasMoreHistory && this.activeChat) {
                    this.isLoadingHistory = true;
                    this.network.send('get_history', {
                        user: this.activeChat,
                        before_id: this.oldestMsgId,
                    });
                }
            },
            { root: this.messengerContainer, threshold: 0.1 },
        );
    }

    initEvents() {
        if (this.messengerContainer && this.scrollBottomBtn) {
            this.messengerContainer.addEventListener('scroll', () => {
                const distanceFromBottom =
                    this.messengerContainer.scrollHeight -
                    this.messengerContainer.scrollTop -
                    this.messengerContainer.clientHeight;
                this.scrollBottomBtn.classList.toggle('hidden', distanceFromBottom <= 150);
            });
            this.scrollBottomBtn.addEventListener('click', () => {
                this.messengerContainer.scrollTo({
                    top: this.messengerContainer.scrollHeight,
                    behavior: 'smooth',
                });
            });
        }
    }

    openChat(chatName, myNickname, onlineUsersSet) {
        this.activeChat = chatName;
        this.myNickname = myNickname;

        if (this.messengerContainer) this.messengerContainer.classList.add('private-chat');
        if (this.headerAvatar) this.headerAvatar.classList.remove('hidden');

        if (chatName === myNickname) {
            this.currentChatNameUI.textContent = 'Saved Messages';
            if (this.headerAvatar) {
                this.headerAvatar.src = 'https://ui-avatars.com/api/?name=SM&background=5b7cff&color=fff';
            }
            if (this.chatSubtitleUI) {
                this.chatSubtitleUI.textContent = 'your personal cloud';
                this.chatSubtitleUI.className = 'chat-subtitle status-online';
            }
        } else {
            this.currentChatNameUI.innerText = chatName;
            this.setChatStatus(onlineUsersSet.has(chatName));

            const dialogNames = Array.from(document.querySelectorAll('.dialog-name'));
            const dialogItem = dialogNames.find((el) => el.textContent === chatName);

            if (this.headerAvatar) {
                if (dialogItem) {
                    const img = dialogItem.closest('.dialog-item').querySelector('.dialog-avatar');
                    this.headerAvatar.src = img ? img.src : UIManager.getAvatarUrl(chatName, 40);
                } else {
                    this.headerAvatar.src = UIManager.getAvatarUrl(chatName, 40);
                }
            }
        }

        this.emptyChatState.classList.add('hidden');
        this.activeChatArea.classList.remove('hidden');

        document.querySelectorAll('.dialog-item').forEach((el) => {
            const nameInList = el.querySelector('.dialog-name')?.textContent;
            const targetName = chatName === myNickname ? 'Saved Messages' : chatName;
            el.classList.toggle('active', nameInList === targetName);
        });

        this.oldestMsgId = 0;
        this.hasMoreHistory = true;
        this.isLoadingHistory = false;
        this.historyObserver.unobserve(this.topSentinel);
        this.messengerContainer.textContent = '';

        this.network.send('get_history', { user: chatName });
    }

    setChatStatus(isOnline) {
        if (!this.chatSubtitleUI) return;
        this.chatSubtitleUI.textContent = isOnline ? 'Online' : 'Offline';
        this.chatSubtitleUI.classList.toggle('status-online', isOnline);
        this.chatSubtitleUI.classList.toggle('status-offline', !isOnline);
    }

    triggerNotification(senderName, messageText) {
        if (!document.hasFocus()) {
            this.notificationSound.play().catch((e) => console.log('Audio blocked:', e));
            const notif = new Notification(senderName, {
                body: messageText.length > 50 ? messageText.slice(0, 50) + '...' : messageText,
                icon: UIManager.getAvatarUrl(senderName, 100),
                silent: true,
            });

            notif.onclick = () => {
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('focus-window');
                document.dispatchEvent(new CustomEvent('switch-chat', { detail: senderName }));
            };
        }
    }

    showTyping(from) {
        if (!this.typingIndicator || from !== this.activeChat || this.activeChat === this.myNickname) return;
        this.typingIndicator.textContent = `${from} is typing...`;
        this.typingIndicator.classList.remove('hidden');
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
            this.typingIndicator.classList.add('hidden');
        }, 3000);
    }
}

module.exports = ChatManager;
