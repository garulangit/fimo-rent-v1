import './login-mascots.js';
import {
  connectFirebase,
  sendPasswordResetEmail,
  signIn,
  watchAuthentication,
} from './firebase.js';

const form = document.querySelector('#login-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const message = document.querySelector('#login-message');
const button = document.querySelector('#login-button');
const buttonText = button.querySelector('.btn-text');
const forgotPasswordButton = document.querySelector('#forgot-password');

let auth;
let isAuthenticating = false;
let isResettingPassword = false;

function setLoginVisualState(state) {
  window.dispatchEvent(new CustomEvent('login-visual-state', { detail: { state } }));
}

function showMessage(text, type = 'error', invalidField = null) {
  message.textContent = text;
  message.classList.toggle('is-error', type === 'error');
  message.classList.toggle('is-success', type === 'success');

  [emailInput, passwordInput].forEach((input) => {
    const invalid = input === invalidField;
    input.setAttribute('aria-invalid', String(invalid));
  });
}

function validateEmail() {
  const email = emailInput.value.trim();
  if (!email) {
    showMessage('Email wajib diisi.', 'error', emailInput);
    emailInput.focus();
    return false;
  }
  if (!emailInput.validity.valid) {
    showMessage('Masukkan alamat email yang valid.', 'error', emailInput);
    emailInput.focus();
    return false;
  }
  return true;
}

function displayError(error) {
  const messages = {
    'auth/invalid-credential': 'Email atau kata sandi tidak sesuai.',
    'auth/wrong-password': 'Email atau kata sandi tidak sesuai.',
    'auth/user-disabled': 'Akun Anda belum memiliki akses ke aplikasi ini. Hubungi administrator.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Silakan coba kembali nanti.',
  };
  return messages[error.code] || 'Terjadi kendala saat masuk. Periksa koneksi Anda dan coba lagi.';
}

function checkSessionExpiredMessage() {
  const urlParams = new URLSearchParams(window.location.search);
  const expiredReason = urlParams.get('expired');
  let expiredMessage = null;

  try {
    expiredMessage = sessionStorage.getItem('fimo_session_expired_message');
    if (expiredMessage) {
      sessionStorage.removeItem('fimo_session_expired_message');
    }
  } catch { /* silent */ }

  if (!expiredMessage && expiredReason) {
    if (expiredReason === 'inactivity') {
      expiredMessage = 'Sesi Anda telah berakhir karena tidak ada aktivitas selama 10 jam. Silakan masuk kembali.';
    } else if (expiredReason === 'max_session') {
      expiredMessage = 'Sesi Anda telah berakhir karena telah mencapai batas waktu maksimal (12 jam). Silakan masuk kembali.';
    } else {
      expiredMessage = 'Sesi Anda telah berakhir. Silakan masuk kembali.';
    }
  }

  if (expiredMessage) {
    showMessage(expiredMessage);
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    }
  }
}

function showDemoEnvironmentLocally() {
  const indicator = document.querySelector('#environment-indicator');
  if (!indicator) return;
  const hostname = window.location.hostname.toLowerCase();
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname)
    || hostname.endsWith('.local')
    || hostname.endsWith('.test');
  indicator.hidden = !isLocal;
}

function initialiseLogin() {
  checkSessionExpiredMessage();
  showDemoEnvironmentLocally();
  const firebase = connectFirebase();

  if (!firebase.connected) {
    showMessage('Terjadi kendala saat masuk. Periksa koneksi Anda dan coba lagi.');
    button.disabled = true;
    forgotPasswordButton.disabled = true;
    document.body.classList.remove('auth-pending');
    return;
  }

  auth = firebase.auth;
  watchAuthentication(auth, (user) => {
    if (user && !isAuthenticating) {
      window.location.replace('index.html');
      return;
    }
    if (!user && !isAuthenticating && !isResettingPassword) button.disabled = false;
    document.body.classList.remove('auth-pending');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isAuthenticating || isResettingPassword) return;

    if (!validateEmail()) return;
    if (!passwordInput.value) {
      showMessage('Kata sandi wajib diisi.', 'error', passwordInput);
      passwordInput.focus();
      return;
    }

    isAuthenticating = true;
    button.disabled = true;
    button.classList.add('loading');
    button.classList.remove('success');
    buttonText.textContent = 'Memproses...';
    showMessage('Memeriksa akun...', 'status');
    setLoginVisualState('waiting');

    try {
      await signIn(auth, emailInput.value.trim(), passwordInput.value);
      button.classList.remove('loading');
      button.classList.add('success');
      buttonText.textContent = 'Berhasil';
      showMessage('Berhasil masuk.', 'success');
      setLoginVisualState('success');
      window.setTimeout(() => {
        isAuthenticating = false;
        window.location.replace('index.html');
      }, 350);
    } catch (error) {
      console.error('Login gagal:', error);
      showMessage(displayError(error));
      setLoginVisualState('failure');
      window.setTimeout(() => setLoginVisualState('idle'), 700);
      isAuthenticating = false;
      button.disabled = !auth;
      button.classList.remove('loading');
      buttonText.textContent = 'Masuk';
    }
  });

  emailInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (validateEmail()) passwordInput.focus();
  });

  [emailInput, passwordInput].forEach((input) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') showMessage('', 'status');
    });
  });

  forgotPasswordButton.addEventListener('click', async () => {
    if (isAuthenticating || isResettingPassword || !validateEmail()) return;

    isResettingPassword = true;
    forgotPasswordButton.disabled = true;
    button.disabled = true;
    forgotPasswordButton.textContent = 'Mengirim...';
    showMessage('Mengirim link reset kata sandi...', 'status');

    try {
      await sendPasswordResetEmail(auth, emailInput.value.trim());
      showMessage('Jika email terdaftar, link reset kata sandi telah dikirim.', 'success');
    } catch (error) {
      console.error('Permintaan reset kata sandi gagal:', error);
      if (error.code === 'auth/user-not-found') {
        showMessage('Jika email terdaftar, link reset kata sandi telah dikirim.', 'success');
      } else {
        showMessage('Link reset kata sandi gagal dikirim. Periksa koneksi Anda dan coba lagi.');
      }
    } finally {
      isResettingPassword = false;
      forgotPasswordButton.disabled = false;
      forgotPasswordButton.textContent = 'Lupa kata sandi?';
      button.disabled = !auth || isAuthenticating;
    }
  });
}

initialiseLogin();
