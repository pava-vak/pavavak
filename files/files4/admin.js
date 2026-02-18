const API_URL = 'http://localhost:3000/api';

let currentTab = 'pending';
let allUsers = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadDashboardData();
    initializeTabs();
    setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
});

// Check if user is authenticated and is admin
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

        if (!data.user.isAdmin) {
            alert('Access denied. Admin privileges required.');
            window.location.href = '/chat.html';
            return;
        }

        document.getElementById('adminUsername').textContent = data.user.fullName || data.user.username;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/index.html';
    }
}

// Load all dashboard data
async function loadDashboardData() {
    await Promise.all([
        loadStats(),
        loadPendingUsers(),
        loadAllUsers(),
        loadConnections(),
        loadInvites(),
        loadMessages()
    ]);
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/admin/dashboard/stats`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('statTotalUsers').textContent = data.stats.totalUsers;
            document.getElementById('statPendingUsers').textContent = data.stats.pendingUsers;
            document.getElementById('statConnections').textContent = data.stats.activeConnections;
            document.getElementById('statMessages').textContent = data.stats.totalMessages;
            document.getElementById('pendingCount').textContent = data.stats.pendingUsers;
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Load pending users
async function loadPendingUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users/pending`, {
            credentials: 'include'
        });
        const data = await response.json();

        const container = document.getElementById('pendingUsersList');
        
        if (data.success && data.pendingUsers.length > 0) {
            container.innerHTML = data.pendingUsers.map(user => `
                <div class="user-card">
                    <div class="user-info">
                        <div class="user-name">${user.username}</div>
                        <div class="user-email">${user.email}</div>
                        <div class="user-fullname">${user.full_name}</div>
                        <div class="user-date">Registered: ${formatDate(user.created_at)}</div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-approve" onclick="approveUser(${user.user_id}, '${user.username}')">
                            ✓ Approve
                        </button>
                        <button class="btn-reject" onclick="rejectUser(${user.user_id}, '${user.username}')">
                            ✗ Reject
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">No pending approvals</p>';
        }
    } catch (error) {
        console.error('Load pending users error:', error);
    }
}

// Load all users
async function loadAllUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            allUsers = data.users;
            const tbody = document.getElementById('usersTableBody');
            
            tbody.innerHTML = data.users.map(user => `
                <tr>
                    <td>${user.user_id}</td>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.email}</td>
                    <td>
                        ${user.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
                        ${user.is_approved ? '<span class="badge badge-approved">APPROVED</span>' : '<span class="badge badge-pending">PENDING</span>'}
                    </td>
                    <td>
                        ${!user.is_admin ? `
                            <button class="btn-small" onclick="toggleAdmin(${user.user_id}, ${user.is_admin}, '${user.username}')">
                                Make Admin
                            </button>
                            <button class="btn-small btn-danger" onclick="deleteUser(${user.user_id}, '${user.username}')">
                                Delete
                            </button>
                        ` : '<span class="text-muted">Current Admin</span>'}
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Load users error:', error);
    }
}

// Load connections
async function loadConnections() {
    try {
        const response = await fetch(`${API_URL}/admin/connections`, {
            credentials: 'include'
        });
        const data = await response.json();

        const container = document.getElementById('connectionsList');
        
        if (data.success && data.connections.length > 0) {
            container.innerHTML = data.connections.map(conn => `
                <div class="connection-card">
                    <div class="connection-info">
                        <div class="connection-users">
                            ${conn.user1.username} ↔ ${conn.user2.username}
                        </div>
                        <div class="connection-names">
                            ${conn.user1.full_name} and ${conn.user2.full_name}
                        </div>
                        <div class="connection-date">
                            Created: ${formatDate(conn.createdAt)}
                        </div>
                    </div>
                    <button class="btn-danger" onclick="deleteConnection(${conn.connectionId}, '${conn.user1.username}', '${conn.user2.username}')">
                        Delete
                    </button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">No connections yet</p>';
        }
    } catch (error) {
        console.error('Load connections error:', error);
    }
}

// Load invite codes
async function loadInvites() {
    try {
        const response = await fetch(`${API_URL}/admin/invites`, {
            credentials: 'include'
        });
        const data = await response.json();

        const container = document.getElementById('invitesList');
        
        if (data.success && data.invites.length > 0) {
            container.innerHTML = data.invites.map(invite => `
                <div class="invite-card">
                    <div class="invite-info">
                        <div class="invite-code">${invite.code}</div>
                        <div class="invite-status">
                            ${invite.used ? 
                                `<span class="status-used">✓ Used by: ${invite.usedBy}</span>` : 
                                '<span class="status-unused">⏳ Not used yet</span>'
                            }
                        </div>
                        <div class="invite-date">
                            Created: ${formatDate(invite.createdAt)}
                        </div>
                    </div>
                    ${!invite.used ? `
                        <button class="btn-danger" onclick="deleteInvite('${invite.code}')">
                            Delete
                        </button>
                    ` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">No invite codes</p>';
        }
    } catch (error) {
        console.error('Load invites error:', error);
    }
}

// Load recent messages
async function loadMessages() {
    try {
        const response = await fetch(`${API_URL}/admin/messages/recent?limit=20`, {
            credentials: 'include'
        });
        const data = await response.json();

        const container = document.getElementById('messagesList');
        
        if (data.success && data.messages.length > 0) {
            container.innerHTML = data.messages.map(msg => `
                <div class="message-card">
                    <div class="message-header">
                        <span class="message-from">${msg.sender.username}</span>
                        → 
                        <span class="message-to">${msg.receiver.username}</span>
                        <button class="btn-small btn-danger" onclick="deleteMessage(${msg.messageId})">
                            Delete
                        </button>
                    </div>
                    <div class="message-content">${escapeHtml(msg.content)}</div>
                    <div class="message-date">
                        ${formatDate(msg.sentAt)} 
                        ${msg.isRead ? '• Read' : '• Unread'}
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">No messages yet</p>';
        }
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

// Initialize tabs
function initializeTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

// Switch tabs
function switchTab(tab) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`content-${tab}`).classList.add('active');

    currentTab = tab;
}

// Approve user
async function approveUser(userId, username) {
    if (!confirm(`Approve user: ${username}?`)) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/approve`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            showToast(`User ${username} approved!`, 'success');
            await loadDashboardData();
        } else {
            showToast(data.error || 'Failed to approve user', 'error');
        }
    } catch (error) {
        console.error('Approve user error:', error);
        showToast('Failed to approve user', 'error');
    }
}

// Reject user
async function rejectUser(userId, username) {
    if (!confirm(`Reject and delete user: ${username}? This cannot be undone.`)) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/reject`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            showToast(`User ${username} rejected`, 'success');
            await loadDashboardData();
        } else {
            showToast(data.error || 'Failed to reject user', 'error');
        }
    } catch (error) {
        console.error('Reject user error:', error);
        showToast('Failed to reject user', 'error');
    }
}

// Delete user
async function deleteUser(userId, username) {
    if (!confirm(`Delete user: ${username}? This will remove all their data.`)) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            showToast(`User ${username} deleted`, 'success');
            await loadDashboardData();
        } else {
            showToast(data.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showToast('Failed to delete user', 'error');
    }
}

// Toggle admin status
async function toggleAdmin(userId, isAdmin, username) {
    const action = isAdmin ? 'remove admin from' : 'make admin';
    if (!confirm(`${action} user: ${username}?`)) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/admin`, {
            method: 'PUT',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            showToast(`Admin status updated`, 'success');
            await loadDashboardData();
        } else {
            showToast(data.error || 'Failed to update admin status', 'error');
        }
    } catch (error) {
        console.error('Toggle admin error:', error);
        showToast('Failed to update admin status', 'error');
    }
}

// Open create connection modal
function openCreateConnectionModal() {
    const approvedUsers = allUsers.filter(u => u.is_approved);
    const options = approvedUsers.map(u => 
        `<option value="${u.user_id}">${u.username} (${u.full_name})</option>`
    ).join('');

    document.getElementById('connectionUser1').innerHTML = '<option value="">Select user...</option>' + options;
    document.getElementById('connectionUser2').innerHTML = '<option value="">Select user...</option>' + options;

    document.getElementById('createConnectionModal').classList.add('active');
}

function closeCreateConnectionModal() {
    document.getElementById('createConnectionModal').classList.remove('active');
}

// Create connection
async function createConnection() {
    const user1Id = parseInt(document.getElementById('connectionUser1').value);
    const user2Id = parseInt(document.getElementById('connectionUser2').value);

    if (!user1Id || !user2Id) {
        showToast('Please select both users', 'error');
        return;
    }

    if (user1Id === user2Id) {
        showToast('Cannot connect user to themselves', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/connections/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user1Id, user2Id })
        });
        const data = await response.json();

        if (data.success) {
            showToast('Connection created!', 'success');
            closeCreateConnectionModal();
            await loadDashboardData();
        } else {
            showToast(data.error || 'Failed to create connection', 'error');
        }
    } catch (error) {
        console.error('Create connection error:', error);
        showToast('Failed to create connection', 'error');
    }
}

// Delete connection
async function deleteConnection(connectionId, user1, user2) {
    if (!confirm(`Delete connection between ${user1} and ${user2}?`)) return;

    try {
        const response = await fetch(`${API_URL}/admin/connections/${connectionId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            showToast('Connection deleted', 'success');
            await loadDashboardData();
        } else {
            showToast(data.error || 'Failed to delete connection', 'error');
        }
    } catch (error) {
        console.error('Delete connection error:', error);
        showToast('Failed to delete connection', 'error');
    }
}

// Generate invite code
async function generateInviteCode() {
    try {
        const response = await fetch(`${API_URL}/admin/invites/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ count: 1 })
        });
        const data = await response.json();

        if (data.success) {
            showToast(`Code generated: ${data.codes[0]}`, 'success');
            await loadInvites();
        } else {
            showToast(data.error || 'Failed to generate code', 'error');
        }
    } catch (error) {
        console.error('Generate invite error:', error);
        showToast('Failed to generate code', 'error');
    }
}

// Delete invite code
async function deleteInvite(code) {
    if (!confirm(`Delete invite code: ${code}?`)) return;

    try {
        const response = await fetch(`${API_URL}/admin/invites/${code}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            showToast('Invite code deleted', 'success');
            await loadInvites();
        } else {
            showToast(data.error || 'Failed to delete code', 'error');
        }
    } catch (error) {
        console.error('Delete invite error:', error);
        showToast('Failed to delete code', 'error');
    }
}

// Delete message
async function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;

    try {
        const response = await fetch(`${API_URL}/admin/messages/${messageId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            showToast('Message deleted', 'success');
            await loadMessages();
        } else {
            showToast(data.error || 'Failed to delete message', 'error');
        }
    } catch (error) {
        console.error('Delete message error:', error);
        showToast('Failed to delete message', 'error');
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

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
