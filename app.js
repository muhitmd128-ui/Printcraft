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
const db      = firebase.firestore();
const storage = firebase.storage();

// ══════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════
const OWNER_USER   = 'owner';
const OWNER_PASS   = 'print2024';
const CUSTOMER_URL = 'https://muhitmd128-ui.github.io/Printcraft/#send';

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
//  DASHBOARD – LOAD FROM FIREBASE
// ══════════════════════════════════════════
function loadDashboard() {
  const list = document.getElementById('files-list');
  list.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div>Loading files…</div></div>';

  db.collection('submissions')
    .orderBy('date', 'desc')
    .get()
    .then(snapshot => {
      const subs = [];
      snapshot.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
      renderStats(subs);
      renderFiles(subs);
    })
    .catch(err => {
      console.error(err);
      list.innerHTML = '<div class="empty"><div class="empty-icon">❌</div><div>Failed to load. Check Firebase rules.</div></div>';
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
  subs.forEach(sub => {
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
            <button class="btn-sm-red"   onclick="dlFile('${esc(f.url)}','${esc(f.name)}')">⬇ Download</button>
            <button class="btn-sm-ghost" onclick="delFile('${sub.id}',${fi})">✕</button>
          </div>
        </div>`;
    });
  });

  list.innerHTML = html;
}

// ══════════════════════════════════════════
//  DASHBOARD – DOWNLOAD FILE
// ══════════════════════════════════════════
function dlFile(url, name) {
  const a  = document.createElement('a');
  a.href   = url;
  a.target = '_blank';
  a.download = name;
  a.click();
  toast('⬇ Downloading ' + name);
}

// ══════════════════════════════════════════
//  DASHBOARD – DELETE FILE
// ══════════════════════════════════════════
function delFile(docId, fileIdx) {
  db.collection('submissions').doc(docId).get().then(doc => {
    if (!doc.exists) return;
    const data  = doc.data();
    const files = data.files || [];
    const file  = files[fileIdx];

    // Delete from Storage
    if (file && file.storagePath) {
      storage.ref(file.storagePath).delete().catch(() => {});
    }

    // Remove from array
    files.splice(fileIdx, 1);

    if (!files.length) {
      // Delete entire doc if no files left
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
  a.download = 'printcraft-qr.png';
  a.href     = canvas.toDataURL('image/png');
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
//  CUSTOMER – SUBMIT TO FIREBASE
// ══════════════════════════════════════════
function submitFiles() {
  if (!selectedFiles.length) {
    toast('⚠ Please select at least one file');
    return;
  }

  const btn       = document.getElementById('send-btn');
  const custName  = document.getElementById('cust-name').value.trim() || 'Anonymous';
  const custNotes = document.getElementById('cust-notes').value.trim();
  btn.textContent = 'Uploading…';
  btn.disabled    = true;

  const uploadPromises = selectedFiles.map(file => {
    const path = `submissions/${Date.now()}_${file.name}`;
    const ref  = storage.ref(path);
    return ref.put(file).then(snap => snap.ref.getDownloadURL()).then(url => ({
      name:        file.name,
      size:        file.size,
      type:        file.type,
      url:         url,
      storagePath: path
    }));
  });

  Promise.all(uploadPromises)
    .then(fileData => {
      return db.collection('submissions').add({
        name:  custName,
        notes: custNotes,
        date:  new Date().toISOString(),
        files: fileData
      });
    })
    .then(() => {
      // Reset form
      selectedFiles = [];
      renderSelected();
      document.getElementById('cust-name').value  = '';
      document.getElementById('cust-notes').value = '';
      btn.textContent = 'Send Files 🚀';
      btn.disabled    = false;

      const banner = document.getElementById('success-banner');
      banner.style.display = 'block';
      setTimeout(() => { banner.style.display = 'none'; }, 7000);
      toast('✅ Files sent successfully!');
    })
    .catch(err => {
      console.error(err);
      btn.textContent = 'Send Files 🚀';
      btn.disabled    = false;
      toast('❌ Upload failed. Please try again.');
    });
}
