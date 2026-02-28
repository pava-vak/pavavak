// ============================================================
// PaVa-Vak App Lock  |  js/applock.js
// CSP COMPLIANT — zero inline onclick handlers
//
// PIN BUG FIX:
//   For timer=0 (immediate), we track whether THIS specific
//   page load has been unlocked. sessionStorage is tab-wide,
//   so navigating pages would skip the lock. We use a
//   page-load flag (in-memory) so every fresh page load
//   requires PIN, but navigating within a page does not.
// ============================================================

'use strict';

const AL_PIN_HASH    = 'pv_pin_hash';
const AL_TIMER       = 'pv_lock_timer';
const AL_BIOMETRIC   = 'pv_biometric';
const AL_LAST_ACTIVE = 'pv_last_active';
const AL_CRED_ID     = 'pv_cred_id';
const AL_UNLOCKED_AT = 'pv_unlocked_at'; // sessionStorage — set per page load

// Per page-load unlock flag (in memory — resets on every page navigation)
let _pageUnlocked = false;

let currentPin = '';
const PIN_LENGTH = 4;

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initAppLock);

async function initAppLock() {
    const overlay = document.getElementById('app-lock-overlay');
    if (!overlay) return;

    // No PIN set → unlock immediately
    if (!localStorage.getItem(AL_PIN_HASH)) {
        unlockOverlay();
        return;
    }

    if (!shouldLock()) {
        unlockOverlay();
        return;
    }

    buildLockScreen(overlay);
    await tryBiometricAuto();
}

// ─── SHOULD LOCK? ─────────────────────────────────────────────
// FIX: timer=0 (immediate) now always locks on a fresh page
//      load because _pageUnlocked starts as false every time.
//      It only stays unlocked within the same page session.
function shouldLock() {
    const timer = parseInt(localStorage.getItem(AL_TIMER) || '0');

    if (timer === 0) {
        // Immediate mode: lock on every fresh page load
        // _pageUnlocked is false until the user unlocks on this page
        return !_pageUnlocked;
    }

    // Timer mode: lock if elapsed > timer
    const lastActive = sessionStorage.getItem(AL_LAST_ACTIVE);
    if (!lastActive) return true;
    return (Date.now() - parseInt(lastActive)) > timer * 1000;
}

// ─── UNLOCK ───────────────────────────────────────────────────
function unlockOverlay() {
    _pageUnlocked = true;
    const overlay = document.getElementById('app-lock-overlay');
    if (overlay) overlay.classList.add('unlocked');
    updateLastActive();
    startActivityTracking();
}

function updateLastActive() {
    sessionStorage.setItem(AL_LAST_ACTIVE, Date.now().toString());
}

// ─── ACTIVITY TRACKING ────────────────────────────────────────
function startActivityTracking() {
    const timer = parseInt(localStorage.getItem(AL_TIMER) || '0');

    // Timer mode: refresh last-active on any interaction
    if (timer > 0) {
        ['click', 'keypress', 'touchstart', 'mousemove', 'scroll'].forEach(evt => {
            document.addEventListener(evt, updateLastActive, { passive: true });
        });
    }

    // Visibility change: handle background/foreground
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange() {
    if (!localStorage.getItem(AL_PIN_HASH)) return;
    const timer = parseInt(localStorage.getItem(AL_TIMER) || '0');

    if (document.hidden) {
        if (timer === 0) {
            // Immediate: clear page unlock flag when going to background
            _pageUnlocked = false;
        }
        // Record time we went to background
        sessionStorage.setItem(AL_LAST_ACTIVE, Date.now().toString());
    } else {
        // Returning to app — check if we should re-lock
        if (!_pageUnlocked && shouldLock()) {
            const overlay = document.getElementById('app-lock-overlay');
            if (overlay) {
                overlay.classList.remove('unlocked');
                currentPin = '';
                buildLockScreen(overlay);
            }
        }
    }
}

// ─── BUILD LOCK SCREEN ────────────────────────────────────────
function buildLockScreen(overlay) {
    overlay.innerHTML = `
        <div class="lock-card">
            <div class="lock-icon">🔐</div>
            <div class="lock-title">PaVa-Vak</div>
            <div class="lock-subtitle" id="lockSubtitle">Enter your PIN to continue</div>

            <div class="pin-dots" id="pinDots">
                <div class="pin-dot"></div>
                <div class="pin-dot"></div>
                <div class="pin-dot"></div>
                <div class="pin-dot"></div>
            </div>

            <div class="lock-error" id="lockError"></div>

            <div class="pin-keypad" id="pinKeypad">
                <button class="pin-key" data-digit="1">1</button>
                <button class="pin-key" data-digit="2">2</button>
                <button class="pin-key" data-digit="3">3</button>
                <button class="pin-key" data-digit="4">4</button>
                <button class="pin-key" data-digit="5">5</button>
                <button class="pin-key" data-digit="6">6</button>
                <button class="pin-key" data-digit="7">7</button>
                <button class="pin-key" data-digit="8">8</button>
                <button class="pin-key" data-digit="9">9</button>
                <button class="pin-key pin-empty" disabled></button>
                <button class="pin-key" data-digit="0">0</button>
                <button class="pin-key pin-delete" id="pinDeleteBtn">⌫</button>
            </div>

            <button class="pin-biometric-btn" id="biometricBtn" style="display:none;">
                👆 Use Biometric
            </button>

            <button class="forgot-pin-btn" id="forgotPinBtn">Forgot PIN?</button>

            <div class="reset-pin-form" id="resetPinForm" style="display:none;">
                <input type="password" id="resetPassword"
                       placeholder="Enter account password"
                       autocomplete="current-password">
                <button class="lock-btn-primary" id="resetPinSubmitBtn">
                    Verify &amp; Reset PIN
                </button>
                <button class="lock-btn-secondary" id="resetPinCancelBtn">
                    Cancel
                </button>
            </div>
        </div>
    `;

    wireLockScreen();
}

// ─── WIRE LOCK SCREEN ─────────────────────────────────────────
function wireLockScreen() {
    // Keypad — event delegation on parent
    const keypad = document.getElementById('pinKeypad');
    if (keypad) {
        keypad.addEventListener('click', function (e) {
            const key = e.target.closest('.pin-key');
            if (!key || key.disabled || key.classList.contains('pin-empty')) return;
            if (key.classList.contains('pin-delete') || key.id === 'pinDeleteBtn') {
                pinDelete();
            } else {
                const digit = key.dataset.digit;
                if (digit !== undefined) pinKeyPress(digit);
            }
        });
    }

    // Biometric button
    const bioBtn = document.getElementById('biometricBtn');
    if (bioBtn) bioBtn.addEventListener('click', tryBiometric);

    // Forgot PIN
    const forgotBtn = document.getElementById('forgotPinBtn');
    if (forgotBtn) forgotBtn.addEventListener('click', showForgotPin);

    // Reset PIN submit
    const submitBtn = document.getElementById('resetPinSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', resetPinWithPassword);

    // Reset PIN cancel
    const cancelBtn = document.getElementById('resetPinCancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', hideForgotPin);

    // Enter key on password field
    const pwField = document.getElementById('resetPassword');
    if (pwField) {
        pwField.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') resetPinWithPassword();
        });
    }
}

// ─── PIN INPUT ────────────────────────────────────────────────
function pinKeyPress(digit) {
    if (currentPin.length >= PIN_LENGTH) return;
    currentPin += String(digit);
    updatePinDots();
    if (currentPin.length === PIN_LENGTH) {
        setTimeout(verifyPin, 120);
    }
}

function pinDelete() {
    if (currentPin.length === 0) return;
    currentPin = currentPin.slice(0, -1);
    updatePinDots();
}

function updatePinDots() {
    const dots = document.querySelectorAll('#pinDots .pin-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < currentPin.length);
        dot.classList.remove('error');
    });
    // Clear any error text while user is typing
    const errorEl = document.getElementById('lockError');
    if (errorEl && currentPin.length > 0) errorEl.textContent = '';
}

// ─── VERIFY PIN ───────────────────────────────────────────────
async function verifyPin() {
    const storedHash = localStorage.getItem(AL_PIN_HASH);
    if (!storedHash) {
        // No PIN in storage anymore — just unlock
        onUnlockSuccess();
        return;
    }

    const hash = await sha256(currentPin);

    if (hash === storedHash) {
        onUnlockSuccess();
    } else {
        pinError('Incorrect PIN. Try again.');
    }
}

function pinError(msg) {
    const errorEl = document.getElementById('lockError');
    if (errorEl) errorEl.textContent = msg;

    const dots = document.querySelectorAll('#pinDots .pin-dot');
    dots.forEach(dot => {
        dot.classList.remove('filled');
        dot.classList.add('error');
    });

    setTimeout(() => {
        currentPin = '';
        dots.forEach(dot => {
            dot.classList.remove('error', 'filled');
        });
        if (errorEl) errorEl.textContent = '';
    }, 900);
}

// ─── ON UNLOCK SUCCESS ────────────────────────────────────────
function onUnlockSuccess() {
    currentPin = '';
    unlockOverlay();
}

// ─── BIOMETRIC ────────────────────────────────────────────────
async function tryBiometricAuto() {
    if (localStorage.getItem(AL_BIOMETRIC) !== 'enabled') return;
    const bioBtn = document.getElementById('biometricBtn');
    if (bioBtn) bioBtn.style.display = 'block';
    await tryBiometric();
}

async function tryBiometric() {
    if (!window.PublicKeyCredential) return;
    try {
        const credIdStored = localStorage.getItem(AL_CRED_ID);
        if (!credIdStored) return;
        const credId = new Uint8Array(JSON.parse(credIdStored));

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge:        crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ type: 'public-key', id: credId }],
                userVerification: 'required',
                timeout:          60000
            }
        });
        if (assertion) onUnlockSuccess();
    } catch (err) {
        // User cancelled biometric — fall back to PIN silently
        console.log('[AppLock] Biometric cancelled, use PIN');
    }
}

// ─── FORGOT PIN ───────────────────────────────────────────────
function showForgotPin() {
    const keypad  = document.getElementById('pinKeypad');
    const form    = document.getElementById('resetPinForm');
    const forgot  = document.getElementById('forgotPinBtn');
    const dots    = document.getElementById('pinDots');
    const bioBtn  = document.getElementById('biometricBtn');
    const subtitle = document.getElementById('lockSubtitle');

    if (keypad)   keypad.style.display   = 'none';
    if (dots)     dots.style.display     = 'none';
    if (forgot)   forgot.style.display   = 'none';
    if (bioBtn)   bioBtn.style.display   = 'none';
    if (subtitle) subtitle.textContent   = 'Enter your account password to reset PIN';
    if (form)     form.style.display     = 'flex';

    const pwField = document.getElementById('resetPassword');
    if (pwField) { pwField.value = ''; pwField.focus(); }

    const errorEl = document.getElementById('lockError');
    if (errorEl) errorEl.textContent = '';
}

function hideForgotPin() {
    const keypad  = document.getElementById('pinKeypad');
    const form    = document.getElementById('resetPinForm');
    const forgot  = document.getElementById('forgotPinBtn');
    const dots    = document.getElementById('pinDots');
    const subtitle = document.getElementById('lockSubtitle');

    if (keypad)   keypad.style.display   = 'grid';
    if (dots)     dots.style.display     = 'flex';
    if (forgot)   forgot.style.display   = 'block';
    if (subtitle) subtitle.textContent   = 'Enter your PIN to continue';
    if (form)     form.style.display     = 'none';
    currentPin = '';
}

async function resetPinWithPassword() {
    const pwField = document.getElementById('resetPassword');
    const errorEl = document.getElementById('lockError');
    if (!pwField) return;

    const password = pwField.value.trim();
    if (!password) {
        if (errorEl) errorEl.textContent = 'Please enter your password';
        return;
    }

    try {
        const res  = await fetch('/api/auth/verify-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (data.success) {
            // Clear PIN — user will set a new one in settings
            localStorage.removeItem(AL_PIN_HASH);
            localStorage.removeItem(AL_BIOMETRIC);
            localStorage.removeItem(AL_CRED_ID);
            onUnlockSuccess();
        } else {
            if (errorEl) errorEl.textContent = 'Incorrect password. Try again.';
            pwField.value = '';
        }
    } catch (err) {
        if (errorEl) errorEl.textContent = 'Connection error. Try again.';
    }
}

// ─── SHA-256 ──────────────────────────────────────────────────
async function sha256(str) {
    const buf  = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — used by settings-extras.js
// ═══════════════════════════════════════════════════════════════

window.applockSetPin = async function (newPin, confirmPin) {
    if (!newPin || newPin.length !== PIN_LENGTH) {
        return { success: false, error: `PIN must be ${PIN_LENGTH} digits` };
    }
    if (newPin !== confirmPin) {
        return { success: false, error: 'PINs do not match' };
    }
    const hash = await sha256(newPin);
    localStorage.setItem(AL_PIN_HASH, hash);
    return { success: true };
};

window.applockRemovePin = function () {
    localStorage.removeItem(AL_PIN_HASH);
    localStorage.removeItem(AL_BIOMETRIC);
    localStorage.removeItem(AL_CRED_ID);
};

window.applockHasPin = function () {
    return !!localStorage.getItem(AL_PIN_HASH);
};

window.applockSetTimer = function (seconds) {
    localStorage.setItem(AL_TIMER, seconds.toString());
};

window.applockGetTimer = function () {
    return parseInt(localStorage.getItem(AL_TIMER) || '0');
};

window.applockSetupBiometric = async function () {
    if (!window.PublicKeyCredential) {
        return { success: false, error: 'Biometric not supported on this device' };
    }
    try {
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge:  crypto.getRandomValues(new Uint8Array(32)),
                rp:         { name: 'PaVa-Vak', id: location.hostname },
                user: {
                    id:          crypto.getRandomValues(new Uint8Array(16)),
                    name:        'pavavak-user',
                    displayName: 'PaVa-Vak User'
                },
                pubKeyCredParams:      [{ type: 'public-key', alg: -7 }],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification:        'required'
                },
                timeout: 60000
            }
        });
        if (credential) {
            const credIdArray = Array.from(new Uint8Array(credential.rawId));
            localStorage.setItem(AL_CRED_ID, JSON.stringify(credIdArray));
            localStorage.setItem(AL_BIOMETRIC, 'enabled');
            return { success: true };
        }
        return { success: false, error: 'Biometric setup failed' };
    } catch (err) {
        return { success: false, error: err.message || 'Biometric setup failed' };
    }
};

window.applockDisableBiometric = function () {
    localStorage.removeItem(AL_BIOMETRIC);
    localStorage.removeItem(AL_CRED_ID);
};

window.applockLockNow = function () {
    _pageUnlocked = false;
    sessionStorage.removeItem(AL_LAST_ACTIVE);
    const overlay = document.getElementById('app-lock-overlay');
    if (overlay && localStorage.getItem(AL_PIN_HASH)) {
        overlay.classList.remove('unlocked');
        currentPin = '';
        buildLockScreen(overlay);
    }
};