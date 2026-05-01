function initNavMenu() {
    const navItems = document.querySelectorAll('.app-nav .nav-item:not(#exit-btn)');
    navItems.forEach((item) => {
        item.onclick = () => {
            navItems.forEach((n) => n.classList.remove('active'));
            item.classList.add('active');
        };
    });
}

function getAvatarUrl(name, size = 40) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}`;
}

function formatTime(timestampStr) {
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

function getFileIcon(ext) {
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

function getMsgContent(element) {
    const img = element.querySelector('.msg-image img');
    const video = element.querySelector('.msg-image video');
    const textSpan = element.querySelector('.actual-text');
    const fileName = element.querySelector('.file-name');

    let url = '';
    if (img) url = img.getAttribute('src');
    else if (video) url = video.getAttribute('src');

    let text = '';
    if (textSpan) text = textSpan.textContent.trim();

    if (url && text) return `${url} || ${text}`;
    if (url) return url;
    if (text) return text;
    if (fileName) return `📎 ${fileName.textContent.trim()}`;

    return '[Attachment]';
}

function openLightbox(imageUrl) {
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

function _insertAfterAnchor(container, element, anchorElement) {
    if (anchorElement) {
        anchorElement.after(element);
    } else {
        container.appendChild(element);
    }
}

module.exports = {
    initNavMenu, getAvatarUrl, formatTime, getFileIcon,
    getMsgContent, openLightbox, _insertAfterAnchor
};
