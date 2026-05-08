// ---- Default data ----
const DEFAULT_PRODUCTS = [
  { n: "2%", c: "Milks" }, { n: "Oat", c: "Milks" }, { n: "Almond", c: "Milks" }, { n: "Coco", c: "Milks" },
  { n: "Skim", c: "Milks" }, { n: "Cream", c: "Milks" }, { n: "Velvet", c: "Milks" }, { n: "Whole", c: "Milks" },
  { n: "Cold brew", c: "Raw Material" }, { n: "Coconut water", c: "Raw Material" }, { n: "Jasmine", c: "Raw Material" },
  { n: "Green coffee", c: "Raw Material" },
  { n: "Mango puree", c: "Purees & Juices" }, { n: "Grapefruit pulp", c: "Purees & Juices" },
  { n: "Pumpkin puree", c: "Purees & Juices" }, { n: "Purple juice", c: "Purees & Juices" },
  { n: "Orange juice", c: "Purees & Juices" },
  { n: "Chia seeds", c: "Raw Material" },
  { n: "Whipping cream premix", c: "Premixes" }, { n: "Tiramisu cold foam", c: "Premixes" },
  { n: "Condensed milk", c: "Premixes" },
  { n: "Chocolate cookie", c: "Pastry" }, { n: "SEC", c: "Pastry" },
  { n: "Almond croissant", c: "Pastry" }, { n: "Chocolate croissant", c: "Pastry" },
  { n: "Chocolate muffin", c: "Pastry" },
  { n: "Matcha", c: "Other" }, { n: "Chocolate", c: "Other" }, { n: "Chocolate chips", c: "Other" },
  { n: "Caramel sauce", c: "Other" }
];

const CATEGORIES = ['Pastry', 'Milks', 'Raw Material', 'Purees & Juices', 'Other', 'Premixes'];

// ---- Firebase ----
firebase.initializeApp(FIREBASE_CONFIG);
const DB = firebase.firestore();
const META_REF = DB.collection('meta').doc('stores');

let data = null;
let dataLoaded = false;
let skipNextSnapshot = false;
let firstSnapshot = true;
let currentStore = localStorage.getItem('currentStore') || '';
let unsubscribeStore = null;

function setConn(status, color) {
  const el = document.getElementById('conn-status');
  if (el) { el.textContent = status; el.style.color = color; }
}

function storeRef() {
  return DB.collection('stores').doc(currentStore || 'default');
}

// ---- Store management ----
let stores = [{ id: 'default', name: 'Store 1' }];

function renderStoreSelector() {
  const sel = document.getElementById('store-select');
  const cur = currentStore || 'default';
  if (!stores.some(s => s.id === cur)) currentStore = stores[0]?.id || 'default';
  sel.innerHTML = stores.map(s => `<option value="${s.id}"${(s.id === currentStore || (!currentStore && s.id === 'default')) ? ' selected' : ''}>${s.name}</option>`).join('');
}

function switchStore(id) {
  if (id === currentStore) return;
  currentStore = id;
  localStorage.setItem('currentStore', id);
  dataLoaded = false;
  data = null;
  setConn('Loading...', 'var(--text-secondary)');
  firstSnapshot = true;
  if (unsubscribeStore) unsubscribeStore();
  attachStoreListener();
}

function attachStoreListener() {
  if (!currentStore) {
    currentStore = stores[0]?.id || 'default';
    localStorage.setItem('currentStore', currentStore);
  }
  unsubscribeStore = storeRef().onSnapshot((doc) => {
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
      storeRef().set(data);
    }
    dataLoaded = true;
    setConn('Live', 'var(--success)');
    const active = document.querySelector('.page.active');
    if (active && active.id !== 'page-log') {
      renderPage(active.id.replace('page-', ''));
    } else if (active) {
      const clear = firstSnapshot;
      firstSnapshot = false;
      renderDailyLog(clear);
    }
  }, () => {
    setConn('Offline', 'var(--danger)');
    data = data || defaultData();
    dataLoaded = true;
    renderPage(document.querySelector('.page.active')?.id?.replace('page-', '') || 'log');
  });
}

function loadStores() {
  META_REF.get().then(doc => {
    if (doc.exists && doc.data().stores) {
      stores = doc.data().stores;
    } else {
      stores = [{ id: 'default', name: 'Store 1' }];
      META_REF.set({ stores });
    }
    renderStoreSelector();
    const saved = localStorage.getItem('currentStore');
    if (saved && stores.some(s => s.id === saved)) currentStore = saved;
    else currentStore = stores[0]?.id || 'default';
    document.getElementById('store-select').value = currentStore;
    attachStoreListener();
  }).catch(() => {
    stores = [{ id: 'default', name: 'Store 1' }];
    renderStoreSelector();
    attachStoreListener();
  });
}

function addStore() {
  const name = prompt('New store name:');
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';
  if (stores.some(s => s.id === id)) { toast('Store already exists'); return; }
  stores.push({ id, name });
  META_REF.set({ stores });
  renderStoreSelector();
  switchStore(id);
  toast(`Added "${name}"`);
}

function deleteStore() {
  if (stores.length <= 1) { toast('Cannot delete the only store'); return; }
  const name = stores.find(s => s.id === currentStore)?.name || currentStore;
  if (!confirm(`Delete "${name}" and all its data?`)) return;
  storeRef().delete().catch(() => {});
  stores = stores.filter(s => s.id !== currentStore);
  META_REF.set({ stores });
  renderStoreSelector();
  switchStore(stores[0].id);
  toast(`Deleted "${name}"`);
}

function saveData() {
  if (!dataLoaded || !data) return;
  skipNextSnapshot = true;
  storeRef().set(data).catch(() => { skipNextSnapshot = false; });
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
  el.textContent = msg;
  el.classList.add('show');
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
  let html = '';
  let idx = 0;
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
let histView = 'day';

document.querySelectorAll('#hist-view-toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#hist-view-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    histView = btn.dataset.view;
    document.getElementById('hist-day-view').style.display = histView === 'day' ? '' : 'none';
    document.getElementById('hist-week-view').style.display = histView === 'week' ? '' : 'none';
    renderHistory();
  });
});

function histSortedDates() {
  return Object.keys(data.dailyLogs).sort();
}

function renderHistory() {
  if (!data) return;
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
  let totalQty = 0;
  for (const pid of Object.keys(log)) totalQty += log[pid];
  document.getElementById('hist-stats').innerHTML = `
    <div class="stat"><div class="stat-label">Date</div><div class="stat-value">${targetDate}</div></div>
    <div class="stat"><div class="stat-label">Items Lost</div><div class="stat-value">${entries}</div></div>
    <div class="stat"><div class="stat-label">Total Qty</div><div class="stat-value">${totalQty}</div></div>
  `;
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
  let html = '';
  let idx = 0;
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
  let hasData = false;
  let html = '';
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
    data-id="${p.id}"
    ondragstart="onDragStart(event)"
    ondragover="onDragOver(event)"
    ondrop="onDrop(event)"
    ondragend="onDragEnd(event)"
    style="cursor:default">
    <td style="color:var(--text-secondary);font-size:11px;cursor:grab;width:30px" class="drag-handle">&#x2630;</td>
    <td><strong>${p.name}</strong></td>
    <td>
      <select onchange="changeCat(${p.id}, this.value)" style="padding:4px 6px;font-size:12px;width:110px">
        ${optionList(categories(), p.category)}
      </select>
    </td>
    <td>
      <select onchange="changeUnit(${p.id}, this.value)" style="padding:4px 6px;font-size:12px;width:70px">
        ${optionList(['g','pcs'], p.unit)}
      </select>
    </td>
    <td><button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Remove</button></td>
  </tr>`).join('');
}

function onDragStart(e) {
  const tr = e.target.closest('tr');
  dragSrcId = tr.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  const name = tr.querySelector('td:nth-child(2)')?.textContent || 'item';
  const c = document.createElement('canvas');
  c.width = 200; c.height = 28;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6366f1'; ctx.beginPath(); ctx.roundRect(0,0,200,28,6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '14px -apple-system, sans-serif';
  ctx.fillText(name, 14, 19);
  e.dataTransfer.setDragImage(c, 14, 14);
  requestAnimationFrame(() => tr.classList.add('dragging'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('#prod-tbody tr').forEach(tr => tr.classList.remove('drag-over-above', 'drag-over-below'));
  const tr = e.target.closest('tr');
  if (!tr || tr.dataset.id === dragSrcId) return;
  const rect = tr.getBoundingClientRect();
  tr.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-above' : 'drag-over-below');
}

function onDrop(e) {
  e.preventDefault();
  const targetTr = e.target.closest('tr');
  if (!targetTr || !dragSrcId) return;
  const targetId = targetTr.dataset.id;
  if (dragSrcId === targetId) return;
  const srcIdx = data.products.findIndex(p => p.id == dragSrcId);
  let tgtIdx = data.products.findIndex(p => p.id == targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;
  const rect = targetTr.getBoundingClientRect();
  const below = e.clientY >= rect.top + rect.height / 2;
  const [moved] = data.products.splice(srcIdx, 1);
  if (srcIdx < tgtIdx) tgtIdx--;
  data.products.splice(below ? tgtIdx + 1 : tgtIdx, 0, moved);
  saveData();
  renderProducts();
}

function onDragEnd(e) {
  e.target.closest('tr').classList.remove('dragging');
  document.querySelectorAll('#prod-tbody tr').forEach(tr => tr.classList.remove('drag-over-above', 'drag-over-below'));
  dragSrcId = null;
}

function changeUnit(id, unit) {
  const p = data.products.find(p => p.id === id);
  if (p) { p.unit = unit; saveData(); }
}

function changeCat(id, category) {
  const p = data.products.find(p => p.id === id);
  if (p) { p.category = category; saveData(); }
}

function renderCatSelect() {
  if (!data) return;
  const sel = document.getElementById('new-prod-cat');
  sel.innerHTML = optionList(categories(), categories()[0] || 'Other');
}

function addProduct() {
  const name = document.getElementById('new-prod-name').value.trim();
  if (!name) { toast('Enter a product name'); return; }
  if (data.products.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('Product already exists'); return; }
  const category = document.getElementById('new-prod-cat').value;
  const unit = document.getElementById('new-prod-unit').value;
  data.products.push({ id: data.nextProductId++, name, category, unit, createdAt: Date.now() });
  saveData();
  document.getElementById('new-prod-name').value = '';
  renderCatSelect();
  renderProducts();
  renderDailyLog();
  toast(`Added "${name}"`);
}

function deleteProduct(id) {
  if (!confirm('Remove this product?')) return;
  data.products = data.products.filter(p => p.id !== id);
  saveData();
  renderCatSelect();
  renderProducts();
  renderDailyLog();
}

// ---- Init ----
document.getElementById('log-date').value = dateStr(new Date());
document.getElementById('log-date').addEventListener('change', function() { renderDailyLog(true); });
renderCatSelect();
setConn('Connecting...', 'var(--text-secondary)');
loadStores();
