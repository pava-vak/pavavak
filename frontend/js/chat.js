// ============================================================
// PaVa-Vak Chat  |  js/chat.js  v3.1
// ============================================================

'use strict';

const API_URL = '/api';

let socket              = null;
let currentUser         = null;
let currentConversation = null;
let conversations       = [];
let typingTimeout       = null;
const onlineUsers       = new Set();

let selectionMode      = false;
const selectedMessages = new Set();
let activeContextMenu  = null;
let longPressTimer     = null;
let touchMoved         = false;

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadConversations();
    initializeSocket();
    setupEventListeners();
    setInterval(loadConversations, 30000);
});

// ── EVENT LISTENERS ──────────────────────────────────────────
function setupEventListeners() {
    document.getElementById('settingsBtn').addEventListener('click', () => {
        window.location.href = '/settings.html';
    });
    const adminBtn = document.getElementById('adminButton');
    if (adminBtn) adminBtn.addEventListener('click', () => { window.location.href = '/admin.html'; });

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('backToConversations').addEventListener('click', showConversations);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    document.getElementById('messageInput').addEventListener('input', handleTyping);

    const selectMsgsBtn = document.getElementById('selectMsgsBtn');
    if (selectMsgsBtn) selectMsgsBtn.addEventListener('click', () => {
        document.getElementById('chatMenuDropdown')?.classList.remove('visible');
        enterSelectionMode();
    });

    document.getElementById('conversationsContainer').addEventListener('click', (e) => {
        const item = e.target.closest('.conversation-item');
        if (item) selectConversation(parseInt(item.dataset.userId));
    });

    document.getElementById('chatMenuBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('chatMenuDropdown')?.classList.toggle('visible');
    });

    document.getElementById('clearChatBtn')?.addEventListener('click', clearChat);
    document.getElementById('cancelSelectBtn')?.addEventListener('click', exitSelectionMode);
    document.getElementById('deleteSelectBtn')?.addEventListener('click', deleteSelectedMessages);

    const msgContainer = document.getElementById('messagesContainer');
    if (msgContainer) {
        msgContainer.addEventListener('contextmenu', handleRightClick);
        msgContainer.addEventListener('touchstart',  handleTouchStart, { passive: true });
        msgContainer.addEventListener('touchend',    handleTouchEnd);
        msgContainer.addEventListener('touchmove',   () => { touchMoved = true; clearTimeout(longPressTimer); }, { passive: true });
        // Checkbox delegation
        msgContainer.addEventListener('change', (e) => {
            const cb = e.target.closest('.msg-checkbox');
            if (!cb) return;
            const msgId     = parseInt(cb.dataset.messageId);
            const messageEl = cb.closest('.message');
            if (cb.checked) {
                selectedMessages.add(msgId);
                messageEl?.classList.add('selected');
                if (!selectionMode) enterSelectionMode();
            } else {
                selectedMessages.delete(msgId);
                messageEl?.classList.remove('selected');
            }
            updateSelectionToolbar();
            if (selectedMessages.size === 0 && selectionMode) exitSelectionMode();
        });
    }

    document.addEventListener('click', (e) => {
        const dd = document.getElementById('chatMenuDropdown');
        if (dd?.classList.contains('visible') && !e.target.closest('.chat-header-menu')) {
            dd.classList.remove('visible');
        }
        if (activeContextMenu && !activeContextMenu.contains(e.target)) dismissContextMenu();
    });
}

// ── AUTH ─────────────────────────────────────────────────────
async function checkAuth() {
    try {
        const res  = await fetch(`${API_URL}/auth/session?t=${Date.now()}`, {
            credentials: 'include', cache: 'no-store'
        });
        const data = await res.json();
        if (!data.authenticated) { window.location.href = '/index.html'; return; }
        currentUser = data.user;
        document.getElementById('currentUsername').textContent =
            currentUser.fullName || currentUser.username;
        if (currentUser.isAdmin) {
            document.getElementById('adminButton')?.classList.remove('hidden');
        }
    } catch {
        window.location.href = '/index.html';
    }
}

// ── SOCKET ───────────────────────────────────────────────────
function initializeSocket() {
    if (typeof io === 'undefined') return;
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect',    () => console.log('[Socket] Connected'));
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));

    socket.on('user_status', ({ userId, status }) => {
        if (status === 'online') onlineUsers.add(userId); else onlineUsers.delete(userId);
        updateOnlineStatusUI(userId, status);
    });

    socket.on('new_message', (message) => {
        loadConversations();
        if (currentConversation &&
            (message.senderId === currentConversation.user.userId ||
             message.receiverId === currentConversation.user.userId)) {
            const isOwn = message.senderId === currentUser.userId;
            addMessageToUI(message, isOwn);
            if (!isOwn) markMessageAsRead(message.messageId);
            scrollToBottom();
        } else {
            showToast(`New message from ${message.senderUsername || 'someone'}`);
        }
    });

    socket.on('message_read', ({ messageId }) => {
        const ind = document.querySelector(`[data-message-id="${messageId}"] .read-indicator`);
        if (ind) { ind.textContent = '✓✓'; ind.className = 'read-indicator read'; }
    });

    socket.on('message_delivered', ({ messageId }) => {
        const ind = document.querySelector(`[data-message-id="${messageId}"] .read-indicator`);
        if (ind && !ind.classList.contains('read')) {
            ind.textContent = '✓✓';
            ind.className   = 'read-indicator delivered';
        }
    });

    socket.on('user_typing', ({ userId, isTyping }) => {
        if (currentConversation && userId === currentConversation.user.userId) {
            isTyping ? showTypingIndicator() : hideTypingIndicator();
        }
    });

    socket.on('message_deleted', ({ messageId }) => {
        removeMessageFromUI(messageId);
        loadConversations();
    });

    socket.on('chat_cleared', ({ otherUserId }) => {
        if (currentConversation?.user.userId === otherUserId) clearMessagesUI();
        loadConversations();
    });
}

// ── ONLINE STATUS ─────────────────────────────────────────────
function updateOnlineStatusUI(userId, status) {
    const dot = document.querySelector(`.conversation-item[data-user-id="${userId}"] .online-dot`);
    if (dot) {
        dot.className = `online-dot ${status === 'online' ? 'online' : 'offline'}`;
        dot.title     = status === 'online' ? 'Online' : 'Offline';
    }
    if (currentConversation?.user.userId === userId) {
        const hs = document.getElementById('chatUserStatus');
        if (hs) {
            hs.textContent = status === 'online' ? '● Online' : '● Offline';
            hs.className   = 'chat-header-status ' + (status === 'online' ? 'status-online' : 'status-offline');
        }
    }
}

// ── CONVERSATIONS LIST ────────────────────────────────────────
async function loadConversations() {
    try {
        const res  = await fetch(`${API_URL}/messages/conversations/list`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) { conversations = data.conversations; renderConversationsList(); }
    } catch (err) { console.error('Load conversations error:', err); }
}

function renderConversationsList() {
    const container = document.getElementById('conversationsContainer');
    if (conversations.length === 0) {
        container.innerHTML = '<p class="empty-state">No conversations yet. Ask admin to connect you.</p>';
        return;
    }
    container.innerHTML = conversations.map(conv => {
        const isActive     = currentConversation?.user.userId === conv.user.userId;
        const isOnline     = onlineUsers.has(conv.user.userId);
        const unread       = conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : '';
        const lastMsg      = conv.lastMessage;
        const name         = conv.user.fullName || conv.user.username;
        return `
        <div class="conversation-item ${isActive ? 'active' : ''}" data-user-id="${conv.user.userId}">
            <div class="conv-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
            <div class="online-dot ${isOnline ? 'online' : 'offline'}" title="${isOnline ? 'Online' : 'Offline'}"></div>
            <div class="conversation-info">
                <div class="conv-top-row">
                    <span class="conversation-name">${escapeHtml(name)}</span>
                    ${lastMsg ? `<span class="conversation-time">${formatTime(lastMsg.sentAt)}</span>` : ''}
                </div>
                <div class="conversation-last-message">
                    ${lastMsg
                        ? (lastMsg.isFromMe ? '<span class="you-prefix">You: </span>' : '') + escapeHtml(lastMsg.content)
                        : 'No messages yet'}
                </div>
            </div>
            ${unread}
        </div>`;
    }).join('');
}

// ── SELECT CONVERSATION ───────────────────────────────────────
async function selectConversation(userId) {
    const conv = conversations.find(c => c.user.userId === userId);
    if (!conv) return;

    exitSelectionMode();
    dismissContextMenu();
    currentConversation = conv;

    // KEY FIX: hide placeholder, show chat panel
    document.getElementById('noConversation')?.classList.add('hidden');
    document.getElementById('activeConversation')?.classList.remove('hidden');

    const name = conv.user.fullName || conv.user.username;
    document.getElementById('chatUsername').textContent = escapeHtml(name);

    const hs     = document.getElementById('chatUserStatus');
    const online = onlineUsers.has(userId);
    if (hs) {
        hs.textContent = online ? '● Online' : '● Offline';
        hs.className   = 'chat-header-status ' + (online ? 'status-online' : 'status-offline');
    }

    await loadMessages(userId);

    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-user-id="${userId}"]`)?.classList.add('active');

    if (window.innerWidth < 768) {
        document.getElementById('conversationsList')?.classList.add('hidden');
        document.getElementById('chatArea')?.classList.add('mobile-visible');
    }

    document.getElementById('messageInput').focus();
}

// ── MESSAGES ──────────────────────────────────────────────────
async function loadMessages(otherUserId) {
    try {
        const res  = await fetch(`${API_URL}/messages/${otherUserId}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            renderMessages(data.messages);
            data.messages.forEach(msg => {
                if (msg.receiverId === currentUser.userId && !msg.isRead) markMessageAsRead(msg.messageId);
            });
            setTimeout(loadConversations, 500);
        }
    } catch (err) { console.error('Load messages error:', err); }
}

function renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (messages.length === 0) {
        container.innerHTML = '<p class="empty-state">No messages yet. Send a message to start!</p>';
        return;
    }
    container.innerHTML = messages.map(msg =>
        createMessageHTML(msg, msg.senderId === currentUser.userId)
    ).join('');
    scrollToBottom();
}

function createMessageHTML(msg, isOwn) {
    let ri = '';
    if (isOwn) {
        if (msg.isRead)           ri = '<span class="read-indicator read">✓✓</span>';
        else if (msg.isDelivered) ri = '<span class="read-indicator delivered">✓✓</span>';
        else                      ri = '<span class="read-indicator">✓</span>';
    }
    return `
    <div class="message ${isOwn ? 'message-sent' : 'message-received'}" data-message-id="${msg.messageId}">
        <div class="msg-checkbox-wrap">
            <input type="checkbox" class="msg-checkbox" data-message-id="${msg.messageId}" aria-label="Select message">
        </div>
        <div class="message-bubble">
            <div class="message-content">${escapeHtml(msg.content)}</div>
            <div class="message-meta">
                <span class="message-time">${formatTime(msg.sentAt)}</span>
                ${ri}
            </div>
        </div>
    </div>`;
}

function addMessageToUI(message, isOwn) {
    const container = document.getElementById('messagesContainer');
    container.querySelector('.empty-state')?.remove();
    container.insertAdjacentHTML('beforeend', createMessageHTML(message, isOwn));
}

function removeMessageFromUI(messageId) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!el) return;
    selectedMessages.delete(messageId);
    updateSelectionToolbar();
    el.style.transition = 'opacity 0.2s, transform 0.2s';
    el.style.opacity    = '0';
    el.style.transform  = 'scale(0.95)';
    setTimeout(() => {
        el.remove();
        const c = document.getElementById('messagesContainer');
        if (c && !c.querySelector('.message')) clearMessagesUI();
    }, 200);
}

function clearMessagesUI() {
    const c = document.getElementById('messagesContainer');
    if (c) c.innerHTML = '<p class="empty-state">No messages yet. Send a message to start!</p>';
    exitSelectionMode();
}

// ── SELECTION MODE ────────────────────────────────────────────
function enterSelectionMode() {
    selectionMode = true;
    document.getElementById('messagesContainer').classList.add('selection-mode');
    document.getElementById('selectionToolbar')?.classList.add('visible');
    updateSelectionToolbar();
}

function exitSelectionMode() {
    selectionMode = false;
    selectedMessages.clear();
    document.getElementById('messagesContainer').classList.remove('selection-mode');
    document.querySelectorAll('.msg-checkbox:checked').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.message.selected').forEach(el => el.classList.remove('selected'));
    document.getElementById('selectionToolbar')?.classList.remove('visible');
}

function updateSelectionToolbar() {
    const count = selectedMessages.size;
    const label = document.getElementById('selectedCount');
    if (label) label.textContent = `${count} selected`;
    const btn = document.getElementById('deleteSelectBtn');
    if (btn) btn.disabled = count === 0;
}

async function deleteSelectedMessages() {
    if (selectedMessages.size === 0) return;
    const count = selectedMessages.size;
    if (!confirm(`Delete ${count} selected message${count > 1 ? 's' : ''} from your view?`)) return;
    const ids = Array.from(selectedMessages);
    exitSelectionMode();
    await Promise.allSettled(ids.map(id => deleteSingleMessage(id, true)));
    loadConversations();
    showToast(`${count} message${count > 1 ? 's' : ''} deleted`);
}

// ── SEND ──────────────────────────────────────────────────────
async function sendMessage() {
    const input   = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !currentConversation) return;
    try {
        const res  = await fetch(`${API_URL}/messages/send`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverId: currentConversation.user.userId, content })
        });
        const data = await res.json();
        if (data.success) {
            input.value = '';
            addMessageToUI(data.message, true);
            scrollToBottom();
            loadConversations();
        } else { showToast(data.error || 'Failed to send message', 'error'); }
    } catch { showToast('Failed to send message', 'error'); }
}

// ── DELETE SINGLE ─────────────────────────────────────────────
async function deleteSingleMessage(messageId, skipConfirm = false) {
    if (!skipConfirm && !confirm('Delete this message from your view?')) return;
    removeMessageFromUI(messageId);
    try {
        const res  = await fetch(`${API_URL}/messages/${messageId}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!data.success) showToast(data.error || 'Delete failed', 'error');
    } catch { showToast('Delete failed', 'error'); }
}

// ── CLEAR CHAT ────────────────────────────────────────────────
async function clearChat() {
    if (!currentConversation) return;
    document.getElementById('chatMenuDropdown')?.classList.remove('visible');
    const name = currentConversation.user.fullName || currentConversation.user.username;
    if (!confirm(`Clear all messages with ${name}?\n\nThis removes from YOUR view only.`)) return;
    clearMessagesUI();
    try {
        const res  = await fetch(
            `${API_URL}/messages/conversation/${currentConversation.user.userId}/clear`,
            { method: 'DELETE', credentials: 'include' }
        );
        const data = await res.json();
        if (data.success) { loadConversations(); showToast('Chat cleared from your view'); }
        else showToast(data.error || 'Failed to clear chat', 'error');
    } catch { showToast('Failed to clear chat', 'error'); }
}

// ── CONTEXT MENU ──────────────────────────────────────────────
function handleTouchStart(e) {
    const msgEl = e.target.closest('.message');
    if (!msgEl) return;
    touchMoved     = false;
    longPressTimer = setTimeout(() => {
        if (!touchMoved) showContextMenu(e.touches[0].clientX, e.touches[0].clientY, msgEl);
    }, 500);
}
function handleTouchEnd() { clearTimeout(longPressTimer); longPressTimer = null; }
function handleRightClick(e) {
    const msgEl = e.target.closest('.message');
    if (!msgEl) return;
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, msgEl);
}

function showContextMenu(x, y, msgEl) {
    dismissContextMenu();
    const messageId = parseInt(msgEl.dataset.messageId);
    const menu      = document.createElement('div');
    menu.className  = 'context-menu';

    const delBtn       = document.createElement('button');
    delBtn.className   = 'context-menu-item context-menu-danger';
    delBtn.textContent = '🗑 Delete message';
    delBtn.addEventListener('click', () => { dismissContextMenu(); deleteSingleMessage(messageId); });
    menu.appendChild(delBtn);

    const selBtn       = document.createElement('button');
    selBtn.className   = 'context-menu-item';
    selBtn.textContent = '☑ Select';
    selBtn.addEventListener('click', () => {
        dismissContextMenu();
        const cb = msgEl.querySelector('.msg-checkbox');
        if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    menu.appendChild(selBtn);

    document.body.appendChild(menu);
    const mw = menu.offsetWidth || 170, mh = menu.offsetHeight || 88;
    let left = Math.min(x + 4, window.innerWidth  - mw - 8);
    let top  = Math.min(y + 4, window.innerHeight - mh - 8);
    left = Math.max(left, 8); top = Math.max(top, 8);
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
    menu.classList.add('visible');
    activeContextMenu = menu;
}

function dismissContextMenu() {
    if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
}

// ── MARK READ ─────────────────────────────────────────────────
async function markMessageAsRead(messageId) {
    try {
        await fetch(`${API_URL}/messages/${messageId}/read`, { method: 'PUT', credentials: 'include' });
    } catch { /* non-critical */ }
}

// ── TYPING ────────────────────────────────────────────────────
function handleTyping() {
    if (!currentConversation || !socket) return;
    socket.emit('typing', { recipientId: currentConversation.user.userId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', { recipientId: currentConversation.user.userId });
    }, 3000);
}

function showTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    const un = document.getElementById('typingUsername');
    if (el) {
        if (un) un.textContent = currentConversation?.user.fullName || currentConversation?.user.username || 'User';
        el.classList.add('visible');
    }
}

function hideTypingIndicator() {
    document.getElementById('typingIndicator')?.classList.remove('visible');
}

// ── UTILS ─────────────────────────────────────────────────────
function scrollToBottom() {
    const c = document.getElementById('messagesContainer');
    if (c) c.scrollTop = c.scrollHeight;
}

function formatTime(ts) {
    const d = new Date(ts), now = new Date(), ms = now - d;
    if (ms < 60000)   return 'Just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = String(text ?? '');
    return d.innerHTML;
}

function showConversations() {
    document.getElementById('conversationsList')?.classList.remove('hidden');
    document.getElementById('chatArea')?.classList.remove('mobile-visible');
    if (!currentConversation) {
        document.getElementById('noConversation')?.classList.remove('hidden');
        document.getElementById('activeConversation')?.classList.add('hidden');
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
        socket?.disconnect();
    } catch { /* ignore */ }
    window.location.href = '/index.html';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const msg   = document.getElementById('toastMessage');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}