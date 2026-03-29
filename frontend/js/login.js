// ============================================================
// PaVa-Vak Login Logic  |  login.js
// Web login now enforces password reset after admin-issued OTP login.
// ============================================================

const API_URL = '/api';
let postResetRedirect = '/chat.html';

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    checkServer();
    initLogin();
    initTwoFactor();
    initForcePasswordReset();
    initPasswordToggle();
    initForgotPassword();
});

async function checkServer() {
    const statusEl = document.getElementById('status');

    try {
        await fetch(`${API_URL}/auth/session`, {
            method: 'GET',
            credentials: 'include'
        });
        statusEl.textContent = 'Server Online';
        statusEl.className = 'status online';
    } catch (error) {
        statusEl.textContent = 'Server Offline';
        statusEl.className = 'status';
    }
}

function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

function initLogin() {
    const form = document.getElementById('loginForm');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                if (data.requires2FA) {
                    showTwoFactorForm();
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Login';
                } else if (needsForcedReset(data)) {
                    postResetRedirect = resolveRedirect(data);
                    showForcePasswordResetForm();
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Login';
                } else {
                    showMessage('Login successful!', 'success');
                    setTimeout(() => {
                        window.location.href = resolveRedirect(data);
                    }, 1000);
                }
            } else {
                showMessage(data.error || 'Login failed', 'error');
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        } catch (error) {
            showMessage('Server connection failed', 'error');
            console.error('Login error:', error);
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });
}

function initTwoFactor() {
    const form = document.getElementById('twoFactorForm');
    const cancelBtn = document.getElementById('cancel2FAButton');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const code = document.getElementById('twoFactorCode').value.trim();
        const verifyBtn = document.getElementById('verify2FAButton');

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            const response = await fetch(`${API_URL}/auth/verify-2fa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (data.success) {
                if (needsForcedReset(data)) {
                    postResetRedirect = resolveRedirect(data);
                    showForcePasswordResetForm();
                } else {
                    showMessage('2FA verified!', 'success');
                    setTimeout(() => {
                        window.location.href = resolveRedirect(data);
                    }, 1000);
                }
            } else {
                showMessage(data.error || 'Invalid 2FA code', 'error');
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify';
                document.getElementById('twoFactorCode').value = '';
            }
        } catch (error) {
            showMessage('Verification failed', 'error');
            console.error('2FA error:', error);
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify';
        }
    });

    cancelBtn.addEventListener('click', function() {
        hideTwoFactorForm();
    });

    const codeInput = document.getElementById('twoFactorCode');
    codeInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 6);
    });
}

function initForcePasswordReset() {
    const form = document.getElementById('forcePasswordResetForm');
    const saveBtn = document.getElementById('saveResetPasswordButton');
    const logoutBtn = document.getElementById('logoutResetButton');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const password = document.getElementById('forceResetPassword').value;
        const confirmPassword = document.getElementById('forceResetConfirmPassword').value;

        if (password.length < 8) {
            showMessage('Password must be at least 8 characters', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const response = await fetch(`${API_URL}/auth/complete-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newPassword: password })
            });

            const data = await response.json();
            if (data.success) {
                showMessage('Password updated. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = postResetRedirect;
                }, 800);
            } else {
                showMessage(data.error || 'Failed to update password', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save New Password';
            }
        } catch (error) {
            showMessage('Failed to update password', 'error');
            console.error('Forced reset error:', error);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save New Password';
        }
    });

    logoutBtn.addEventListener('click', async function() {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout after forced reset failed:', error);
        }
        window.location.href = '/';
    });
}

function showTwoFactorForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('twoFactorForm').classList.remove('hidden');
    document.getElementById('forcePasswordResetForm').classList.add('hidden');
    document.getElementById('twoFactorCode').focus();
}

function hideTwoFactorForm() {
    document.getElementById('twoFactorForm').classList.add('hidden');
    document.getElementById('forcePasswordResetForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('twoFactorCode').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').textContent = 'Login';
}

function showForcePasswordResetForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('twoFactorForm').classList.add('hidden');
    document.getElementById('forcePasswordResetForm').classList.remove('hidden');
    document.getElementById('forceResetPassword').value = '';
    document.getElementById('forceResetConfirmPassword').value = '';
    document.getElementById('saveResetPasswordButton').disabled = false;
    document.getElementById('saveResetPasswordButton').textContent = 'Save New Password';
    document.getElementById('forceResetPassword').focus();
}

function initPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    toggleBtn.addEventListener('click', function() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = 'Hide';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = 'Show';
        }
    });
}

function initForgotPassword() {
    const link = document.getElementById('forgotPasswordLink');

    link.addEventListener('click', async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const value = prompt('Enter your username or email to request password reset:', username);
        if (!value || !value.trim()) return;

        try {
            const response = await fetch(`${API_URL}/auth/request-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ usernameOrEmail: value.trim() })
            });
            const data = await response.json();
            if (data.success) {
                showMessage('Reset request sent. Admin will issue one-time password.', 'success');
            } else {
                showMessage(data.error || 'Failed to submit reset request', 'error');
            }
        } catch (error) {
            showMessage('Failed to submit reset request', 'error');
        }
    });
}

async function checkSession() {
    try {
        const response = await fetch(`${API_URL}/auth/session?t=${Date.now()}`, {
            credentials: 'include',
            cache: 'no-store'
        });
        const data = await response.json();

        if (data.authenticated) {
            if (data.user.forcePasswordReset) {
                postResetRedirect = data.user.isAdmin ? '/admin.html' : '/chat.html';
                showForcePasswordResetForm();
            } else if (data.user.isAdmin) {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/chat.html';
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

function needsForcedReset(data) {
    return !!(data.requiresPasswordReset || (data.user && data.user.forcePasswordReset));
}

function resolveRedirect(data) {
    if (data.redirect) return data.redirect;
    if (data.user && data.user.isAdmin) return '/admin.html';
    return '/chat.html';
}
