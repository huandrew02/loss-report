// ---- Default data ----
const DEFAULT_PRODUCTS = [
  { n: "2%", c: "Milk", u: "g" }, { n: "Oat", c: "Milk", u: "g" }, { n: "Almond", c: "Milk", u: "g" },
  { n: "Barista Coconut", c: "Milk", u: "g" }, { n: "Skim", c: "Milk", u: "g" },
  { n: "Heavy Whipping Cream", c: "Milk", u: "g" }, { n: "Whole", c: "Milk", u: "g" },
  { n: "Velvet", c: "Premix", u: "g" },
  { n: "Cold Brew", c: "Premix", u: "g" }, { n: "Jasmine", c: "Premix", u: "g" },
  { n: "Whipping Cream", c: "Premix", u: "g" }, { n: "Matcha", c: "Premix", u: "g" },
  { n: "Chocolate", c: "Premix", u: "g" },
  { n: "Coconut Water", c: "Raw Material", u: "g" }, { n: "Condensed Milk", c: "Raw Material", u: "g" },
  { n: "Vanilla Smthie", c: "Raw Material", u: "g" }, { n: "Cinnamon Powder", c: "Raw Material", u: "g" },
  { n: "Kyoto Matcha Powder", c: "Raw Material", u: "g" }, { n: "Caramel Sauce", c: "Raw Material", u: "g" },
  { n: "Seltzer Water", c: "Raw Material", u: "g" },
  { n: "Chocolate Cookie", c: "Pastry", u: "pcs" }, { n: "SEC", c: "Pastry", u: "pcs" },
  { n: "Almond Croissant", c: "Pastry", u: "pcs" }, { n: "Chocolate Croissant", c: "Pastry", u: "pcs" },
  { n: "Chocolate Muffin", c: "Pastry", u: "pcs" }, { n: "Grilled Cheese", c: "Pastry", u: "pcs" },
];

const CATEGORIES = ['Pastry', 'Milk', 'Premix', 'Raw Material'];

function defaultData() {
  return {
    products: DEFAULT_PRODUCTS.map((p, i) => ({ id: i + 1, name: p.n, category: p.c, unit: p.u || 'g', createdAt: Date.now() })),
    dailyLogs: {},
    nextProductId: DEFAULT_PRODUCTS.length + 1,
  };
}

// ---- Firebase ----
firebase.initializeApp(FIREBASE_CONFIG);
const DB = firebase.firestore();
const AUTH = firebase.auth();

let data = null;
let dataLoaded = false;
let skipNextSnapshot = false;
let firstSnapshot = true;
let currentStore = '';
let unsubscribeStore = null;
let currentUser = null;

// ---- Auth UI ----
function showLogin() { document.getElementById('signin-form').style.display = ''; document.getElementById('register-form').style.display = 'none'; document.getElementById('login-sub').textContent = 'Sign in to your store'; document.getElementById('login-error').style.display = 'none'; document.getElementById('reg-error').style.display = 'none'; }
function showRegister() { document.getElementById('signin-form').style.display = 'none'; document.getElementById('register-form').style.display = ''; document.getElementById('login-sub').textContent = 'Create your store account'; document.getElementById('login-error').style.display = 'none'; document.getElementById('reg-error').style.display = 'none'; }

function openLogin() { document.getElementById('login-screen').classList.add('open'); showLogin(); }
function closeLogin() { document.getElementById('login-screen').classList.remove('open'); }

const FAKE_DOMAIN = '@lt.app';

function usernameToEmail(username) { return username.trim().toLowerCase().replace(/\s+/g, '-') + FAKE_DOMAIN; }

function login() {
  const username = document.getElementById('login-username').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  if (!username || !pass) { err.textContent = 'Enter username and password'; err.style.display = ''; return; }
  AUTH.signInWithEmailAndPassword(usernameToEmail(username), pass).catch(e => { err.textContent = e.message; err.style.display = ''; });
}

function register() {
  const username = document.getElementById('reg-username').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const err = document.getElementById('reg-error');
  err.style.display = 'none';
  if (!username || !pass) { err.textContent = 'Fill in all fields'; err.style.display = ''; return; }
  if (pass.length < 6) { err.textContent = 'Password must be at least 6 characters'; err.style.display = ''; return; }
  if (!/^[a-zA-Z0-9-]+$/.test(username)) { err.textContent = 'Use only letters, numbers, and hyphens'; err.style.display = ''; return; }

  const storeId = 'store-' + username.toLowerCase();
  const email = usernameToEmail(username);

  DB.collection('usernames').doc(username.toLowerCase()).get().then(snap => {
    if (snap.exists) { err.textContent = 'Username already taken'; err.style.display = ''; return; }

    AUTH.createUserWithEmailAndPassword(email, pass)
      .then(cred => {
        DB.collection('usernames').doc(username.toLowerCase()).set({ uid: cred.user.uid }).catch(() => {});
        DB.collection('userStores').doc(cred.user.uid).set({ storeId, userName: username });
        DB.collection('stores').doc(storeId).set(defaultData());
      })
      .catch(e => { err.textContent = e.message; err.style.display = ''; });
  }).catch(() => {
    AUTH.createUserWithEmailAndPassword(email, pass)
      .then(cred => {
        DB.collection('userStores').doc(cred.user.uid).set({ storeId, userName: username });
        DB.collection('stores').doc(storeId).set(defaultData());
      })
      .catch(e => { err.textContent = e.message; err.style.display = ''; });
  });
}

function logout() {
  AUTH.signOut();
  currentUser = null; currentStore = ''; data = null;
  document.getElementById('app-content').style.display = 'none';
  openLogin();
}

AUTH.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    document.getElementById('user-email').textContent = user.email;
    closeLogin();
    // Load their assigned store
    DB.collection('userStores').doc(user.uid).get().then(doc => {
      if (doc.exists) {
        const s = doc.data();
        if (s.storeId) {
          document.getElementById('user-store').textContent = s.userName ? 'Store ' + s.userName : 'Store';
          loadStore(s.storeId);
          return;
        }
      }
      document.getElementById('user-store').textContent = 'No store assigned';
      document.getElementById('app-content').style.display = '';
    }).catch(() => {
      document.getElementById('user-store').textContent = 'Error loading store';
      document.getElementById('app-content').style.display = '';
      setConn('Error', 'var(--danger)');
    });
  } else {
    document.getElementById('app-content').style.display = 'none';
    // Reset login form fields
    document.getElementById('login-username').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-pass').value = '';
    openLogin();
  }
});

function setConn(status, color) {
  const el = document.getElementById('conn-status');
  if (el) { el.textContent = status; el.style.color = color; }
}

// ---- Store loading ----
function loadStore(storeId) {
  currentStore = storeId;
  if (unsubscribeStore) unsubscribeStore();
  unsubscribeStore = DB.collection('stores').doc(storeId).onSnapshot((doc) => {
    if (skipNextSnapshot) { skipNextSnapshot = false; return; }
    if (doc.exists) {
      data = doc.data();
      if (!data.nextProductId) data.nextProductId = (data.products || []).length + 1;
      if (!data.dailyLogs) data.dailyLogs = {};
      if (data.products) data.products.forEach(p => {
        if (p.category === 'Bakery' || p.category === 'Pastries') p.category = 'Pastry';
      });
    } else {
      data = defaultData();
      doc.ref.set(data);
    }
    dataLoaded = true;
    document.getElementById('app-content').style.display = '';
    setConn('Live', 'var(--success)');
    const active = document.querySelector('.page.active');
    if (active && active.id !== 'page-log') renderPage(active.id.replace('page-', ''));
    else if (active) { const c = firstSnapshot; firstSnapshot = false; renderDailyLog(c); }
  }, () => {
    setConn('Offline', 'var(--danger)');
    data = data || defaultData(); dataLoaded = true;
    document.getElementById('app-content').style.display = '';
    renderPage(document.querySelector('.page.active')?.id?.replace('page-', '') || 'log');
  });
}

function saveData() {
  if (!dataLoaded || !data) return;
  skipNextSnapshot = true;
  DB.collection('stores').doc(currentStore).set(data).catch(() => { skipNextSnapshot = false; });
}

// ---- Navigation ----
document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.page));
});

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelectorAll(`.nav-item[data-page="${page}"]`).forEach(n => n.classList.add('active'));
  if (page === 'log') renderDailyLog(true);
  if (page === 'history') renderHistory();
  if (page === 'products') { renderCatSelect(); renderProducts(); }
}

function renderPage(page) {
  if (page === 'log') renderDailyLog(true);
  else if (page === 'history') renderHistory();
  else if (page === 'products') { renderCatSelect(); renderProducts(); }
}

// ---- Helpers ----
function categories() {
  const used = new Set();
  data.products.forEach(p => { if (p.category) used.add(p.category); });
  const ordered = CATEGORIES.filter(c => used.has(c));
  const extra = [...used].filter(c => !CATEGORIES.includes(c));
  return [...ordered, ...extra];
}

function optionList(vals, cur) {
  return vals.map(v => `<option value="${v}"${cur === v ? ' selected' : ''}>${v}</option>`).join('');
}

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---- Daily Log ----
function renderDailyLog(clearInputs) {
  if (!data) return;
  const date = document.getElementById('log-date').value || dateStr(new Date());
  document.getElementById('log-date').value = date;
  const saved = data.dailyLogs[date] || {};
  const tbody = document.getElementById('log-tbody');
  const groups = {};
  data.products.forEach(p => {
    const cat = p.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  let html = ''; let idx = 0;
  categories().forEach(cat => {
    if (!groups[cat] || groups[cat].length === 0) return;
    html += `<tr style="background:#f8fafc"><td colspan="4" style="padding:6px 10px;font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.04em">${cat}</td></tr>`;
    groups[cat].forEach(p => {
      idx++;
      const qty = clearInputs ? '' : (saved[p.id] || '');
      html += `<tr><td style="color:var(--text-secondary)">${idx}</td><td><strong>${p.name}</strong></td><td><div class="qty-cell"><input type="number" step="0.1" min="0" id="log-qty-${p.id}" value="${qty}" placeholder="0" oninput="onLogQtyChange(${p.id})"></div></td><td>${p.unit}</td></tr>`;
    });
  });
  tbody.innerHTML = html;
  updateLogTotal();
  const hasSaved = !!data.dailyLogs[date] && Object.keys(data.dailyLogs[date]).length > 0;
  document.getElementById('log-save-status').textContent = hasSaved ? 'Saved' : '';
}

function onLogQtyChange(productId) {
  const input = document.getElementById(`log-qty-${productId}`);
  const val = parseFloat(input.value);
  const chk = input.parentElement.querySelector('.qty-saved');
  if (val > 0) {
    input.style.borderColor = 'var(--success)';
    if (!chk) input.parentElement.insertAdjacentHTML('beforeend', '<span class="qty-saved">&#10003;</span>');
  } else {
    input.style.borderColor = '';
    if (chk) chk.remove();
  }
  updateLogTotal();
}

function updateLogTotal() {
  let count = 0;
  for (const p of data.products) {
    const v = parseFloat(document.getElementById(`log-qty-${p.id}`)?.value);
    if (v > 0) count++;
  }
  document.getElementById('log-total-label').textContent = `Items with loss: ${count}`;
}

function saveDailyLog() {
  const date = document.getElementById('log-date').value;
  if (!date) { toast('Please select a date'); return; }
  const log = {};
  for (const p of data.products) {
    const v = parseFloat(document.getElementById(`log-qty-${p.id}`)?.value);
    if (v > 0) log[p.id] = v;
  }
  if (Object.keys(log).length === 0) { toast('No losses to save. Enter at least one quantity.'); return; }
  data.dailyLogs[date] = log;
  saveData();
  renderDailyLog(true);
  toast(`Saved ${Object.keys(log).length} items for ${date}`);
}

// ---- History ----
let histView = 'week';

function histSortedDates() { return Object.keys(data.dailyLogs).sort(); }

function renderHistory() {
  if (!data) return;
  document.getElementById('hist-day-view').style.display = histView === 'day' ? '' : 'none';
  document.getElementById('hist-week-view').style.display = histView === 'week' ? '' : 'none';
  if (histView === 'day') renderDayView();
  else renderWeekView();
}

function renderDayView() {
  const input = document.getElementById('hist-date');
  if (!input.value) {
    const sorted = histSortedDates();
    input.value = sorted.length > 0 ? sorted[sorted.length - 1] : dateStr(new Date());
  }
  const targetDate = input.value;
  const log = data.dailyLogs[targetDate] || {};
  const entries = Object.keys(log).length;
  document.getElementById('hist-stats').innerHTML = `<div class="stat"><div class="stat-label">Date</div><div class="stat-value">${targetDate}</div></div>`;
  const tbody = document.getElementById('hist-tbody');
  const empty = document.getElementById('hist-empty');
  if (entries === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const groups = {};
  data.products.forEach(p => {
    if (!log[p.id]) return;
    const cat = p.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  let html = ''; let idx = 0;
  categories().forEach(cat => {
    if (!groups[cat]) return;
    html += `<tr style="background:#f8fafc"><td colspan="4" style="padding:6px 10px;font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.04em">${cat}</td></tr>`;
    groups[cat].forEach(p => { idx++; html += `<tr><td style="color:var(--text-secondary)">${idx}</td><td><strong>${p.name}</strong></td><td>${log[p.id]}</td><td>${p.unit}</td></tr>`; });
  });
  tbody.innerHTML = html;
}

function histPrev() {
  const sorted = histSortedDates();
  if (sorted.length === 0) return;
  const cur = document.getElementById('hist-date').value || sorted[sorted.length - 1];
  const idx = sorted.indexOf(cur);
  if (idx > 0) { document.getElementById('hist-date').value = sorted[idx - 1]; renderDayView(); }
}

function histNext() {
  const sorted = histSortedDates();
  if (sorted.length === 0) return;
  const cur = document.getElementById('hist-date').value || sorted[sorted.length - 1];
  const idx = sorted.indexOf(cur);
  if (idx < sorted.length - 1) { document.getElementById('hist-date').value = sorted[idx + 1]; renderDayView(); }
}

function deleteHistory() {
  const date = document.getElementById('hist-date').value;
  if (!date || !data.dailyLogs[date]) { toast('No data for this date'); return; }
  if (!confirm(`Delete all loss records for ${date}?`)) return;
  delete data.dailyLogs[date];
  saveData();
  renderDayView();
  toast(`Deleted records for ${date}`);
}

// Week View
let weekOffset = 0;

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function renderWeekView() {
  const today = new Date();
  const base = addDays(today, weekOffset * 7);
  const weekStart = getWeekStart(base);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates = dayLabels.map((_, i) => dateStr(addDays(weekStart, i)));
  document.getElementById('hist-week-label').textContent = `${dates[0]} — ${dates[6]}`;
  const thead = document.getElementById('week-thead');
  thead.innerHTML = `<tr><th>Item</th>${dayLabels.map(d => `<th>${d}</th>`).join('')}<th class="col-total">Total</th><th>Unit</th></tr>`;
  const tbody = document.getElementById('week-tbody');
  const empty = document.getElementById('week-empty');
  const groups = {};
  data.products.forEach(p => {
    const cat = p.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    const vals = dates.map(d => { const log = data.dailyLogs[d]; return log && log[p.id] ? log[p.id] : 0; });
    const total = vals.reduce((s, v) => s + v, 0);
    groups[cat].push({ name: p.name, unit: p.unit, vals, total });
  });
  let hasData = false; let html = '';
  categories().forEach(cat => {
    const rows = groups[cat];
    if (!rows || rows.every(r => r.total === 0)) return;
    hasData = true;
    html += `<tr style="background:#f8fafc"><td colspan="10" style="padding:6px 10px;font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.04em">${cat}</td></tr>`;
    rows.filter(r => r.total > 0).forEach(r => {
      html += `<tr><td>${r.name}</td>${r.vals.map(v => `<td>${v || '-'}</td>`).join('')}<td class="col-total">${r.total}</td><td>${r.unit}</td></tr>`;
    });
  });
  if (!hasData) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = html;
}

function weekPrev() { weekOffset--; renderWeekView(); }
function weekNext() { weekOffset++; renderWeekView(); }

// ---- Products ----
let dragSrcId = null;

function renderProducts() {
  if (!data) return;
  const tbody = document.getElementById('prod-tbody');
  tbody.innerHTML = data.products.map((p, i) => `<tr draggable="true"
    data-id="${p.id}" ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)" style="cursor:default">
    <td style="color:var(--text-secondary);font-size:11px;cursor:grab;width:30px" class="drag-handle">&#x2630;</td>
    <td><strong>${p.name}</strong></td>
    <td><select onchange="changeCat(${p.id}, this.value)" style="padding:4px 6px;font-size:12px;width:110px">${optionList(categories(), p.category)}</select></td>
    <td><select onchange="changeUnit(${p.id}, this.value)" style="padding:4px 6px;font-size:12px;width:70px">${optionList(['g','pcs'], p.unit)}</select></td>
    <td><button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Remove</button></td>
  </tr>`).join('');
}

function onDragStart(e) { const tr=e.target.closest('tr'); dragSrcId=tr.dataset.id; e.dataTransfer.effectAllowed='move'; const name=tr.querySelector('td:nth-child(2)')?.textContent||'item'; const c=document.createElement('canvas'); c.width=200; c.height=28; const ctx=c.getContext('2d'); ctx.fillStyle='#6366f1'; ctx.beginPath(); ctx.roundRect(0,0,200,28,6); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='14px -apple-system, sans-serif'; ctx.fillText(name,14,19); e.dataTransfer.setDragImage(c,14,14); requestAnimationFrame(()=>tr.classList.add('dragging')); }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect='move'; document.querySelectorAll('#prod-tbody tr').forEach(tr=>tr.classList.remove('drag-over-above','drag-over-below')); const tr=e.target.closest('tr'); if(!tr||tr.dataset.id===dragSrcId) return; const rect=tr.getBoundingClientRect(); tr.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-above':'drag-over-below'); }
function onDrop(e) { e.preventDefault(); const targetTr=e.target.closest('tr'); if(!targetTr||!dragSrcId) return; const targetId=targetTr.dataset.id; if(dragSrcId===targetId) return; let srcIdx=data.products.findIndex(p=>p.id==dragSrcId); let tgtIdx=data.products.findIndex(p=>p.id==targetId); if(srcIdx===-1||tgtIdx===-1) return; const rect=targetTr.getBoundingClientRect(); const below=e.clientY>=rect.top+rect.height/2; const [moved]=data.products.splice(srcIdx,1); if(srcIdx<tgtIdx) tgtIdx--; data.products.splice(below?tgtIdx+1:tgtIdx,0, moved); saveData(); renderProducts(); }
function onDragEnd(e) { e.target.closest('tr').classList.remove('dragging'); document.querySelectorAll('#prod-tbody tr').forEach(tr=>tr.classList.remove('drag-over-above','drag-over-below')); dragSrcId=null; }
function changeUnit(id, unit) { const p=data.products.find(p=>p.id===id); if(p){p.unit=unit; saveData();} }
function changeCat(id, cat) { const p=data.products.find(p=>p.id===id); if(p){p.category=cat; saveData();} }

function renderCatSelect() {
  if (!data) return;
  document.getElementById('new-prod-cat').innerHTML = optionList(categories(), categories()[0] || 'Other');
}

function addProduct() {
  const name=document.getElementById('new-prod-name').value.trim(); if(!name){toast('Enter a product name');return;}
  if(data.products.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast('Product already exists');return;}
  data.products.push({id:data.nextProductId++,name,category:document.getElementById('new-prod-cat').value,unit:document.getElementById('new-prod-unit').value,createdAt:Date.now()});
  saveData(); document.getElementById('new-prod-name').value=''; renderCatSelect(); renderProducts(); renderDailyLog(); toast(`Added "${name}"`);
}

function deleteProduct(id) { if(!confirm('Remove this product?')) return; data.products=data.products.filter(p=>p.id!==id); saveData(); renderCatSelect(); renderProducts(); renderDailyLog(); }

// ---- Init ----
document.getElementById('log-date').value = dateStr(new Date());
document.getElementById('log-date').addEventListener('change', function() { renderDailyLog(true); });
renderCatSelect();
setConn('Connecting...', 'var(--text-secondary)');
