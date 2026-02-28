/* ============================================================
   PaVa-Vak Chat CSS
   Dark theme — WhatsApp-inspired
   Covers: layout, header, conversations list, chat area,
           message bubbles, checkboxes, selection toolbar,
           context menu, chat header menu, toast, PWA,
           responsive (mobile/desktop)
   ============================================================ */

/* ─── Reset & Base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Helvetica Neue', Arial, sans-serif;
    background: #0f1419;
    color: #e9edef;
    font-size: 14px;
    line-height: 1.5;
    overflow: hidden; /* prevent outer scroll — each panel scrolls independently */
}

/* ─── CSS Variables ────────────────────────────────────────── */
:root {
    --bg-primary:      #0f1419;
    --bg-secondary:    #1a2232;
    --bg-tertiary:     #202c33;
    --bg-elevated:     #1e2d3d;
    --bg-hover:        rgba(255,255,255,0.05);

    --text-primary:    #e9edef;
    --text-secondary:  #8696a0;
    --text-muted:      #536471;

    --brand:           #4f46e5;
    --brand-hover:     #4338ca;
    --brand-light:     rgba(79,70,229,0.15);

    --online:          #25d366;
    --offline:         #536471;
    --read-color:      #53bdeb;
    --delivered:       #8696a0;
    --danger:          #f87171;
    --danger-hover:    rgba(248,113,113,0.12);

    --bubble-out:      #005c4b;
    --bubble-in:       #1e2d3d;

    --divider:         rgba(134,150,160,0.15);
    --radius-sm:       6px;
    --radius-md:       10px;
    --radius-bubble:   18px;

    --header-height:   56px;
    --input-height:    60px;
}

/* ─── App Header ───────────────────────────────────────────── */
.header {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: var(--header-height);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--divider);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    z-index: 100;
}

.header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
}
.header-logo  { font-size: 20px; }
.header-title { font-size: 17px; font-weight: 600; color: var(--text-primary); }

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.header-username {
    font-size: 13px;
    color: var(--text-secondary);
    margin-right: 4px;
}
.header-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 13px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
}
.header-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.header-btn-danger { color: var(--danger); }
.header-btn-danger:hover { background: var(--danger-hover); }

/* ─── Main Layout ──────────────────────────────────────────── */
.chat-container {
    position: fixed;
    top: var(--header-height);
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
}

/* ─── Conversations List (left panel) ──────────────────────── */
.conversations-list {
    width: 320px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border-right: 1px solid var(--divider);
    overflow: hidden;
}

.conversations-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--divider);
    flex-shrink: 0;
}
.conversations-header h2 {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-primary);
}

#conversationsContainer {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

/* ── Conversation Item ─────────────────────────────────────── */
.conversation-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    gap: 10px;
    cursor: pointer;
    border-bottom: 1px solid var(--divider);
    position: relative;
    transition: background 0.12s;
    user-select: none;
}
.conversation-item:hover  { background: var(--bg-hover); }
.conversation-item.active { background: var(--bg-elevated); }

/* Avatar circle with letter */
.conv-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
}

/* Online dot — sits on bottom-right of avatar */
.online-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid var(--bg-primary);
    position: absolute;
    bottom: 10px;
    left: 42px;      /* avatar width */
    transform: translate(-100%, 0);
    flex-shrink: 0;
}
.conversation-item .online-dot {
    position: absolute;
    bottom: 10px;
    left: 44px;
}
.online-dot.online  { background: var(--online); }
.online-dot.offline { background: var(--offline); }

.conversation-info {
    flex: 1;
    min-width: 0;
}
.conv-top-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 4px;
}
.conversation-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
}
.conversation-time {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
}
.conversation-last-message {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
}
.you-prefix { color: var(--text-muted); }

.unread-badge {
    background: var(--brand);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

/* ─── Chat Area (right panel) ──────────────────────────────── */
.chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary);
    position: relative;
}

/* ── No conversation selected ──────────────────────────────── */
.no-conversation {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
}
.no-conv-inner {
    text-align: center;
    color: var(--text-muted);
}
.no-conv-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }
.no-conv-inner p { font-size: 14px; }

/* ─── Chat Header ──────────────────────────────────────────── */
.chat-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    height: 56px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--divider);
    flex-shrink: 0;
}

.back-btn-mobile {
    display: none;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 20px;
    padding: 6px;
    cursor: pointer;
    border-radius: var(--radius-sm);
}
.back-btn-mobile:hover { background: var(--bg-hover); }

.chat-header-info { flex: 1; min-width: 0; }
.chat-header-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.chat-header-status {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 1px;
}

/* ⋮ menu */
.chat-header-menu { position: relative; }

.chat-menu-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 22px;
    line-height: 1;
    padding: 6px 10px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background 0.15s;
}
.chat-menu-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.chat-menu-dropdown {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 190px;
    background: var(--bg-elevated);
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 300;
    overflow: hidden;
    animation: menuFadeIn 0.15s ease;
}
.chat-menu-dropdown.visible { display: block; }

.chat-menu-option {
    display: block;
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border: none;
    text-align: left;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.12s;
}
.chat-menu-option:hover  { background: var(--bg-hover); }
.chat-menu-danger        { color: var(--danger); }
.chat-menu-danger:hover  { background: var(--danger-hover); }

/* ─── Selection Toolbar ────────────────────────────────────── */
.selection-toolbar {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    height: 48px;
    background: #1a2d4a;
    border-bottom: 1px solid rgba(79,70,229,0.3);
    flex-shrink: 0;
    gap: 12px;
}
.selection-toolbar.visible { display: flex; }

.sel-count {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    text-align: center;
}
.sel-btn {
    border: none;
    border-radius: var(--radius-sm);
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
}
.sel-cancel {
    background: var(--bg-hover);
    color: var(--text-secondary);
}
.sel-cancel:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }

.sel-delete {
    background: var(--danger);
    color: #fff;
}
.sel-delete:hover    { background: #ef4444; }
.sel-delete:disabled { opacity: 0.4; cursor: not-allowed; }

/* ─── Messages Area ────────────────────────────────────────── */
.messages-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    scroll-behavior: smooth;
}

/* ── Individual message row ─────────────────────────────────── */
.message {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    max-width: 100%;
    position: relative;
    /* smooth delete animation starts hidden */
}

/* Checkbox wrapper — hidden by default, shown in selection mode */
.msg-checkbox-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 0;
    overflow: hidden;
    transition: width 0.2s;
    flex-shrink: 0;
}

/* In selection mode — reveal checkboxes */
.selection-mode .msg-checkbox-wrap {
    width: 28px;
}

.msg-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--brand);
    cursor: pointer;
    border-radius: 3px;
}

/* Bubble */
.message-bubble {
    position: relative;
    padding: 8px 12px 22px;  /* bottom padding for timestamp row */
    border-radius: var(--radius-bubble);
    max-width: 75%;
    word-break: break-word;
    transition: box-shadow 0.15s;
}

/* Selected state */
.message.selected .message-bubble {
    box-shadow: 0 0 0 2px var(--brand);
}

/* Sent (right side) */
.message-sent {
    flex-direction: row-reverse;
}
.message-sent .message-bubble {
    background: var(--bubble-out);
    border-bottom-right-radius: 4px;
    margin-left: auto;
}

/* Received (left side) */
.message-received .message-bubble {
    background: var(--bubble-in);
    border-bottom-left-radius: 4px;
}

.message-content {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.5;
}

.message-meta {
    position: absolute;
    bottom: 5px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}
.message-received .message-meta { right: auto; left: 10px; }

.message-time {
    font-size: 11px;
    color: rgba(255,255,255,0.55);
}

/* Read indicators — ticks */
.read-indicator {
    font-size: 11px;
    color: var(--delivered);
    line-height: 1;
}
.read-indicator.delivered { color: var(--delivered); }
.read-indicator.read      { color: var(--read-color); }

/* ── Empty state ───────────────────────────────────────────── */
.empty-state {
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    padding: 32px 16px;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
}

/* ── Typing indicator ──────────────────────────────────────── */
.typing-indicator {
    padding: 6px 16px 4px;
    font-size: 12px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}
.typing-dots {
    display: inline-flex;
    gap: 3px;
    align-items: center;
}
.typing-dots span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--text-secondary);
    animation: typingBounce 1.2s infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30%           { transform: translateY(-5px); }
}

/* ─── Input Area ────────────────────────────────────────────── */
.message-input-container {
    background: var(--bg-secondary);
    border-top: 1px solid var(--divider);
    padding: 10px 12px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    flex-shrink: 0;
}
.message-input-form {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-tertiary);
    border-radius: 26px;
    padding: 6px 6px 6px 16px;
}

#messageInput {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.5;
    min-height: 24px;
    max-height: 100px;
    resize: none;
    caret-color: var(--brand);
}
#messageInput::placeholder { color: var(--text-muted); }

.send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--brand);
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.1s;
}
.send-btn:hover  { background: var(--brand-hover); }
.send-btn:active { transform: scale(0.93); }

/* ─── Context Menu ──────────────────────────────────────────── */
.context-menu {
    position: fixed;
    min-width: 170px;
    background: var(--bg-elevated);
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 32px rgba(0,0,0,0.55);
    z-index: 9000;
    overflow: hidden;
    opacity: 0;
    transform: scale(0.88);
    transform-origin: top left;
    transition: opacity 0.12s ease, transform 0.12s ease;
    pointer-events: none;
}
.context-menu.visible {
    opacity: 1;
    transform: scale(1);
    pointer-events: all;
}

.context-menu-item {
    display: block;
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border: none;
    text-align: left;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.12s;
}
.context-menu-item:hover  { background: var(--bg-hover); }
.context-menu-danger      { color: var(--danger); }
.context-menu-danger:hover { background: var(--danger-hover); }

/* ─── Back Button (no-conversation state) ───────────────────── */
.back-btn {
    background: var(--brand);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    padding: 10px 20px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s;
}
.back-btn:hover { background: var(--brand-hover); }

/* ─── Toast ─────────────────────────────────────────────────── */
.toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--bg-elevated);
    color: var(--text-primary);
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.5);
    z-index: 9999;
    pointer-events: none;
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;
    opacity: 0;
    white-space: nowrap;
}
.toast.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
}
.toast.toast-error { background: #7f1d1d; color: #fecaca; }

/* ─── PWA Banner ────────────────────────────────────────────── */
.pwa-banner {
    display: none;
    background: var(--brand);
    color: #fff;
    padding: 10px 16px;
    font-size: 13px;
    text-align: center;
    align-items: center;
    justify-content: center;
    gap: 10px;
}
.pwa-banner.visible { display: flex; }
.pwa-banner-install {
    padding: 4px 14px;
    background: #fff;
    color: var(--brand);
    border: none;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
}
.pwa-banner-close {
    background: transparent;
    color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 12px;
    padding: 4px 10px;
    cursor: pointer;
}
.pwa-header-install {
    display: none;
    padding: 6px 12px;
    background: #25d366;
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
}

/* ─── Animations ────────────────────────────────────────────── */
@keyframes menuFadeIn {
    from { opacity: 0; transform: scale(0.92) translateY(-4px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes messageIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
}
.message { animation: messageIn 0.18s ease-out; }

/* ─── Scrollbar styling ─────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* ─── Reduce motion ─────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}

/* ═══════════════════════════════════════════════════════════
   RESPONSIVE — MOBILE (< 768px)
   Single panel: list OR chat, never both
════════════════════════════════════════════════════════════ */
@media (max-width: 767px) {
    .chat-container { display: block; position: relative; }

    .conversations-list {
        position: absolute;
        inset: 0;
        width: 100%;
        z-index: 10;
    }

    .chat-area {
        position: absolute;
        inset: 0;
        width: 100%;
        z-index: 20;
        display: none; /* shown by JS when conversation selected */
    }
    .chat-area.mobile-visible { display: flex; }

    .back-btn-mobile { display: flex; }

    .header-username { display: none; }

    /* Wider bubbles on mobile */
    .message-bubble { max-width: 88%; }

    /* Pad for home indicator */
    .message-input-container {
        padding-bottom: calc(10px + env(safe-area-inset-bottom));
    }
}

/* ═══════════════════════════════════════════════════════════
   DESKTOP  (≥ 768px)
════════════════════════════════════════════════════════════ */
@media (min-width: 768px) {
    .chat-container { display: flex; }
    .conversations-list { display: flex !important; }
    .chat-area { display: flex !important; }
    .back-btn-mobile { display: none !important; }
    #backToConversations2 { display: none !important; }
}