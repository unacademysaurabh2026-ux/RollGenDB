// ─── Default Streams & Classes ────────────────────────────────────────────────
var DEFAULT_STREAMS = [
  { code: '16', name: 'NEET',    rollDigits: 9  },
  { code: '17', name: 'IIT-JEE', rollDigits: 10 }
];
var DEFAULT_CLASSES = [
  { code: '11', name: 'Class 11' },
  { code: '12', name: 'Class 12' },
  { code: '13', name: 'Dropper' }
];

// ─── State ────────────────────────────────────────────────────────────────────
var students  = [];
var bin       = [];       // recycle bin
var streams   = [];
var classes   = [];
var counter   = 1;
var pendingDeleteId = null;   // for confirm dialog

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadData() {
  try {
    var s  = localStorage.getItem('rnm3_students');
    var b  = localStorage.getItem('rnm3_bin');
    var st = localStorage.getItem('rnm3_streams');
    var cl = localStorage.getItem('rnm3_classes');
    var c  = localStorage.getItem('rnm3_counter');
    students = s  ? JSON.parse(s)  : [];
    bin      = b  ? JSON.parse(b)  : [];
    streams  = st ? JSON.parse(st) : JSON.parse(JSON.stringify(DEFAULT_STREAMS));
    classes  = cl ? JSON.parse(cl) : JSON.parse(JSON.stringify(DEFAULT_CLASSES));
    counter  = c  ? parseInt(c, 10) : 1;
  } catch (e) {
    streams = JSON.parse(JSON.stringify(DEFAULT_STREAMS));
    classes = JSON.parse(JSON.stringify(DEFAULT_CLASSES));
  }
}

function saveData() {
  try {
    localStorage.setItem('rnm3_students', JSON.stringify(students));
    localStorage.setItem('rnm3_bin',      JSON.stringify(bin));
    localStorage.setItem('rnm3_streams',  JSON.stringify(streams));
    localStorage.setItem('rnm3_classes',  JSON.stringify(classes));
    localStorage.setItem('rnm3_counter',  String(counter));
  } catch (e) { console.warn('Save failed', e); }
}

// ─── Roll Number ──────────────────────────────────────────────────────────────
// Format: SS + YY + BB + N...  (digits controlled per stream)
function serialPad(streamCode) {
  var s = streams.find(function(x) { return x.code === streamCode; });
  var totalDigits = s ? (s.rollDigits || 10) : 10;
  var yr = new Date().getFullYear().toString().slice(-2);
  var fixed = streamCode.length + yr.length; // SS+YY always fixed
  // BB length depends on classCode passed separately; we pad serial to fill the rest
  // We store serialLen on stream so genRoll can use it directly
  return totalDigits; // return total desired digits
}
function getSerialLen(streamCode, classCode) {
  var s = streams.find(function(x) { return x.code === streamCode; });
  var totalDigits = s ? (s.rollDigits || 10) : 10;
  var yr = new Date().getFullYear().toString().slice(-2);
  var serialLen = totalDigits - streamCode.length - yr.length - classCode.length;
  return Math.max(1, serialLen);
}
function genRoll(streamCode, classCode, seq) {
  var yr  = new Date().getFullYear().toString().slice(-2);
  var serialLen = getSerialLen(streamCode, classCode);
  var num = String(seq).padStart(serialLen, '0');
  return streamCode + yr + classCode + num;
}
function maxStudents(streamCode, classCode) {
  var serialLen = getSerialLen(streamCode, classCode || '11');
  return Math.pow(10, serialLen) - 1;
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

// badge color cycles through a palette by index
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
  // form selects
  var fs = document.getElementById('f-stream');
  var fc = document.getElementById('f-class');
  var ff = document.getElementById('filter-stream');

  var prevStream = fs.value;
  var prevClass  = fc.value;
  var prevFilter = ff.value;

  fs.innerHTML = '<option value="">Select stream</option>';
  streams.forEach(function(s) {
    fs.innerHTML += '<option value="' + esc(s.code) + '">' + esc(s.name) + '</option>';
  });

  fc.innerHTML = '<option value="">Select class</option>';
  classes.forEach(function(c) {
    fc.innerHTML += '<option value="' + esc(c.code) + '">' + esc(c.name) + '</option>';
  });

  ff.innerHTML = '<option value="">All Streams</option>';
  streams.forEach(function(s) {
    ff.innerHTML += '<option value="' + esc(s.code) + '">' + esc(s.name) + '</option>';
  });

  fs.value = prevStream;
  fc.value = prevClass;
  ff.value = prevFilter;
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
    '<div class="legend-row"><span class="seg seg-serial">NNNN</span><span>Global sequential serial</span></div>';
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
    var yr      = new Date().getFullYear().toString().slice(-2);
    var sLen    = getSerialLen(streamCode, classCode);
    var seq     = String(counter).padStart(sLen, '0');
    var maxS    = maxStudents(streamCode, classCode);
    var s       = streams.find(function(x){ return x.code === streamCode; });
    var totalD  = s ? (s.rollDigits || 10) : 10;
    bdEl.innerHTML =
      '<span class="seg seg-stream">' + esc(streamCode) + '</span>' +
      '<span class="seg-dot">+</span>' +
      '<span class="seg seg-year">'   + yr              + '</span>' +
      '<span class="seg-dot">+</span>' +
      '<span class="seg seg-class">'  + esc(classCode)  + '</span>' +
      '<span class="seg-dot">+</span>' +
      '<span class="seg seg-serial">' + seq             + '</span>' +
      '<span class="roll-meta">' + totalD + '-digit roll · max <b>' + maxS.toLocaleString() + '</b> students</span>';
  } else {
    numEl.textContent = '— — — — — — — — — —';
    numEl.classList.remove('ready');
    bdEl.innerHTML =
      '<span class="seg seg-stream">SS</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-year">YY</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-class">BB</span><span class="seg-dot">+</span>' +
      '<span class="seg seg-serial">NNNN</span>';
  }
}

// ─── Add Student ──────────────────────────────────────────────────────────────
function addStudent() {
  var name       = document.getElementById('f-name').value.trim();
  var mobile     = document.getElementById('f-mobile').value.trim();
  var parent     = document.getElementById('f-parent').value.trim();
  var classCode  = document.getElementById('f-class').value;
  var streamCode = document.getElementById('f-stream').value;

  if (!name)                            { showMsg('Enter student name', false); return; }
  if (!/^\d{10}$/.test(mobile))         { showMsg('Enter valid 10-digit mobile', false); return; }
  if (!classCode)                       { showMsg('Select a class', false); return; }
  if (!streamCode)                      { showMsg('Select a stream', false); return; }
  if (parent && !/^\d{10}$/.test(parent)) { showMsg('Parent mobile must be 10 digits or blank', false); return; }

  var roll = genRoll(streamCode, classCode, counter);
  if (students.find(function(s) { return s.roll === roll; })) {
    showMsg('Roll collision — please retry', false); return;
  }

  var student = {
    id: Date.now(), roll: roll, seq: counter,
    name: name, mobile: mobile, parent: parent,
    classCode: classCode, streamCode: streamCode
  };
  students.push(student);
  counter++;
  saveData();

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
}

// ─── Delete (soft) — ask confirm first ───────────────────────────────────────
function confirmDelete(id) {
  var s = students.find(function(x) { return x.id === id; });
  if (!s) return;
  pendingDeleteId = id;
  document.getElementById('confirm-body').textContent =
    'Move "' + s.name + '" (' + s.roll + ') to Recycle Bin?';
  openOverlay('confirm-overlay');
}

function doDelete() {
  var id  = pendingDeleteId;
  var idx = students.findIndex(function(s) { return s.id === id; });
  if (idx === -1) { closeOverlay('confirm-overlay'); return; }
  var s = students.splice(idx, 1)[0];
  s.deletedAt = new Date().toLocaleString('en-IN', { hour12: true });
  bin.push(s);
  saveData();
  updateStats();
  renderStudents();
  renderBin();
  closeOverlay('confirm-overlay');
  toast('Moved to Recycle Bin · ' + s.roll, 'err');
}

// ─── Restore from Bin ─────────────────────────────────────────────────────────
function restoreStudent(id) {
  var idx = bin.findIndex(function(s) { return s.id === id; });
  if (idx === -1) return;
  var s = bin.splice(idx, 1)[0];
  delete s.deletedAt;
  students.push(s);
  saveData();
  updateStats();
  renderStudents();
  renderBin();
  toast('Restored · ' + s.roll, 'ok');
}

// ─── Empty Bin ────────────────────────────────────────────────────────────────
function emptyBin() {
  if (!bin.length) { toast('Recycle Bin is already empty', 'err'); return; }
  if (!confirm('Permanently delete all ' + bin.length + ' student(s) in the bin? This cannot be undone.')) return;
  bin = [];
  saveData();
  updateStats();
  renderBin();
  toast('Recycle Bin cleared', 'ok');
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  animateNum('s-total', students.length);
  animateNum('s-bin',   bin.length);

  var last = students.length ? students[students.length - 1].roll : '—';
  document.getElementById('s-last').textContent = last;

  // per-stream counts
  var area = document.getElementById('stream-stats-area');
  var html = '';
  streams.forEach(function(st) {
    var count = students.filter(function(s) { return s.streamCode === st.code; }).length;
    var c = BADGE_COLORS[streams.indexOf(st) % BADGE_COLORS.length];
    html += '<div class="stat-unit">' +
      '<span class="stat-num" style="color:' + c.fg + '" id="s-stream-' + st.code + '">' + count + '</span>' +
      '<span class="stat-label">' + esc(st.name) + '</span></div>';
  });
  area.innerHTML = html;

  // bin badge on tab
  var badge = document.getElementById('bin-badge');
  if (bin.length > 0) {
    badge.textContent = bin.length;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

function animateNum(id, target) {
  var el   = document.getElementById(id);
  if (!el) return;
  var from = parseInt(el.textContent, 10) || 0;
  if (from === target) { el.textContent = target; return; }
  var step  = target > from ? 1 : -1;
  var steps = Math.min(Math.abs(target - from), 15);
  var delay = Math.max(1, Math.round(120 / steps));
  var cur   = from;
  var timer = setInterval(function() {
    cur += step;
    el.textContent = cur;
    if (cur === target) clearInterval(timer);
  }, delay);
}

// ─── Render Students Table ────────────────────────────────────────────────────
function renderStudents(highlightId) {
  var q       = (document.getElementById('search').value || '').toLowerCase().trim();
  var fStream = document.getElementById('filter-stream').value;

  var filtered = students.filter(function(s) {
    var mq = !q || s.name.toLowerCase().includes(q) ||
                   s.roll.includes(q) || s.mobile.includes(q);
    return mq && (!fStream || s.streamCode === fStream);
  });

  var tbody  = document.getElementById('tbody');
  var empty  = document.getElementById('empty-state');
  var footer = document.getElementById('table-footer');

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    footer.textContent  = '';
    return;
  }
  empty.style.display = 'none';
  footer.textContent  = filtered.length + ' student' + (filtered.length !== 1 ? 's' : '') +
                        (q || fStream ? ' · filtered' : '');

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
        '<path d="M10 11v6M14 11v6"/></svg></button></td>' +
      '</tr>';
  }).join('');
}

// ─── Render Bin Table ─────────────────────────────────────────────────────────
function renderBin() {
  var tbody  = document.getElementById('bin-tbody');
  var empty  = document.getElementById('bin-empty-state');
  var footer = document.getElementById('bin-footer');

  if (!bin.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    footer.textContent  = '';
    return;
  }
  empty.style.display = 'none';
  footer.textContent  = bin.length + ' item' + (bin.length !== 1 ? 's' : '') + ' in bin';

  tbody.innerHTML = bin.map(function(s) {
    return '<tr>' +
      '<td><span class="roll-cell">' + esc(s.roll) + '</span></td>' +
      '<td style="font-weight:500">' + esc(s.name) + '</td>' +
      '<td><span class="stream-badge" style="' + badgeStyle(s.streamCode) + '">' + esc(streamName(s.streamCode)) + '</span></td>' +
      '<td>' + esc(className(s.classCode)) + '</td>' +
      '<td class="mobile-cell">' + esc(s.mobile) + '</td>' +
      '<td class="deleted-at">' + esc(s.deletedAt || '—') + '</td>' +
      '<td><button class="btn btn-green" onclick="restoreStudent(' + s.id + ')">↩ Restore</button></td>' +
      '</tr>';
  }).join('');
}

// ─── Settings: Stream & Class management ──────────────────────────────────────
function renderStreamList() {
  var el = document.getElementById('stream-list');
  if (!streams.length) { el.innerHTML = '<span style="font-size:12px;color:var(--text-3)">No streams added</span>'; return; }
  el.innerHTML = streams.map(function(s, i) {
    var c = BADGE_COLORS[i % BADGE_COLORS.length];
    var d = s.rollDigits || 10;
    return '<span class="tag" style="color:' + c.fg + ';border-color:' + c.br + ';background:' + c.bg + '">' +
      s.code + ' · ' + esc(s.name) + ' · <span style="opacity:.7">' + d + '-digit</span>' +
      '<span class="tag-remove" onclick="removeStream(\'' + esc(s.code) + '\')" title="Remove">×</span></span>';
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
  var code   = document.getElementById('new-stream-code').value.trim().replace(/\D/g, '');
  var name   = document.getElementById('new-stream-name').value.trim();
  var digits = parseInt(document.getElementById('new-stream-digits').value.trim(), 10);
  if (!code || code.length > 2)      { toast('Code must be 1-2 digits', 'err'); return; }
  if (!name)                          { toast('Enter stream name', 'err'); return; }
  if (!digits || digits < 7 || digits > 12) { toast('Roll digits must be 7–12', 'err'); return; }
  if (streams.find(function(s) { return s.code === code; })) { toast('Code already exists', 'err'); return; }
  streams.push({ code: code, name: name, rollDigits: digits });
  document.getElementById('new-stream-code').value   = '';
  document.getElementById('new-stream-name').value   = '';
  document.getElementById('new-stream-digits').value = '';
  document.getElementById('stream-digits-hint').textContent = '';
  saveData(); refreshAfterSettings();
  toast('Stream added: ' + name + ' (' + digits + '-digit roll)', 'ok');
}

function removeStream(code) {
  var used = students.some(function(s) { return s.streamCode === code; });
  if (used) { toast('Cannot remove — students exist in this stream', 'err'); return; }
  streams = streams.filter(function(s) { return s.code !== code; });
  saveData(); refreshAfterSettings();
  toast('Stream removed', 'ok');
}

function addClass() {
  var code = document.getElementById('new-class-code').value.trim().replace(/\D/g, '');
  var name = document.getElementById('new-class-name').value.trim();
  if (!code || code.length > 2) { toast('Code must be 1-2 digits', 'err'); return; }
  if (!name)                     { toast('Enter class name', 'err'); return; }
  if (classes.find(function(c) { return c.code === code; })) { toast('Code already exists', 'err'); return; }
  classes.push({ code: code, name: name });
  document.getElementById('new-class-code').value = '';
  document.getElementById('new-class-name').value = '';
  saveData(); refreshAfterSettings();
  toast('Class added: ' + name, 'ok');
}

function removeClass(code) {
  var used = students.some(function(s) { return s.classCode === code; });
  if (used) { toast('Cannot remove — students exist in this class', 'err'); return; }
  classes = classes.filter(function(c) { return c.code !== code; });
  saveData(); refreshAfterSettings();
  toast('Class removed', 'ok');
}

function refreshAfterSettings() {
  renderStreamList();
  renderClassList();
  populateSelects();
  renderLegend();
  updateStats();
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCSV() {
  if (!students.length) { toast('No students to export', 'err'); return; }
  var rows = [['Roll Number','Name','Stream','Class','Mobile','Parent Mobile']];
  students.forEach(function(s) {
    rows.push([s.roll, s.name, streamName(s.streamCode), className(s.classCode), s.mobile, s.parent || '']);
  });
  downloadCSV(rows, 'students_' + new Date().getFullYear() + '.csv');
  toast('Exported ' + students.length + ' students', 'ok');
}

// ─── Bulk Template (Excel-compatible CSV) ─────────────────────────────────────
function downloadBulkTemplate() {
  var streamOpts = streams.map(function(s) { return s.name; }).join(' / ');
  var classOpts  = classes.map(function(c) { return c.name; }).join(' / ');
  var rows = [
    ['Name', 'Mobile', 'Parent Mobile', 'Class', 'Stream'],
    ['# Fill rows below. Class options: ' + classOpts + ' | Stream options: ' + streamOpts],
    ['Rahul Sharma',  '9876543210', '9876543211', classes[0] ? classes[0].name : 'Class 11', streams[0] ? streams[0].name : 'NEET'],
    ['Priya Patel',   '9123456780', '',           classes[1] ? classes[1].name : 'Class 12', streams[1] ? streams[1].name : 'IIT-JEE']
  ];
  downloadCSV(rows, 'bulk_template.csv');
  toast('Template downloaded — fill and import', 'ok');
}

// ─── Import CSV ───────────────────────────────────────────────────────────────
function importCSV(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var lines   = ev.target.result.split(/\r?\n/);
    var added   = 0, skipped = 0, errors = 0;
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      var cols = parseCSVLine(line);
      if (cols.length < 4) { errors++; continue; }

      var name       = cols[0];
      var mobile     = cols[1];
      var parent     = cols[2] || '';
      var clsName    = cols[3];
      var streamName2= cols[4] || '';

      // support both name-based import (from template) and code-based (from export)
      var streamObj = streams.find(function(s) { return s.name === streamName2 || s.code === streamName2; });
      var classObj  = classes.find(function(c) { return c.name === clsName    || c.code === clsName;    });

      // also handle export format: Roll Number, Name, Stream, Class, Mobile, Parent
      if (!name && cols[0].match(/^\d{10}$/)) {
        // looks like export format — roll is col 0
        var roll2 = cols[0]; name = cols[1];
        streamObj = streams.find(function(s) { return s.name === cols[2] || s.code === cols[2]; });
        classObj  = classes.find(function(c) { return c.name === cols[3] || c.code === cols[3]; });
        mobile = cols[4]; parent = cols[5] || '';
        if (students.find(function(s) { return s.roll === roll2; })) { skipped++; continue; }
      }

      if (!name || !/^\d{10}$/.test(mobile) || !streamObj || !classObj) { errors++; continue; }

      var roll = genRoll(streamObj.code, classObj.code, counter);
      if (students.find(function(s) { return s.roll === roll; })) { skipped++; return; }

      students.push({ id: Date.now() + i, roll: roll, seq: counter,
        name: name, mobile: mobile, parent: parent,
        classCode: classObj.code, streamCode: streamObj.code });
      counter++; added++;
    }
    saveData(); updateStats(); renderStudents();
    var msg = 'Imported ' + added + ' student' + (added !== 1 ? 's' : '');
    if (skipped) msg += ' · ' + skipped + ' skipped';
    if (errors)  msg += ' · ' + errors  + ' invalid';
    toast(msg, 'ok');
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  var csv = rows.map(function(r) {
    return r.map(function(c) { return '"' + String(c || '').replace(/"/g, '""') + '"'; }).join(',');
  }).join('\r\n');
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
  cols.push(cur.trim());
  return cols;
}

// ─── Overlay helpers ──────────────────────────────────────────────────────────
function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

// ─── Toast ────────────────────────────────────────────────────────────────────
var toastTimer = null;
function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show' + (type === 'ok' ? ' toast-ok' : type === 'err' ? ' toast-err' : '');
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
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  loadData();
  populateSelects();
  renderLegend();
  updateStats();
  renderStudents();
  renderBin();
  updatePreview();

  // Form inputs
  document.getElementById('f-stream').addEventListener('change', updatePreview);
  document.getElementById('f-class').addEventListener('change', updatePreview);
  document.getElementById('btn-add').addEventListener('click', addStudent);

  // Enter key navigation
  var fields = ['f-name','f-mobile','f-parent'];
  fields.forEach(function(id, i) {
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var next = fields[i + 1] ? document.getElementById(fields[i + 1]) : document.getElementById('f-class');
        if (next) next.focus();
      }
    });
  });

  // Search & filter
  document.getElementById('search').addEventListener('input', function() { renderStudents(); });
  document.getElementById('filter-stream').addEventListener('change', function() { renderStudents(); });

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-bulk-download').addEventListener('click', downloadBulkTemplate);
  document.getElementById('btn-import-trigger').addEventListener('click', function() {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import').addEventListener('change', importCSV);

  // Recycle bin
  document.getElementById('btn-empty-bin').addEventListener('click', emptyBin);

  // Tabs
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
  });

  // Confirm dialog
  document.getElementById('confirm-ok').addEventListener('click', doDelete);
  document.getElementById('confirm-cancel').addEventListener('click', function() { closeOverlay('confirm-overlay'); });
  document.getElementById('confirm-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeOverlay('confirm-overlay');
  });

  // Settings modal
  document.getElementById('btn-settings').addEventListener('click', function() {
    renderStreamList(); renderClassList(); openOverlay('settings-overlay');
  });
  document.getElementById('settings-close').addEventListener('click', function() { closeOverlay('settings-overlay'); });
  document.getElementById('settings-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeOverlay('settings-overlay');
  });
  document.getElementById('btn-add-stream').addEventListener('click', addStream);
  document.getElementById('btn-add-class').addEventListener('click', addClass);

  // Live hint for roll digits
  document.getElementById('new-stream-digits').addEventListener('input', function() {
    var digits     = parseInt(this.value, 10);
    var hintEl     = document.getElementById('stream-digits-hint');
    var sampleCode = document.getElementById('new-stream-code').value.trim() || 'SS';
    var yr         = new Date().getFullYear().toString().slice(-2);
    var sampleCls  = '11';
    if (!digits || digits < 7 || digits > 12) { hintEl.textContent = ''; return; }
    var serialLen = digits - sampleCode.length - yr.length - sampleCls.length;
    if (serialLen < 1) { hintEl.textContent = 'Code too long for this digit count'; hintEl.style.color = 'var(--red)'; return; }
    var maxS = Math.pow(10, serialLen) - 1;
    hintEl.style.color = 'var(--green)';
    hintEl.textContent = digits + '-digit roll · max ' + maxS.toLocaleString('en-IN') + ' students per class';
  });

  // Enter key in settings inputs
  document.getElementById('new-stream-name').addEventListener('keydown', function(e) { if (e.key === 'Enter') addStream(); });
  document.getElementById('new-class-name').addEventListener('keydown', function(e)  { if (e.key === 'Enter') addClass(); });
});
