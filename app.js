// ══════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════
const OWNER_USER    = 'owner';
const OWNER_PASS    = 'print2024';
const CUSTOMER_URL  = 'https://muhitmd128-ui.github.io/Printcraft/#send';

// ══════════════════════════════════════════
//  ROUTING
// ══════════════════════════════════════════
function show(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  document.getElementById('pg-' + page).classList.add('show');
  window.scrollTo(0, 0);
  if (page === 'dash') {
    renderStats();
    renderFiles();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (location.hash === '#send') show('customer');
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#send') show('customer');
});

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
function doLogin() {
  const u   = document.getElementById('inp-user').value.trim();
  const p   = document.getElementById('inp-pass').value;
  const err = document.getElementById('login-err');

  if (u === OWNER_USER && p === OWNER_PASS) {
    err.style.display = 'none';
    document.getElementById('inp-user').value = '';
    document.getElementById('inp-pass').value = '';
    show('dash');
  } else {
    err.style.display = 'block';
  }
}

function doLogout() {
  show('landing');
}

// ══════════════════════════════════════════
//  LOCAL STORAGE
// ══════════════════════════════════════════
function getSubs() {
  try { return JSON.parse(localStorage.getItem('pc_subs') || '[]'); }
  catch { return []; }
}
function saveSubs(arr) {
  localStorage.setItem('pc_subs', JSON.stringify(arr));
}

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function fileIcon(name) {
  const e = (name || '').split('.').pop().toLowerCase();
  if (e === 'pdf') return '📄';
  if (['doc', 'docx'].includes(e)) return '📝';
  if (['xls', 'xlsx'].includes(e)) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return '🖼️';
  if (['ppt', 'pptx'].includes(e)) return '📑';
  if (['zip', 'rar', '7z'].includes(e)) return '🗜️';
  return '📎';
}

function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ══════════════════════════════════════════
//  DASHBOARD – STATS
// ══════════════════════════════════════════
function renderStats() {
  const subs    = getSubs();
  const today   = new Date().toDateString();
  const todayCt = subs.filter(s => new Date(s.date).toDateString() === today).length;
  const totalF  = subs.reduce((a, s) => a + (s.files || []).length, 0);

  document.getElementById('st-total').textContent = subs.length;
  document.getElementById('st-today').textContent = todayCt;
  document.getElementById('st-files').textContent = totalF;
}

// ══════════════════════════════════════════
//  DASHBOARD – FILES
// ══════════════════════════════════════════
function renderFiles() {
  const subs = getSubs();
  const list = document.getElementById('files-list');

  if (!subs.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📭</div>
        <div>No files received yet.<br>Share the QR code with customers.</div>
      </div>`;
    return;
  }

  let html = '';
  subs.slice().reverse().forEach((sub, ri) => {
    const realIdx = subs.length - 1 - ri;
    (sub.files || []).forEach((f, fi) => {
      html += `
        <div class="file-row">
          <div class="file-icon">${fileIcon(f.name)}</div>
          <div class="file-info">
            <div class="file-name">${esc(f.name)}</div>
            <div class="file-meta">
              From: <strong>${esc(sub.name || 'Anonymous')}</strong>
              &middot; ${new Date(sub.date).toLocaleString()}
              ${sub.notes ? ' &middot; ' + esc(sub.notes) : ''}
              ${f.size   ? ' &middot; ' + fmtBytes(f.size) : ''}
            </div>
          </div>
          <div class="file-actions">
            <button class="btn-sm-red"   onclick="dlFile(${realIdx},${fi})">⬇ Download</button>
            <button class="btn-sm-ghost" onclick="delFile(${realIdx},${fi})">✕</button>
          </div>
        </div>`;
    });
  });

  list.innerHTML = html;
}

function dlFile(si, fi) {
  const f = getSubs()[si].files[fi];
  const a = document.createElement('a');
  a.href     = f.data;
  a.download = f.name;
  a.click();
  toast('⬇ Downloading ' + f.name);
}

function delFile(si, fi) {
  const subs = getSubs();
  subs[si].files.splice(fi, 1);
  if (!subs[si].files.length) subs.splice(si, 1);
  saveSubs(subs);
  renderFiles();
  renderStats();
  toast('🗑 File deleted');
}

// ══════════════════════════════════════════
//  DASHBOARD – TABS
// ══════════════════════════════════════════
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-btn-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'qr') renderQR();
}

// ══════════════════════════════════════════
//  QR CODE
// ══════════════════════════════════════════
let qrGenerated = false;

function renderQR() {
  document.getElementById('qr-url-text').textContent = CUSTOMER_URL;
  if (qrGenerated) return;

  const container = document.getElementById('qr-render');
  container.innerHTML = '';

  new QRCode(container, {
    text:         CUSTOMER_URL,
    width:        200,
    height:       200,
    colorDark:    '#1a1a2e',
    colorLight:   '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  qrGenerated = true;
}

function downloadQR() {
  const canvas = document.querySelector('#qr-render canvas');
  if (!canvas) { toast('⚠ Open the QR Code tab first'); return; }
  const a      = document.createElement('a');
  a.download   = 'printcraft-qr.png';
  a.href       = canvas.toDataURL('image/png');
  a.click();
  toast('✓ QR Code downloaded!');
}

function copyURL() {
  navigator.clipboard.writeText(CUSTOMER_URL)
    .then(() => toast('✓ URL copied to clipboard!'))
    .catch(() => toast('⚠ Could not copy — copy it manually'));
}

// ══════════════════════════════════════════
//  CUSTOMER – FILE SELECTION
// ══════════════════════════════════════════
let selectedFiles = [];

function onDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('over');
  addFiles(Array.from(e.dataTransfer.files));
}

function onFileInput(e) {
  addFiles(Array.from(e.target.files));
  e.target.value = '';
}

function addFiles(newFiles) {
  newFiles.forEach(f => {
    const exists = selectedFiles.find(x => x.name === f.name && x.size === f.size);
    if (!exists) selectedFiles.push(f);
  });
  renderSelected();
}

function removeFile(i) {
  selectedFiles.splice(i, 1);
  renderSelected();
}

function renderSelected() {
  const c = document.getElementById('sel-files');
  if (!selectedFiles.length) { c.innerHTML = ''; return; }

  c.innerHTML = selectedFiles.map((f, i) => `
    <div class="sel-file">
      <span>${fileIcon(f.name)}</span>
      <span class="sel-file-name">${esc(f.name)}</span>
      <span class="sel-file-size">${fmtBytes(f.size)}</span>
      <span class="sel-remove" onclick="removeFile(${i})">✕</span>
    </div>`).join('');
}

// ══════════════════════════════════════════
//  CUSTOMER – SUBMIT
// ══════════════════════════════════════════
function submitFiles() {
  if (!selectedFiles.length) {
    toast('⚠ Please select at least one file');
    return;
  }

  const btn      = document.getElementById('send-btn');
  btn.textContent = 'Sending…';
  btn.disabled    = true;

  const reads = selectedFiles.map(f => new Promise(resolve => {
    const reader   = new FileReader();
    reader.onload  = () => resolve({ name: f.name, size: f.size, type: f.type, data: reader.result });
    reader.readAsDataURL(f);
  }));

  Promise.all(reads).then(fileData => {
    const subs = getSubs();
    subs.push({
      name:  document.getElementById('cust-name').value.trim() || 'Anonymous',
      notes: document.getElementById('cust-notes').value.trim(),
      date:  new Date().toISOString(),
      files: fileData
    });
    saveSubs(subs);

    // Reset form
    selectedFiles = [];
    renderSelected();
    document.getElementById('cust-name').value  = '';
    document.getElementById('cust-notes').value = '';
    btn.textContent = 'Send Files 🚀';
    btn.disabled    = false;

    // Show success
    const banner = document.getElementById('success-banner');
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 7000);
    toast('✅ Files sent successfully!');
  });
}
