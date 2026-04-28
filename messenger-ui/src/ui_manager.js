class UIManager {
    static initNavMenu() {
        const navItems = document.querySelectorAll('.app-nav .nav-item:not(#exit-btn)');
        navItems.forEach((item) => {
            item.onclick = () => {
                navItems.forEach((n) => n.classList.remove('active'));
                item.classList.add('active');
            };
        });
    }

    static getAvatarUrl(name, size = 40) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}`;
    }

    static formatTime(timestampStr) {
        if (!timestampStr || timestampStr === 'now' || String(timestampStr).trim() === '') {
            const d = new Date();
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }

        const parts = timestampStr.split(/[- :]/);
        if (parts.length >= 5) {
            const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] || 0));
            if (!isNaN(d.getTime())) {
                const h = d.getHours().toString().padStart(2, '0');
                const m = d.getMinutes().toString().padStart(2, '0');
                return `${h}:${m}`;
            }
        }
        return timestampStr;
    }

    static getFileIcon(ext) {
        const map = {
            pdf: 'ph ph-file-pdf',
            doc: 'ph ph-file-doc',
            docx: 'ph ph-file-doc',
            xls: 'ph ph-file-xls',
            xlsx: 'ph ph-file-xls',
            zip: 'ph ph-file-zip',
            rar: 'ph ph-file-zip',
            txt: 'ph ph-file-text',
            mp3: 'ph ph-file-audio',
            wav: 'ph ph-file-audio',
        };
        return map[ext] || 'ph ph-file';
    }

    static buildMessageBody(text) {
        const body = document.createElement('div');
        body.className = 'msg-text';

        const safeText = text ? String(text) : '';
        const isFileUrl = safeText.startsWith(
            ('http://localhost:' && safeText.includes('/files/')) || safeText.includes('/upload'),
        );

        if (!isFileUrl) {
            const textSpan = document.createElement('span');
            textSpan.className = 'actual-text';
            textSpan.textContent = safeText;
            body.appendChild(textSpan);
            return body;
        }

        const ext = safeText.split('.').pop().toLowerCase();
        const parts = safeText.split('/');
        const filenameWithTime = parts[parts.length - 1];
        const originalName = decodeURIComponent(filenameWithTime.substring(filenameWithTime.indexOf('_') + 1));

        body.style.background = 'transparent';
        body.style.padding = '0';

        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const vidExts = ['mp4', 'webm', 'ogg', 'mov'];

        if (imgExts.includes(ext)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'msg-image';
            const img = document.createElement('img');
            img.src = safeText;
            img.alt = originalName;
            img.onclick = () => UIManager.openLightbox(safeText);
            wrapper.appendChild(img);
            body.appendChild(wrapper);
        } else if (vidExts.includes(ext)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'msg-image';
            const video = document.createElement('video');
            video.src = safeText;
            video.muted = true;
            video.autoplay = true;
            video.loop = true;
            video.setAttribute('playsinline', '');
            video.onclick = (e) => {
                e.preventDefault();
                video.muted = !video.muted;
                video.controls = !video.muted;
            };

            wrapper.appendChild(video);
            body.appendChild(wrapper);
        } else {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.onclick = () => window.open(safeText, '_blank');

            const iconDiv = document.createElement('div');
            iconDiv.className = 'file-icon';
            const icon = document.createElement('i');
            icon.className = UIManager.getFileIcon(ext);
            iconDiv.appendChild(icon);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            nameDiv.textContent = originalName;

            fileItem.appendChild(iconDiv);
            fileItem.appendChild(nameDiv);
            body.appendChild(fileItem);
        }
        return body;
    }

    static openLightbox(imageUrl) {
        const lightbox = document.getElementById('image-lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const overlay = document.querySelector('#image-lightbox .lightbox-overlay');
        const closeBtn = document.getElementById('lightbox-close');

        lightboxImg.src = imageUrl;
        lightbox.classList.remove('hidden');

        const closeLightbox = () => {
            lightbox.classList.add('hidden');
            lightboxImg.src = '';
            document.removeEventListener('keydown', onEsc);
        };

        const onEsc = (e) => {
            if (e.key === 'Escape') closeLightbox();
        };

        closeBtn.onclick = closeLightbox;
        overlay.onclick = closeLightbox;
        document.addEventListener('keydown', onEsc);
    }

    static _insertAfterAnchor(container, element, anchorElement) {
        if (anchorElement) {
            anchorElement.after(element);
        } else {
            container.appendChild(element);
        }
    }

    static _buildReplyBlock(container, replyToId, replyText) {
        const replyBlock = document.createElement('div');
        replyBlock.className = 'reply-block';

        const replyLine = document.createElement('div');
        replyLine.className = 'reply-line';

        const replyContent = document.createElement('div');
        replyContent.className = 'reply-content';

        const replyTextPreview = document.createElement('span');
        replyTextPreview.className = 'reply-text-preview';

        const preview = !replyText || replyText.trim() === ''
        ? '[Message]' : replyText.length > 80 ? replyText.slice(0, 80) + '...' : replyText;
        replyTextPreview.textContent = preview;

        replyContent.appendChild(replyTextPreview);
        replyBlock.appendChild(replyLine);
        replyBlock.appendChild(replyContent);

        replyBlock.onclick = () => {
            const originalMsg = container.querySelector(`.message[data-id="${replyToId}"]`);
            if (originalMsg) {
                originalMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                originalMsg.classList.add('msg-highlight');
                setTimeout(() => originalMsg.classList.remove('msg-highlight'), 2000);
            }
        };
        return replyBlock;
    }

    static addMessage(
        container,
        from,
        text,
        msgId,
        timestampStr,
        isOwn = false,
        isRead = false,
        observer = null,
        insertAfterAnchor = null,
        replyToId = 0,
        replyText = '',
    ) {
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';

        const safeText = text ? String(text) : '';
        if (from === 'System') {
            msgDiv.classList.add('system-msg');
            const body = document.createElement('div');
            body.className = 'msg-text';
            body.innerText = safeText;
            msgDiv.appendChild(body);
            UIManager._insertAfterAnchor(container, msgDiv, insertAfterAnchor);
            return msgDiv;
        }

        if (isOwn) {
            msgDiv.classList.add('own');
        } else {
            msgDiv.dataset.sender = from;
            if (observer) observer.observe(msgDiv);
        }

        if (msgId) msgDiv.dataset.id = msgId;
        if (timestampStr) msgDiv.dataset.time = timestampStr;

        const avatarImg = document.createElement('img');
        avatarImg.className = 'msg-avatar';
        avatarImg.src = UIManager.getAvatarUrl(from, 40);
        avatarImg.alt = from;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content';

        const header = document.createElement('div');
        header.className = 'msg-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'msg-name';
        nameSpan.textContent = from;
        header.appendChild(nameSpan);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'msg-time';
        timeSpan.textContent = UIManager.formatTime(timestampStr);

        if (isOwn) {
            const checkIcon = document.createElement('span');
            checkIcon.className = 'read-receipt';
            const icon = document.createElement('i');
            icon.className = isRead ? 'ph ph-checks' : 'ph ph-check';
            icon.dataset.read = isRead ? '1' : '0';
            checkIcon.appendChild(icon);
            timeSpan.appendChild(checkIcon);
        }

        const body = UIManager.buildMessageBody(safeText);

        if (replyToId && replyToId > 0) {
            const replyBlock = UIManager._buildReplyBlock(container, replyToId, replyText);
            body.insertBefore(replyBlock, body.firstChild);
        }

        body.appendChild(timeSpan);
        contentDiv.appendChild(header);
        contentDiv.appendChild(body);
        msgDiv.appendChild(avatarImg);
        msgDiv.appendChild(contentDiv);

        UIManager._insertAfterAnchor(container, msgDiv, insertAfterAnchor);
        return msgDiv;
    }

    static renderDialogsList(listElement, dialogsArray, myNickname, onChatClick) {
        if (!listElement) return;
        listElement.innerHTML = '';

        if (!dialogsArray || dialogsArray.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-dialogs-msg';
            emptyMsg.innerText = 'No recent chats';
            listElement.appendChild(emptyMsg);
            return;
        }

        let savedMessagesDialog = null;
        const otherDialogs = [];

        dialogsArray.forEach((dialog) => {
            if (dialog.chat_name === 'Saved Messages' || dialog.chat_name === myNickname) {
                savedMessagesDialog = dialog;
            } else {
                otherDialogs.push(dialog);
            }
        });

        if (savedMessagesDialog) {
            listElement.appendChild(
                UIManager._buildDialogItem(
                    'Saved Messages',
                    savedMessagesDialog,
                    myNickname,
                    () => onChatClick(myNickname),
                    true,
                ),
            );
        }

        otherDialogs.forEach((dialog) => {
            listElement.appendChild(
                UIManager._buildDialogItem(
                    dialog.chat_name,
                    dialog,
                    myNickname,
                    () => onChatClick(dialog.chat_name),
                    false,
                ),
            );
        });
    }

    static _buildDialogItem(displayTitle, dialog, myNickname, onChatClick, isSaved = false) {
        const li = document.createElement('li');
        li.className = 'dialog-item';

        const avatar = document.createElement('img');
        if (isSaved) avatar.src = 'https://ui-avatars.com/api/?name=SM&background=5b7cff&color=fff';
        else if (dialog.avatar_url && dialog.avatar_url.trim() !== '') avatar.src = dialog.avatar_url;
        else avatar.src = UIManager.getAvatarUrl(displayTitle, 40);
        avatar.className = 'dialog-avatar';
        avatar.alt = displayTitle;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'dialog-info';

        const nameTimeDiv = document.createElement('div');
        nameTimeDiv.className = 'dialog-header';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = displayTitle;
        nameSpan.className = 'dialog-name';

        const timeSpan = document.createElement('span');
        timeSpan.textContent = UIManager.formatTime(dialog.time);
        timeSpan.className = 'dialog-time';

        nameTimeDiv.appendChild(nameSpan);
        nameTimeDiv.appendChild(timeSpan);

        const textBadgeDiv = document.createElement('div');
        textBadgeDiv.className = 'dialog-text-wrapper';

        const textSpan = document.createElement('span');
        textSpan.textContent = dialog.text;
        textSpan.className = 'dialog-text';

        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'dialog-badge-container';

        if (!isSaved) {
            if (dialog.last_sender === myNickname) {
                const tickIcon = document.createElement('i');
                tickIcon.className =
                    dialog.is_read_by_them === 1
                        ? 'ph ph-checks dialog-tick-icon read'
                        : 'ph ph-check dialog-tick-icon unread';
                badgeContainer.appendChild(tickIcon);
            } else {
                if (dialog.unread_count > 0) {
                    const badge = document.createElement('span');
                    badge.textContent = dialog.unread_count;
                    badge.className = 'dialog-unread-badge';
                    badgeContainer.appendChild(badge);
                    textSpan.classList.add('unread-bold');
                }
            }
        }

        textBadgeDiv.appendChild(textSpan);
        textBadgeDiv.appendChild(badgeContainer);

        infoDiv.appendChild(nameTimeDiv);
        infoDiv.appendChild(textBadgeDiv);
        li.appendChild(avatar);
        li.appendChild(infoDiv);

        li.onclick = onChatClick;
        return li;
    }

    static initContextMenu(messagesContainer, myNicknameFunc, ipcRenderer, onEditRequest, onReplyRequest) {
        const contextMenu = document.getElementById('context-menu');
        if (!contextMenu || !messagesContainer) return;

        let selectedMsgId = null;
        let selectedMsgElement = null;

        messagesContainer.addEventListener('contextmenu', (e) => {
            const msgDiv = e.target.closest('.message:not(.system-msg)');
            if (!msgDiv) return;

            e.preventDefault();
            selectedMsgId = parseInt(msgDiv.dataset.id);
            selectedMsgElement = msgDiv;

            const isOwn = msgDiv.classList.contains('own');
            const editItem = document.getElementById('ctx-edit');
            const deleteItem = document.getElementById('ctx-delete');
            const replyItem = document.getElementById('ctx-reply');

            let canEdit = isOwn;

            if (canEdit && msgDiv.dataset.time && msgDiv.dataset.time !== 'now') {
                const isoString = msgDiv.dataset.time.replace(' ', 'T') + 'Z';
                const msgDate = new Date(isoString).getTime();
                const diffHours = (Date.now() - msgDate) / (1000 * 60 * 60);
                if (diffHours > 1) canEdit = false;
            }
            if (editItem) editItem.style.display = canEdit ? 'flex' : 'none';
            if (deleteItem) deleteItem.style.display = isOwn ? 'flex' : 'none';
            if (replyItem) replyItem.style.display = 'flex';

            const menuW = 185,
                menuH = 120;
            const left = Math.min(e.pageX, window.innerWidth - menuW - 8);
            const top = Math.min(e.pageY, window.innerHeight - menuH - 8);

            contextMenu.style.top = top + 'px';
            contextMenu.style.left = left + 'px';
            contextMenu.classList.remove('hidden');
        });

        document.addEventListener('click', () => {
            contextMenu.classList.add('hidden');
        });

        document.getElementById('ctx-delete').onclick = () => {
            if (selectedMsgId) {
                ipcRenderer.send('to-cpp', JSON.stringify({ type: 'delete_msg', id: selectedMsgId }));
                contextMenu.classList.add('hidden');
            }
        };

        document.getElementById('ctx-edit').onclick = () => {
            if (selectedMsgId && selectedMsgElement) {
                const textSpan = selectedMsgElement.querySelector('.actual-text');
                const oldText = textSpan ? textSpan.textContent.trim() : '';

                contextMenu.classList.add('hidden');
                if (onEditRequest) onEditRequest(selectedMsgId, oldText);
            }
        };

        const ctxReply = document.getElementById('ctx-reply');
        if (ctxReply) {
            ctxReply.onclick = () => {
                if (selectedMsgId && selectedMsgElement) {
                    const textSpan = selectedMsgElement.querySelector('.actual-text');
                    const oldText = textSpan ? textSpan.textContent.trim() : '[Attachment]';
                    contextMenu.classList.add('hidden');

                    if (onReplyRequest) onReplyRequest(selectedMsgId, oldText);
                }
            };
        }
    }

    static setMessageEdited(msgElement, newText) {
        if (!msgElement) return;

        const textSpan = msgElement.querySelector('.actual-text');
        if (textSpan) {
            textSpan.textContent = newText;
        } else {
            const textEl = msgElement.querySelector('.msg-text');
            if (textEl) textEl.textContent = newText;
        }

        const timeSpan = msgElement.querySelector('.msg-time');
        if (timeSpan && !msgElement.querySelector('.edited-mark')) {
            const mark = document.createElement('span');
            mark.className = 'edited-mark';
            mark.textContent = ' (edited)';
            timeSpan.prepend(mark);
        }
    }
}

module.exports = UIManager;
