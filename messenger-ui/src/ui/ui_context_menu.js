const { getMsgContent } = require('./ui_utils.js');

function initContextMenu(
    messagesContainer,
    myNicknameFunc,
    ipcRenderer,
    onEditRequest,
    onReplyRequest,
    onForwardRequest,
) {
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
        const forwardItem = document.getElementById('ctx-forward');

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
        if (forwardItem) forwardItem.style.display = 'flex';

        const menuW = 185, menuH = 160;
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
                const oldText = getMsgContent(selectedMsgElement);
                contextMenu.classList.add('hidden');
                if (onReplyRequest) onReplyRequest(selectedMsgId, oldText);
            }
        };
    }

    const forwardItem = document.getElementById('ctx-forward');
    if (forwardItem) {
        forwardItem.onclick = () => {
            if (selectedMsgId && selectedMsgElement) {
                const oldText = getMsgContent(selectedMsgElement);
                const sender = selectedMsgElement.classList.contains('own')
                    ? myNicknameFunc()
                    : selectedMsgElement.dataset.sender;

                contextMenu.classList.add('hidden');
                if (onForwardRequest) onForwardRequest(selectedMsgId, oldText, sender);
            }
        };
    }
}

module.exports = { initContextMenu };
