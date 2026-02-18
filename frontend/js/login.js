const API_URL = 'http://localhost:3000/api';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    checkServer();
    initLogin();
    initTwoFactor();
    initPasswordToggle();
    initForgotPassword();
});

// Check server status
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

// Show message
function showMessage(text, type) {
    const messageEl = document.getElementById('message');

    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';

    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// Initialize login form
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
                    showTwoFactorForm();
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Login';
                } else {
                    showMessage('✓ Login successful!', 'success');
                    
                    setTimeout(() => {
                        window.location.href = data.redirect || '/chat.html';
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

// Initialize 2FA form
function initTwoFactor() {
    const form = document.getElementById('twoFactorForm');
    const cancelBtn = document.getElementById('cancel2FAButton');

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
                    window.location.href = data.redirect || (data.user.isAdmin ? '/admin.html' : '/chat.html');
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

    cancelBtn.addEventListener('click', function() {
        hideTwoFactorForm();
    });

    // Auto-format 2FA code
    const codeInput = document.getElementById('twoFactorCode');
    codeInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 6);
    });
}

// Show 2FA form
function showTwoFactorForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('twoFactorForm').classList.remove('hidden');
    document.getElementById('twoFactorCode').focus();
}

// Hide 2FA form
function hideTwoFactorForm() {
    document.getElementById('twoFactorForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('twoFactorCode').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').textContent = 'Login';
}

// Initialize password toggle
function initPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    toggleBtn.addEventListener('click', function() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
        }
    });
}

// Initialize forgot password
function initForgotPassword() {
    const link = document.getElementById('forgotPasswordLink');

    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        alert(
            'Password Reset Instructions:\n\n' +
            '1. Contact your system administrator\n' +
            '2. Or run: node scripts/resetPassword.js\n' +
            '   in the backend folder\n\n' +
            'You will need command line access to reset your password.'
        );
    });
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