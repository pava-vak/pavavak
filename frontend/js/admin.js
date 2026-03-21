const API_URL = '/api';
let currentUser = null;
let allUsers = [];
let broadcastRecipients = [];
const selectedBroadcastUsers = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventListeners();
    loadDashboard();
});

// Check auth
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/auth/session`, { credentials: 'include' });
        const data = await response.json();
        if (!data.authenticated) { window.location.href = '/index.html'; return; }
        if (!data.user.isAdmin) { window.location.href = '/chat.html'; return; }
        currentUser = data.user;
        document.getElementById('adminUsername').textContent = data.user.fullName || data.user.username;
    } catch (error) {
        window.location.href = '/index.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Header buttons
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('chatBtn').addEventListener('click', () => window.location.href = '/chat.html');
    document.getElementById('refreshDashboardBtn').addEventListener('click', loadDashboard);

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // User tab
    document.getElementById('createUserBtn').addEventListener('click', openCreateUserModal);
    document.getElementById('resetAllPasswordsBtn').addEventListener('click', resetAllUserPasswords);
    document.getElementById('userSearchInput').addEventListener('input', filterUsers);

    // Create user modal
    document.getElementById('createUserConfirmBtn').addEventListener('click', createUser);
    document.getElementById('closeCreateUserModalBtn').addEventListener('click', () => closeModal('createUserModal'));
    document.getElementById('cancelCreateUserBtn').addEventListener('click', () => closeModal('createUserModal'));

    // Password modal
    document.getElementById('copyPasswordBtn').addEventListener('click', copyTempPassword);
    document.getElementById('closePasswordModalBtn').addEventListener('click', () => closeModal('passwordModal'));

    // Reset link modal
    document.getElementById('copyResetLinkBtn').addEventListener('click', copyResetLink);
    document.getElementById('closeResetLinkModalBtn').addEventListener('click', () => closeModal('resetLinkModal'));
    document.getElementById('dismissResetLinkBtn').addEventListener('click', () => closeModal('resetLinkModal'));
    document.getElementById('refreshResetsBtn').addEventListener('click', loadPasswordResets);

    // Connection tab
    document.getElementById('createConnectionBtn').addEventListener('click', openCreateConnectionModal);
    document.getElementById('createConnectionConfirmBtn').addEventListener('click', createConnection);
    document.getElementById('closeConnectionModalBtn').addEventListener('click', () => closeModal('createConnectionModal'));
    document.getElementById('cancelConnectionBtn').addEventListener('click', () => closeModal('createConnectionModal'));

    // Edit user modal
    document.getElementById('saveEditUserBtn').addEventListener('click', saveEditUser);
    document.getElementById('closeEditUserModalBtn').addEventListener('click', () => closeModal('editUserModal'));
    document.getElementById('cancelEditUserBtn').addEventListener('click', () => closeModal('editUserModal'));

    // Messages tab
    document.getElementById('refreshMessagesBtn').addEventListener('click', loadMessages);
    document.getElementById('refreshBroadcastRecipientsBtn').addEventListener('click', loadBroadcastRecipients);
    document.getElementById('sendBroadcastBtn').addEventListener('click', sendBroadcastNotification);
    document.getElementById('broadcastSelectAllBtn').addEventListener('click', selectAllBroadcastRecipients);
    document.getElementById('broadcastClearSelectionBtn').addEventListener('click', clearBroadcastSelection);
    document.getElementById('broadcastUserSearch').addEventListener('input', renderBroadcastRecipients);
    document.getElementById('broadcastRecipientsList').addEventListener('change', handleBroadcastRecipientToggle);
    document.querySelectorAll('input[name="broadcastMode"]').forEach(el => {
        el.addEventListener('change', updateBroadcastModeUi);
    });
    document.getElementById('broadcastIncludeSelf').addEventListener('change', updateBroadcastSummary);

    // Invites tab
    document.getElementById('generateInviteBtn').addEventListener('click', generateInviteCode);

    // Logs tab
    document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);
    document.getElementById('logLevelFilter').addEventListener('change', loadLogs);

    // Event delegation for dynamic buttons
    document.addEventListener('click', handleDynamicClicks);

    // Close modal when clicking the backdrop.
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Escape should close any open modal.
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    });
}

// Handle dynamic button clicks
function handleDynamicClicks(e) {
    const action = e.target.dataset.action;
    if (!action) return;

    const userId = e.target.dataset.userId ? parseInt(e.target.dataset.userId) : null;
    const username = e.target.dataset.username || '';
    const connectionId = e.target.dataset.connectionId ? parseInt(e.target.dataset.connectionId) : null;
    const code = e.target.dataset.code || '';
    const messageId = e.target.dataset.messageId ? parseInt(e.target.dataset.messageId) : null;
    const requestId = e.target.dataset.requestId ? parseInt(e.target.dataset.requestId) : null;

    switch (action) {
        case 'approve-user': approveUser(userId, username); break;
        case 'reject-user': rejectUser(userId, username); break;
        case 'delete-user': deleteUser(userId, username); break;
        case 'toggle-admin': toggleAdmin(userId, username); break;
        case 'edit-user': openEditUserModal(userId); break;
        case 'reset-user-password': resetUserPassword(userId, username); break;
        case 'delete-connection': deleteConnection(connectionId); break;
        case 'delete-invite': deleteInvite(code); break;
        case 'delete-message': deleteMessage(messageId); break;
        case 'generate-reset-link': generateResetOtp(requestId, username); break;
        case 'dismiss-reset': dismissResetRequest(requestId); break;
        case 'copy-invite': copyToClipboard(code, 'Invite code copied!'); break;
    }
}

// Switch tabs
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Load data for tab
    switch (tabName) {
        case 'dashboard': loadDashboard(); break;
        case 'users': loadUsers(); break;
        case 'resets': loadPasswordResets(); break;
        case 'broadcast': loadBroadcastRecipients(); break;
        case 'connections': loadConnections(); break;
        case 'messages': loadMessages(); break;
        case 'invites': loadInvites(); break;
        case 'logs': loadLogs(); break;
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
       const [statsRes, pendingRes, resetsRes, activityRes] = await Promise.all([
    fetch(`${API_URL}/admin/dashboard/stats`, { credentials: 'include' }),
    fetch(`${API_URL}/admin/users/pending`, { credentials: 'include' }),
    fetch(`${API_URL}/admin/password-resets/pending`, { credentials: 'include' }),
    fetch(`${API_URL}/admin/dashboard/activity`, { credentials: 'include' })
]);

const stats = await statsRes.json();
const pending = await pendingRes.json();
const resets = await resetsRes.json();
const activity = await activityRes.json();

        if (stats.success) {
            document.getElementById('statTotalUsers').textContent = stats.stats.totalUsers;
            document.getElementById('statPendingUsers').textContent = stats.stats.pendingUsers;
            document.getElementById('statConnections').textContent = stats.stats.activeConnections;
            document.getElementById('statMessages').textContent = stats.stats.totalMessages;
            document.getElementById('statResetRequests').textContent = stats.stats.pendingResets || 0;
            document.getElementById('pendingCount').textContent = stats.stats.pendingUsers;
        }

        // Dashboard pending list
        if (pending.success) {
            const container = document.getElementById('dashPendingList');
            if (pending.pendingUsers.length === 0) {
                container.innerHTML = '<p class="empty-state">No pending approvals</p>';
            } else {
                container.innerHTML = pending.pendingUsers.slice(0, 5).map(u => `
                    <div class="dash-item">
                        <span>${u.username}</span>
                        <div>
                            <button class="btn btn-sm btn-success" data-action="approve-user" data-user-id="${u.user_id}" data-username="${u.username}">Approve</button>
                            <button class="btn btn-sm btn-danger" data-action="reject-user" data-user-id="${u.user_id}" data-username="${u.username}">Reject</button>
                        </div>
                    </div>
                `).join('');
            }
        }
// Dashboard recent activity
if (activity.success) {
    const container = document.getElementById('dashRecentActivity');
    let html = '';

    if (activity.recentUsers.length > 0) {
        html += '<p class="activity-title">New Users:</p>';
        html += activity.recentUsers.map(u => `
            <div class="dash-item">
                <span>${u.username}</span>
                <span class="badge ${u.isApproved ? 'badge-success' : 'badge-warning'}">
                    ${u.isApproved ? 'Active' : 'Pending'}
                </span>
            </div>
        `).join('');
    }

    if (activity.recentMessages.length > 0) {
        html += '<p class="activity-title">Recent Messages:</p>';
        html += activity.recentMessages.map(m => `
            <div class="dash-item">
                <span>${m.from} → ${m.to}</span>
                <span class="date">${formatDate(m.sentAt)}</span>
            </div>
        `).join('');
    }

    if (!html) html = '<p class="empty-state">No recent activity</p>';
    container.innerHTML = html;
}
        // Dashboard reset requests
        if (resets.success) {
            const container = document.getElementById('dashResetRequests');
            if (resets.requests.length === 0) {
                container.innerHTML = '<p class="empty-state">No pending reset requests</p>';
            } else {
                container.innerHTML = resets.requests.slice(0, 5).map(r => `
                    <div class="dash-item">
                        <span>${r.username}</span>
                        <button class="btn btn-sm btn-primary" data-action="generate-reset-link" data-request-id="${r.request_id}" data-username="${r.username}">Generate OTP</button>
                    </div>
                `).join('');
            }
        }

    } catch (error) {
        console.error('Load dashboard error:', error);
    }
}

// ==================== USERS ====================

async function loadUsers() {
    try {
        const [pendingRes, usersRes] = await Promise.all([
            fetch(`${API_URL}/admin/users/pending`, { credentials: 'include' }),
            fetch(`${API_URL}/admin/users`, { credentials: 'include' })
        ]);

        const pending = await pendingRes.json();
        const users = await usersRes.json();

        if (pending.success) {
            document.getElementById('pendingCount').textContent = pending.pendingUsers.length;
            renderPendingUsers(pending.pendingUsers);
        }

        if (users.success) {
            allUsers = users.users;
            renderUsersTable(allUsers);
        }
    } catch (error) {
        console.error('Load users error:', error);
    }
}

function renderPendingUsers(users) {
    const container = document.getElementById('pendingUsersList');

    if (users.length === 0) {
        container.innerHTML = '<p class="empty-state">No pending approvals</p>';
        return;
    }

    container.innerHTML = users.map(u => `
        <div class="pending-item">
            <div class="pending-info">
                <strong>${u.username}</strong>
                <span>${u.full_name || '-'}</span>
                <span>${u.email || '-'}</span>
                <span class="date">${formatDate(u.created_at)}</span>
            </div>
            <div class="pending-actions">
                <button class="btn btn-sm btn-success" data-action="approve-user" data-user-id="${u.user_id}" data-username="${u.username}">✓ Approve</button>
                <button class="btn btn-sm btn-danger" data-action="reject-user" data-user-id="${u.user_id}" data-username="${u.username}">✗ Reject</button>
            </div>
        </div>
    `).join('');
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.username}</strong></td>
            <td>${u.full_name || '-'}</td>
            <td>${u.email || '-'}</td>
            <td><span class="badge ${u.is_approved ? 'badge-success' : 'badge-warning'}">${u.is_approved ? 'Active' : 'Pending'}</span></td>
            <td><span class="badge ${u.is_admin ? 'badge-admin' : 'badge-user'}">${u.is_admin ? 'Admin' : 'User'}</span></td>
            <td>${formatDate(u.created_at)}</td>
            <td class="actions">
                <button class="btn btn-sm btn-primary" data-action="edit-user" data-user-id="${u.user_id}">Edit</button>
                <button class="btn btn-sm btn-warning" data-action="reset-user-password" data-user-id="${u.user_id}" data-username="${u.username}">Reset Password</button>
                <button class="btn btn-sm btn-warning" data-action="toggle-admin" data-user-id="${u.user_id}" data-username="${u.username}">${u.is_admin ? 'Remove Admin' : 'Make Admin'}</button>
                ${u.user_id !== currentUser.userId ? `<button class="btn btn-sm btn-danger" data-action="delete-user" data-user-id="${u.user_id}" data-username="${u.username}">Delete</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const query = document.getElementById('userSearchInput').value.toLowerCase();
    const filtered = allUsers.filter(u =>
        u.username.toLowerCase().includes(query) ||
        (u.full_name && u.full_name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query))
    );
    renderUsersTable(filtered);
}

async function approveUser(userId, username) {
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/approve`, {
            method: 'POST', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast(`${username} approved`, 'success');
            loadUsers();
            loadDashboard();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

async function rejectUser(userId, username) {
    if (!confirm(`Reject and delete user "${username}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/reject`, {
            method: 'POST', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast(`${username} rejected`, 'success');
            loadUsers();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

async function deleteUser(userId, username) {
    if (!confirm(`Delete user "${username}"? This cannot be undone!`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast(`${username} deleted`, 'success');
            loadUsers();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) { showToast('Failed', 'error'); }
}

async function toggleAdmin(userId, username) {
    if (!confirm(`Toggle admin status for "${username}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/admin`, {
            method: 'PUT', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast(`${username} admin status updated`, 'success');
            loadUsers();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

// Create User
function openCreateUserModal() {
    document.getElementById('newUsername').value = '';
    document.getElementById('newFullName').value = '';
    document.getElementById('newEmail').value = '';
    document.getElementById('newIsAdmin').checked = false;
    document.getElementById('newIsApproved').checked = true;
    openModal('createUserModal');
}

async function createUser() {
    const username = document.getElementById('newUsername').value.trim();
    const fullName = document.getElementById('newFullName').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const isAdmin = document.getElementById('newIsAdmin').checked;
    const isApproved = document.getElementById('newIsApproved').checked;

    if (!username) { showToast('Username is required', 'error'); return; }
    if (!fullName) { showToast('Full Name is required', 'error'); return; }

    try {
        const res = await fetch(`${API_URL}/admin/users/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, fullName, isAdmin, isApproved })
        });
        const data = await res.json();

        if (data.success) {
            closeModal('createUserModal');
            document.getElementById('createdUsername').textContent = data.user.username;
            document.getElementById('createdEmail').textContent = data.user.email || 'N/A';
            document.getElementById('tempPassword').textContent = data.user.temporaryPassword;
            openModal('passwordModal');
            loadUsers();
        } else {
            showToast(data.error || 'Failed to create user', 'error');
        }
    } catch (error) { showToast('Failed', 'error'); }
}

function copyTempPassword() {
    const password = document.getElementById('tempPassword').textContent;
    copyToClipboard(password, 'Password copied!');
}

// Edit User
function openEditUserModal(userId) {
    const user = allUsers.find(u => u.user_id === userId);
    if (!user) return;
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editFullName').value = user.full_name || '';
    document.getElementById('editEmail').value = user.email || '';
    openModal('editUserModal');
}

async function saveEditUser() {
    const userId = parseInt(document.getElementById('editUserId').value);
    const fullName = document.getElementById('editFullName').value.trim();
    const email = document.getElementById('editEmail').value.trim();

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fullName, email })
        });
        const data = await res.json();
        if (data.success) {
            showToast('User updated', 'success');
            closeModal('editUserModal');
            loadUsers();
        } else {
            showToast(data.error || 'Failed', 'error');
        }
    } catch (error) { showToast('Failed', 'error'); }
}

// ==================== PASSWORD RESETS ====================

async function loadPasswordResets() {
    try {
        const res = await fetch(`${API_URL}/admin/password-resets/pending`, { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('resetRequestsList');

        if (!data.success || data.requests.length === 0) {
            container.innerHTML = '<p class="empty-state">No pending password reset requests</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Requested</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.requests.map(r => `
                        <tr>
                            <td><strong>${r.username}</strong></td>
                            <td>${r.email || '-'}</td>
                            <td>${formatDate(r.created_at)}</td>
                            <td><span class="badge badge-warning">${r.status}</span></td>
                            <td class="actions">
                                <button class="btn btn-sm btn-primary" data-action="generate-reset-link" data-request-id="${r.request_id}" data-username="${r.username}">Generate OTP</button>
                                <button class="btn btn-sm btn-danger" data-action="dismiss-reset" data-request-id="${r.request_id}">Dismiss</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) { console.error('Load resets error:', error); }
}

async function generateResetOtp(requestId, username) {
    try {
        const res = await fetch(`${API_URL}/admin/password-resets/${requestId}/generate-otp`, {
            method: 'POST', credentials: 'include'
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('resetLinkUsername').textContent = username;
            document.getElementById('resetLinkUrl').textContent = `${data.otp} (expires: ${formatDate(data.expiresAt)})`;
            openModal('resetLinkModal');
            loadPasswordResets();
        } else {
            showToast(data.error || 'Failed', 'error');
        }
    } catch (error) { showToast('Failed', 'error'); }
}

function copyResetLink() {
    const link = document.getElementById('resetLinkUrl').textContent;
    copyToClipboard(link, 'OTP copied!');
}

async function dismissResetRequest(requestId) {
    if (!confirm('Dismiss this reset request?')) return;
    try {
        const res = await fetch(`${API_URL}/admin/password-resets/${requestId}/dismiss`, {
            method: 'POST', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Request dismissed', 'success');
            loadPasswordResets();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

// ==================== CONNECTIONS ====================

// ==================== BROADCAST ====================

async function loadBroadcastRecipients() {
    try {
        const res = await fetch(`${API_URL}/admin/notifications/recipients`, { credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            showToast(data.error || 'Failed to load recipients', 'error');
            return;
        }
        broadcastRecipients = data.recipients || [];
        for (const userId of [...selectedBroadcastUsers]) {
            if (!broadcastRecipients.some(u => u.userId === userId)) {
                selectedBroadcastUsers.delete(userId);
            }
        }
        renderBroadcastRecipients();
        updateBroadcastModeUi();
        updateBroadcastSummary(data.summary || null);
    } catch (error) {
        showToast('Failed to load recipients', 'error');
    }
}

function renderBroadcastRecipients() {
    const container = document.getElementById('broadcastRecipientsList');
    const query = (document.getElementById('broadcastUserSearch').value || '').trim().toLowerCase();
    const includeSelf = document.getElementById('broadcastIncludeSelf').checked;

    const filtered = broadcastRecipients.filter(user => {
        if (!includeSelf && currentUser && user.userId === currentUser.userId) return false;
        if (!query) return true;
        return (
            user.username.toLowerCase().includes(query) ||
            (user.fullName && user.fullName.toLowerCase().includes(query))
        );
    });

    if (!filtered.length) {
        container.innerHTML = '<p class="empty-state">No matching recipients</p>';
        return;
    }

    container.innerHTML = filtered.map(user => {
        const checked = selectedBroadcastUsers.has(user.userId) ? 'checked' : '';
        const name = escapeHtml(user.fullName || user.username);
        const username = escapeHtml(user.username);
        return `
            <label class="broadcast-recipient-item">
                <input type="checkbox" data-action="toggle-broadcast-user" data-user-id="${user.userId}" ${checked}>
                <div class="broadcast-recipient-meta">
                    <strong>${name}</strong>
                    <span>@${username}</span>
                </div>
                <div class="broadcast-recipient-badges">
                    <span class="badge ${user.isAdmin ? 'badge-admin' : 'badge-approved'}">${user.isAdmin ? 'Admin' : 'User'}</span>
                    <span class="badge ${user.activeTokenCount > 0 ? 'badge-approved' : 'badge-pending'}">${user.activeTokenCount} active token${user.activeTokenCount === 1 ? '' : 's'}</span>
                </div>
            </label>
        `;
    }).join('');
}

function selectedBroadcastMode() {
    return document.querySelector('input[name="broadcastMode"]:checked')?.value || 'all';
}

function updateBroadcastModeUi() {
    const selectedOnly = selectedBroadcastMode() === 'selected';
    document.getElementById('broadcastRecipientsList').classList.toggle('broadcast-recipient-list-disabled', !selectedOnly);
    document.getElementById('broadcastSelectAllBtn').disabled = !selectedOnly;
    document.getElementById('broadcastClearSelectionBtn').disabled = !selectedOnly;
    document.getElementById('broadcastUserSearch').disabled = !selectedOnly;
    updateBroadcastSummary();
}

function updateBroadcastSummary(serverSummary = null) {
    const summary = document.getElementById('broadcastAudienceSummary');
    const includeSelf = document.getElementById('broadcastIncludeSelf').checked;
    const visibleRecipients = broadcastRecipients.filter(user => includeSelf || !currentUser || user.userId !== currentUser.userId);
    const activeTokenUsers = visibleRecipients.filter(user => user.activeTokenCount > 0).length;

    if (selectedBroadcastMode() === 'selected') {
        const selected = visibleRecipients.filter(user => selectedBroadcastUsers.has(user.userId));
        summary.textContent = `Selected ${selected.length} user(s). ${selected.filter(user => user.activeTokenCount > 0).length} currently have active device tokens.`;
        return;
    }

    const totalUsers = serverSummary?.totalUsers ?? visibleRecipients.length;
    const tokenUsers = serverSummary?.activeTokenUsers ?? activeTokenUsers;
    const effectiveUsers = includeSelf ? totalUsers : visibleRecipients.length;
    const effectiveTokenUsers = includeSelf ? tokenUsers : activeTokenUsers;
    summary.textContent = `Broadcast will target ${effectiveUsers} approved user(s). ${effectiveTokenUsers} currently have active device tokens.`;
}

function toggleBroadcastUser(userId) {
    if (!userId) return;
    if (selectedBroadcastUsers.has(userId)) {
        selectedBroadcastUsers.delete(userId);
    } else {
        selectedBroadcastUsers.add(userId);
    }
    renderBroadcastRecipients();
    updateBroadcastSummary();
}

function handleBroadcastRecipientToggle(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== 'checkbox') return;
    const userId = parseInt(input.dataset.userId || '', 10);
    if (!Number.isInteger(userId) || userId <= 0) return;
    if (input.checked) {
        selectedBroadcastUsers.add(userId);
    } else {
        selectedBroadcastUsers.delete(userId);
    }
    updateBroadcastSummary();
}

function selectAllBroadcastRecipients() {
    if (selectedBroadcastMode() !== 'selected') return;
    const includeSelf = document.getElementById('broadcastIncludeSelf').checked;
    const query = (document.getElementById('broadcastUserSearch').value || '').trim().toLowerCase();
    broadcastRecipients.forEach(user => {
        if (!includeSelf && currentUser && user.userId === currentUser.userId) return;
        if (query) {
            const matches = user.username.toLowerCase().includes(query) ||
                (user.fullName && user.fullName.toLowerCase().includes(query));
            if (!matches) return;
        }
        selectedBroadcastUsers.add(user.userId);
    });
    renderBroadcastRecipients();
    updateBroadcastSummary();
}

function clearBroadcastSelection() {
    selectedBroadcastUsers.clear();
    renderBroadcastRecipients();
    updateBroadcastSummary();
}

async function sendBroadcastNotification() {
    const title = (document.getElementById('broadcastTitle').value || '').trim();
    const body = (document.getElementById('broadcastBody').value || '').trim();
    const mode = selectedBroadcastMode();
    const includeSelf = document.getElementById('broadcastIncludeSelf').checked;
    const userIds = mode === 'selected' ? [...selectedBroadcastUsers] : [];

    if (!title) {
        showToast('Notification title is required', 'error');
        return;
    }
    if (!body) {
        showToast('Notification message is required', 'error');
        return;
    }
    if (mode === 'selected' && userIds.length === 0) {
        showToast('Select at least one user', 'error');
        return;
    }

    const confirmText = mode === 'selected'
        ? `Send this broadcast to ${userIds.length} selected user(s)?`
        : 'Send this broadcast to all approved users?';
    if (!confirm(confirmText)) return;

    try {
        const res = await fetch(`${API_URL}/admin/notifications/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, body, mode, includeSelf, userIds })
        });
        const data = await res.json();
        if (!data.success) {
            showToast(data.error || 'Broadcast failed', 'error');
            return;
        }
        showToast(`Broadcast queued for ${data.summary.targetedCount} user(s)`, 'success');
        document.getElementById('broadcastTitle').value = '';
        document.getElementById('broadcastBody').value = '';
        clearBroadcastSelection();
        loadBroadcastRecipients();
    } catch (error) {
        showToast('Broadcast failed', 'error');
    }
}

// ==================== CONNECTIONS ====================

async function loadConnections() {
    try {
        const res = await fetch(`${API_URL}/admin/connections`, { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('connectionsList');

        if (!data.success || data.connections.length === 0) {
            container.innerHTML = '<p class="empty-state">No connections found</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>User 1</th>
                        <th>User 2</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.connections.map(c => `
                        <tr>
                            <td>${c.user1.full_name || c.user1.username}</td>
                            <td>${c.user2.full_name || c.user2.username}</td>
                            <td>${formatDate(c.createdAt)}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" data-action="delete-connection" data-connection-id="${c.connectionId}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) { console.error('Load connections error:', error); }
}

async function openCreateConnectionModal() {
    try {
        const res = await fetch(`${API_URL}/admin/users`, { credentials: 'include' });
        const data = await res.json();

        if (data.success) {
            const approvedUsers = data.users.filter(u => u.is_approved);
            const options = approvedUsers.map(u =>
                `<option value="${u.user_id}">${u.username} (${u.full_name || 'No name'})</option>`
            ).join('');

            document.getElementById('connectionUser1').innerHTML = '<option value="">Select user...</option>' + options;
            document.getElementById('connectionUser2').innerHTML = '<option value="">Select user...</option>' + options;
        }
        openModal('createConnectionModal');
    } catch (error) { showToast('Failed to load users', 'error'); }
}

async function createConnection() {
    const user1Id = parseInt(document.getElementById('connectionUser1').value);
    const user2Id = parseInt(document.getElementById('connectionUser2').value);

    if (!user1Id || !user2Id) { showToast('Select both users', 'error'); return; }
    if (user1Id === user2Id) { showToast('Cannot connect user to themselves', 'error'); return; }

    try {
        const res = await fetch(`${API_URL}/admin/connections/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user1Id, user2Id })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Connection created', 'success');
            closeModal('createConnectionModal');
            loadConnections();
        } else {
            showToast(data.error || 'Failed', 'error');
        }
    } catch (error) { showToast('Failed', 'error'); }
}

async function deleteConnection(connectionId) {
    if (!confirm('Delete this connection? Messages will remain.')) return;
    try {
        const res = await fetch(`${API_URL}/admin/connections/${connectionId}`, {
            method: 'DELETE', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Connection deleted', 'success');
            loadConnections();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

// ==================== MESSAGES ====================

async function loadMessages() {
    try {
        const res = await fetch(`${API_URL}/admin/messages/recent?limit=50`, { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('messagesList');

        if (!data.success || data.messages.length === 0) {
            container.innerHTML = '<p class="empty-state">No messages found</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>From</th>
                        <th>To</th>
                        <th>Message</th>
                        <th>Time</th>
                        <th>Read</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.messages.map(m => `
                        <tr>
                            <td>${m.sender.username}</td>
                            <td>${m.receiver.username}</td>
                            <td class="message-preview">${escapeHtml(m.content.substring(0, 50))}${m.content.length > 50 ? '...' : ''}</td>
                            <td>${formatDate(m.sentAt)}</td>
                            <td>${m.isRead ? '✓' : '✗'}</td>
                            <td>
                                <button class="btn btn-sm btn-danger" data-action="delete-message" data-message-id="${m.messageId}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) { console.error('Load messages error:', error); }
}

async function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    try {
        const res = await fetch(`${API_URL}/admin/messages/${messageId}`, {
            method: 'DELETE', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Message deleted', 'success');
            loadMessages();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

// ==================== INVITE CODES ====================

async function loadInvites() {
    try {
        const res = await fetch(`${API_URL}/admin/invites`, { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('invitesList');

        if (!data.success || data.invites.length === 0) {
            container.innerHTML = '<p class="empty-state">No invite codes found</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Status</th>
                        <th>Used By</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.invites.map(i => `
                        <tr>
                            <td class="code-cell">
                                <strong>${i.code}</strong>
                                <button class="btn btn-sm" data-action="copy-invite" data-code="${i.code}">Copy</button>
                            </td>
                            <td><span class="badge ${i.used ? 'badge-danger' : 'badge-success'}">${i.used ? 'Used' : 'Available'}</span></td>
                            <td>${i.usedBy || '-'}</td>
                            <td>${formatDate(i.createdAt)}</td>
                            <td>
                                ${!i.used ? `<button class="btn btn-sm btn-danger" data-action="delete-invite" data-code="${i.code}">Delete</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) { console.error('Load invites error:', error); }
}

async function generateInviteCode() {
    try {
        const res = await fetch(`${API_URL}/admin/invites/generate`, {
            method: 'POST', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Code generated: ${data.codes[0]}`, 'success');
            loadInvites();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

async function deleteInvite(code) {
    if (!confirm(`Delete invite code "${code}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/invites/${code}`, {
            method: 'DELETE', credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Invite code deleted', 'success');
            loadInvites();
        }
    } catch (error) { showToast('Failed', 'error'); }
}

// ==================== LOGS ====================

async function loadLogs() {
    try {
        const level = document.getElementById('logLevelFilter').value;
        const url = `${API_URL}/admin/logs${level ? `?level=${level}` : ''}`;
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();

        const container = document.getElementById('logsList');

        if (!data.success || data.logs.length === 0) {
            container.innerHTML = '<p class="empty-state">No logs found</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Level</th>
                        <th>Action</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.logs.map(l => `
                        <tr class="log-row log-${l.level.toLowerCase()}">
                            <td>${formatDate(l.timestamp)}</td>
                            <td><span class="badge badge-${l.level.toLowerCase()}">${l.level}</span></td>
                            <td>${l.action}</td>
                            <td>${l.message}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        document.getElementById('logsList').innerHTML = '<p class="empty-state">Logs not available</p>';
    }
}

// ==================== HELPERS ====================

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    });
}

async function resetUserPassword(userId, username) {
    if (!confirm(`Reset password for "${username}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/reset-password`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('createdUsername').textContent = data.reset.username;
            document.getElementById('createdEmail').textContent = data.reset.email || 'N/A';
            document.getElementById('tempPassword').textContent = data.reset.temporaryPassword;
            openModal('passwordModal');
            showToast(`Password reset for ${data.reset.username}`, 'success');
        } else {
            showToast(data.error || 'Failed to reset password', 'error');
        }
    } catch (error) {
        showToast('Failed to reset password', 'error');
    }
}

async function resetAllUserPasswords() {
    if (!confirm('Reset passwords for ALL users? This will force everyone to use new temporary passwords.')) return;

    try {
        const res = await fetch(`${API_URL}/admin/users/reset-passwords-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ includeAdmins: true, includeCurrentAdmin: true })
        });
        const data = await res.json();

        if (!data.success) {
            showToast(data.error || 'Bulk reset failed', 'error');
            return;
        }

        downloadResetCredentials(data.resetCredentials || []);
        showToast(`Reset complete: ${data.summary.totalReset} users`, 'success');
    } catch (error) {
        showToast('Bulk reset failed', 'error');
    }
}

function downloadResetCredentials(resetCredentials) {
    if (!resetCredentials.length) return;

    const generatedAt = new Date().toISOString();
    const lines = [
        `PaVa-Vak Password Reset Export`,
        `Generated At (UTC): ${generatedAt}`,
        '',
        'user_id,username,email,is_admin,temporary_password'
    ];

    for (const row of resetCredentials) {
        const email = (row.email || '').replace(/,/g, ' ');
        lines.push(`${row.userId},${row.username},${email},${row.isAdmin ? 'yes' : 'no'},${row.temporaryPassword}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pavavak-password-resets-${Date.now()}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || 'Copied!', 'success');
    }).catch(() => {
        showToast('Copy failed - please copy manually', 'error');
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = '/index.html';
}
