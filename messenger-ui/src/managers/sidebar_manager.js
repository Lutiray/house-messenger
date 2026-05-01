const UIManager = require('../ui/ui_manager.js');

class SidebarManager {
    constructor (network) {
        this.network = network;
        this.userListContainer = document.getElementById('user-list');
        this.searchInput = document.getElementById('user-search-input');

        this.toggleDetailsBtn = document.getElementById('toggle-details-btn');
        this.closeDetailsBtn = document.getElementById('close-details-btn');
        this.chatDetailsPanel = document.getElementById('chat-details-panel');

        this.dialogsDebounceTimer = null;
        this.initEvents();
    }

    initEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                if (query.startsWith('@') && query.length > 1) {
                    this.network.send('search_user', { query });
                } else if (query === '' || query === '@') {
                    this.requestDialogsDebounced(0);
                }
            });
        }

        if (this.toggleDetailsBtn && this.closeDetailsBtn && this.chatDetailsPanel) {
            this.toggleDetailsBtn.onclick = () => this.chatDetailsPanel.classList.toggle('hidden');
            this.closeDetailsBtn.onclick = () => this.chatDetailsPanel.classList.add('hidden');
        }
    }

    requestDialogsDebounced(delay = 500) {
        clearTimeout(this.dialogsDebounceTimer);
        this.dialogsDebounceTimer = setTimeout(() => {
            this.network.send('get_dialogs');
        }, delay);
    }

    renderDialogs(dialogsArray, myNickname, openChatCallback) {
        UIManager.renderDialogsList(this.userListContainer, dialogsArray, myNickname, openChatCallback);
    }

    renderSearchResults(users, openChatCallback) {
        this.userListContainer.textContent = '';
        if (!users || users.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-dialogs-msg';
            empty.textContent = 'No users found';
            this.userListContainer.appendChild(empty);
            return;
        }

        users.forEach((user) => {
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
                this.searchInput.value = '';
                this.requestDialogsDebounced(0);
                openChatCallback(user);
            };

            this.userListContainer.appendChild(li);
        });
    }
}

module.exports = SidebarManager;
