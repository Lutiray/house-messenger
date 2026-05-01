const { getAvatarUrl, formatTime } = require('./ui_utils.js');

function _buildDialogItem(displayTitle, dialog, myNickname, onChatClick, isSaved = false) {
    const li = document.createElement('li');
    li.className = 'dialog-item';

    const avatar = document.createElement('img');
    if (isSaved) avatar.src = 'https://ui-avatars.com/api/?name=SM&background=5b7cff&color=fff';
    else if (dialog.avatar_url && dialog.avatar_url.trim() !== '') avatar.src = dialog.avatar_url;
    else avatar.src = getAvatarUrl(displayTitle, 40);
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
    timeSpan.textContent = formatTime(dialog.time);
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

function renderDialogsList(listElement, dialogsArray, myNickname, onChatClick) {
    if (!listElement) return;
    listElement.textContent = '';

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
            _buildDialogItem(
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
            _buildDialogItem(
                dialog.chat_name,
                dialog,
                myNickname,
                () => onChatClick(dialog.chat_name),
                false,
            ),
        );
    });
}

module.exports = { renderDialogsList, _buildDialogItem };
