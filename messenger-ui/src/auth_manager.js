class AuthManager {
    static init(ipcRenderer) {
        this.ipcRenderer = ipcRenderer;

        // --- DOM-elements ---
        this.authScreen = document.getElementById('auth-screen');
        this.chatScreen = document.getElementById('chat-screen');
        this.regScreen = document.getElementById('reg-screen');
        this.authStatus = document.getElementById('auth-status');
        this.regStatus = document.getElementById('reg-status');
        // --- Buttons ---
        this.regBtn = document.getElementById('reg-btn');
        this.goToLoginBtn = document.getElementById('go-to-login');
        this.loginBtn = document.getElementById('login-btn');
        this.regSubmitBtn = document.getElementById('reg-submit-btn');
        this.exitBtn = document.getElementById('exit-btn');

        this.loginUserInp = document.getElementById('username');
        this.loginPassInp = document.getElementById('password');
        this.regUserInp = document.getElementById('reg-username');
        this.regPassInp = document.getElementById('reg-password');
        this.regPassConfInp = document.getElementById('reg-password-confirm');
        this.regEmailInp = document.getElementById('reg-email');
        this.regPhoneInp = document.getElementById('reg-phone');

        regBtn.onclick = () => this.showReg();
        goToLoginBtn.onclick = (e) => {
            e.preventDefault();
            this.showLogin();
        };

        loginBtn.onclick = () => this.handleLogin();
        regSubmitBtn.onclick = () => this.handleReg();

        exitBtn.onclick = () => {
            ipcRenderer.send('to-cpp', '/exit');
            ipcRenderer.send('restart-app');
        };
    }

    static showReg() {
        this.authScreen.classList.add('hidden');
        this.regScreen.classList.remove('hidden');
        if (this.authStatus) this.authStatus.textContent = '';
    }

    static showLogin() {
        this.regScreen.classList.add('hidden');
        this.authScreen.classList.remove('hidden');
        if (this.regStatus) this.regStatus.textContent = '';
    }

    static handleLogin() {
        const user = this.loginUserInp.value.trim();
        const password = this.loginPassInp.value;
        if (!user || !password) {
            this.authStatus.textContent = 'Please fill in all fields';
            return;
        }

        this.ipcRenderer.send('to-cpp', '/connect');
        setTimeout(() => this.ipcRenderer.send('to-cpp', `/login ${user} ${password}`), 100);
    }

    static handleReg() {
        const user = this.regUserInp.value.trim();
        const pass = this.regPassInp.value;
        const confirm = this.regPassConfInp.value;
        const email = this.regEmailInp.value.trim() || 'none';
        const phone = this.regPhoneInp.value.trim() || 'none';

        if (!user || !pass) {
            this.regStatus.textContent = 'Username and password are required';
            return;
        }

        if (pass !== confirm) {
            this.regStatus.textContent = 'Passwords do not match!';
            return;
        }

        this.ipcRenderer.send('to-cpp', '/connect');
        setTimeout(() => this.ipcRenderer.send('to-cpp', `/reg ${user} ${pass} ${email} ${phone}`), 100);
    }

    static onAuthSuccess() {
        this.authScreen.classList.add('hidden');
        this.regScreen.classList.add('hidden');
        this.chatScreen.classList.remove('hidden');
    }

    static showError(message) {
        if (this.authStatus) this.authStatus.textContent = message;
        if (this.regStatus) this.regStatus.textContent = message;
    }
}

module.exports = AuthManager;
