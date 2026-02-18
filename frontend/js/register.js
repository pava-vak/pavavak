const API_URL = 'http://localhost:3000/api';
let validatedInviteCode = null;

document.addEventListener('DOMContentLoaded', () => {
    // Invite form submit
    document.getElementById('inviteForm').addEventListener('submit', validateInvite);

    // Register form submit
    document.getElementById('registerForm').addEventListener('submit', register);

    // Back button
    document.getElementById('backToStep1Btn').addEventListener('click', goBackToStep1);

    // Format invite code as user types
    document.getElementById('inviteCode').addEventListener('input', function(e) {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (value.length > 2) {
            value = value.substring(0, 2) + '-' + value.substring(2);
        }
        if (value.length > 7) {
            value = value.substring(0, 7) + '-' + value.substring(7, 11);
        }

        e.target.value = value;
    });
});

// Validate invite code
async function validateInvite(event) {
    event.preventDefault();

    const code = document.getElementById('inviteCode').value.trim().toUpperCase();
    const button = document.getElementById('validateButton');

    button.disabled = true;
    button.textContent = 'Validating...';

    try {
        const response = await fetch(`${API_URL}/invites/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        const data = await response.json();
        
        console.log('Frontend received:', data);
        console.log('data.valid =', data.valid);
        console.log('Type of data.valid:', typeof data.valid);

        if (data.valid === true) {
            console.log('✅ Code validated successfully!');
            validatedInviteCode = code;
            showStep2();
        } else {
            console.log('❌ Validation failed');
            showToast(data.reason || data.error || 'Invalid invite code');
            button.disabled = false;
            button.textContent = 'Validate Code';
        }
    } catch (error) {
        console.error('Validation error:', error);
        showToast('Failed to validate invite code');
        button.disabled = false;
        button.textContent = 'Validate Code';
    }
}
// Register user
async function register(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showToast('Passwords do not match');
        return;
    }

    if (password.length < 8) {
        showToast('Password must be at least 8 characters');
        return;
    }

    const button = document.getElementById('registerButton');
    button.disabled = true;
    button.textContent = 'Creating Account...';

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                email,
                fullName,
                inviteCode: validatedInviteCode
            })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess();
        } else {
            showToast(data.error || 'Registration failed');
            button.disabled = false;
            button.textContent = 'Create Account';
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.');
        button.disabled = false;
        button.textContent = 'Create Account';
    }
}

function showStep2() {
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
}

function showSuccess() {
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('successMessage').classList.remove('hidden');
}

function goBackToStep1() {
    validatedInviteCode = null;
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('inviteCode').value = '';
    document.getElementById('registerForm').reset();
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}