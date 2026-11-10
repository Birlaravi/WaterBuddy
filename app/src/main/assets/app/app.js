/* Cutie - her companion app. Plain JS, no build step. Runs inside an Android WebView. */
(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); };
var PETS = ['bunny', 'kitten', 'puppy', 'unicorn', 'fox', 'piglet', 'panda', 'penguin', 'duckling', 'teddy'];
var PET_NAMES = { bunny: 'Bunny', kitten: 'Kitten', puppy: 'Puppy', unicorn: 'Unicorn', fox: 'Fox', piglet: 'Piglet', panda: 'Panda', penguin: 'Penguin', duckling: 'Duckling', teddy: 'Teddy' };
var MOODS = [['🥰', 'Loved'], ['😊', 'Happy'], ['😌', 'Calm'], ['😴', 'Tired'], ['😔', 'Sad'], ['😤', 'Stressed']];
var SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Tired', 'Moody', 'Cravings', 'Back pain', 'Acne', 'Nausea', 'Sore'];
var CATS = ['Top', 'Bottom', 'Dress', 'Shoes', 'Bag', 'Accessory'];
var THEMES = { rose: '#e86a8a', lavender: '#7c5ce0', mint: '#2fb67c', peach: '#e8825a', night: '#2a1c2e' };
var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- native bridge (safe wrappers, work in a normal browser too) ---------- */
var HAS_NATIVE = typeof window.Native !== 'undefined';
function nat(fn, def, a, b) {
  try {
    var f = window.Native[fn], n = arguments.length - 2, v = n === 0 ? window.Native[fn]() : n === 1 ? window.Native[fn](a) : window.Native[fn](a, b);
    return v === undefined ? def : v;
  } catch (e) { return def; }
}
var N = {
  water: function () { try { return JSON.parse(nat('getWater', '{}')); } catch (e) { return {}; } },
  addGlass: function (d) { nat('addGlass', 0, d || 1); },
  setWater: function (o) { nat('setWater', 0, JSON.stringify(o)); },
  perms: function () { try { return JSON.parse(nat('getPerms', '{}')); } catch (e) { return {}; } },
  setup: function () { nat('startSetup', 0); },
  petNow: function () { nat('showPetNow', 0); },
  reminders: function (list) { nat('setReminders', 0, JSON.stringify(list)); },
  share: function (name, text) { return nat('shareText', false, name, text); }
};

/* ---------- dates ---------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function diff(a, b) { return Math.round((b - a) / 864e5); }
function nice(d) { return d.getDate() + ' ' + MON[d.getMonth()].slice(0, 3); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function uid() { return Math.random().toString(36).slice(2, 9); }

/* ---------- state ---------- */
var KEY = 'cutie.v1';
function defaults() {
  return {
    settings: { name: 'Cutie', theme: 'rose', pet: 'bunny', pin: '', cycle: true, wardrobe: true, wishlist: true, dates: true, notes: true,
      rem: { skinAM: '08:00', skinPM: '21:30', diary: '21:00', note: '08:30', onAM: true, onPM: true, onDiary: true, onNote: true, onDates: true, onCycle: true } },
    mood: {}, journal: {}, hlog: {}, slog: {},
    habits: [{ id: 'h1', name: 'Vitamins', e: '💊' }, { id: 'h2', name: 'Walk / stretch', e: '🚶‍♀️' }, { id: 'h3', name: 'Sleep 8 hours', e: '😴' }, { id: 'h4', name: 'Read 10 minutes', e: '📖' }],
    skin: { am: ['Cleanser', 'Moisturizer', 'Sunscreen'], pm: ['Remove makeup', 'Cleanser', 'Serum', 'Moisturizer'] },
    cycle: { starts: [], periodLen: 5, cycleLen: 28, sym: {} },
    dates: [{ id: 'd1', name: 'My Birthday', e: '🎂', m: 10, d: 25, y: 2002 }, { id: 'd2', name: 'The day we met', e: '💞', m: 4, d: 11, y: null }, { id: 'd3', name: 'Our engagement', e: '💍', m: 4, d: 13, y: null }],
    wardrobe: [], outfits: {}, wishlist: [], noteOpened: {}, myNotes: []
  };
}
var S;
function load() {
  var d = defaults(), raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (raw) {
    for (var k in raw) { if (k === 'settings') { for (var j in raw.settings) { if (j === 'rem') { for (var r in raw.settings.rem) d.settings.rem[r] = raw.settings.rem[r]; } else d.settings[j] = raw.settings[j]; } } else d[k] = raw[k]; }
    for (var c in defaults().cycle) if (d.cycle[c] === undefined) d.cycle[c] = defaults().cycle[c];
  }
  S = d;
}
var saveT = 0;
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage is full - try removing some photos'); } clearTimeout(saveT); saveT = setTimeout(syncReminders, 800); }

/* ---------- images (IndexedDB) ---------- */
var _db;
function idb() {
  return new Promise(function (res, rej) {
    if (_db) return res(_db);
    var r = indexedDB.open('cutie-img', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('i'); };
    r.onsuccess = function () { _db = r.result; res(_db); };
    r.onerror = function () { rej(r.error); };
  });
}
function idbPut(k, v) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction('i', 'readwrite'); t.objectStore('i').put(v, k); t.oncomplete = res; t.onerror = rej; }); }); }
function idbGet(k) { return idb().then(function (db) { return new Promise(function (res) { var q = db.transaction('i').objectStore('i').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); }); }
function idbDel(k) { return idb().then(function (db) { db.transaction('i', 'readwrite').objectStore('i').delete(k); }); }
function idbAll() { return idb().then(function (db) { return new Promise(function (res) { var o = {}, q = db.transaction('i').objectStore('i').openCursor(); q.onsuccess = function () { var c = q.result; if (c) { o[c.key] = c.value; c.continue(); } else res(o); }; q.onerror = function () { res(o); }; }); }); }
function shrink(file, max) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onerror = rej;
    fr.onload = function () {
      var im = new Image();
      im.onerror = rej;
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
var imgCache = {};
function hydrateImages(root) {
  (root || document).querySelectorAll('[data-img]').forEach(function (el) {
    var k = el.getAttribute('data-img');
    if (imgCache[k]) { el.style.backgroundImage = 'url(' + imgCache[k] + ')'; el.textContent = ''; return; }
    idbGet(k).then(function (v) { if (v) { imgCache[k] = v; el.style.backgroundImage = 'url(' + v + ')'; var e = el.querySelector('.ph'); if (e) e.remove(); } });
  });
}

/* ---------- love notes ---------- */
var NOTES = { from: 'Your person', daily: ['You are loved.'], openWhen: [] };
function loadNotes() {
  return fetch('data/love_notes.json').then(function (r) { return r.json(); }).then(function (j) { NOTES = j; }).catch(function () {});
}
function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
function todayNote() {
  var all = NOTES.daily.concat(S.myNotes || []);
  return all[dayOfYear(today()) % all.length];
}

/* ---------- derived ---------- */
function petOfToday() { return S.settings.pet === 'random' ? PETS[dayOfYear(today()) % PETS.length] : S.settings.pet; }
function waterInfo() { var w = N.water(); return { yes: +w.yes || 0, no: +w.no || 0, goal: +w.goal || 8, interval: +w.interval || 60, enabled: !!w.enabled }; }
function greeting() { var h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'; }
function nextOcc(m, d) { var t = today(), x = new Date(t.getFullYear(), m - 1, d); if (x < t) x = new Date(t.getFullYear() + 1, m - 1, d); return x; }
function upcoming() {
  return S.dates.map(function (x) { var o = nextOcc(x.m, x.d); var yrs = x.y ? o.getFullYear() - x.y : null; return { it: x, at: o, days: diff(today(), o), yrs: yrs }; }).sort(function (a, b) { return a.days - b.days; });
}
function streak(id) {
  var n = 0, d = today();
  if (!(S.hlog[ymd(d)] || {})[id]) d = addDays(d, -1);
  while ((S.hlog[ymd(d)] || {})[id]) { n++; d = addDays(d, -1); }
  return n;
}
function cycleInfo() {
  var c = S.cycle, st = c.starts.slice().sort();
  if (!st.length) return null;
  var len = c.cycleLen;
  if (st.length >= 2) {
    var ds = [], k;
    for (k = Math.max(1, st.length - 6); k < st.length; k++) ds.push(diff(parse(st[k - 1]), parse(st[k])));
    ds = ds.filter(function (x) { return x >= 18 && x <= 50; });
    if (ds.length) len = Math.round(ds.reduce(function (a, b) { return a + b; }, 0) / ds.length);
  }
  var last = parse(st[st.length - 1]), t = today(), day = diff(last, t) + 1;
  var next = addDays(last, len);
  while (next < t) next = addDays(next, len);
  var ov = len - 14, daysTo = diff(t, next), phase, tip;
  var dc = ((day - 1) % len) + 1;
  if (day >= 1 && day <= c.periodLen) { phase = 'Period'; tip = 'Rest, warm drinks and a hot water bottle. Be extra gentle with yourself.'; }
  else if (dc >= ov - 5 && dc <= ov + 1) { phase = dc === ov ? 'Ovulation day (likely)' : 'Fertile window'; tip = 'Energy is usually high now.'; }
  else if (daysTo <= 5) { phase = 'PMS zone'; tip = 'Mood swings and cravings are normal. Hug yourself, I mean it.'; }
  else if (dc < ov - 5) { phase = 'Fresh phase'; tip = 'Good time for new plans and workouts.'; }
  else { phase = 'Winding down'; tip = 'Slow down a little and drink extra water.'; }
  return { len: len, last: last, day: day > 0 && day <= 99 ? day : null, next: next, daysTo: daysTo, ov: ov, phase: phase, tip: tip };
}

/* ---------- ui helpers ---------- */
var toastT;
function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2200); }
function openSheet(html, mount) {
  var s = $('#sheet'); s.innerHTML = '<div class="in">' + html + '</div>'; s.classList.remove('hidden');
  s.onclick = function (e) { if (e.target === s) closeSheet(); };
  if (mount) mount(s);
}
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheet').innerHTML = ''; }
function ico(p) { return '<svg viewBox="0 0 24 24">' + p + '</svg>'; }
var TABS = [
  ['home', 'Home', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ['care', 'Care', '<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z"/>'],
  ['diary', 'Diary', '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'],
  ['cycle', 'Cycle', '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'],
  ['more', 'More', '<path d="M12 20s-7-4.5-9-9.2C1.8 7.6 3.700 4.500 7 4.500c2 0 3.300 1 5 3 1.700-2 3-3 5-3 3.300 0 5.200 3.100 4 6.300C19 15.500 12 20 12 20z"/>']
];
var tab = 'home', sub = null, calMonth = null;
function renderTabs() {
  var tabs = TABS.filter(function (t) { return t[0] !== 'cycle' || S.settings.cycle; });
  $('#tabs').innerHTML = tabs.map(function (t) { return '<button data-a="tab" data-v="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + ico(t[2]) + t[1] + '</button>'; }).join('');
}
function applyTheme() {
  document.body.className = 't-' + S.settings.theme;
  var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = S.settings.theme === 'night' ? '#1d1420' : '#fff1f4';
}
function render(keepScroll) {
  var v = $('#view'), y = v.scrollTop;
  var pages = { home: pHome, care: pCare, diary: pDiary, cycle: pCycle, more: pMore };
  if (tab === 'cycle' && !S.settings.cycle) tab = 'home';
  v.innerHTML = sub ? pSub(sub) : pages[tab]();
  renderTabs(); applyTheme(); hydrateImages(v);
  v.scrollTop = keepScroll ? y : 0;
}
function go(t) { tab = t; sub = null; render(); }
function open(s) { sub = s; render(); }
function head(title, subtitle, back) {
  return '<div class="page-top">' + (back ? '<button class="back" data-a="back">‹</button>' : '') + '<div><h1>' + title + '</h1>' + (subtitle ? '<div class="sub">' + subtitle + '</div>' : '') + '</div></div>';
}

/* ---------- HOME ---------- */
function pHome() {
  var w = waterInfo(), pct = Math.min(1, w.yes / w.goal), pet = petOfToday(), h = new Date().getHours();
  var face = pct >= 1 ? 'happy' : (h >= 15 && pct < 0.4 ? 'sad' : 'idle');
  var msg = pct >= 1 ? 'Goal reached! So proud of you!' : face === 'sad' ? 'I am thirsty... ' + (w.goal - w.yes) + ' more to go' : (w.goal - w.yes) + ' more glasses to go';
  var mo = S.mood[ymd(today())], ci = S.settings.cycle ? cycleInfo() : null, up = S.settings.dates ? upcoming()[0] : null;
  var tasks = todayTasks();
  var o = head(greeting() + ', ' + esc(S.settings.name) + ' 🌸', new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
  o += '<div class="grid">';
  o += '<div class="card hero span2"><img id="mascot" src="m/' + pet + '_' + face + '.png" data-a="poke" alt=""><div class="grow"><div class="lbl">Water</div><div class="big">' + w.yes + '<small style="font-size:18px">/' + w.goal + '</small></div><div class="sub" style="margin-top:2px">' + esc(msg) + '</div><div class="row" style="margin-top:8px"><button class="btn sm" data-a="glass">+ Glass</button><button class="btn ghost sm" data-a="unglass">−</button></div></div></div>';
  if (S.settings.notes) o += '<button class="card span2" data-a="notes" style="text-align:left"><div class="lbl">💌 Today from ' + esc(NOTES.from) + '</div><div class="note">“' + esc(todayNote()) + '”</div></button>';
  o += '<div class="card span2"><div class="lbl">How are you feeling?</div><div class="moods">' + MOODS.map(function (m) { return '<button data-a="mood" data-v="' + m[0] + '" class="' + (mo === m[0] ? 'on' : '') + '">' + m[0] + '</button>'; }).join('') + '</div></div>';
  if (up) o += '<button class="card" data-a="dates" style="text-align:left"><div class="lbl">' + up.it.e + ' ' + esc(up.it.name) + '</div><div class="cd" style="margin-top:6px">' + (up.days === 0 ? 'Today!' : up.days) + '</div><div class="sub">' + (up.days === 0 ? 'Happy day, Cutie 🎉' : up.days === 1 ? 'day to go' : 'days to go') + '</div></button>';
  if (ci) o += '<button class="card" data-a="cycle" style="text-align:left"><div class="lbl">🌙 Cycle</div><div style="font:600 22px Fredoka;margin-top:6px">' + (ci.day && ci.day <= ci.len ? 'Day ' + ci.day : '—') + '</div><div class="sub">' + (ci.daysTo === 0 ? 'Period expected today' : 'Period in ~' + ci.daysTo + ' days') + '</div></button>';
  else if (S.settings.cycle) o += '<button class="card" data-a="cycle" style="text-align:left"><div class="lbl">🌙 Cycle</div><div class="sub" style="margin-top:6px">Tap to start tracking</div></button>';
  o += '<button class="card span2" data-a="care" style="text-align:left"><div class="row sp"><div class="lbl">✅ Today\'s routine</div><div class="fire">' + tasks.done + ' / ' + tasks.total + '</div></div><div class="bar"><i style="width:' + (tasks.total ? tasks.done / tasks.total * 100 : 0) + '%"></i></div></button>';
  o += '</div>';
  return o;
}
function todayTasks() {
  var t = ymd(today()), total = 0, done = 0, sl = S.slog[t] || {}, hl = S.hlog[t] || {};
  S.habits.forEach(function (h) { total++; if (hl[h.id]) done++; });
  ['am', 'pm'].forEach(function (p) { S.skin[p].forEach(function (s, i) { total++; if ((sl[p] || {})[i]) done++; }); });
  return { total: total, done: done };
}

/* ---------- CARE ---------- */
function pCare() {
  var w = waterInfo(), t = ymd(today()), sl = S.slog[t] || {}, hl = S.hlog[t] || {}, pr = N.perms();
  var o = head('Self care', 'Small habits, big glow ✨');
  o += '<div class="card"><div class="row sp"><h2>💧 Water</h2><div class="fire">' + w.yes + ' / ' + w.goal + '</div></div>';
  var g = ''; for (var i = 0; i < w.goal; i++) g += '<span class="' + (i < w.yes ? 'f' : '') + '">💧</span>';
  o += '<div class="glasses">' + g + '</div><div class="bar"><i style="width:' + Math.min(100, w.yes / w.goal * 100) + '%"></i></div>';
  o += '<div class="row" style="margin-top:12px"><button class="btn sm" data-a="glass">+ Glass</button><button class="btn ghost sm" data-a="unglass">− Glass</button><span class="sub grow" style="text-align:right">Buddy said yes ' + w.yes + '× · no ' + w.no + '×</span></div></div>';
  o += '<div class="card"><div class="row sp"><div><h2>🐾 Water buddy</h2><div class="sub">Walks over any app and asks if you drank water</div></div><button class="tog ' + (w.enabled ? 'on' : '') + '" data-a="buddy"></button></div>';
  o += '<div class="field" style="margin-top:12px"><span class="lbl">Remind me every</span>' + [30, 60, 90, 120].map(function (m) { return '<button class="chip ' + (w.interval === m ? 'on' : '') + '" data-a="interval" data-v="' + m + '">' + (m < 60 ? m + ' min' : m / 60 + ' h') + '</button>'; }).join('') + '</div>';
  o += '<div class="field"><span class="lbl">Daily goal (glasses)</span>' + [6, 8, 10, 12].map(function (m) { return '<button class="chip ' + (w.goal === m ? 'on' : '') + '" data-a="goal" data-v="' + m + '">' + m + '</button>'; }).join('') + '</div>';
  o += '<div class="row"><button class="btn sm" data-a="petnow">Show buddy now</button>' + (HAS_NATIVE && (pr.overlay === false || pr.notif === false || pr.battery === false) ? '<button class="btn ghost sm" data-a="setup">Finish setup</button>' : '') + '</div>';
  if (HAS_NATIVE && pr.overlay === false) o += '<div class="sub" style="margin-top:8px">⚠️ Permission needed so the buddy can appear over other apps.</div>';
  o += '</div>';
  ['am', 'pm'].forEach(function (p) {
    var steps = S.skin[p];
    o += '<div class="card"><div class="row sp"><h2>' + (p === 'am' ? '☀️ Morning skincare' : '🌙 Night skincare') + '</h2><button class="btn ghost sm" data-a="editskin" data-v="' + p + '">Edit</button></div>';
    steps.forEach(function (s, i) { var d = (sl[p] || {})[i]; o += '<button class="check ' + (d ? 'done' : '') + '" data-a="skin" data-v="' + p + ':' + i + '" style="width:100%;text-align:left"><span class="box">' + (d ? '✓' : '') + '</span><span class="t">' + esc(s) + '</span></button>'; });
    o += '</div>';
  });
  o += '<div class="card"><div class="row sp"><h2>🌷 Daily habits</h2><button class="btn ghost sm" data-a="edithabits">Edit</button></div>';
  S.habits.forEach(function (h) {
    var d = hl[h.id], s = streak(h.id);
    o += '<button class="check ' + (d ? 'done' : '') + '" data-a="habit" data-v="' + h.id + '" style="width:100%;text-align:left"><span class="box">' + (d ? '✓' : '') + '</span><span class="t grow">' + h.e + ' ' + esc(h.name) + '</span>' + (s ? '<span class="fire">🔥 ' + s + '</span>' : '') + '</button>';
  });
  return o + '</div>';
}

/* ---------- DIARY ---------- */
function pDiary() {
  var t = ymd(today()), j = S.journal[t] || { g: ['', '', ''], text: '' }, mo = S.mood[t];
  var o = head('My diary', 'Just for you 🔒');
  o += '<div class="card"><div class="lbl">Mood today</div><div class="moods">' + MOODS.map(function (m) { return '<button data-a="mood" data-v="' + m[0] + '" class="' + (mo === m[0] ? 'on' : '') + '">' + m[0] + '</button>'; }).join('') + '</div></div>';
  o += '<div class="card"><h2>🙏 Three good things today</h2>';
  for (var i = 0; i < 3; i++) o += '<div class="field" style="margin:10px 0 0"><input data-j="g' + i + '" placeholder="' + (i + 1) + '. I am grateful for…" value="' + esc(j.g[i]) + '"></div>';
  o += '</div><div class="card"><h2>📝 Dear diary…</h2><div class="field" style="margin:10px 0 0"><textarea data-j="text" placeholder="Write anything. Nobody else can read this." style="min-height:130px">' + esc(j.text) + '</textarea></div><button class="btn" style="margin-top:10px" data-a="savej">Save</button></div>';
  var days = [], k, d, col = '';
  for (k = 6; k >= 0; k--) { d = addDays(today(), -k); days.push(d); }
  col = days.map(function (d) { var m = S.mood[ymd(d)], sc = m ? { '🥰': 6, '😊': 5, '😌': 4, '😴': 3, '😔': 2, '😤': 1 }[m] : 0; return '<div><div class="e">' + (m || '') + '</div><div class="b" style="height:' + (sc ? sc * 9 : 4) + 'px;opacity:' + (sc ? 1 : .4) + '"></div>' + DOW[(d.getDay() + 6) % 7] + '</div>'; }).join('');
  o += '<div class="card"><h2>📊 This week</h2><div class="week">' + col + '</div></div>';
  var past = Object.keys(S.journal).sort().reverse().filter(function (x) { var e = S.journal[x]; return x !== t && (e.text || e.g.join('')); }).slice(0, 14);
  if (past.length) {
    o += '<h2 style="margin:16px 0 8px">Past entries</h2>';
    past.forEach(function (x) { var e = S.journal[x], dd = parse(x); o += '<button class="card" data-a="entry" data-v="' + x + '" style="width:100%;text-align:left;display:block"><div class="lbl">' + (S.mood[x] || '') + ' ' + dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + '</div><div style="margin-top:4px;font-size:14px">' + esc((e.text || e.g.filter(Boolean)[0] || '').slice(0, 90)) + '</div></button>'; });
  }
  return o;
}

/* ---------- CYCLE ---------- */
function pCycle() {
  var ci = cycleInfo(), c = S.cycle, t = today();
  if (!calMonth) calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  var o = head('Cycle', 'Private & only on this phone 🌙');
  if (!ci) {
    o += '<div class="card empty"><img src="m/' + petOfToday() + '_happy.png" alt=""><h2 style="margin:8px 0">Let\'s start tracking</h2><div>Log the first day of your last period and I will predict the next one.</div><button class="btn" style="margin-top:14px" data-a="logperiod">Log period start</button></div>';
  } else {
    o += '<div class="card hero"><div class="grow"><div class="lbl">' + esc(ci.phase) + '</div><div class="big" style="margin-top:6px">' + (ci.daysTo === 0 ? 'Today' : ci.daysTo) + '</div><div class="sub">' + (ci.daysTo === 0 ? 'period expected' : 'days until next period · ' + nice(ci.next)) + '</div><div style="margin-top:8px;font-size:13px">' + esc(ci.tip) + '</div></div><img src="m/' + petOfToday() + '_idle.png" alt=""></div>';
    o += '<div class="row" style="margin-bottom:10px"><button class="btn grow" data-a="logperiod">Period started</button><button class="btn ghost grow" data-a="endperiod">Period ended</button></div>';
  }
  o += '<div class="card"><div class="row sp"><button class="back" data-a="calprev">‹</button><h2>' + MON[calMonth.getMonth()] + ' ' + calMonth.getFullYear() + '</h2><button class="back" data-a="calnext">›</button></div><div class="cal" style="margin-top:10px">' + DOW.map(function (d) { return '<div class="h">' + d[0] + '</div>'; }).join('') + calCells(ci) + '</div>';
  o += '<div class="sub" style="margin-top:10px">● period &nbsp; <span style="color:var(--acc)">○</span> predicted &nbsp; <span style="color:#1d6e4a">●</span> fertile window</div></div>';
  var sy = c.sym[ymd(t)] || [];
  o += '<div class="card"><h2>How do you feel today?</h2><div style="margin-top:8px">' + SYMPTOMS.map(function (s) { return '<button class="chip ' + (sy.indexOf(s) >= 0 ? 'on' : '') + '" data-a="sym" data-v="' + s + '">' + s + '</button>'; }).join('') + '</div></div>';
  if (c.starts.length) {
    o += '<div class="card"><h2>History</h2>' + c.starts.slice().sort().reverse().slice(0, 6).map(function (s) { return '<div class="row sp" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>' + parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span><button class="btn ghost sm" data-a="delperiod" data-v="' + s + '">Remove</button></div>'; }).join('');
    o += '<div class="sub" style="margin-top:8px">Average cycle ' + (ci ? ci.len : c.cycleLen) + ' days · period ' + c.periodLen + ' days. Predictions are estimates, not medical advice.</div></div>';
  }
  return o;
}
function calCells(ci) {
  var y = calMonth.getFullYear(), m = calMonth.getMonth(), first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), s = '', i, c = S.cycle;
  var marks = {};
  c.starts.forEach(function (st) { for (var k = 0; k < c.periodLen; k++) marks[ymd(addDays(parse(st), k))] = 'p'; });
  if (ci) {
    for (var q = 0; q < 8; q++) {
      var cs = addDays(ci.last, q * ci.len), ov = addDays(cs, ci.ov - 1);
      if (q > 0) for (var k2 = 0; k2 < c.periodLen; k2++) { var kk = ymd(addDays(cs, k2)); if (!marks[kk]) marks[kk] = 'pp'; }
      for (var f = -5; f <= 1; f++) { var fk = ymd(addDays(ov, f)); if (!marks[fk]) marks[fk] = 'fw'; }
    }
  }
  for (i = 0; i < lead; i++) s += '<div></div>';
  for (i = 1; i <= n; i++) { var k3 = ymd(new Date(y, m, i)); s += '<div class="d ' + (marks[k3] || '') + (k3 === ymd(today()) ? ' td' : '') + '">' + i + '</div>'; }
  return s;
}

/* ---------- MORE ---------- */
function pMore() {
  var s = S.settings, o = head('More', 'Everything else you love 💗');
  var items = [['notes', '💌', 'Love notes', 'Messages made just for you', s.notes], ['dates', '🎉', 'Special dates', 'Countdowns to the big days', s.dates], ['wardrobe', '👗', 'Wardrobe & outfits', 'Plan what to wear', s.wardrobe], ['wishlist', '🛍️', 'Wishlist', 'Things you want', s.wishlist], ['settings', '⚙️', 'Settings', 'Name, theme, lock, reminders, backup', true]];
  items.forEach(function (i) { if (i[4]) o += '<button class="menu" data-a="open" data-v="' + i[0] + '"><span class="e">' + i[1] + '</span><span class="grow"><b>' + i[2] + '</b><div class="sub">' + i[3] + '</div></span><span class="sub">›</span></button>'; });
  return o;
}
function pSub(x) { return { notes: pNotes, dates: pDates, wardrobe: pWardrobe, wishlist: pWish, settings: pSettings }[x](); }

function pNotes() {
  var o = head('Love notes', 'From ' + esc(NOTES.from) + ' 💌', true);
  o += '<div class="card"><div class="lbl">Today</div><div class="note" style="font-size:19px">“' + esc(todayNote()) + '”</div></div>';
  o += '<h2 style="margin:16px 0 8px">Open when…</h2>';
  NOTES.openWhen.forEach(function (n, i) {
    var op = S.noteOpened[i];
    o += '<button class="envelope" data-a="envelope" data-v="' + i + '"><b>' + (op ? '💌' : '✉️') + ' ' + esc(n.title) + '</b>' + (op ? '<div class="open">' + esc(n.text) + '</div>' : '<div class="sub">Tap to open</div>') + '</button>';
  });
  o += '<h2 style="margin:16px 0 8px">My own notes to self</h2>';
  (S.myNotes || []).forEach(function (n, i) { o += '<div class="card row sp"><div class="grow">' + esc(n) + '</div><button class="btn ghost sm" data-a="delmynote" data-v="' + i + '">✕</button></div>'; });
  return o + '<div class="row"><input id="mynote" placeholder="Write a sweet reminder for yourself"><button class="btn" data-a="addmynote">Add</button></div>';
}
function pDates() {
  var o = head('Special dates', 'Counting down to what matters', true);
  upcoming().forEach(function (u) {
    o += '<button class="card row" data-a="editdate" data-v="' + u.it.id + '" style="width:100%;text-align:left"><span style="font-size:32px">' + u.it.e + '</span><span class="grow"><b>' + esc(u.it.name) + '</b><div class="sub">' + nice(u.at) + ' ' + u.at.getFullYear() + (u.yrs ? ' · ' + (/birth/i.test(u.it.name) ? 'turning ' + u.yrs : u.yrs + (u.yrs === 1 ? ' year' : ' years')) : '') + '</div></span><span style="text-align:right"><div class="cd">' + (u.days === 0 ? '🎉' : u.days) + '</div><div class="sub">' + (u.days === 0 ? 'today' : 'days') + '</div></span></button>';
  });
  return o + '<button class="btn" data-a="adddate" style="width:100%;margin-top:6px;text-align:center">+ Add a date</button>';
}
function pWardrobe() {
  var o = head('Wardrobe', 'Your clothes, your style 👗', true), items = S.wardrobe;
  o += '<div class="card"><div class="row sp"><h2>🗓️ Outfit planner</h2></div>';
  for (var i = 0; i < 7; i++) {
    var d = addDays(today(), i), k = ymd(d), ids = S.outfits[k] || [];
    o += '<button class="check" data-a="plan" data-v="' + k + '" style="width:100%;text-align:left"><b style="width:64px;flex:none">' + (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DOW[(d.getDay() + 6) % 7] + ' ' + d.getDate()) + '</b><span class="grow sub">' + (ids.length ? ids.map(function (id) { var w = items.filter(function (x) { return x.id === id; })[0]; return w ? esc(w.name) : ''; }).filter(Boolean).join(', ') : 'Tap to plan') + '</span></button>';
  }
  o += '</div><div class="row sp" style="margin:6px 0 10px"><h2>My clothes</h2><button class="btn sm" data-a="additem">+ Add</button></div>';
  if (!items.length) return o + '<div class="card empty"><img src="m/' + petOfToday() + '_idle.png" alt=""><div>Add photos of your clothes to plan outfits.</div></div>';
  o += '<div class="grid" style="grid-template-columns:1fr 1fr 1fr">';
  items.forEach(function (it) { o += '<button class="photo" data-a="edititem" data-v="' + it.id + '" ' + (it.img ? 'data-img="' + it.id + '"' : '') + '>' + (it.img ? '' : '<span class="ph">👚</span>') + '<small>' + esc(it.name) + '</small></button>'; });
  return o + '</div>';
}
function pWish() {
  var o = head('Wishlist', 'Dream big, little one 🛍️', true), items = S.wishlist.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); });
  o += '<div class="row" style="margin-bottom:12px"><input id="wname" placeholder="I want…"><button class="btn" data-a="addwish">Add</button></div>';
  if (!items.length) o += '<div class="card empty"><img src="m/' + petOfToday() + '_happy.png" alt=""><div>Nothing here yet. Add your wishes!</div></div>';
  items.forEach(function (w) { o += '<div class="card row ' + (w.done ? 'check done' : '') + '" style="padding:12px"><button data-a="wishdone" data-v="' + w.id + '" class="box" style="' + (w.done ? 'background:var(--acc)' : '') + '">' + (w.done ? '✓' : '') + '</button><span class="grow t">' + esc(w.name) + '</span><button class="btn ghost sm" data-a="delwish" data-v="' + w.id + '">✕</button></div>'; });
  return o;
}
function tog(on, a, v) { return '<button class="tog ' + (on ? 'on' : '') + '" data-a="' + a + '"' + (v ? ' data-v="' + v + '"' : '') + '></button>'; }
function pSettings() {
  var s = S.settings, r = s.rem, o = head('Settings', '', true);
  o += '<div class="card"><div class="field"><span class="lbl">Name</span><input id="sname" value="' + esc(s.name) + '"></div>';
  o += '<span class="lbl">Theme</span><div class="themes">' + Object.keys(THEMES).map(function (k) { return '<button data-a="theme" data-v="' + k + '" class="' + (s.theme === k ? 'on' : '') + '" style="background:' + THEMES[k] + '" aria-label="' + k + '"></button>'; }).join('') + '</div></div>';
  o += '<div class="card"><span class="lbl">Your buddy (home screen + walking pet)</span><div class="pets"><button data-a="pet" data-v="random" class="' + (s.pet === 'random' ? 'on' : '') + '" style="font-size:26px">🎲</button>' + PETS.map(function (p) { return '<button data-a="pet" data-v="' + p + '" class="' + (s.pet === p ? 'on' : '') + '"><img src="m/' + p + '_happy.png" alt="' + p + '"></button>'; }).join('') + '</div></div>';
  o += '<div class="card"><h2>Reminders</h2>';
  [['onNote', 'note', '💌 Daily love note'], ['onAM', 'skinAM', '☀️ Morning skincare'], ['onPM', 'skinPM', '🌙 Night skincare'], ['onDiary', 'diary', '📖 Diary time']].forEach(function (x) {
    o += '<div class="check"><span class="grow">' + x[2] + '</span><input type="time" data-rt="' + x[1] + '" value="' + r[x[1]] + '" style="width:128px;padding:6px 6px;font-size:13px">' + tog(r[x[0]], 'remtog', x[0]) + '</div>';
  });
  o += '<div class="check"><span class="grow">🎉 Special date reminders</span>' + tog(r.onDates, 'remtog', 'onDates') + '</div><div class="check"><span class="grow">🌙 Period coming soon</span>' + tog(r.onCycle, 'remtog', 'onCycle') + '</div></div>';
  o += '<div class="card"><h2>Features</h2>';
  [['cycle', '🌙 Cycle tracker'], ['notes', '💌 Love notes'], ['dates', '🎉 Special dates'], ['wardrobe', '👗 Wardrobe'], ['wishlist', '🛍️ Wishlist']].forEach(function (x) { o += '<div class="check"><span class="grow">' + x[1] + '</span>' + tog(s[x[0]], 'feat', x[0]) + '</div>'; });
  o += '</div><div class="card"><h2>🔒 App lock</h2><div class="sub" style="margin:2px 0 10px">' + (s.pin ? 'PIN is on' : 'Protect the app with a 4-digit PIN') + '</div><button class="btn ghost sm" data-a="setpin">' + (s.pin ? 'Change PIN' : 'Set PIN') + '</button> ' + (s.pin ? '<button class="btn ghost sm" data-a="clearpin">Turn off</button>' : '') + '</div>';
  o += '<div class="card"><h2>💾 Backup</h2><div class="sub" style="margin:2px 0 10px">Save everything to a file (keep it in Google Drive / WhatsApp) before changing phones.</div><button class="btn sm" data-a="export">Export</button> <button class="btn ghost sm" data-a="import">Import</button><input id="impfile" type="file" accept=".json,application/json" class="hidden"></div>';
  return o + '<div class="empty sub">Made with love 💗</div>';
}

/* ---------- actions ---------- */
function bounce() { var m = $('#mascot'); if (m) { m.classList.remove('bounce'); void m.offsetWidth; m.classList.add('bounce'); } }
function setList(key, k, fn) { var o = S[key][k] || (S[key][k] = {}); fn(o); }
var A = {
  tab: function (v) { go(v); }, back: function () { sub = null; render(); },
  open: function (v) { open(v); }, notes: function () { go('more'); open('notes'); }, dates: function () { go('more'); open('dates'); },
  cycle: function () { go('cycle'); }, care: function () { go('care'); },
  poke: function () { bounce(); },
  glass: function () { N.addGlass(1); if (!HAS_NATIVE) {} render(true); setTimeout(bounce, 30); var w = waterInfo(); if (w.yes === w.goal) toast('Goal reached! 🎉'); },
  unglass: function () { N.addGlass(-1); render(true); },
  mood: function (v) { var k = ymd(today()); S.mood[k] = S.mood[k] === v ? undefined : v; if (!S.mood[k]) delete S.mood[k]; save(); render(true); },
  buddy: function () { var w = waterInfo(); N.setWater({ enabled: !w.enabled, pet: S.settings.pet }); if (!w.enabled) { var p = N.perms(); if (HAS_NATIVE && (p.overlay === false || p.notif === false)) { toast('One quick setup needed'); N.setup(); } } render(true); },
  interval: function (v) { N.setWater({ interval: +v }); render(true); },
  goal: function (v) { N.setWater({ goal: +v }); render(true); },
  petnow: function () { N.petNow(); toast(HAS_NATIVE ? 'Your buddy is coming…' : 'Buddy preview works on the phone'); },
  setup: function () { N.setup(); },
  skin: function (v) { var p = v.split(':'), t = ymd(today()); setList('slog', t, function (o) { var s = o[p[0]] || (o[p[0]] = {}); s[p[1]] = !s[p[1]]; }); save(); render(true); },
  habit: function (v) { var t = ymd(today()); setList('hlog', t, function (o) { o[v] = !o[v]; }); save(); render(true); if (S.hlog[t][v]) { var s = streak(v); if (s > 1 && s % 7 === 0) toast('🔥 ' + s + ' day streak!'); } },
  editskin: function (v) {
    openSheet('<h2>' + (v === 'am' ? 'Morning' : 'Night') + ' skincare steps</h2><div class="sub" style="margin:4px 0 10px">One step per line, in order.</div><textarea id="steps" style="min-height:160px">' + esc(S.skin[v].join('\n')) + '</textarea><button class="btn" data-a="saveskin" data-v="' + v + '" style="margin-top:12px;width:100%">Save</button>');
  },
  saveskin: function (v) { S.skin[v] = $('#steps').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); save(); closeSheet(); render(true); },
  edithabits: function () {
    openSheet('<h2>My habits</h2><div id="hl">' + S.habits.map(function (h) { return '<div class="row" style="margin:8px 0"><span style="font-size:22px">' + h.e + '</span><span class="grow">' + esc(h.name) + '</span><button class="btn ghost sm" data-a="delhabit" data-v="' + h.id + '">✕</button></div>'; }).join('') + '</div><div class="row" style="margin-top:12px"><input id="he" value="⭐" style="width:60px;text-align:center"><input id="hn" placeholder="New habit…"></div><button class="btn" data-a="addhabit" style="margin-top:12px;width:100%">Add habit</button>');
  },
  addhabit: function () { var n = $('#hn').value.trim(); if (!n) return; S.habits.push({ id: uid(), name: n, e: $('#he').value || '⭐' }); save(); closeSheet(); render(true); },
  delhabit: function (v) { S.habits = S.habits.filter(function (h) { return h.id !== v; }); save(); closeSheet(); render(true); A.edithabits(); },
  savej: function () {
    var t = ymd(today()), g = [0, 1, 2].map(function (i) { return $('[data-j=g' + i + ']').value.trim(); });
    S.journal[t] = { g: g, text: $('[data-j=text]').value.trim() }; save(); toast('Saved 💗'); render(true);
  },
  entry: function (v) { var e = S.journal[v]; openSheet('<div class="lbl">' + (S.mood[v] || '') + ' ' + parse(v).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>' + (e.g.filter(Boolean).length ? '<h2 style="margin:10px 0 4px">Grateful for</h2>' + e.g.filter(Boolean).map(function (x) { return '<div>• ' + esc(x) + '</div>'; }).join('') : '') + (e.text ? '<p style="margin-top:12px;white-space:pre-wrap;user-select:text">' + esc(e.text) + '</p>' : '')); },
  logperiod: function () { openSheet('<h2>When did your period start?</h2><input type="date" id="pd" value="' + ymd(today()) + '" max="' + ymd(today()) + '" style="margin:12px 0"><button class="btn" data-a="saveperiod" style="width:100%">Save</button>'); },
  saveperiod: function () { var v = $('#pd').value; if (!v) return; if (S.cycle.starts.indexOf(v) < 0) S.cycle.starts.push(v); S.cycle.starts.sort(); save(); closeSheet(); calMonth = null; render(true); toast('Logged 🌙'); },
  endperiod: function () {
    var ci = cycleInfo(); if (!ci || !ci.day) { toast('Log a period start first'); return; }
    var n = Math.min(10, Math.max(2, diff(ci.last, today()) + 1)); S.cycle.periodLen = n; save(); render(true); toast('Period length set to ' + n + ' days');
  },
  delperiod: function (v) { S.cycle.starts = S.cycle.starts.filter(function (x) { return x !== v; }); save(); render(true); },
  sym: function (v) { var k = ymd(today()), a = S.cycle.sym[k] || (S.cycle.sym[k] = []), i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); save(); render(true); },
  calprev: function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); render(true); },
  calnext: function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); render(true); },
  envelope: function (v) { S.noteOpened[v] = !S.noteOpened[v]; save(); render(true); },
  addmynote: function () { var i = $('#mynote'); if (!i.value.trim()) return; S.myNotes.push(i.value.trim()); save(); render(true); },
  delmynote: function (v) { S.myNotes.splice(+v, 1); save(); render(true); },
  adddate: function () { dateSheet({ id: '', name: '', e: '🎉', m: today().getMonth() + 1, d: today().getDate(), y: null }); },
  editdate: function (v) { dateSheet(S.dates.filter(function (x) { return x.id === v; })[0]); },
  savedate: function (v) {
    var n = $('#dn').value.trim(), dt = $('#dd').value; if (!n || !dt) { toast('Add a name and a date'); return; }
    var p = dt.split('-'), o = { id: v || uid(), name: n, e: $('#de').value || '🎉', m: +p[1], d: +p[2], y: $('#dy').classList.contains('on') ? +p[0] : null };
    var i = S.dates.findIndex(function (x) { return x.id === o.id; }); if (i >= 0) S.dates[i] = o; else S.dates.push(o); save(); closeSheet(); render(true);
  },
  deldate: function (v) { S.dates = S.dates.filter(function (x) { return x.id !== v; }); save(); closeSheet(); render(true); },
  togy: function () { $('#dy').classList.toggle('on'); },
  additem: function () { itemSheet({ id: '', name: '', cat: 'Top' }); },
  edititem: function (v) { itemSheet(S.wardrobe.filter(function (x) { return x.id === v; })[0]); },
  saveitem: function (v) {
    var n = $('#in').value.trim() || 'New item', cat = $('#ic').getAttribute('data-cat'), file = $('#ifile').files[0];
    var it = S.wardrobe.filter(function (x) { return x.id === v; })[0];
    if (!it) { it = { id: uid(), name: n, cat: cat }; S.wardrobe.push(it); }
    it.name = n; it.cat = cat;
    var done = function () { save(); closeSheet(); render(true); };
    if (file) shrink(file, 700).then(function (d) { imgCache[it.id] = d; it.img = true; return idbPut(it.id, d); }).then(done, function () { toast('Could not read that photo'); done(); }); else done();
  },
  delitem: function (v) { S.wardrobe = S.wardrobe.filter(function (x) { return x.id !== v; }); idbDel(v); delete imgCache[v]; Object.keys(S.outfits).forEach(function (k) { S.outfits[k] = S.outfits[k].filter(function (x) { return x !== v; }); }); save(); closeSheet(); render(true); },
  cat: function (v) { $('#ic').setAttribute('data-cat', v); document.querySelectorAll('#ic .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-v') === v); }); },
  plan: function (v) {
    if (!S.wardrobe.length) { toast('Add some clothes first 👚'); return; }
    var ids = S.outfits[v] || [];
    openSheet('<h2>Outfit for ' + parse(v).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) + '</h2><div id="pl" data-d="' + v + '" style="margin-top:10px">' + S.wardrobe.map(function (it) { return '<button class="check ' + (ids.indexOf(it.id) >= 0 ? 'done' : '') + '" data-a="planpick" data-v="' + it.id + '" style="width:100%;text-align:left"><span class="box">' + (ids.indexOf(it.id) >= 0 ? '✓' : '') + '</span><span class="grow">' + esc(it.name) + ' <span class="sub">· ' + it.cat + '</span></span></button>'; }).join('') + '</div><button class="btn" data-a="closesheet" style="margin-top:12px;width:100%">Done</button>');
  },
  planpick: function (v, el) { var d = $('#pl').getAttribute('data-d'), a = S.outfits[d] || (S.outfits[d] = []), i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); save(); el.classList.toggle('done'); el.querySelector('.box').textContent = i >= 0 ? '' : '✓'; },
  closesheet: function () { closeSheet(); render(true); },
  addwish: function () { var i = $('#wname'); if (!i.value.trim()) return; S.wishlist.push({ id: uid(), name: i.value.trim(), done: false }); save(); render(true); },
  wishdone: function (v) { var w = S.wishlist.filter(function (x) { return x.id === v; })[0]; w.done = !w.done; save(); render(true); },
  delwish: function (v) { S.wishlist = S.wishlist.filter(function (x) { return x.id !== v; }); save(); render(true); },
  theme: function (v) { S.settings.theme = v; save(); render(true); },
  pet: function (v) { S.settings.pet = v; save(); N.setWater({ pet: v }); render(true); },
  remtog: function (v) { S.settings.rem[v] = !S.settings.rem[v]; save(); render(true); },
  feat: function (v) { S.settings[v] = !S.settings[v]; save(); render(true); },
  setpin: function () { pinEntry('Choose a PIN', function (p1) { pinEntry('Repeat the PIN', function (p2) { if (p1 === p2) { S.settings.pin = p1; save(); toast('PIN set 🔒'); render(true); } else toast('PINs did not match'); }); }); },
  clearpin: function () { S.settings.pin = ''; save(); render(true); },
  export: function () {
    idbAll().then(function (imgs) {
      var data = JSON.stringify({ app: 'cutie', v: 1, saved: new Date().toISOString(), state: S, images: imgs }), name = 'cutie-backup-' + ymd(today()) + '.json';
      if (!N.share(name, data)) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      }
    });
  },
  import: function () { $('#impfile').click(); }
};
function dateSheet(x) {
  openSheet('<h2>' + (x.id ? 'Edit date' : 'New special date') + '</h2><div class="row" style="margin:12px 0"><input id="de" value="' + esc(x.e) + '" style="width:64px;text-align:center;font-size:22px"><input id="dn" placeholder="Name (e.g. Our first date)" value="' + esc(x.name) + '"></div><input type="date" id="dd" value="' + (x.y || today().getFullYear()) + '-' + pad(x.m) + '-' + pad(x.d) + '"><div class="check"><span class="grow">Count the years<div class="sub">e.g. turning 24, 2 years together</div></span><button id="dy" class="tog ' + (x.y ? 'on' : '') + '" data-a="togy"></button></div><button class="btn" data-a="savedate" data-v="' + x.id + '" style="width:100%;margin-top:6px">Save</button>' + (x.id ? '<button class="btn danger" data-a="deldate" data-v="' + x.id + '" style="width:100%;margin-top:8px">Delete</button>' : ''));
}
function itemSheet(x) {
  openSheet('<h2>' + (x.id ? 'Edit item' : 'New item') + '</h2><div class="field" style="margin-top:12px"><span class="lbl">Photo</span><input type="file" id="ifile" accept="image/*"></div><div class="field"><span class="lbl">Name</span><input id="in" placeholder="Pink floral dress" value="' + esc(x.name) + '"></div><div class="field"><span class="lbl">Type</span><div id="ic" data-cat="' + x.cat + '">' + CATS.map(function (c) { return '<button class="chip ' + (c === x.cat ? 'on' : '') + '" data-a="cat" data-v="' + c + '">' + c + '</button>'; }).join('') + '</div></div><button class="btn" data-a="saveitem" data-v="' + x.id + '" style="width:100%">Save</button>' + (x.id ? '<button class="btn danger" data-a="delitem" data-v="' + x.id + '" style="width:100%;margin-top:8px">Delete</button>' : ''));
}

/* ---------- PIN ---------- */
function pinEntry(title, cb, target) {
  var val = '', box = target || $('#sheet');
  function draw() {
    var h = '<div style="text-align:center;padding:16px 0"><h2>' + title + '</h2><div class="dots" style="justify-content:center;margin:18px 0">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < val.length ? 'f' : '') + '"></i>'; }).join('') + '</div><div class="pad" style="justify-content:center;margin:auto;width:max-content">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(function (n) { return n === '' ? '<span></span>' : '<button data-p="' + n + '">' + n + '</button>'; }).join('') + '</div></div>';
    if (target) target.querySelector('.pin').innerHTML = h; else openSheet(h, null);
    box = target || $('#sheet');
    box.onclick = function (e) {
      var b = e.target.closest('[data-p]'); if (!b) { if (e.target === $('#sheet')) closeSheet(); return; }
      var k = b.getAttribute('data-p'); if (k === '⌫') val = val.slice(0, -1); else if (val.length < 4) val += k;
      if (val.length === 4) { var v = val; val = ''; if (!target) closeSheet(); cb(v, function () { draw(); }); return; }
      draw();
    };
  }
  draw();
}
function lockScreen() {
  var l = $('#lock'); if (!S.settings.pin) { l.classList.add('hidden'); return; }
  l.classList.remove('hidden'); l.innerHTML = '<img src="m/' + petOfToday() + '_happy.png" alt=""><h2>Hi ' + esc(S.settings.name) + ' 💗</h2><div class="pin"></div>';
  pinEntry('Enter your PIN', function (v, redraw) { if (v === S.settings.pin) { l.classList.add('hidden'); l.innerHTML = ''; } else { toast('Wrong PIN'); redraw(); } }, l);
}

/* ---------- reminders (handed to Android) ---------- */
function syncReminders() {
  var r = S.settings.rem, L = [];
  function hm(s) { var p = (s || '08:00').split(':'); return [+p[0], +p[1]]; }
  function daily(id, on, t, title, text) { if (on) { var x = hm(t); L.push({ id: id, type: 'daily', h: x[0], m: x[1], title: title, text: text }); } }
  daily('note', r.onNote && S.settings.notes, r.note, '💌 You have a love note', 'Open Cutie to read today\'s message for you.');
  daily('skinAM', r.onAM, r.skinAM, '☀️ Morning skincare', 'Time to glow, ' + S.settings.name + '!');
  daily('skinPM', r.onPM, r.skinPM, '🌙 Night skincare', 'Wash off the day and take care of your skin.');
  daily('diary', r.onDiary && true, r.diary, '📖 Diary time', 'How was your day? Write three good things.');
  if (r.onDates && S.settings.dates) upcoming().slice(0, 6).forEach(function (u) {
    var d0 = new Date(u.at.getFullYear(), u.at.getMonth(), u.at.getDate(), 9, 0), d1 = addDays(d0, -1); d1.setHours(18, 0, 0, 0);
    if (d0 > new Date()) L.push({ id: 'date-' + u.it.id, type: 'once', at: d0.getTime(), title: u.it.e + ' ' + u.it.name, text: 'It is today! 🎉' });
    if (d1 > new Date()) L.push({ id: 'date1-' + u.it.id, type: 'once', at: d1.getTime(), title: u.it.e + ' ' + u.it.name + ' is tomorrow', text: 'Get ready, ' + S.settings.name + '!' });
  });
  var ci = S.settings.cycle ? cycleInfo() : null;
  if (r.onCycle && ci) { var d = addDays(ci.next, -2); d.setHours(9, 0, 0, 0); if (d > new Date()) L.push({ id: 'cycle', type: 'once', at: d.getTime(), title: '🌙 Period may start soon', text: 'Maybe pack a pad and a chocolate. 🍫' }); }
  N.reminders(L);
}

/* ---------- events ---------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]'); if (!el) return;
  var f = A[el.getAttribute('data-a')]; if (f) f(el.getAttribute('data-v'), el);
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'sname') { S.settings.name = e.target.value.trim() || 'Cutie'; save(); }
  var rt = e.target.getAttribute && e.target.getAttribute('data-rt'); if (rt && e.target.value) { S.settings.rem[rt] = e.target.value; save(); }
});
document.addEventListener('change', function (e) {
  if (e.target.id !== 'impfile' || !e.target.files[0]) return;
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var j = JSON.parse(fr.result); if (j.app !== 'cutie') throw 0;
      S = j.state; localStorage.setItem(KEY, JSON.stringify(S)); load();
      var ks = Object.keys(j.images || {}); imgCache = {};
      Promise.all(ks.map(function (k) { return idbPut(k, j.images[k]); })).then(function () { toast('Backup restored 💗'); applyTheme(); render(); syncReminders(); });
    } catch (x) { toast('That file is not a Cutie backup'); }
  };
  fr.readAsText(e.target.files[0]);
});
var hiddenAt = 0;
document.addEventListener('visibilitychange', function () {
  if (document.hidden) hiddenAt = Date.now();
  else { if (S.settings.pin && Date.now() - hiddenAt > 60000) lockScreen(); render(true); }
});
window.cutieBack = function () {
  if (!$('#sheet').classList.contains('hidden')) { closeSheet(); return true; }
  if (!$('#lock').classList.contains('hidden')) return false;
  if (sub) { sub = null; render(); return true; }
  if (tab !== 'home') { go('home'); return true; }
  return false;
};
window.cutieRefresh = function () { if (!document.hidden) render(true); };

/* ---------- boot ---------- */
load(); applyTheme();
loadNotes().then(function () { render(); lockScreen(); syncReminders(); if (S.settings.pet) N.setWater({ pet: S.settings.pet }); });
window.__cutie = { get S() { return S; }, A: A, go: go, open: open, render: render };
})();
