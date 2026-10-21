
const COLS = ['symbol','id','date','weekday_hk','weekday_ny','source','side','level_top','level_bot','touch_price','wo','fwd_1_high','fwd_1_low','fwd_3_high','fwd_3_low','fwd_5_high','fwd_5_low','bounce_atr','bounce_ok'];
let rows = [];

const $ = (id) => document.getElementById(id);
const tbody = $('tbody');
const empty = $('empty');

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
    return obj;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i+1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === ',' && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function isBounce(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'ok';
}

function sideLabel(side) {
  const s = String(side || '').toLowerCase();
  if (s === 'sell') return '賣方低效率';
  if (s === 'buy') return '買方低效率';
  if (s === 'sh') return 'Swing High';
  if (s === 'sl') return 'Swing Low';
  return side || '—';
}

function sourceLabel(src) {
  const s = String(src || '').toLowerCase();
  if (s === 'fvg') return '低效率';
  if (s === 'swing') return 'Swing';
  return src || '—';
}

function directionClass(side) {
  const s = String(side || '').toLowerCase();
  return (s === 'sell' || s === 'sh') ? 'down' : 'up';
}

function withinDefaultYear(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  return d >= start && d <= end;
}

function filtered() {
  const sym = $('filterSymbol').value;
  const src = $('filterSource').value;
  const side = $('filterSide').value;
  const from = $('from').value;
  const to = $('to').value;
  return rows.filter(r => {
    if (!isBounce(r.bounce_ok)) return false;
    if (sym && String(r.symbol || '').toUpperCase() !== sym.toUpperCase()) return false;
    if (src && String(r.source || '').toLowerCase() !== src) return false;
    if (side && String(r.side || '').toLowerCase() !== side) return false;
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function render() {
  const list = filtered();
  const dual = dualDates(rows);
  tbody.innerHTML = '';
  $('count').textContent = `${list.length} 日有反彈`;
  $('export').disabled = list.length === 0;
  empty.classList.toggle('hidden', list.length > 0 || rows.length > 0);
  if (rows.length && list.length === 0) {
    empty.textContent = '有資料，但篩選後冇符合「有反彈」嘅日子。';
    empty.classList.remove('hidden');
  } else if (!rows.length) {
    empty.textContent = '等緊低效率同 swing 事件 CSV。上傳後會喺呢度顯示有反彈嘅日子。';
  }
  for (const r of list) {
    const tr = document.createElement('tr');
    const level = r.level_top || r.level_bot || '—';
    tr.innerHTML = `
      <td>${esc(r.symbol || '—')}</td>
      <td><code>${esc(r.id || '—')}</code></td>
      <td>${esc(r.date)}${dual.has(`${String(r.symbol || '').toUpperCase()}|${r.date}`) ? ' <span class="tag dual">雙觸發</span>' : ''}</td>
      <td>${esc(weekdaysFor(r.date).hk)}</td>
      <td>${esc(weekdaysFor(r.date).ny)}</td>
      <td><span class="tag ${esc(String(r.source||'').toLowerCase())}">${esc(sourceLabel(r.source))}</span></td>
      <td><span class="tag ${directionClass(r.side)}">${esc(sideLabel(r.side))}</span></td>
      <td>${esc(r.touch_price || '—')}</td>
      <td>${esc(r.bounce_atr || '—')}</td>
      <td>${esc(level)}</td>
      <td>${esc(r.wo_id || r.wo || '—')}</td>`;
    tbody.appendChild(tr);
  }
  $('meta').textContent = rows.length
    ? `已載入 ${rows.length} 行事件 · 顯示 bounce_ok 為真者`
    : '未載入資料';
}



function weekdaysFor(dateStr) {
  if (!dateStr) return { hk: '—', ny: '—' };
  // Civil calendar date from CSV (no intraday) — same weekday for both labels
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return { hk: '—', ny: '—' };
  const y = +m[1], mo = +m[2], d = +m[3];
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=Sun
  const hkNames = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const nyNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return { hk: hkNames[dow], ny: nyNames[dow] };
}

function dualDates(list) {
  const map = {};
  for (const r of list) {
    if (!isBounce(r.bounce_ok)) continue;
    const key = `${String(r.symbol || '').toUpperCase()}|${r.date}`;
    const src = String(r.source || '').toLowerCase();
    if (!map[key]) map[key] = new Set();
    map[key].add(src);
  }
  return new Set(Object.keys(map).filter(k => map[k].has('fvg') && map[k].has('swing')));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function loadRows(parsed) {
  rows = parsed.map(r => ({
    symbol: r.symbol || 'XAUUSD',
    id: r.id || '',
    date: r.date || '',
    source: r.source || '',
    side: r.side || '',
    level_top: r.level_top || '',
    level_bot: r.level_bot || '',
    touch_price: r.touch_price || '',
    wo: r.wo || '',
    wo_id: r.wo_id || '',
    bounce_atr: r.bounce_atr || '',
    bounce_ok: r.bounce_ok || ''
  }));
  // default date inputs to last 12 months if empty
  if (!$('from').value || !$('to').value) {
    const end = new Date();
    const start = new Date(end); start.setMonth(start.getMonth() - 3);
    const iso = d => d.toISOString().slice(0,10);
    if (!$('from').value) $('from').value = iso(start);
    if (!$('to').value) $('to').value = iso(end);
  }
  render();
}

$('file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  loadRows(parseCsv(await f.text()));
});

['filterSymbol','filterSource','filterSide','from','to'].forEach(id => $(id).addEventListener('input', render));

$('export').addEventListener('click', () => {
  const list = filtered().map(r => {
    const w = weekdaysFor(r.date);
    return { ...r, weekday_hk: w.hk, weekday_ny: w.ny };
  });
  const header = COLS.join(',');
  const body = list.map(r => COLS.map(c => csvEscape(r[c] ?? '')).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'xauusd-bounce-days.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

$('pasteBtn').addEventListener('click', () => $('pasteDlg').showModal());
$('pasteApply').addEventListener('click', (e) => {
  e.preventDefault();
  loadRows(parseCsv($('pasteArea').value));
  $('pasteDlg').close();
});


// Auto-load bundled events
fetch('data.csv').then(r => r.ok ? r.text() : '').then(t => {
  if (t && t.trim()) loadRows(parseCsv(t));
}).catch(() => {});

// init default date window
(() => {
  const end = new Date();
  const start = new Date(end); start.setMonth(start.getMonth() - 3);
  const iso = d => d.toISOString().slice(0,10);
  $('from').value = iso(start);
  $('to').value = iso(end);
  render();
})();
