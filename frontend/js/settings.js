const API_URL = 'http://localhost:3000/api';

let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadUserData();
    initializeTabs();
    initializePasswordToggles();
    setupEventListeners();
});

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/index.html';
            return;
        }

        currentUser = data.user;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/index.html';
    }
}

// Load user data
async function loadUserData() {
    try {
        const response = await fetch(`${API_URL}/users/profile`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            const user = data.user;

            // Profile tab
            document.getElementById('username').value = user.username;
            document.getElementById('email').value = user.email;
            document.getElementById('fullName').value = user.fullName || '';

            // Account tab
            document.getElementById('accountStatus').textContent = user.isApproved ? 'Active' : 'Pending';
            document.getElementById('accountStatus').className = user.isApproved ? 'status-badge active' : 'status-badge disabled';
            document.getElementById('memberSince').textContent = formatDate(user.createdAt);
            document.getElementById('lastLogin').textContent = user.lastLogin ? formatDate(user.lastLogin) : 'Never';
            document.getElementById('userRole').textContent = user.isAdmin ? 'Administrator' : 'User';

            // 2FA status
            const twoFactorEnabled = user.twoFactorEnabled;
            document.getElementById('twoFactorStatusText').textContent = twoFactorEnabled ? 'Enabled' : 'Disabled';
            document.getElementById('twoFactorStatusText').className = twoFactorEnabled ? 'status-badge active' : 'status-badge disabled';
            document.getElementById('toggle2FABtn').textContent = twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA';
        }
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

// Initialize tabs
function initializeTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
        });
    });
}

// Initialize password toggles
function initializePasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('backToChatBtn').addEventListener('click', () => {
        window.location.href = '/chat.html';
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    document.getElementById('toggle2FABtn').addEventListener('click', toggle2FA);
    document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount);
}

// Update profile
async function updateProfile(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();

    try {
        const response = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fullName })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Profile updated successfully', 'success');
        } else {
            showToast(data.error || 'Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('Failed to update profile', 'error');
    }
}

// Change password
async function changePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Password changed successfully', 'success');
            document.getElementById('passwordForm').reset();
        } else {
            showToast(data.error || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Change password error:', error);
        showToast('Failed to change password', 'error');
    }
}

// Toggle 2FA
async function toggle2FA() {
    showToast('2FA feature coming soon', 'error');
}

// Delete account
async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }

    const password = prompt('Enter your password to confirm deletion:');
    if (!password) return;

    try {
        const response = await fetch(`${API_URL}/users/delete-account`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Account deleted', 'success');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 2000);
        } else {
            showToast(data.error || 'Failed to delete account', 'error');
        }
    } catch (error) {
        console.error('Delete account error:', error);
        showToast('Failed to delete account', 'error');
    }
}

// Logout
async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/index.html';
    }
}

// Show toast
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}