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
//  CONSTANTS
// ══════════════════════════════════════════
// Firestore documents max out at ~1MB. Keep margin for metadata.
const MAX_FILE_SIZE = 700 * 1024; // 700 KB per file

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
//  FILE SELECTION
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
    if (f.size > MAX_FILE_SIZE) {
      toast(`⚠ "${f.name}" is too large (max ${fmtBytes(MAX_FILE_SIZE)}). Skipped.`);
      return;
    }
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
//  PROGRESS BAR
// ══════════════════════════════════════════
function setProgress(percent, label) {
  const wrap = document.getElementById('progress-wrap');
  const bar  = document.getElementById('progress-bar');
  const txt  = document.getElementById('progress-label');

  if (percent === null) {
    wrap.style.display = 'none';
    bar.style.width = '0%';
    txt.textContent = '';
    return;
  }

  wrap.style.display = 'block';
  bar.style.width = percent + '%';
  txt.textContent = label || '';
}

// ══════════════════════════════════════════
//  CONVERT FILE TO BASE64
// ══════════════════════════════════════════
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:mime;base64,xxxx
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════
//  SUBMIT TO FIRESTORE
// ══════════════════════════════════════════
function submitFiles() {
  if (!selectedFiles.length) {
    toast('⚠ Please select at least one file');
    return;
  }

  const btn       = document.getElementById('send-btn');
  const custName  = document.getElementById('cust-name').value.trim() || 'Anonymous';
  const custNotes = document.getElementById('cust-notes').value.trim();
  const total     = selectedFiles.length;

  btn.textContent = 'Uploading…';
  btn.disabled    = true;
  setProgress(0, `Processing 0 of ${total} files…`);

  let done = 0;
  const fileDataResults = [];

  // Process files one at a time
  let chain = Promise.resolve();
  selectedFiles.forEach((file) => {
    chain = chain.then(() => {
      return fileToBase64(file).then(base64 => {
        fileDataResults.push({
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64
        });
        done++;
        const pct = Math.round((done / total) * 100);
        setProgress(pct, `Processing ${done} of ${total} files… (${pct}%)`);
      });
    });
  });

  chain
    .then(() => {
      setProgress(100, 'Saving order…');
      return db.collection('submissions').add({
        name:  custName,
        notes: custNotes,
        date:  new Date().toISOString(),
        files: fileDataResults
      });
    })
    .then(() => {
      // Reset everything
      selectedFiles = [];
      renderSelected();
      document.getElementById('cust-name').value  = '';
      document.getElementById('cust-notes').value = '';
      btn.textContent = 'Send Files 🚀';
      btn.disabled    = false;
      setProgress(null);

      document.querySelector('.form').style.display = 'none';
      document.getElementById('success-banner').style.display = 'block';
      toast('✅ Files sent successfully!');
    })
    .catch(err => {
      console.error('Submission failed:', err);
      btn.textContent = 'Send Files 🚀';
      btn.disabled    = false;
      setProgress(null);
      toast('❌ Failed: ' + (err.message || 'Check your connection and Firestore rules'));
    });
}

// ══════════════════════════════════════════
//  RESET FORM (Send More Files)
// ══════════════════════════════════════════
function resetForm() {
  document.getElementById('success-banner').style.display = 'none';
  document.querySelector('.form').style.display = 'block';
}
