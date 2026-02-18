const API_URL = 'http://localhost:3000/api';

let socket;
let currentUser = null;
let currentConversation = null;
let conversations = [];
let typingTimeout = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadConversations();
    initializeSocket();
    setupEventListeners();
    
    // Refresh conversations every 30 seconds
    setInterval(loadConversations, 30000);
});

// Setup all event listeners
function setupEventListeners() {
    // Button listeners
 // Button listeners
    document.getElementById('settingsBtn').addEventListener('click', () => {
        window.location.href = '/settings.html';
    });
    document.getElementById('adminButton').addEventListener('click', goToAdmin);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('backToConversations').addEventListener('click', showConversations);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    
    // Message input listeners
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', handleMessageKeyPress);
    messageInput.addEventListener('input', handleTyping);
    
    // Conversation click delegation
    document.getElementById('conversationsContainer').addEventListener('click', (e) => {
        const conversationItem = e.target.closest('.conversation-item');
        if (conversationItem) {
            const userId = parseInt(conversationItem.dataset.userId);
            selectConversation(userId);
        }
    });
}

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
        document.getElementById('currentUsername').textContent = currentUser.fullName || currentUser.username;

        // Show admin button if user is admin
        if (currentUser.isAdmin) {
            document.getElementById('adminButton').style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/index.html';
    }
}

// Initialize Socket.io connection
function initializeSocket() {
    // Socket.io will be loaded from external file
    if (typeof io === 'undefined') {
        console.error('Socket.io not loaded');
        return;
    }

    socket = io({
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('Socket connected');
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });

    // Listen for new messages
    socket.on('new_message', (message) => {
        console.log('New message received:', message);
        
        // Update conversations list
        loadConversations();
        
        // If this message is for current conversation, add it
        if (currentConversation && 
            (message.senderId === currentConversation.user.userId || 
             message.receiverId === currentConversation.user.userId)) {
            addMessageToUI(message, message.senderId === currentUser.userId);
            
            // Mark as read if we're the receiver
            if (message.receiverId === currentUser.userId) {
                markMessageAsRead(message.messageId);
            }
            
            scrollToBottom();
        } else {
            showToast(`New message from ${message.senderUsername || 'someone'}`);
        }
    });

    // Listen for message read receipts
    socket.on('message_read', (data) => {
        const messageEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageEl) {
            const readIndicator = messageEl.querySelector('.read-indicator');
            if (readIndicator) {
                readIndicator.textContent = '✓✓';
                readIndicator.classList.add('read');
            }
        }
    });

    // Listen for typing indicators
    socket.on('user_typing', (data) => {
        if (currentConversation && data.userId === currentConversation.user.userId) {
            if (data.isTyping) {
                showTypingIndicator();
            } else {
                hideTypingIndicator();
            }
        }
    });

    // Listen for message deletion
    socket.on('message_deleted', (data) => {
        const messageEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageEl) {
            messageEl.remove();
        }
    });
}

// Load conversations list
async function loadConversations() {
    try {
        const response = await fetch(`${API_URL}/messages/conversations/list`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            conversations = data.conversations;
            renderConversationsList();
        }
    } catch (error) {
        console.error('Load conversations error:', error);
    }
}

// Render conversations list
function renderConversationsList() {
    const container = document.getElementById('conversationsContainer');
    
    if (conversations.length === 0) {
        container.innerHTML = '<p class="empty-state">No conversations yet. An admin needs to create a connection for you.</p>';
        return;
    }

    container.innerHTML = conversations.map(conv => {
        const isActive = currentConversation && currentConversation.user.userId === conv.user.userId;
        const lastMessage = conv.lastMessage;
        const unreadBadge = conv.unreadCount > 0 ? 
            `<span class="unread-badge">${conv.unreadCount}</span>` : '';

        return `
            <div class="conversation-item ${isActive ? 'active' : ''}" 
                 data-user-id="${conv.user.userId}">
                <div class="conversation-info">
                    <div class="conversation-name">
                        ${conv.user.fullName || conv.user.username}
                    </div>
                    ${lastMessage ? `
                        <div class="conversation-last-message">
                            ${lastMessage.isFromMe ? 'You: ' : ''}${lastMessage.content}
                        </div>
                        <div class="conversation-time">
                            ${formatTime(lastMessage.sentAt)}
                        </div>
                    ` : '<div class="conversation-last-message">No messages yet</div>'}
                </div>
                ${unreadBadge}
            </div>
        `;
    }).join('');
}

// Select a conversation
async function selectConversation(userId) {
    try {
        const conv = conversations.find(c => c.user.userId === userId);
        if (!conv) return;

        currentConversation = conv;

        // Update UI
        document.getElementById('noConversation').style.display = 'none';
        document.getElementById('activeConversation').style.display = 'flex';
        document.getElementById('chatUsername').textContent = conv.user.fullName || conv.user.username;

        // Load messages
        await loadMessages(userId);

        // Mark active conversation in list
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-user-id="${userId}"]`)?.classList.add('active');

        // Mobile: show chat area
        if (window.innerWidth < 768) {
            document.getElementById('conversationsList').style.display = 'none';
            document.getElementById('chatArea').style.display = 'flex';
            document.getElementById('backToConversations').style.display = 'block';
        }

        // Focus message input
        document.getElementById('messageInput').focus();
    } catch (error) {
        console.error('Select conversation error:', error);
    }
}

// Load messages for conversation
async function loadMessages(otherUserId) {
    try {
        const response = await fetch(`${API_URL}/messages/${otherUserId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            renderMessages(data.messages);
            
            // Mark unread messages as read
            data.messages.forEach(msg => {
                if (msg.receiverId === currentUser.userId && !msg.isRead) {
                    markMessageAsRead(msg.messageId);
                }
            });

            // Refresh conversations to update unread count
            setTimeout(loadConversations, 500);
        }
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

// Render messages
function renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = '<p class="empty-state">No messages yet. Send a message to start!</p>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isOwn = msg.senderId === currentUser.userId;
        return createMessageHTML(msg, isOwn);
    }).join('');

    scrollToBottom();
}

// Create message HTML
function createMessageHTML(message, isOwn) {
    const readIndicator = isOwn && message.isRead ? 
        '<span class="read-indicator read">✓✓</span>' : 
        (isOwn ? '<span class="read-indicator">✓</span>' : '');

    return `
        <div class="message ${isOwn ? 'message-sent' : 'message-received'}" data-message-id="${message.messageId}">
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-meta">
                ${formatTime(message.sentAt)}
                ${readIndicator}
            </div>
        </div>
    `;
}

// Add message to UI (for real-time updates)
function addMessageToUI(message, isOwn) {
    const container = document.getElementById('messagesContainer');
    
    // Remove "no messages" placeholder if it exists
    const placeholder = container.querySelector('.empty-state');
    if (placeholder) {
        placeholder.remove();
    }

    const messageHTML = createMessageHTML(message, isOwn);
    container.insertAdjacentHTML('beforeend', messageHTML);
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content || !currentConversation) return;

    try {
        const response = await fetch(`${API_URL}/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                receiverId: currentConversation.user.userId,
                content: content,
                timerType: 'keep_forever'
            })
        });

        const data = await response.json();

        if (data.success) {
            input.value = '';
            addMessageToUI(data.message, true);
            scrollToBottom();
            loadConversations();
        } else {
            showToast(data.error || 'Failed to send message', 'error');
        }
    } catch (error) {
        console.error('Send message error:', error);
        showToast('Failed to send message', 'error');
    }
}

// Handle message input key press
function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Handle typing indicator
function handleTyping() {
    if (!currentConversation || !socket) return;

    socket.emit('typing', { recipientId: currentConversation.user.userId });

    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }

    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', { recipientId: currentConversation.user.userId });
    }, 3000);
}

// Show typing indicator
function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    const username = document.getElementById('typingUsername');
    
    if (currentConversation) {
        username.textContent = currentConversation.user.fullName || currentConversation.user.username;
        indicator.style.display = 'block';
    }
}

// Hide typing indicator
function hideTypingIndicator() {
    document.getElementById('typingIndicator').style.display = 'none';
}

// Mark message as read
async function markMessageAsRead(messageId) {
    try {
        await fetch(`${API_URL}/messages/${messageId}/read`, {
            method: 'PUT',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
    }
}

// Scroll to bottom of messages
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Format time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
        return 'Just now';
    }
    
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
    }
    
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show conversations (for mobile)
function showConversations() {
    document.getElementById('conversationsList').style.display = 'block';
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('backToConversations').style.display = 'none';
}

// Go to admin dashboard
function goToAdmin() {
    window.location.href = '/admin.html';
}

// Logout
async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        if (socket) {
            socket.disconnect();
        }
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
    toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}