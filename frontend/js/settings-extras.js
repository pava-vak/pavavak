// ============================================================
// PaVa-Vak Settings Extras  |  js/settings-extras.js
// Handles: App Info, Notifications, PIN setup, Biometric,
//          Lock timer — all wired via addEventListener,
//          no inline onclick handlers (CSP compliant)
// ============================================================

'use strict';

// ─── PIN SETUP STATE ─────────────────────────────────────────
let pinSetupStep    = 'enter';
let pinSetupFirst   = '';
let pinSetupCurrent = '';

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    updateAppInfo();
    updateNotificationUI();
    updatePinUI();
    initLockTimer();
    initPinButtons();
    initBiometricButtons();
    initPinKeypad();       // ← wires keypad via data-digit, no onclick
    initNotificationBtn();
});

// ─── APP INFO ─────────────────────────────────────────────────
function updateAppInfo() {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches
               || window.navigator.standalone === true;
    const modeEl = document.getElementById('appMode');
    if (modeEl) modeEl.textContent = isPWA ? 'Installed PWA' : 'Browser';

    const swEl = document.getElementById('swStatus');
    if (swEl) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                swEl.textContent = reg ? '✅ Active' : '⚠️ Not registered';
            }).catch(() => { swEl.textContent = '❌ Error'; });
        } else {
            swEl.textContent = '❌ Not supported';
        }
    }

    const connEl = document.getElementById('connectionStatus');
    if (connEl) {
        connEl.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
        window.addEventListener('online',  () => { connEl.textContent = '🟢 Online'; });
        window.addEventListener('offline', () => { connEl.textContent = '🔴 Offline'; });
    }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function updateNotificationUI() {
    const statusText = document.getElementById('notificationStatusText');
    const enableBtn  = document.getElementById('enableNotificationsBtn');
    const disableBtn = document.getElementById('disableNotificationsBtn');

    if (!('Notification' in window)) {
        if (statusText) statusText.textContent = 'Not supported';
        if (enableBtn)  enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = 'none';
        return;
    }

    const p = Notification.permission;
    if (statusText) {
        statusText.textContent =
            p === 'granted' ? '✅ Enabled' :
            p === 'denied'  ? '❌ Blocked in browser' : 'Not enabled';
        statusText.className = 'status-badge ' +
            (p === 'granted' ? 'badge-success' : p === 'denied' ? 'badge-danger' : '');
    }
    if (enableBtn)  enableBtn.style.display  = p === 'granted' ? 'none' : '';
    if (disableBtn) disableBtn.style.display = p === 'granted' ? '' : 'none';
}

function initNotificationBtn() {
    const btn = document.getElementById('enableNotificationsBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
        if (!('Notification' in window)) return;
        const result = await Notification.requestPermission();
        updateNotificationUI();
        if (result === 'denied') {
            alert('Notifications blocked. Please enable them in your browser settings.');
        }
    });
}

// ─── PIN STATUS UI ────────────────────────────────────────────
function updatePinUI() {
    const hasPin       = window.applockHasPin ? window.applockHasPin() : false;
    const hasBiometric = localStorage.getItem('pv_biometric') === 'enabled';

    const pinStatus = document.getElementById('pinStatusText');
    if (pinStatus) {
        pinStatus.textContent = hasPin ? '✅ PIN set' : '❌ Not set';
        pinStatus.className   = 'status-badge ' + (hasPin ? 'badge-success' : 'badge-danger');
    }

    const bioStatus = document.getElementById('biometricStatusText');
    if (bioStatus) {
        bioStatus.textContent = hasBiometric ? '✅ Enabled' : 'Not set up';
        bioStatus.className   = 'status-badge ' + (hasBiometric ? 'badge-success' : '');
    }

    const setupBtn   = document.getElementById('setupPinBtn');
    const changeBtn  = document.getElementById('changePinBtn');
    const removeBtn  = document.getElementById('removePinBtn');
    const timerGroup = document.getElementById('lockTimerGroup');
    const bioGroup   = document.getElementById('biometricBtnGroup');
    const bioRow     = document.getElementById('biometricRow');

    if (setupBtn)   setupBtn.style.display   = hasPin ? 'none' : '';
    if (changeBtn)  changeBtn.style.display  = hasPin ? '' : 'none';
    if (removeBtn)  removeBtn.style.display  = hasPin ? '' : 'none';
    if (timerGroup) timerGroup.style.display = ''; // always visible

    const webAuthnOK = !!window.PublicKeyCredential;
    if (bioGroup) bioGroup.style.display = (hasPin && webAuthnOK) ? '' : 'none';
    if (bioRow)   bioRow.style.display   = webAuthnOK ? '' : 'none';

    const setupBioBtn  = document.getElementById('setupBiometricBtn');
    const removeBioBtn = document.getElementById('removeBiometricBtn');
    if (setupBioBtn)  setupBioBtn.style.display  = hasBiometric ? 'none' : '';
    if (removeBioBtn) removeBioBtn.style.display = hasBiometric ? '' : 'none';
}

// ─── LOCK TIMER ───────────────────────────────────────────────
function initLockTimer() {
    const select      = document.getElementById('lockTimer');
    const customGroup = document.getElementById('customTimerGroup');
    if (!select) return;

    const current = window.applockGetTimer ? window.applockGetTimer() : 0;
    const known   = ['0', '60', '300', '900'];
    if (known.includes(String(current))) {
        select.value = String(current);
    } else if (current > 0) {
        select.value = 'custom';
        if (customGroup) customGroup.style.display = '';
        const inp = document.getElementById('customTimerMinutes');
        if (inp) inp.value = Math.round(current / 60);
    }

    select.addEventListener('change', function () {
        if (this.value === 'custom') {
            if (customGroup) customGroup.style.display = '';
        } else {
            if (customGroup) customGroup.style.display = 'none';
            if (window.applockSetTimer) {
                window.applockSetTimer(parseInt(this.value));
                showPinMessage('Lock timer updated ✅', 'success');
            }
        }
    });

    const saveBtn = document.getElementById('saveCustomTimerBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            const mins = parseInt(document.getElementById('customTimerMinutes').value);
            if (!mins || mins < 1) {
                showPinMessage('Enter a valid number of minutes', 'error');
                return;
            }
            if (window.applockSetTimer) {
                window.applockSetTimer(mins * 60);
                showPinMessage(`Lock timer set to ${mins} minute${mins > 1 ? 's' : ''} ✅`, 'success');
            }
        });
    }
}

// ─── PIN BUTTONS ──────────────────────────────────────────────
function initPinButtons() {
    const setupBtn  = document.getElementById('setupPinBtn');
    const changeBtn = document.getElementById('changePinBtn');
    const removeBtn = document.getElementById('removePinBtn');

    if (setupBtn)  setupBtn.addEventListener('click',  () => openPinSetup());
    if (changeBtn) changeBtn.addEventListener('click', () => openPinSetup());
    if (removeBtn) {
        removeBtn.addEventListener('click', function () {
            if (confirm('Remove PIN? The app will no longer lock automatically.')) {
                if (window.applockRemovePin) window.applockRemovePin();
                updatePinUI();
                showPinMessage('PIN removed', 'success');
            }
        });
    }
}

// ─── BIOMETRIC BUTTONS ────────────────────────────────────────
function initBiometricButtons() {
    const setupBtn  = document.getElementById('setupBiometricBtn');
    const removeBtn = document.getElementById('removeBiometricBtn');

    if (setupBtn) {
        setupBtn.addEventListener('click', async function () {
            if (!window.applockSetupBiometric) return;
            showPinMessage('Setting up biometric — follow your device prompt...', 'info');
            const result = await window.applockSetupBiometric();
            if (result.success) {
                updatePinUI();
                showPinMessage('Biometric set up successfully ✅', 'success');
            } else {
                showPinMessage('Biometric setup failed: ' + result.error, 'error');
            }
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', function () {
            if (confirm('Remove biometric authentication?')) {
                if (window.applockDisableBiometric) window.applockDisableBiometric();
                updatePinUI();
                showPinMessage('Biometric removed', 'success');
            }
        });
    }
}

// ─── PIN KEYPAD — wired via data-digit, no onclick ────────────
function initPinKeypad() {
    const keypad    = document.getElementById('pinSetupKeypad');
    const deleteBtn = document.getElementById('pinSetupDelete');
    const cancelBtn = document.getElementById('pinSetupCancelBtn');

    if (keypad) {
        keypad.addEventListener('click', function (e) {
            const key = e.target.closest('.pin-key');
            if (!key || key.disabled || key.classList.contains('pin-empty')) return;
            if (key.classList.contains('pin-delete')) {
                pinSetupDeleteDigit();
            } else {
                const digit = key.dataset.digit;
                if (digit !== undefined) pinSetupAddDigit(digit);
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', pinSetupDeleteDigit);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePinSetup);
    }
}

// ─── PIN SETUP OVERLAY ────────────────────────────────────────
function openPinSetup() {
    pinSetupStep    = 'enter';
    pinSetupFirst   = '';
    pinSetupCurrent = '';

    const overlay  = document.getElementById('pin-setup-overlay');
    const title    = document.getElementById('pinSetupTitle');
    const subtitle = document.getElementById('pinSetupSubtitle');
    const errorEl  = document.getElementById('pinSetupError');

    if (title)    title.textContent    = window.applockHasPin() ? 'Change PIN' : 'Set New PIN';
    if (subtitle) subtitle.textContent = 'Enter a 4-digit PIN';
    if (errorEl)  errorEl.textContent  = '';
    if (overlay)  overlay.classList.add('visible');

    refreshSetupDots();
}

function closePinSetup() {
    const overlay = document.getElementById('pin-setup-overlay');
    if (overlay) overlay.classList.remove('visible');
    pinSetupStep    = 'enter';
    pinSetupFirst   = '';
    pinSetupCurrent = '';
}

function pinSetupAddDigit(digit) {
    if (pinSetupCurrent.length >= 4) return;
    pinSetupCurrent += digit;
    refreshSetupDots();
    if (pinSetupCurrent.length === 4) {
        setTimeout(handlePinSetupComplete, 150);
    }
}

function pinSetupDeleteDigit() {
    if (pinSetupCurrent.length === 0) return;
    pinSetupCurrent = pinSetupCurrent.slice(0, -1);
    refreshSetupDots();
}

function refreshSetupDots() {
    const dots = document.querySelectorAll('#pinSetupDots .pin-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < pinSetupCurrent.length);
        dot.classList.remove('error');
    });
}

async function handlePinSetupComplete() {
    const subtitle = document.getElementById('pinSetupSubtitle');
    const errorEl  = document.getElementById('pinSetupError');

    if (pinSetupStep === 'enter') {
        pinSetupFirst   = pinSetupCurrent;
        pinSetupCurrent = '';
        pinSetupStep    = 'confirm';
        if (subtitle) subtitle.textContent = 'Confirm your PIN';
        refreshSetupDots();
    } else {
        if (pinSetupCurrent !== pinSetupFirst) {
            const dots = document.querySelectorAll('#pinSetupDots .pin-dot');
            dots.forEach(d => d.classList.add('error'));
            if (errorEl) errorEl.textContent = 'PINs do not match. Try again.';
            setTimeout(() => {
                pinSetupStep    = 'enter';
                pinSetupFirst   = '';
                pinSetupCurrent = '';
                dots.forEach(d => d.classList.remove('error'));
                if (errorEl)  errorEl.textContent  = '';
                if (subtitle) subtitle.textContent = 'Enter a 4-digit PIN';
                refreshSetupDots();
            }, 900);
            return;
        }

        const result = await window.applockSetPin(pinSetupCurrent, pinSetupFirst);
        if (result.success) {
            closePinSetup();
            updatePinUI();
            showPinMessage('PIN set successfully ✅', 'success');
        } else {
            if (errorEl) errorEl.textContent = result.error;
        }
    }
}

// ─── PIN MESSAGE ──────────────────────────────────────────────
function showPinMessage(text, type) {
    const el = document.getElementById('pinMessage');
    if (!el) return;
    el.textContent = text;
    el.className   = 'form-message ' + type;
    setTimeout(() => {
        el.textContent = '';
        el.className   = 'form-message';
    }, 4000);
}