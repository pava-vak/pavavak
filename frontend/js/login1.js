const API_URL = 'https://pavavak-backend.onrender.com/api';

async function checkServer() {
    const statusEl = document.getElementById('status');

    try {
        await fetch(`${API_URL}/auth/login`, {
            method: 'OPTIONS'
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

        const email = document.getElementById('email').value;
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
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('✓ Login successful!', 'success');

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                setTimeout(() => {
                    if (data.user.role === 'ADMIN') {
                        window.location.href = '/admin.html';
                    } else {
                        window.location.href = '/chat.html';
                    }
                }, 1000);
            } else {
                showMessage(data.error || 'Login failed', 'error');
            }

        } catch (error) {
            showMessage('Server connection failed', 'error');
            console.error('Login error:', error);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });

    checkServer();
}

document.addEventListener('DOMContentLoaded', initLogin);
