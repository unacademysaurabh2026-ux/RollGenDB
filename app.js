// ─── CONFIG — paste your Apps Script Web App URL here ─────────────────────────
var SHEET_URL = 'https://script.google.com/macros/s/AKfycbxnXotBfSTspQpMucCZD6VF3Yfc6q7ECMgAYWBwC_fZON8XShFDE6fyKt_-qRKCPEs/exec';

// ─── Default Streams & Classes ────────────────────────────────────────────────
var DEFAULT_STREAMS = [
  { code: '16', name: 'NEET' },
  { code: '17', name: 'IIT-JEE' }
];
var DEFAULT_CLASSES = [
  { code: '11', name: 'Class 11' },
  { code: '12', name: 'Class 12' },
  { code: '13', name: 'Dropper' }
];

// ─── State ────────────────────────────────────────────────────────────────────
var students      = [];
var bin           = [];
var recycledRolls = [];
var streams       = [];
var classes       = [];
var counter       = 1;
var pendingDeleteId = null;
var isSaving      = false;

// ─── API helpers ──────────────────────────────────────────────────────────────
function apiCall(action, payload) {
  var body = Object.assign({ action: action }, payload || {});
  return fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); });
}

// ─── Loading overlay ──────────────────────────────────────────────────────────
function setLoading(on, msg) {
  var el = document.getElementById('loading-overlay');
  if (on) {
    document.getElementById('loading-msg').textContent = msg || 'Saving…';
    el.classList.add('open');
  } else {
    el.classList.remove('open');
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadData() {
  setLoading(true, 'Loading data from Google Sheet…');
  return apiCall('load').then(function(data) {
    students      = data.students      || [];
    bin           = data.bin           || [];
    recycledRolls = data.recycledRolls || [];
    streams       = data.streams && data.streams.length ? data.streams : JSON.parse(JSON.stringify(DEFAULT_STREAMS));
    classes       = data.classes && data.classes.length ? data.classes : JSON.parse(JSON.stringify(DEFAULT_CLASSES));
    counter       = data.counter || 1;
    setLoading(false);
    populateSelects();
    renderLegend();
    updateStats();
    renderStudents();
    renderBin();
    updatePreview();
  }).catch(function(e) {
    setLoading(false);
    streams  = JSON.parse(JSON.stringify(DEFAULT_STREAMS));
    classes  = JSON.parse(JSON.stringify(DEFAULT_CLASSES));
    toast('Failed to load from sheet — check your URL', 'err');
    console.error(e);
  });
}

function saveData() {
  isSaving = true;
  return apiCall('save', {
    students:      students,
    bin:           bin,
    recycledRolls: recycledRolls,
    streams:       streams,
    classes:       classes,
    counter:       counter
  }).then(function(res) {
    isSaving = false;
    if (!res.ok) { toast('Sheet save failed: ' + (res.error || 'unknown'), 'err'); }
  }).catch(function(e) {
    isSaving = false;
    toast('Network error — data may not be saved', 'err');
    console.error(e);
  });
}

// ─── Roll Number ──────────────────────────────────────────────────────────────
function genRoll(streamCode, classCode, seq) {
  var yr  = new Date().getFullYear().toString().slice(-2);
  var num = String(seq).padStart(3, '0');
  return streamCode + yr + classCode + num;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────
function streamName(code) {
  var s = streams.find(function(x) { return x.code === code; });
  return s ? s.name : code;
}
function className(code) {
  var c = classes.find(function(x) { return x.code === code; });
  return c ? c.name : code;
}

var BADGE_COLORS = [
  { bg: 'rgba(52,211,153,0.10)',  fg: '#34d399', br: 'rgba(52,211,153,0.25)'  },
  { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', br: 'rgba(96,165,250,0.25)'  },
  { bg: 'rgba(251,191,36,0.10)',  fg: '#fbbf24', br: 'rgba(251,191,36,0.25)'  },
  { bg: 'rgba(167,139,250,0.12)', fg: '#a78bfa', br: 'rgba(167,139,250,0.28)' },
  { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', br: 'rgba(248,113,113,0.25)' },
  { bg: 'rgba(251,146,60,0.10)',  fg: '#fb923c', br: 'rgba(251,146,60,0.25)'  }
];
function badgeStyle(code) {
  var idx = streams.findIndex(function(x) { return x.code === code; });
  var c   = BADGE_COLORS[Math.abs(idx) % BADGE_COLORS.length];
  return 'background:' + c.bg + ';color:' + c.fg + ';border:1px solid ' + c.br;
}

// ─── Populate Selects ─────────────────────────────────────────────────────────
function populateSelects() {
  var fs = document.getElementById('f-stream');
  var fc = document.getElementById('f-class');
  var ff = document.getElementById('filter-stream');
  var prevStream = fs.value, prevClass = fc.value, prevFilter = ff.value;

  fs.innerHTML = '<option value="">Select stream</option>';
  streams.forEach(function(s) { fs.innerHTML += '<option value="' + esc(s.code) + '">' + esc(s.name) + '</option>'; });

  fc.innerHTML = '<option value="">Select class</option>';
  classes.forEach(function(c) { fc.innerHTML += '<option value="' + esc(c.code) + '">' + esc(c.name) + '</option>'; });

  ff.innerHTML = '<option value="">All Streams</option>';
  streams.forEach(function(s) { ff.innerHTML += '<option value="' + esc(s.code) + '">' + esc(s.name) + '</option>'; });

  fs.value = prevStream; fc.value = prevClass; ff.value = prevFilter;
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function renderLegend() {
  var rows = document.getElementById('legend-rows');
  var streamLines = streams.map(function(s) { return s.code + '=' + s.name; }).join(', ');
  var classLines  = classes.map(function(c) { return c.code + '=' + c.name; }).join(', ');
  rows.innerHTML =
    '<div class="legend-row"><span class="seg seg-stream">SS</span><span>' + streamLines + '</span></div>' +
    '<div class="legend-row"><span class="seg seg-year">YY</span><span>Enrollment year (auto)</span></div>' +
    '<div class="legend-row"><span class="seg seg-class">BB</span><span>' + classLines + '</span></div>' +
    '<div class="legend-row"><span class="seg seg-serial">NNN</span><span>Global sequential serial</span></div>';
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
function updatePreview() {
  var streamCode = document.getElementById('f-stream').value;
  var classCode  = document.getElementById('f-class').value;
  var numEl      = document.getElementById('roll-preview');
  var bdEl       = document.getElementById('roll-breakdown');

  if (streamCode && classCode) {
    var roll = genRoll(streamCode, classCode, counter);
    numEl.textContent = roll;
    numEl.classList.add('ready');
    var yr  = new Date().getFullYear().toString().slice(-2);
    var seq = String(counter).padStart(3, '0');
    bdEl.innerHTML =
      '<span class="seg seg-stream">' + esc(streamCode) + '</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-year">'   + yr              + '</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-class">'  + esc(classCode)  + '</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-serial">' + seq             + '</span>';
  } else {
    numEl.textContent = '— — — — — — — — —';
    numEl.classList.remove('ready');
    bdEl.innerHTML =
      '<span class="seg seg-stream">SS</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-year">YY</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-class">BB</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-serial">NNN</span>';
  }
}

// ─── Add Student ──────────────────────────────────────────────────────────────
function addStudent() {
  var name       = document.getElementById('f-name').value.trim();
  var mobile     = document.getElementById('f-mobile').value.trim();
  var parent     = document.getElementById('f-parent').value.trim();
  var classCode  = document.getElementById('f-class').value;
  var streamCode = document.getElementById('f-stream').value;

  if (!name)                              { showMsg('Enter student name', false); return; }
  if (!/^\d{10}$/.test(mobile))           { showMsg('Enter valid 10-digit mobile', false); return; }
  if (!classCode)                         { showMsg('Select a class', false); return; }
  if (!streamCode)                        { showMsg('Select a stream', false); return; }
  if (parent && !/^\d{10}$/.test(parent)) { showMsg('Parent mobile must be 10 digits or blank', false); return; }

  var roll = genRoll(streamCode, classCode, counter);
  if (students.find(function(s) { return s.roll === roll; })) { showMsg('Roll collision — please retry', false); return; }

  var student = {
    id: Date.now(), roll: roll, seq: counter,
    name: name, mobile: mobile, parent: parent,
    classCode: classCode, streamCode: streamCode
  };
  students.push(student);
  counter++;

  document.getElementById('f-name').value   = '';
  document.getElementById('f-mobile').value = '';
  document.getElementById('f-parent').value = '';
  document.getElementById('f-class').value  = '';
  document.getElementById('f-stream').value = '';
  updatePreview();
  updateStats();
  renderStudents(student.id);
  showMsg('Saved — Roll: ' + roll, true);
  toast('Student added · ' + roll, 'ok');

  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); });
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────
function confirmDelete(id) {
  var s = students.find(function(x) { return x.id === id; });
  if (!s) return;
  pendingDeleteId = id;
  document.getElementById('confirm-body').textContent = 'Move "' + s.name + '" (' + s.roll + ') to Recycle Bin?';
  openOverlay('confirm-overlay');
}

function doDelete() {
  var idx = students.findIndex(function(s) { return s.id === pendingDeleteId; });
  if (idx === -1) { closeOverlay('confirm-overlay'); return; }
  var s = students.splice(idx, 1)[0];
  s.deletedAt = new Date().toLocaleString('en-IN', { hour12: true });
  bin.push(s);
  updateStats(); renderStudents(); renderBin();
  closeOverlay('confirm-overlay');
  toast('Moved to Recycle Bin · ' + s.roll, 'err');
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); });
}

// ─── Restore from Bin ─────────────────────────────────────────────────────────
function restoreStudent(id) {
  var idx = bin.findIndex(function(s) { return s.id === id; });
  if (idx === -1) return;
  var s = bin.splice(idx, 1)[0];
  delete s.deletedAt;
  students.push(s);
  updateStats(); renderStudents(); renderBin();
  toast('Restored · ' + s.roll, 'ok');
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); });
}

// ─── Delete All Data (two-step confirm) ───────────────────────────────────────
var deleteAllStep = 0;
function startDeleteAll() {
  deleteAllStep = 1;
  document.getElementById('delete-all-title').textContent = 'Delete All Student Data?';
  document.getElementById('delete-all-body').textContent =
    'This will move all ' + students.length + ' student(s) and ' + bin.length + ' item(s) to the Recycle Bin.';
  document.getElementById('delete-all-ok').textContent = 'Yes, Delete All';
  openOverlay('delete-all-overlay');
}
function deleteAllConfirm() {
  if (deleteAllStep === 1) {
    deleteAllStep = 2;
    document.getElementById('delete-all-title').textContent = '⚠️ Are you absolutely sure?';
    document.getElementById('delete-all-body').textContent = 'Final warning: all student records will be moved to Recycle Bin.';
    document.getElementById('delete-all-ok').textContent = 'Move Everything to Bin';
  } else if (deleteAllStep === 2) {
    var now = new Date().toLocaleString('en-IN', { hour12: true });
    students.forEach(function(s) { s.deletedAt = now; bin.push(s); });
    var moved = students.length;
    students = [];
    updateStats(); renderStudents(); renderBin();
    closeOverlay('delete-all-overlay');
    deleteAllStep = 0;
    toast('Moved ' + moved + ' student(s) to Recycle Bin', 'err');
    setLoading(true, 'Saving to Google Sheet…');
    saveData().then(function() { setLoading(false); });
  }
}

// ─── Empty Bin ────────────────────────────────────────────────────────────────
function emptyBin() {
  if (!bin.length) { toast('Recycle Bin is already empty', 'err'); return; }
  if (!confirm('Permanently delete all ' + bin.length + ' student(s) in the bin? This cannot be undone.')) return;
  var now = new Date().toLocaleString('en-IN', { hour12: true });
  bin.forEach(function(s) {
    recycledRolls.push({ roll: s.roll, seq: s.seq, streamCode: s.streamCode, classCode: s.classCode, prevName: s.name, freedAt: now });
  });
  bin = [];
  updateStats(); renderBin();
  toast('Recycle Bin cleared', 'ok');
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); });
}

function deleteBinStudent(id) {
  var idx = bin.findIndex(function(s) { return s.id === id; });
  if (idx === -1) return;
  var s = bin[idx];
  if (!confirm('Permanently delete "' + s.name + '" (' + s.roll + ')? This cannot be undone.')) return;
  bin.splice(idx, 1);
  recycledRolls.push({
    roll: s.roll, seq: s.seq, streamCode: s.streamCode, classCode: s.classCode,
    prevName: s.name, freedAt: new Date().toLocaleString('en-IN', { hour12: true })
  });
  updateStats(); renderBin();
  toast('Permanently deleted · ' + s.roll, 'err');
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); });
}

// ─── Recycled Roll Numbers Pool ───────────────────────────────────────────────
var assignStep = 0;
var assignRoll = null;

function openRecycledRolls() { renderRecycledRollsList(); openOverlay('recycled-rolls-overlay'); }

function renderRecycledRollsList() {
  var el = document.getElementById('recycled-rolls-list');
  if (!recycledRolls.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;font-size:13px;color:var(--text-3)">No recycled roll numbers yet.<br>They appear here when students are permanently deleted.</div>';
    return;
  }
  el.innerHTML = recycledRolls.map(function(r, i) {
    return '<div class="recycled-row">' +
      '<div><span class="roll-cell" style="font-size:13px">' + esc(r.roll) + '</span>' +
      '<span style="font-size:11px;color:var(--text-3);margin-left:10px">was: ' + esc(r.prevName) + '</span></div>' +
      '<div style="font-size:10px;color:var(--text-3)">' + esc(r.freedAt) + '</div>' +
      '<button class="btn btn-accent btn-sm" onclick="startAssignRoll(' + i + ')">Assign to Student</button>' +
    '</div>';
  }).join('');
}

function startAssignRoll(idx) {
  assignRoll = recycledRolls[idx]; assignStep = 1;
  closeOverlay('recycled-rolls-overlay');
  document.getElementById('assign-roll-num').textContent  = assignRoll.roll;
  document.getElementById('assign-prev-name').textContent = assignRoll.prevName;
  document.getElementById('assign-f-name').value   = '';
  document.getElementById('assign-f-mobile').value = '';
  document.getElementById('assign-f-parent').value = '';
  document.getElementById('assign-step-indicator').textContent = 'Step 1 of 3: Enter student details';
  document.getElementById('assign-confirm-area').style.display = 'none';
  document.getElementById('assign-input-area').style.display   = 'block';
  document.getElementById('assign-final-area').style.display   = 'none';
  document.getElementById('assign-next-btn').textContent = 'Next →';
  openOverlay('assign-roll-overlay');
}

function assignRollNext() {
  if (assignStep === 1) {
    var name   = document.getElementById('assign-f-name').value.trim();
    var mobile = document.getElementById('assign-f-mobile').value.trim();
    var parent = document.getElementById('assign-f-parent').value.trim();
    if (!name)                              { alert('Enter student name'); return; }
    if (!/^\d{10}$/.test(mobile))           { alert('Enter valid 10-digit mobile'); return; }
    if (parent && !/^\d{10}$/.test(parent)) { alert('Parent mobile must be 10 digits or blank'); return; }
    assignStep = 2;
    document.getElementById('assign-step-indicator').textContent = 'Step 2 of 3: Confirm details';
    document.getElementById('assign-input-area').style.display   = 'none';
    document.getElementById('assign-confirm-area').style.display = 'block';
    document.getElementById('assign-final-area').style.display   = 'none';
    document.getElementById('assign-confirm-roll').textContent   = assignRoll.roll;
    document.getElementById('assign-confirm-name').textContent   = name;
    document.getElementById('assign-confirm-mobile').textContent = mobile;
    document.getElementById('assign-confirm-parent').textContent = parent || '—';
    document.getElementById('assign-next-btn').textContent = 'Looks Good →';
  } else if (assignStep === 2) {
    assignStep = 3;
    document.getElementById('assign-step-indicator').textContent = 'Step 3 of 3: Final confirmation';
    document.getElementById('assign-confirm-area').style.display = 'none';
    document.getElementById('assign-input-area').style.display   = 'none';
    document.getElementById('assign-final-area').style.display   = 'block';
    document.getElementById('assign-final-roll').textContent     = assignRoll.roll;
    document.getElementById('assign-final-name').textContent     = document.getElementById('assign-confirm-name').textContent;
    document.getElementById('assign-next-btn').textContent       = '✓ Assign Roll Number';
  } else if (assignStep === 3) {
    var name2   = document.getElementById('assign-confirm-name').textContent;
    var mobile2 = document.getElementById('assign-confirm-mobile').textContent;
    var parent2 = document.getElementById('assign-confirm-parent').textContent;
    if (parent2 === '—') parent2 = '';
    var student = {
      id: Date.now(), roll: assignRoll.roll, seq: assignRoll.seq,
      name: name2, mobile: mobile2, parent: parent2,
      classCode: assignRoll.classCode, streamCode: assignRoll.streamCode
    };
    students.push(student);
    var ri = recycledRolls.findIndex(function(r) { return r.roll === assignRoll.roll; });
    if (ri !== -1) recycledRolls.splice(ri, 1);
    updateStats(); renderStudents(student.id);
    closeOverlay('assign-roll-overlay');
    assignStep = 0; assignRoll = null;
    toast('Assigned roll ' + student.roll + ' to ' + student.name, 'ok');
    setLoading(true, 'Saving to Google Sheet…');
    saveData().then(function() { setLoading(false); });
  }
}

function cancelAssignRoll() { assignStep = 0; assignRoll = null; closeOverlay('assign-roll-overlay'); }

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  animateNum('s-total', students.length);
  animateNum('s-bin',   bin.length);
  var last = students.length ? students[students.length - 1].roll : '—';
  document.getElementById('s-last').textContent = last;

  var area = document.getElementById('stream-stats-area');
  var html = '';
  streams.forEach(function(st) {
    var count = students.filter(function(s) { return s.streamCode === st.code; }).length;
    var c = BADGE_COLORS[streams.indexOf(st) % BADGE_COLORS.length];
    html += '<div class="stat-unit"><span class="stat-num" style="color:' + c.fg + '" id="s-stream-' + st.code + '">' + count + '</span>' +
            '<span class="stat-label">' + esc(st.name) + '</span></div>';
  });
  area.innerHTML = html;

  var badge = document.getElementById('bin-badge');
  if (bin.length > 0) { badge.textContent = bin.length; badge.style.display = 'inline'; }
  else { badge.style.display = 'none'; }
}

function animateNum(id, target) {
  var el = document.getElementById(id);
  if (!el) return;
  var from = parseInt(el.textContent, 10) || 0;
  if (from === target) { el.textContent = target; return; }
  var step = target > from ? 1 : -1;
  var steps = Math.min(Math.abs(target - from), 15);
  var delay = Math.max(1, Math.round(120 / steps));
  var cur = from;
  var timer = setInterval(function() {
    cur += step; el.textContent = cur;
    if (cur === target) clearInterval(timer);
  }, delay);
}

// ─── Render Students ──────────────────────────────────────────────────────────
function renderStudents(highlightId) {
  var q       = (document.getElementById('search').value || '').toLowerCase().trim();
  var fStream = document.getElementById('filter-stream').value;
  var filtered = students.filter(function(s) {
    var mq = !q || s.name.toLowerCase().includes(q) || s.roll.includes(q) || s.mobile.includes(q);
    return mq && (!fStream || s.streamCode === fStream);
  });
  var tbody = document.getElementById('tbody');
  var empty = document.getElementById('empty-state');
  var footer = document.getElementById('table-footer');
  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; footer.textContent = ''; return; }
  empty.style.display = 'none';
  footer.textContent = filtered.length + ' student' + (filtered.length !== 1 ? 's' : '') + (q || fStream ? ' · filtered' : '');
  tbody.innerHTML = filtered.map(function(s) {
    return '<tr class="' + (s.id === highlightId ? 'row-new' : '') + '">' +
      '<td><span class="roll-cell">' + esc(s.roll) + '</span></td>' +
      '<td style="font-weight:500">' + esc(s.name) + '</td>' +
      '<td><span class="stream-badge" style="' + badgeStyle(s.streamCode) + '">' + esc(streamName(s.streamCode)) + '</span></td>' +
      '<td>' + esc(className(s.classCode)) + '</td>' +
      '<td class="mobile-cell">' + esc(s.mobile) + '</td>' +
      '<td class="mobile-cell">' + (s.parent ? esc(s.parent) : '—') + '</td>' +
      '<td><button class="btn btn-danger-icon" onclick="confirmDelete(' + s.id + ')" title="Delete">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
        '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>' +
        '<path d="M10 11v6M14 11v6"/></svg></button></td></tr>';
  }).join('');
}

// ─── Render Bin ───────────────────────────────────────────────────────────────
function renderBin() {
  var tbody = document.getElementById('bin-tbody');
  var empty = document.getElementById('bin-empty-state');
  var footer = document.getElementById('bin-footer');
  if (!bin.length) { tbody.innerHTML = ''; empty.style.display = 'block'; footer.textContent = ''; return; }
  empty.style.display = 'none';
  footer.textContent = bin.length + ' item' + (bin.length !== 1 ? 's' : '') + ' in bin';
  tbody.innerHTML = bin.map(function(s) {
    return '<tr>' +
      '<td><span class="roll-cell">' + esc(s.roll) + '</span></td>' +
      '<td style="font-weight:500">' + esc(s.name) + '</td>' +
      '<td><span class="stream-badge" style="' + badgeStyle(s.streamCode) + '">' + esc(streamName(s.streamCode)) + '</span></td>' +
      '<td>' + esc(className(s.classCode)) + '</td>' +
      '<td class="mobile-cell">' + esc(s.mobile) + '</td>' +
      '<td class="deleted-at">' + esc(s.deletedAt || '—') + '</td>' +
      '<td style="display:flex;gap:6px;align-items:center">' +
        '<button class="btn btn-green" onclick="restoreStudent(' + s.id + ')">↩ Restore</button>' +
        '<button class="btn btn-danger-icon" onclick="deleteBinStudent(' + s.id + ')" title="Permanently Delete">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
          '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>' +
          '<path d="M10 11v6M14 11v6"/></svg></button></td></tr>';
  }).join('');
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderStreamList() {
  var el = document.getElementById('stream-list');
  if (!streams.length) { el.innerHTML = '<span style="font-size:12px;color:var(--text-3)">No streams added</span>'; return; }
  el.innerHTML = streams.map(function(s, i) {
    var c = BADGE_COLORS[i % BADGE_COLORS.length];
    return '<span class="tag" style="color:' + c.fg + ';border-color:' + c.br + ';background:' + c.bg + '">' +
      s.code + ' · ' + esc(s.name) + '<span class="tag-remove" onclick="removeStream(\'' + esc(s.code) + '\')" title="Remove">×</span></span>';
  }).join('');
}
function renderClassList() {
  var el = document.getElementById('class-list');
  if (!classes.length) { el.innerHTML = '<span style="font-size:12px;color:var(--text-3)">No classes added</span>'; return; }
  el.innerHTML = classes.map(function(c) {
    return '<span class="tag">' + esc(c.code) + ' · ' + esc(c.name) +
      '<span class="tag-remove" onclick="removeClass(\'' + esc(c.code) + '\')" title="Remove">×</span></span>';
  }).join('');
}
function addStream() {
  var code = document.getElementById('new-stream-code').value.trim().replace(/\D/g, '');
  var name = document.getElementById('new-stream-name').value.trim();
  if (!code || code.length > 2) { toast('Code must be 1-2 digits', 'err'); return; }
  if (!name) { toast('Enter stream name', 'err'); return; }
  if (streams.find(function(s) { return s.code === code; })) { toast('Code already exists', 'err'); return; }
  streams.push({ code: code, name: name });
  document.getElementById('new-stream-code').value = '';
  document.getElementById('new-stream-name').value = '';
  refreshAfterSettings();
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); toast('Stream added: ' + name, 'ok'); });
}
function removeStream(code) {
  if (students.some(function(s) { return s.streamCode === code; })) { toast('Cannot remove — students exist in this stream', 'err'); return; }
  streams = streams.filter(function(s) { return s.code !== code; });
  refreshAfterSettings();
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); toast('Stream removed', 'ok'); });
}
function addClass() {
  var code = document.getElementById('new-class-code').value.trim().replace(/\D/g, '');
  var name = document.getElementById('new-class-name').value.trim();
  if (!code || code.length > 2) { toast('Code must be 1-2 digits', 'err'); return; }
  if (!name) { toast('Enter class name', 'err'); return; }
  if (classes.find(function(c) { return c.code === code; })) { toast('Code already exists', 'err'); return; }
  classes.push({ code: code, name: name });
  document.getElementById('new-class-code').value = '';
  document.getElementById('new-class-name').value = '';
  refreshAfterSettings();
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); toast('Class added: ' + name, 'ok'); });
}
function removeClass(code) {
  if (students.some(function(s) { return s.classCode === code; })) { toast('Cannot remove — students exist in this class', 'err'); return; }
  classes = classes.filter(function(c) { return c.code !== code; });
  refreshAfterSettings();
  setLoading(true, 'Saving to Google Sheet…');
  saveData().then(function() { setLoading(false); toast('Class removed', 'ok'); });
}
function refreshAfterSettings() { renderStreamList(); renderClassList(); populateSelects(); renderLegend(); updateStats(); }

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCSV() {
  if (!students.length) { toast('No students to export', 'err'); return; }
  var rows = [['Roll Number','Name','Stream','Class','Mobile','Parent Mobile']];
  students.forEach(function(s) { rows.push([s.roll, s.name, streamName(s.streamCode), className(s.classCode), s.mobile, s.parent || '']); });
  downloadCSV(rows, 'students_' + new Date().getFullYear() + '.csv');
  toast('Exported ' + students.length + ' students', 'ok');
}
function downloadBulkTemplate() {
  var streamOpts = streams.map(function(s) { return s.name; }).join(' / ');
  var classOpts  = classes.map(function(c) { return c.name; }).join(' / ');
  var rows = [
    ['Name','Mobile','Parent Mobile','Class','Stream'],
    ['# Fill rows below. Class options: ' + classOpts + ' | Stream options: ' + streamOpts],
    ['Rahul Sharma','9876543210','9876543211', classes[0]?classes[0].name:'Class 11', streams[0]?streams[0].name:'NEET'],
    ['Priya Patel', '9123456780','',           classes[1]?classes[1].name:'Class 12', streams[1]?streams[1].name:'IIT-JEE']
  ];
  downloadCSV(rows, 'bulk_template.csv');
  toast('Template downloaded — fill and import', 'ok');
}
function importCSV(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var lines = e.target.result.split(/\r?\n/).filter(Boolean);
    var added = 0, skipped = 0, errors = 0;
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVLine(lines[i]);
      if (!cols[0] || cols[0].startsWith('#')) continue;
      var name = cols[0].trim(), mobile = cols[1].trim(), parent = (cols[2]||'').trim();
      var className_ = (cols[3]||'').trim(), streamName_ = (cols[4]||'').trim();
      var classObj  = classes.find(function(c) { return c.name.toLowerCase() === className_.toLowerCase(); });
      var streamObj = streams.find(function(s) { return s.name.toLowerCase() === streamName_.toLowerCase(); });
      if (!name || !mobile || !classObj || !streamObj) { errors++; continue; }
      if (!/^\d{10}$/.test(mobile)) { errors++; continue; }
      if (students.find(function(s) { return s.mobile === mobile; })) { skipped++; continue; }
      var roll = genRoll(streamObj.code, classObj.code, counter);
      students.push({ id: Date.now() + i, roll: roll, seq: counter, name: name, mobile: mobile, parent: parent, classCode: classObj.code, streamCode: streamObj.code });
      counter++; added++;
    }
    updateStats(); renderStudents();
    var msg = 'Imported ' + added + ' student' + (added !== 1 ? 's' : '');
    if (skipped) msg += ' · ' + skipped + ' skipped';
    if (errors)  msg += ' · ' + errors  + ' invalid';
    toast(msg, 'ok');
    setLoading(true, 'Saving to Google Sheet…');
    saveData().then(function() { setLoading(false); });
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  var csv = rows.map(function(r) { return r.map(function(c) { return '"' + String(c||'').replace(/"/g,'""') + '"'; }).join(','); }).join('\r\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function parseCSVLine(line) {
  var cols = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
  }
  cols.push(cur.trim()); return cols;
}

// ─── Overlay helpers ──────────────────────────────────────────────────────────
function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

// ─── Toast ────────────────────────────────────────────────────────────────────
var toastTimer = null;
function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type === 'ok' ? ' toast-ok' : type === 'err' ? ' toast-err' : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.className = 'toast'; }, 3200);
}

// ─── Form message ─────────────────────────────────────────────────────────────
var msgTimer = null;
function showMsg(text, ok) {
  var el = document.getElementById('form-msg');
  el.innerHTML = '<span class="' + (ok ? 'msg-ok' : 'msg-err') + '">' + esc(text) + '</span>';
  if (msgTimer) clearTimeout(msgTimer);
  if (ok) msgTimer = setTimeout(function() { el.innerHTML = ''; }, 3000);
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('.tab[data-tab="' + name + '"]').classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  streams = JSON.parse(JSON.stringify(DEFAULT_STREAMS));
  classes = JSON.parse(JSON.stringify(DEFAULT_CLASSES));
  populateSelects(); renderLegend(); updateStats(); renderStudents(); renderBin(); updatePreview();

  loadData();

  document.getElementById('f-stream').addEventListener('change', updatePreview);
  document.getElementById('f-class').addEventListener('change',  updatePreview);
  document.getElementById('btn-add').addEventListener('click',   addStudent);

  var fields = ['f-name','f-mobile','f-parent'];
  fields.forEach(function(id, i) {
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { var next = fields[i+1] ? document.getElementById(fields[i+1]) : document.getElementById('f-class'); if (next) next.focus(); }
    });
  });

  document.getElementById('search').addEventListener('input',        function() { renderStudents(); });
  document.getElementById('filter-stream').addEventListener('change', function() { renderStudents(); });

  document.getElementById('btn-export').addEventListener('click',        exportCSV);
  document.getElementById('btn-bulk-download').addEventListener('click', downloadBulkTemplate);
  document.getElementById('btn-import-trigger').addEventListener('click', function() { document.getElementById('file-import').click(); });
  document.getElementById('file-import').addEventListener('change',       importCSV);

  document.getElementById('btn-delete-all').addEventListener('click',   startDeleteAll);
  document.getElementById('delete-all-ok').addEventListener('click',    deleteAllConfirm);
  document.getElementById('delete-all-cancel').addEventListener('click', function() { deleteAllStep = 0; closeOverlay('delete-all-overlay'); });
  document.getElementById('delete-all-overlay').addEventListener('click', function(e) { if (e.target === this) { deleteAllStep = 0; closeOverlay('delete-all-overlay'); } });

  document.getElementById('btn-empty-bin').addEventListener('click', emptyBin);

  document.querySelectorAll('.tab').forEach(function(tab) { tab.addEventListener('click', function() { switchTab(tab.dataset.tab); }); });

  document.getElementById('confirm-ok').addEventListener('click',     doDelete);
  document.getElementById('confirm-cancel').addEventListener('click', function() { closeOverlay('confirm-overlay'); });
  document.getElementById('confirm-overlay').addEventListener('click', function(e) { if (e.target === this) closeOverlay('confirm-overlay'); });

  document.getElementById('btn-settings').addEventListener('click', function() { renderStreamList(); renderClassList(); openOverlay('settings-overlay'); });
  document.getElementById('settings-close').addEventListener('click', function() { closeOverlay('settings-overlay'); });
  document.getElementById('settings-overlay').addEventListener('click', function(e) { if (e.target === this) closeOverlay('settings-overlay'); });
  document.getElementById('btn-add-stream').addEventListener('click', addStream);
  document.getElementById('btn-add-class').addEventListener('click',  addClass);

  document.getElementById('btn-recycled-rolls').addEventListener('click',    openRecycledRolls);
  document.getElementById('recycled-rolls-close').addEventListener('click',  function() { closeOverlay('recycled-rolls-overlay'); });
  document.getElementById('recycled-rolls-overlay').addEventListener('click', function(e) { if (e.target === this) closeOverlay('recycled-rolls-overlay'); });

  document.getElementById('assign-next-btn').addEventListener('click',   assignRollNext);
  document.getElementById('assign-cancel-btn').addEventListener('click',  cancelAssignRoll);
  document.getElementById('assign-roll-overlay').addEventListener('click', function(e) { if (e.target === this) cancelAssignRoll(); });

  document.getElementById('new-stream-name').addEventListener('keydown', function(e) { if (e.key === 'Enter') addStream(); });
  document.getElementById('new-class-name').addEventListener('keydown',  function(e) { if (e.key === 'Enter') addClass(); });
});
