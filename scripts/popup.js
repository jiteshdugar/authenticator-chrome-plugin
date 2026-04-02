/**
 * Main Popup Script for Authenticator Extension
 * Manages UI, event listeners, and token refresh
 */

// UI Elements
const els = {
  mainContent: document.getElementById('main-content'),
  accountsList: document.getElementById('accounts-list'),
  navButtons: document.querySelectorAll('.nav-btn'),
  views: document.querySelectorAll('.view'),
  manualForm: document.getElementById('manual-add-form'),
  scanQrBtn: document.getElementById('scan-qr-btn'),
  searchBtn: document.getElementById('search-btn'),
  searchOverlay: document.getElementById('search-overlay'),
  searchInput: document.getElementById('search-input'),
  closeSearch: document.getElementById('close-search'),
  exportBtn: document.getElementById('export-btn'),
  importFile: document.getElementById('import-file'),
  toast: document.getElementById('toast'),
  emptyAddBtn: document.getElementById('empty-add-btn')
};

let currentView = 'home';
let accounts = [];
let searchQuery = '';
let refreshInterval;

// Initialize
async function init() {
  accounts = await StorageManager.getAccounts();
  renderAccounts();
  setupEventListeners();
  startRefreshLoop();
}

/**
 * Setup UI Event Listeners
 */
function setupEventListeners() {
  // Navigation
  els.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.getAttribute('data-view'));
    });
  });

  // Manual Form Submission
  els.manualForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const account = {
      name: document.getElementById('code-name').value,
      secret: document.getElementById('setup-key').value.replace(/\s/g, ''),
      type: document.getElementById('key-type').value,
      issuer: '',
      period: 30,
      digits: 6
    };

    if (account.secret) {
      await StorageManager.addAccount(account);
      accounts = await StorageManager.getAccounts();
      els.manualForm.reset();
      switchView('home');
      showToast('Account added successfully');
    }
  });

  // Empty state button
  els.emptyAddBtn.addEventListener('click', () => {
    switchView('add');
  });

  // Search
  els.searchBtn.addEventListener('click', () => {
    els.searchOverlay.classList.remove('hidden');
    els.searchInput.focus();
  });

  els.closeSearch.addEventListener('click', () => {
    els.searchOverlay.classList.add('hidden');
    els.searchInput.value = '';
    searchQuery = '';
    renderAccounts();
  });

  els.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderAccounts();
  });

  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView('home'));
  });

  // Export
  els.exportBtn.addEventListener('click', async () => {
    const data = await StorageManager.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `authenticator-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported');
  });

  // Import
  els.importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const success = await StorageManager.importData(event.target.result);
        if (success) {
          accounts = await StorageManager.getAccounts();
          renderAccounts();
          showToast('Imported successfully');
        } else {
          showToast('Import failed: Invalid file format');
        }
      };
      reader.readAsText(file);
    }
  });

  // QR Scanning
  els.scanQrBtn.addEventListener('click', () => {
    scanFromScreen();
  });
}

/**
 * Switching views logic
 * @param {string} viewId 
 */
function switchView(viewId) {
  els.views.forEach(view => {
    view.classList.add('hidden');
    if (view.id === `view-${viewId}`) {
      view.classList.remove('hidden');
    }
  });

  els.navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
  });

  currentView = viewId;
  if (viewId === 'home') {
    renderAccounts();
  }
}

/**
 * Rendering accounts to Home view
 */
function renderAccounts() {
  if (currentView !== 'home') return;

  const filtered = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery) || 
    (acc.issuer && acc.issuer.toLowerCase().includes(searchQuery))
  );

  if (filtered.length === 0 && searchQuery === '') {
    // Show empty state
    els.accountsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <p>No accounts yet.</p>
        <button id="empty-add-btn-inner" class="btn btn-primary">Add account</button>
      </div>
    `;
    document.getElementById('empty-add-btn-inner')?.addEventListener('click', () => switchView('add'));
    return;
  }

  els.accountsList.innerHTML = filtered.map(acc => {
    const data = OTPLogic.generateToken(acc);
    return `
      <div class="account-card" data-id="${acc.id}">
        <div class="account-info">
          <span class="account-name">${acc.issuer ? `${acc.issuer} (${acc.name})` : acc.name}</span>
          <button class="delete-btn icon-btn" title="Delete account">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
        <div class="code-container" data-secret="${acc.secret}">
          <span class="otp-code">${data.token}</span>
        </div>
        <div class="expiry-indicator">
          <div class="progress-bar ${data.remainingTime < 5 ? 'warning' : ''}" style="width: ${(data.remainingTime / data.period) * 100}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // Add click to copy
  document.querySelectorAll('.account-card').forEach(card => {
    const code = card.querySelector('.otp-code').textContent;
    const id = card.getAttribute('data-id');

    card.addEventListener('click', (e) => {
      // Prevent copy if delete button was clicked
      if (e.target.closest('.delete-btn')) {
        handleDelete(id);
        return;
      }
      
      navigator.clipboard.writeText(code.replace(/\s/g, ''));
      showToast('Copied to clipboard');
    });
  });
}

/**
 * Delete account
 * @param {string} id 
 */
async function handleDelete(id) {
  if (confirm('Delete this account?')) {
    await StorageManager.removeAccount(id);
    accounts = await StorageManager.getAccounts();
    renderAccounts();
    showToast('Account removed');
  }
}

/**
 * Token refresh loop
 */
function startRefreshLoop() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (currentView === 'home') {
      renderAccounts();
    }
  }, 1000);
}

/**
 * Toast notification
 * @param {string} msg 
 */
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  els.toast.classList.add('show');
  setTimeout(() => {
    els.toast.classList.remove('show');
    els.toast.classList.add('hidden');
  }, 3000);
}

/**
 * QR Code scanning from screen
 */
async function scanFromScreen() {
  showToast('Capturing screen...');
  
  chrome.runtime.sendMessage({ action: 'scan_qr' }, async (response) => {
    if (response && response.success && response.dataUrl) {
      showToast('Decoding QR...');
      
      const uri = await decodeQRCode(response.dataUrl);
      if (uri) {
        const account = OTPLogic.parseURI(uri);
        if (account) {
          await StorageManager.addAccount(account);
          accounts = await StorageManager.getAccounts();
          switchView('home');
          showToast('Account added via QR');
        } else {
          showToast('Invalid QR format');
        }
      } else {
        showToast('No QR code found on screen');
      }
    } else {
      showToast(response?.error || 'Failed to capture screen');
    }
  });
}

/**
 * Decode QR Code from Image Data URL
 * @param {string} dataUrl 
 * @returns {Promise<string|null>}
 */
async function decodeQRCode(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data) {
        resolve(code.data);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Start app
document.addEventListener('DOMContentLoaded', init);
