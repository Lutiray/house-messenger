class UIManager {

    static getAvatarUrl(name, size = 40) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}`;
    }

    static formatTime(timestampStr) {
        let dateObj;
        if (!timestampStr || timestampStr === 'now') {
            dateObj = new Date();
        } else {
            const isoString = timestampStr.replace(' ', 'T') + 'Z';
            dateObj = new Date(isoString);
        }
        const h = dateObj.getHours().toString().padStart(2, '0');
        const m = dateObj.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    static getFileIcon(ext) {
        const map = {
            pdf:  'ph ph-file-pdf',
            doc:  'ph ph-file-doc',
            docx: 'ph ph-file-doc',
            xls:  'ph ph-file-xls',
            xlsx: 'ph ph-file-xls',
            zip:  'ph ph-file-zip',
            rar:  'ph ph-file-zip',
            txt:  'ph ph-file-text',
            mp3:  'ph ph-file-audio',
            wav:  'ph ph-file-audio',
        };
        return map[ext] || 'ph ph-file';
    }

    static buildMessageBody(text){
        const body = document.createElement('div');
        body.className = 'msg-text';
        const isFileUrl = text.startsWith('http://localhost:') && text.includes('/files/');
        if (!isFileUrl) {
            body.textContent = text;
            return body;
        }

        const ext = text.split('.').pop().toLowerCase();
        const parts = text.split('/');
        const filenameWithTime = parts[parts.length - 1];
        const originalName = decodeURIComponent(
            filenameWithTime.substring(filenameWithTime.indexOf('_') + 1)
        );

        body.style.background = 'transparent';
        body.style.padding = '0';

        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const vidExts = ['mp4', 'webm', 'ogg', 'mov'];

        if (imgExts.includes(ext)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'msg-image';
            const img = document.createElement('img');
            img.src = text;
            img.alt = originalName;
            img.onclick = () => UIManager.openLightbox(text);
            wrapper.appendChild(img);
            body.appendChild(wrapper);
        } 
        else if (vidExts.includes(ext)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'msg-image';
            const video = document.createElement('video');
            video.src = text;
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
            fileItem.onclick = () => window.open(text, '_blank');
 
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
        const overlay = document.querySelector('.lightbox-overlay');
        const closeBtn = document.getElementById('lightbox-close');

        lightboxImg.src = imageUrl;
        lightbox.classList.remove('hidden');

        const closeLightbox = () => {
            lightbox.classList.add('hidden');
            lightboxImg.src = '';
        };

        closeBtn.onclick = closeLightbox;
        overlay.onclick = closeLightbox;

        document.addEventListener('keydown', function enEsc(e) {
            if (e.key === 'Escape') {
                closeLightbox();
                document.removeEventListener('keydown', onEsc);
            }
        });
    }

    static _insertAfterAnchor(container, element, anchorElement) {
        if (anchorElement) {
            anchorElement.after(element);
        } else {
            container.appendChild(element);
        }
    }

    static addMessage(container, from, text, msgId, timestampStr, isOwn = false, 
                        isRead = false, observer = null, insertAfterAnchor = null) {
        if (!container) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';

        if (from === 'System') {
            msgDiv.classList.add('system-msg');
            const body = document.createElement('div');
            body.className = 'msg-text';
            body.innerText = text;
            msgDiv.appendChild(body);
            container.appendChild(msgDiv);
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

        header.appendChild(nameSpan);
        header.appendChild(timeSpan);

        const body = UIManager.buildMessageBody(text);

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

        dialogsArray.forEach(dialog => {
            listElement.appendChild(
                UIManager._buildDialogItem(dialog.from, dialog, onChatClick)
            );
        });
    }

    static _buildDialogItem(chatName, dialog, onChatClick) {
        const li = document.createElement('li');
        li.className = 'dialog-item'; 

        const avatar = document.createElement('img');
        avatar.src = UIManager.getAvatarUrl(chatName, 40);
        avatar.className = 'dialog-avatar';
        avatar.alt = chatName;
            
        const infoDiv = document.createElement('div');
        infoDiv.className = 'dialog-info';
            
        const nameTimeDiv = document.createElement('div');
        nameTimeDiv.className = 'dialog-header';
            
        const nameSpan = document.createElement('span');
        nameSpan.textContent  = chatName;
        nameSpan.className = 'dialog-name';
            
        const timeSpan = document.createElement('span');
        timeSpan.textContent = UIManager.formatTime(dialog.time);
        timeSpan.className = 'dialog-time';

        nameTimeDiv.appendChild(nameSpan);
        nameTimeDiv.appendChild(timeSpan);
            
        const textSpan = document.createElement('span');
        textSpan.textContent = dialog.text;
        textSpan.className = 'dialog-text';

        infoDiv.appendChild(nameTimeDiv);
        infoDiv.appendChild(textSpan);
        li.appendChild(avatar);
        li.appendChild(infoDiv);
            
        li.onclick = () => onChatClick(chatName);
        return li;
    }

    static initNavMenu() {
        const navItems = document.querySelectorAll('.app-nav .nav-item:not(#exit-btn)');
        navItems.forEach(item => {
            item.onclick = () => {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            };
        });
    }

    static initContextMenu(messagesContainer, myNicknameFunc, ipcRenderer, onEditRequest) {
        const contextMenu = document.getElementById('context-menu');
        if (!contextMenu || !messagesContainer) return;

        let selectedMsgId = null;
        let selectedMsgElement = null;

        messagesContainer.addEventListener('contextmenu', (e) => {
            const msgDiv = e.target.closest('.message');
            if (!msgDiv || !msgDiv.classList.contains('own')) return;

            e.preventDefault(); 
            selectedMsgId = parseInt(msgDiv.dataset.id);
            selectedMsgElement = msgDiv;

            const menuW = 185, menuH = 80;
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
                ipcRenderer.send('to-cpp', JSON.stringify({ type: "delete_msg", id: selectedMsgId }));
            }
        };

        document.getElementById('ctx-edit').onclick = () => {
            if (selectedMsgId && selectedMsgElement) {
                const textNode = selectedMsgElement.querySelector('.msg-text');
                const clone = textNode.cloneNode(true);
                clone.querySelectorAll('span').forEach(s => s.remove());
                const oldText = clone.textContent.trim();

                contextMenu.classList.add('hidden');
                if (onEditRequest) onEditRequest(selectedMsgId, oldText);
            }
        };
    }

    static setMessageEdited(msgElement, newText) {
        if (!msgElement) return;
        const textEl = msgElement.querySelector('.msg-text');
        if (!textEl) return;

        const oldMark = textEl.querySelector('.edited-mark');
        if (oldMark) oldMark.remove();

        textEl.textContent = newText;

        const mark = document.createElement('span');
        mark.className = 'edited-mark';
        mark.textContent = ' (edited)';
        textEl.appendChild(mark);
    }
}

module.exports = UIManager;