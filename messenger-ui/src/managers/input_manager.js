const UIManager = require('../ui/ui_manager.js');

class InputManager {
    constructor(network) {
        this.network = network;

        this.myNickname = '';
        this.lastTypingTime = 0;
        this.forwardingMessage = null;
        this.activeChat = null;
        this.editingMsgId = null;
        this.stagedFile = null;
        this.replyingToId = null;
        this.currentDialogs = [];

        this.messageForm = document.getElementById('message-form');
        this.messageInput = document.getElementById('message-input');
        // Edit elements
        this.editIndicator = document.getElementById('edit-indicator');
        this.editPreviewText = document.getElementById('edit-preview-text');
        this.cancelEditBtn = document.getElementById('cancel-edit-btn');
        // Attach elements
        this.attachBtn = document.getElementById('attach-btn');
        this.fileUploadInput = document.getElementById('file-upload-input');
        this.stagingArea = document.getElementById('attachment-staging');
        this.cancelAttachBtn = document.getElementById('cancel-attachment');
        this.stagingFilename = document.getElementById('staging-filename');
        // Reply elements
        this.replyPreviewText = document.getElementById('reply-preview-text');
        this.replyIndicator = document.getElementById('reply-indicator');
        this.cancelReplyBtn = document.getElementById('cancel-reply-btn');
        // Forward elements
        this.forwardModal = document.getElementById('forward-modal');
        this.forwardSearchInput = document.getElementById('forward-search-input');
        this.forwardDialogsList = document.getElementById('forward-dialogs-list');
        this.forwardIndicator = document.getElementById('forward-indicator');
        this.cancelForwardBtn = document.getElementById('cancel-forward-btn');
        this.previewForwardEl = document.getElementById('forward-preview-text');
        this.closeForwardBtn = document.getElementById('close-forward-btn');
        this.titleForwardEl = document.getElementById('forward-to-name');
        this.initEvents();
    }

    setup(chatName, myNickname, currentDialogs) {
        this.activeChat = chatName;
        this.myNickname = myNickname;
        this.currentDialogs = currentDialogs;
        this.clearAllStates();
    }

    initEvents() {
        this.messageInput.addEventListener('input', () => {
            if (!this.activeChat || this.activeChat === this.myNickname) return;

            const now = Date.now();
            if (now - this.lastTypingTime > 2000) {
                this.lastTypingTime = now;
                this.network.send('typing', { to: this.activeChat });
            }
        });

        if (this.attachBtn && this.fileUploadInput) {
            this.attachBtn.onclick = () => {
                if (this.activeChat) this.fileUploadInput.click();
            };
            this.fileUploadInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                this.stagedFile = file;
                this.showFileStaging(file);
            };
        }

        if (this.cancelAttachBtn) this.cancelAttachBtn.onclick = () => this.clearFileStaging();
        if (this.cancelEditBtn) this.cancelEditBtn.onclick = () => this.clearAllStates();
        if (this.cancelReplyBtn) this.cancelReplyBtn.onclick = () => this.clearAllStates();
        if (this.cancelForwardBtn) this.cancelForwardBtn.onclick = () => this.clearAllStates();

        this.messageForm.onsubmit = async (e) => {
            e.preventDefault();
            await this.handleSend();
        };

        if (this.closeForwardBtn) {
            this.closeForwardBtn.onclick = () => this.forwardModal.classList.add('hidden');
        }
        if (this.forwardSearchInput) {
            this.forwardSearchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const filtered = this.currentDialogs.filter((d) => {
                    const chatName = d.chat_name === 'Saved Messages' ? this.myNickname : d.chat_name;
                    return chatName.toLowerCase().includes(query);
                });
                this.renderForwardList(filtered);

                if (query.startsWith('@') && query.length > 1) {
                    this.network.send('search_user', { query });
                }
            });
        }
    }

    async handleSend() {
        if (!this.activeChat) return;
        const text = this.messageInput.value.trim();

        if (!text && !this.forwardingMessage && !this.stagedFile) return;

        if (this.editingMsgId) {
            this.network.send('edit_msg', {
                id: Number(this.editingMsgId),
                text,
            });
            this.clearAllStates();
            return;
        }

        this.finalContent = text;

        if (this.stagedFile) {
            this.messageInput.placeholder = 'Uploading...';
            this.messageInput.disabled = true;
            try {
                const formData = new FormData();
                formData.append('file', this.stagedFile);

                const response = await fetch(`http://localhost:8081/upload`, {
                    method: 'POST',
                    headers: { filename: encodeURIComponent(this.stagedFile.name) },
                    body: this.stagedFile,
                });
                const data = await response.json();
                if (data.status === 'success') {
                    this.finalContent = text ? `${data.url} || ${text}` : data.url;
                } else {
                    console.error('Upload error: ', data.error);
                    this.messageInput.disabled = false;
                    return;
                }
            } catch (error) {
                console.error('Fetch failed: ', error);
                this.messageInput.disabled = false;
                return;
            }
        }

        this.network.send('send_msg', {
            to: this.activeChat,
            content: this.finalContent,
            reply_to_id: this.replyingToId ? Number(this.replyingToId) : 0,
            // reply_text: this.replyingToText,
            forward_from: this.forwardingMessage ? this.forwardingMessage.sender : '',
            forward_text: this.forwardingMessage ? this.forwardingMessage.text : '',
        });
        this.clearAllStates();
    }

    setReply(msgId, text) {
        this.clearAllStates();
        this.replyingToId = msgId;
        let mainContent = text;
        let caption = '';
        
        if (text.includes(' || ')) {
            const parts = text.split(' || ');
            mainContent = parts[0].trim();
            caption = parts[1].trim();
        }
        const isFileUrl = mainContent.startsWith('http://localhost:') && (mainContent.includes('/files/') || mainContent.includes('/upload'));
        let preview = '';
        if (isFileUrl) {
            preview = caption ? `📷 ${caption}` : '📷 [Photo]';
        } else {
            preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
        }
        this.replyPreviewText.textContent = preview;
        if (this.replyIndicator) 
            this.replyIndicator.classList.remove('hidden');
        this.messageInput.focus();
    }

    setEdit(msgId, text) {
        this.clearAllStates();
        this.editingMsgId = msgId;
        this.messageInput.value = text;
        this.editPreviewText.textContent = text;
        if (this.editIndicator)
            this.editIndicator.classList.remove('hidden');
        this.messageInput.focus();
    }

    openForwardModal(msgId, text, sender) {
        this.forwardingMessage = { text, sender };
        this.forwardModal.classList.remove('hidden');
        this.forwardSearchInput.value = '';
        this.renderForwardList(this.currentDialogs);
        this.forwardSearchInput.focus();
    }

    renderForwardList(dialogs) {
        UIManager.renderDialogsList(this.forwardDialogsList, dialogs, this.myNickname, (targetChatName) => {
            this.forwardModal.classList.add('hidden');
            const savedMessage = this.forwardingMessage;
            document.dispatchEvent(new CustomEvent('switch-chat', { detail:targetChatName }));
            this.forwardingMessage = savedMessage;

            this.titleForwardEl.textContent = "From: " + this.forwardingMessage.sender;
            const rawText = this.forwardingMessage.text || '[Attachment]';
            const isFileUrl = rawText.startsWith('http://localhost:') && (rawText.includes('/files/') || rawText.includes('/upload'));
            const shortText = isFileUrl ? '📷 [Attachment]' : (rawText.length > 60 ? rawText.slice(0, 60) + '...' : rawText);
            this.previewForwardEl.textContent = shortText;
            
            if (this.editIndicator)
                this.editIndicator.classList.add('hidden');
            if (this.replyIndicator)
                this.replyIndicator.classList.add('hidden');

            this.forwardIndicator.classList.remove('hidden');
            this.messageInput.focus();
        });
    }

    showFileStaging(file) {
        this.stagingFilename = file.name;
        const thumbDiv = document.getElementById('file-thumbnail');
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                thumbDiv.innerHTML = `<img class="image-file" src="${ev.target.result}">`;
            };
            reader.readAsDataURL(file);
        } else {
            thumbDiv.innerHTML = `<i class="ph ph-file" class="attach-file"></i>`;
        }
        if (this.stagingArea)
            this.stagingArea.classList.remove('hidden');
    }

    clearFileStaging() {
        this.stagedFile = null;
        this.fileUploadInput.value = '';
        if (this.stagingArea)
            this.stagingArea.classList.add('hidden');
    }        

    clearAllStates() {
        this.replyingToId = null;
        this.forwardingMessage = null;
        this.editingMsgId = null;
        if (this.editIndicator)
            this.editIndicator.classList.add('hidden');
        if (this.forwardIndicator)
            this.forwardIndicator.classList.add('hidden');
        if (this.replyIndicator)
            this.replyIndicator.classList.add('hidden');
        this.clearFileStaging();
        this.messageInput.value = '';
        this.messageInput.placeholder = 'Type something...';
        this.messageInput.disabled = false;
    }
}

module.exports = InputManager;
