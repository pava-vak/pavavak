const API_URL = 'http://localhost:3000/api';

async function checkServer() {
    const statusEl = document.getElementById('status');

    try {
        await fetch(`${API_URL}/auth/session`, {
            method: 'GET',
            credentials: 'include'
        });

        statusEl.textContent = '✓ Server Online';
        statusEl.className = 'status online';
    } catch (error) {
        statusEl.textContent = '✗ Server Offline';
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

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                if (data.requires2FA) {
                    // Show 2FA form
                    showTwoFactorForm();
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Login';
                } else {
                    showMessage('✓ Login successful!', 'success');
                    
                    setTimeout(() => {
                        if (data.user.isAdmin) {
                            window.location.href = '/admin.html';
                        } else {
                            window.location.href = '/chat.html';
                        }
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

    checkServer();
}

function showTwoFactorForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('twoFactorForm').style.display = 'block';
    document.getElementById('twoFactorCode').focus();
}

function cancelTwoFactor() {
    document.getElementById('twoFactorForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('twoFactorCode').value = '';
    document.getElementById('password').value = '';
}

function initTwoFactor() {
    const form = document.getElementById('twoFactorForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const code = document.getElementById('twoFactorCode').value.trim();
        const verifyBtn = document.getElementById('verify2FAButton');

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            const response = await fetch(`${API_URL}/auth/verify-2fa`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('✓ 2FA verified!', 'success');
                
                setTimeout(() => {
                    if (data.user.isAdmin) {
                        window.location.href = '/admin.html';
                    } else {
                        window.location.href = '/chat.html';
                    }
                }, 1000);
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
}

// Auto-format 2FA code
function formatTwoFactorCode() {
    const input = document.getElementById('twoFactorCode');
    if (input) {
        input.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 6);
        });
    }
}

// Check if already logged in
async function checkSession() {
    try {
        const response = await fetch(`${API_URL}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.authenticated) {
            if (data.user.isAdmin) {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/chat.html';
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    initLogin();
    initTwoFactor();
    formatTwoFactorCode();
});
