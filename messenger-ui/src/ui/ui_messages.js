const {
    getAvatarUrl,
    formatTime,
    getFileIcon,
    openLightbox,
    _insertAfterAnchor,
    getMsgContent,
} = require('./ui_utils.js');

function buildMessageBody(text) {
    const body = document.createElement('div');
    body.className = 'msg-text';

    const safeText = text ? String(text) : '';
    let mainContent = safeText;
    let caption = '';

    if (safeText.includes(' || ')) {
        const parts = safeText.split(' || ');
        mainContent = parts[0];
        caption = parts[1];
    }
    const isFileUrl =
        safeText.startsWith('http://localhost:') && (safeText.includes('/files/') || safeText.includes('/upload'));

    if (!isFileUrl) {
        const textSpan = document.createElement('span');
        textSpan.className = 'actual-text';
        textSpan.textContent = safeText;
        body.appendChild(textSpan);
        return body;
    }

    const ext = mainContent.split('.').pop().toLowerCase();
    const parts = mainContent.split('/');
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
        img.src = mainContent;
        img.alt = originalName;
        img.onclick = () => openLightbox(mainContent);
        wrapper.appendChild(img);
        body.appendChild(wrapper);
    } else if (vidExts.includes(ext)) {
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-image';
        const video = document.createElement('video');
        video.src = mainContent;
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
        icon.className = getFileIcon(ext);
        iconDiv.appendChild(icon);
        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-name';
        nameDiv.textContent = originalName;
        fileItem.appendChild(iconDiv);
        fileItem.appendChild(nameDiv);
        body.appendChild(fileItem);
    }
    if (caption) {
        const capSpan = document.createElement('span');
        capSpan.className = 'actual-text';
        capSpan.textContent = caption;
        body.appendChild(capSpan);
        body.style.background = '';
        body.style.padding = '';
    }
    return body;
}

function _buildReplyBlock(container, replyToId, replyText) {
    const replyBlock = document.createElement('div');
    replyBlock.className = 'reply-block';

    const leftContent = document.createElement('div');
    leftContent.className = 'left-content';

    const replyLine = document.createElement('div');
    replyLine.className = 'reply-line';

    const replyContent = document.createElement('div');
    replyContent.className = 'reply-content';

    const replyTitle = document.createElement('span');
    replyTitle.className = 'reply-title';
    replyTitle.textContent = 'Reply';

    const replyTextPreview = document.createElement('span');
    replyTextPreview.className = 'reply-text-preview';

    const safeText = replyText ? String(replyText) : '';
    let mainContent = safeText;
    let caption = '';
    if (safeText.includes(' || ')) {
        const parts = safeText.split(' || ');
        mainContent = parts[0].trim();
        caption = parts[1].trim();
    }

    const isFileUrl =
        mainContent.startsWith('http://localhost:') &&
        (mainContent.includes('/files/') || mainContent.includes('/upload'));

    let preview = '';
    if (isFileUrl) {
        preview = caption ? `${caption}` : '[Photo]';
    } else {
        preview =
            (!safeText || safeText.trim() === '')
                ? '[Message]'
                : safeText.length > 80
                  ? safeText.slice(0, 80) + '...'
                  : safeText;
    }
    replyTextPreview.textContent = preview;

    replyContent.appendChild(replyTitle);
    replyContent.appendChild(replyTextPreview);
    leftContent.appendChild(replyLine);
    leftContent.appendChild(replyContent);
    replyBlock.appendChild(leftContent);

    if (isFileUrl) {
        const ext = mainContent.split('.').pop().toLowerCase();
        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        
        if (imgExts.includes(ext)) {
            const thumb = document.createElement('img');
            thumb.src = mainContent;
            
            thumb.style.width = '36px';
            thumb.style.height = '36px';
            thumb.style.objectFit = 'cover';
            thumb.style.borderRadius = '4px';
            thumb.style.marginLeft = '12px';
            thumb.style.flexShrink = '0';
            
            replyBlock.appendChild(thumb);
        }
    }

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

function _buildForwardBlock(forwardFrom, forwardText) {
    const block = document.createElement('div');
    block.className = 'forward-block';

    const title = document.createElement('span');
    title.className = 'forward-title-in-msg';
    title.textContent = 'Forwarded from ' + forwardFrom;
    block.appendChild(title);

    const safeText = forwardText ? String(forwardText) : '';
    let mainContent = safeText;
    if (safeText.includes(' || ')) 
        mainContent = safeText.split(' || ')[0];

    const isFileUrl =
        mainContent.startsWith('http://localhost:') && (mainContent.includes('/files/') || mainContent.includes('/upload'));

    if (isFileUrl) {
        const fileBody = buildMessageBody(safeText);
        fileBody.style.marginTop = '4px';
        block.appendChild(fileBody);
    } else {
        const textPreview = document.createElement('span');
        textPreview.className = 'forward-text';
        textPreview.textContent = safeText || '[Empty]';
        block.appendChild(textPreview);
    }
    return block;
}

function addMessage(
    container, from, text, msgId, timestampStr, isOwn = false,
    isRead = false, observer = null, insertAfterAnchor = null,
    replyToId = 0, replyText = '', forwardFrom = '', forwardText = '',
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
        _insertAfterAnchor(container, msgDiv, insertAfterAnchor);
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
    avatarImg.src = getAvatarUrl(from, 40);
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
    timeSpan.textContent = formatTime(timestampStr);

    if (isOwn) {
        const checkIcon = document.createElement('span');
        checkIcon.className = 'read-receipt';
        const icon = document.createElement('i');
        icon.className = isRead ? 'ph ph-checks' : 'ph ph-check';
        icon.dataset.read = isRead ? '1' : '0';
        checkIcon.appendChild(icon);
        timeSpan.appendChild(checkIcon);
    }

    const body = buildMessageBody(safeText);

    if (replyToId && replyToId > 0) {
        let finalReplyText = replyText;
        if (!finalReplyText || finalReplyText.trim() === '') {
            const originalMsg = container.querySelector(`.message[data-id="${replyToId}"]`);
            if (originalMsg) finalReplyText = getMsgContent(originalMsg);
        }
        const replyBlock = _buildReplyBlock(container, replyToId, finalReplyText);
        body.insertBefore(replyBlock, body.firstChild);
    }

    if (forwardFrom && forwardFrom !== '') {
        const forwardBlock = _buildForwardBlock(forwardFrom, forwardText);
        body.insertBefore(forwardBlock, body.firstChild);
    }

    body.appendChild(timeSpan);
    contentDiv.appendChild(header);
    contentDiv.appendChild(body);
    msgDiv.appendChild(avatarImg);
    msgDiv.appendChild(contentDiv);

    _insertAfterAnchor(container, msgDiv, insertAfterAnchor);
    return msgDiv;
}

function setMessageEdited(msgElement, newText) {
    if (!msgElement) return;

    const oldBody = msgElement.querySelector('.msg-text');
    if (!oldBody) return;

    const timeSpan = msgElement.querySelector('.msg-time');
    const replyBlock = oldBody.querySelector('.reply-block');
    const forwardBlock = oldBody.querySelector('.forward-block');

    if (timeSpan && !msgElement.querySelector('.edited-mark')) {
        const mark = document.createElement('span');
        mark.className = 'edited-mark';
        mark.textContent = ' (edited)';
        timeSpan.prepend(mark);
    }

    const newBody = buildMessageBody(newText);

    if (forwardBlock) newBody.insertBefore(forwardBlock, newBody.firstChild);
    if (replyBlock) newBody.insertBefore(replyBlock, forwardBlock ? newBody.children[1] : newBody.firstChild);
    if (timeSpan) newBody.appendChild(timeSpan);
    oldBody.replaceWith(newBody);
}

module.exports = { buildMessageBody, _buildReplyBlock, _buildForwardBlock, addMessage, setMessageEdited };
