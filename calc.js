// Pure helpers used by index.html
const TH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);

// safe arithmetic for amount fields: digits, + - * / ( ) . and commas only
function evalAmount(s) {
  s = String(s).replace(/,/g, '').trim();
  if (!s || !/^[\d.+\-*/() ]+$/.test(s)) return NaN;
  try { const v = Function('"use strict";return (' + s + ')')(); return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN; }
  catch (e) { return NaN; }
}

const baht = n => (n < 0 ? '−' : '') + '฿' + Math.abs(Math.round(n)).toLocaleString('th-TH');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// '2026-09-21' -> '21 ก.ย. 69' (Buddhist-era year)
const snapLabel = iso => { const d = new Date(iso + 'T00:00'); return d.getDate() + ' ' + TH_ABBR[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(2); };

// ---------- net worth math shared by index.html and summary.html (w = data.worth)
const KINDS = [
  ['cash', 'เงินสด/เงินฝาก', '#3B82F6'], ['stock', 'หุ้น/กองทุน', '#8B5CF6'], ['lottery', 'สลาก', '#EAB308'],
  ['company', 'ออมกับบริษัท', '#14B8A6'], ['debt', 'หนี้สิน', '#DC2626'], ['other', 'ทรัพย์สินอื่น (ไม่รวมในยอด)', '#9CA3AF']];
const ASSET_KINDS = ['cash', 'stock', 'lottery', 'company'];
const kindKey = k => KINDS.some(x => x[0] === k) ? k : 'other';
const accVal = (a, s) => { const x = s.v[a.id]; return x == null ? null : a.unit ? x * (+s.price || 0) : x; };
const signed = (a, v) => a.kind === 'debt' ? -v : v;

function worthIn(w, s) {
  const by = {}; KINDS.forEach(k => by[k[0]] = 0);
  w.accounts.forEach(a => { const x = accVal(a, s); if (x != null) by[kindKey(a.kind)] += x; });
  const gross = sum(ASSET_KINDS, k => by[k]);
  return {by, gross, net: gross - by.debt};
}
// the snapshot before index i; the first one is compared with the opening balance
function prevIn(w, i) {
  if (i > 0) return worthIn(w, w.snaps[i - 1]);
  const o = +w.opening || 0;
  return o ? {net: o, gross: o, by: null} : null;
}
// accounts grouped by bank, biggest first; debt-only and "other"-only groups go last.
// withNew also lists accounts never recorded in any snapshot, so a just-added account is visible
function groupsIn(w, s, withNew) {
  const m = new Map();
  w.accounts.forEach(a => {
    const v = accVal(a, s);
    if (v == null && !(withNew && !w.snaps.some(x => x.v[a.id] != null))) return;
    if (!m.has(a.bank)) m.set(a.bank, {name: a.bank, total: 0, list: [], kinds: new Set()});
    const g = m.get(a.bank);
    g.total += v == null ? 0 : signed(a, v); g.list.push(a); g.kinds.add(kindKey(a.kind));
  });
  const rank = g => g.kinds.size === 1 && g.kinds.has('debt') ? 2 : g.kinds.size === 1 && g.kinds.has('other') ? 3 : 1;
  return [...m.values()].map(g => ({...g, rank: rank(g)})).sort((a, b) => a.rank - b.rank || b.total - a.total);
}
const bankTotalIn = (w, s, name) => s ? sum(w.accounts.filter(a => a.bank === name), a => { const v = accVal(a, s); return v == null ? 0 : signed(a, v); }) : null;
