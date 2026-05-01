const UIManager = require('../ui/ui_manager.js');

class ProfileManager {
    static init(ipcRenderer) {
        this.ipcRenderer = ipcRenderer;

        // --- DOM-elements ---
        this.modal = document.getElementById('profile-modal');
        this.overlay = document.getElementById('profile-overlay');
        this.closeBtn = document.getElementById('close-profile-btn');
        this.avatarImg = document.getElementById('profile-avatar-img');
        this.nicknameInput = document.getElementById('profile-nickname-input');
        this.usernameInput = document.getElementById('profile-username-input');
        this.bioInput = document.getElementById('profile-bio-input');
        this.addPhotoTextBtn = document.getElementById('add-photo-text-btn');
        this.uploadInput = document.getElementById('avatar-upload-input');
        this.avatarTrigger = document.getElementById('profile-avatar-trigger');

        this.setupListeners();
    }

    static setupListeners() {
        const profileBtn = document.querySelector('.my-avatar-placeholder');
        if (profileBtn) profileBtn.onclick = () => this.openProfile();
        if (this.closeBtn) this.closeBtn.onclick = () => this.closeProfile();
        if (this.overlay) this.overlay.onclick = () => this.closeProfile();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.closeProfile();
            }
        });

        document.querySelectorAll('.profile-editable-group .edit-icon-btn').forEach((icon) => {
            icon.onclick = (e) => {
                const input = e.target.previousElementSibling;
                input.removeAttribute('readonly');
                input.focus();
                const val = input.value;
                input.value = '';
                input.value = val;
            };
        });

        document.querySelectorAll('.profile-input').forEach((input) => {
            const lockInput = () => {
                input.setAttribute('readonly', 'true');
                if (input.value.trim() !== '') {
                    this.ipcRenderer.send(
                        'to-cpp',
                        JSON.stringify({
                            type: 'update_profile',
                            field: input.id,
                            value: input.value.trim(),
                        }),
                    );
                }
            };

            input.addEventListener('blur', lockInput);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
            });
        });

        const triggerUpload = () => {
            if (this.uploadInput) this.uploadInput.click();
        };
        if (this.avatarTrigger) this.avatarTrigger.onclick = triggerUpload;
        if (this.addPhotoTextBtn) this.addPhotoTextBtn.onclick = triggerUpload;

        if (this.uploadInput) {
            this.uploadInput.addEventListener('change', async (e) => this.handleAvatarUpload(e));
        }
    }

    static openProfile() {
        [this.nicknameInput, this.usernameInput, this.bioInput].forEach((input) =>
            input.setAttribute('readonly', 'true'),
        );

        this.modal.classList.remove('hidden');
        this.ipcRenderer.send('to-cpp', JSON.stringify({ type: 'get_profile' }));
    }

    static closeProfile() {
        this.modal.classList.add('hidden');
    }

    static fillProfileData(data) {
        this.avatarImg.src = data.avatar_url ? data.avatar_url : UIManager.getAvatarUrl(data.display_name, 120);
        this.nicknameInput.value = data.display_name;
        this.usernameInput.value = data.username;
        this.bioInput.value = data.bio;
    }

    static async handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (this.addPhotoTextBtn) {
            this.addPhotoTextBtn.textContent = 'Uploading...';
        }
        profileAvatarImg.style.opacity = '0.5';

        try {
            const response = await fetch(`http://localhost:8081/upload`, {
                method: 'POST',
                headers: {
                    filename: encodeURIComponent(file.name),
                },
                body: file,
            });
            const data = await response.json();

            if (data.status === 'success') {
                const avatarUrl = data.url;
                this.ipcRenderer.send(
                    'to-cpp',
                    JSON.stringify({
                        type: 'update_profile',
                        field: 'avatar_url',
                        value: avatarUrl,
                    }),
                );
                this.avatarImg.src = avatarUrl;

                const mainAvatarIcon = document.querySelector('.my-avatar-placeholder');
                if (mainAvatarIcon) {
                    mainAvatarIcon.textContent = '';
                    const newAvatarImg = document.createElement('img');
                    newAvatarImg.className = 'avatar-img';
                    newAvatarImg.src = avatarUrl;
                    newAvatarImg.alt = 'My Avatar';
                    mainAvatarIcon.appendChild(newAvatarImg);
                }
            } else {
                alert('Failed to upload avatar: ' + data.error);
            }
        } catch (error) {
            console.error('Avatar upload failed: ', error);
            alert('Server connection error. Is the file server running on port 8081?');
        } finally {
            if (this.addPhotoTextBtn) 
                this.addPhotoTextBtn.textContent = 'Add photo';
            this.avatarImg.style.opacity = '1';
            this.uploadInput.value = '';
        }
    }
}

module.exports = ProfileManager;
