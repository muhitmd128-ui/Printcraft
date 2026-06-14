// ══════════════════════════════════════════
//  FIREBASE CONFIG
// ══════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyBYTYmisYZc_V3NTu6HFaossdahMHtb4Xw",
  authDomain:        "printcraft-78ea2.firebaseapp.com",
  projectId:         "printcraft-78ea2",
  storageBucket:     "printcraft-78ea2.firebasestorage.app",
  messagingSenderId: "423279199420",
  appId:             "1:423279199420:web:a2dc60a9d4b2a41c427cb9",
  measurementId:     "G-44Z19633GQ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ══════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════
const OWNER_USER   = 'owner';
const OWNER_PASS   = 'print2024';
const CUSTOMER_URL = 'https://muhitmd128-ui.github.io/Printcraft/send.html';

// ══════════════════════════════════════════
//  ROUTING
// ══════════════════════════════════════════
function show(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  document.getElementById('pg-' + page).classList.add('show');
  window.scrollTo(0, 0);
  if (page === 'dash') {
    loadDashboard();
  }
}

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
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ══════════════════════════════════════════
//  DASHBOARD – LOAD FROM FIRESTORE
// ══════════════════════════════════════════
let currentSubs = [];

function loadDashboard() {
  const list = document.getElementById('files-list');
  list.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div>Loading files…</div></div>';

  db.collection('submissions')
    .orderBy('date', 'desc')
    .get()
    .then(snapshot => {
      currentSubs = [];
      snapshot.forEach(doc => currentSubs.push({ id: doc.id, ...doc.data() }));
      renderStats(currentSubs);
      renderFiles(currentSubs);
    })
    .catch(err => {
      console.error(err);
      list.innerHTML = '<div class="empty"><div class="empty-icon">❌</div><div>Failed to load. Check Firestore rules.</div></div>';
    });
}

// ══════════════════════════════════════════
//  DASHBOARD – STATS
// ══════════════════════════════════════════
function renderStats(subs) {
  const today   = new Date().toDateString();
  const todayCt = subs.filter(s => new Date(s.date).toDateString() === today).length;
  const totalF  = subs.reduce((a, s) => a + (s.files || []).length, 0);
  document.getElementById('st-total').textContent = subs.length;
  document.getElementById('st-today').textContent = todayCt;
  document.getElementById('st-files').textContent = totalF;
}

// ══════════════════════════════════════════
//  DASHBOARD – RENDER FILES
// ══════════════════════════════════════════
function renderFiles(subs) {
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
  subs.forEach((sub, si) => {
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
              ${f.size    ? ' &middot; ' + fmtBytes(f.size) : ''}
            </div>
          </div>
          <div class="file-actions">
            <button class="btn-sm-red"   onclick="dlFile(${si},${fi})">⬇ Download</button>
            <button class="btn-sm-ghost" onclick="delFile('${sub.id}',${fi})">✕</button>
          </div>
        </div>`;
    });
  });

  list.innerHTML = html;
}

// ══════════════════════════════════════════
//  DASHBOARD – DOWNLOAD FILE (from Cloudinary URL)
// ══════════════════════════════════════════
function dlFile(subIdx, fileIdx) {
  const f = currentSubs[subIdx].files[fileIdx];
  // Cloudinary: force download with fl_attachment flag
  let url = f.url;
  if (url && url.includes('/upload/') && !url.includes('fl_attachment')) {
    url = url.replace('/upload/', '/upload/fl_attachment/');
  }
  const a = document.createElement('a');
  a.href     = url;
  a.target   = '_blank';
  a.download = f.name;
  a.click();
  toast('⬇ Downloading ' + f.name);
}

// ══════════════════════════════════════════
//  DASHBOARD – DELETE FILE (Firestore record only)
// ══════════════════════════════════════════
function delFile(docId, fileIdx) {
  db.collection('submissions').doc(docId).get().then(doc => {
    if (!doc.exists) return;
    const data  = doc.data();
    const files = data.files || [];
    files.splice(fileIdx, 1);

    if (!files.length) {
      return db.collection('submissions').doc(docId).delete();
    } else {
      return db.collection('submissions').doc(docId).update({ files });
    }
  }).then(() => {
    toast('🗑 File deleted');
    loadDashboard();
  }).catch(err => {
    console.error(err);
    toast('❌ Delete failed');
  });
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
  const a    = document.createElement('a');
  a.download = 'sharify-qr.png';
  a.href     = canvas.toDataURL('image/png');
  a.click();
  toast('✓ QR Code downloaded!');
}

function copyURL() {
  navigator.clipboard.writeText(CUSTOMER_URL)
    .then(() => toast('✓ URL copied to clipboard!'))
    .catch(() => toast('⚠ Could not copy — copy it manually'));
}
