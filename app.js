const API = "https://script.google.com/macros/s/AKfycbw2zzARX3MqaXdP6WMTQRLamlyRpC6moKKTXijdXfwOml-TCp-xEnHO7qdhwm65ARmx/exec";
let F = [], C = [], S = null;

const $ = x => document.getElementById(x);
const money = x => "₹" + Number(x || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const kg = x => Number(x || 0).toLocaleString("en-IN") + " kg";
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function sum(a, f) { return a.reduce((s, x) => s + Number(f(x) || 0), 0); }

function api(action) {
  return new Promise((ok, no) => {
    if (!API.startsWith("https://")) return no(Error("Add your Apps Script /exec URL in app.js"));
    let cb = "cb" + Date.now() + Math.random().toString(36).slice(2);
    let s = document.createElement("script");
    let t = setTimeout(() => {
      delete window[cb];
      s.remove();
      no(Error("Data service timed out"));
    }, 20000);
    window[cb] = x => {
      clearTimeout(t);
      delete window[cb];
      s.remove();
      ok(x);
    };
    s.onerror = () => {
      clearTimeout(t);
      delete window[cb];
      no(Error("Cannot reach spreadsheet service"));
    };
    s.src = API + "?action=" + action + "&callback=" + cb;
    document.body.append(s);
  });
}

async function start() {
  try {
    if ($("status")) $("status").textContent = "Loading latest sheet data…";
    let [f, c, s] = await Promise.all([api("fruit"), api("crop"), api("summary")]);
    if (!f.ok || !c.ok || !s.ok) throw Error(f.error || c.error || s.error);
    
    F = f.data.rows || [];
    C = c.data.rows || [];
    S = s.data || {};

    const canonicalFA = name => {
      const n = String(name || "").trim().toUpperCase().replace(/\s+/g, " ");
      if (n === "LAVAKUMAR") return "LAVAKUMAR T S";
      if (n === "LOKESH") return "LOKESH R N";
      return String(name || "").trim();
    };

    F.forEach(x => x.fa = canonicalFA(x.fa));
    C.forEach(x => x.fa = canonicalFA(x.fa));

    let fas = [...new Set(F.map(x => x.fa).concat(C.map(x => x.fa)).filter(Boolean))].sort();
    if ($("ffa")) $("ffa").innerHTML = '<option value="">All Field Assistants</option>' + fas.map(x => `<option>${esc(x)}</option>`).join("");
    
    try { populateCropFAs(); } catch (e) { console.error(e); }
    try { farmers(); } catch (e) { console.error(e); }
    try { fruit(); } catch (e) { console.error(e); }
    try { crop(); } catch (e) { console.error(e); }
    try { dashboard(); } catch (e) { console.error(e); }

    if ($("status")) $("status").textContent = "Data loaded · refresh to check for new entries";
  } catch (e) {
    if ($("status")) $("status").textContent = e.message;
    if ($("fout")) $("fout").textContent = e.message;
  }
}

function farmers() {
  if (!$("ffa") || !$("ffarmer")) return;
  let a = F.filter(x => !$("ffa").value || x.fa === $("ffa").value);
  let u = [...new Map(a.map(x => [x.code, x])).values()];
  u.sort((a, b) => {
    let an = Number(a.code), bn = Number(b.code);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: "base" });
  });
  $("ffarmer").innerHTML = '<option value="">All Farmers</option>' + u.map(x => `<option value="${esc(x.code)}">${esc(x.code)} · ${esc(x.farmer)}</option>`).join("");
}

function fruit() {
  if (!$("fout")) return;
  let fa = $("ffa") ? $("ffa").value : "";
  let code = ($("fsearch") ? $("fsearch").value.trim() : "") || ($("ffarmer") ? $("ffarmer").value : "");
  let rows = F.filter(x => (!fa || x.fa === fa) && (!code || String(x.code) === String(code)));
  
  const dateValue = s => {
    const t = String(s || "").trim();
    let m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    let d = new Date(t);
    return isNaN(d) ? 0 : d.getTime();
  };
  rows.sort((a, b) => dateValue(a.date) - dateValue(b.date));

  if (!rows.length) {
    $("fout").innerHTML = '<div class="fruit-empty">No purchase records found. Try another Field Assistant or farmer account number.</div>';
    return;
  }

  let people = [...new Map(rows.map(x => [x.code, x])).values()];
  const grades = ["A1", "B2", "C3", "D4", "E5"];
  let faOverview = "";

  if (fa && !code) {
    let faQty = sum(rows, x => x.qty.total), faAmount = sum(rows, x => x.amount.total), faReceipts = rows.length, faAvg = faQty ? faAmount / faQty : 0;
    let faGradeQty = {}, faGradeAmount = {};
    grades.forEach(g => {
      faGradeQty[g] = sum(rows, x => x.qty[g]);
      faGradeAmount[g] = sum(rows, x => x.amount[g]);
    });

    let faGradeCards = grades.map(g => `<article class="grade-card"><div class="grade-card-head">${g}</div><div class="grade-card-body"><span>${kg(faGradeQty[g])}<small>QUANTITY</small></span><span>${money(faGradeAmount[g])}<small>AMOUNT</small></span></div></article>`).join("");

    const chartColors = ["#1c7c4a", "#83b85a", "#e3b341", "#e47b3c", "#bd5360"];
    const chartCardStyle = "background:#fff;border:1px solid #e3eae4;border-radius:14px;padding:18px;min-width:0;box-shadow:0 3px 12px rgba(25,60,35,.05)";

    const donut = (values, unit) => {
      const total = values.reduce((a, b) => a + b.value, 0);
      let angle = 0;
      const segments = values.map(v => {
        const from = angle;
        angle += total ? (v.value / total) * 100 : 0;
        return `${v.color} ${from}% ${angle}%`;
      }).join(",");
      const gradient = total ? `conic-gradient(${segments})` : "#edf1ed";
      const legend = values.map(v => `<div style="display:flex;align-items:center;gap:8px;margin:7px 0;font-size:12px"><i style="width:10px;height:10px;border-radius:3px;background:${v.color};flex:none"></i><span style="font-weight:700;min-width:24px">${v.name}</span><b style="margin-left:auto;text-align:right">${unit === "kg" ? kg(v.value) : money(v.value)}</b></div>`).join("");
      return `<div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:10px 2px"><div role="img" aria-label="${unit === "kg" ? "Quantity" : "Earnings"} distribution by grade" style="width:154px;height:154px;flex:none;border-radius:50%;background:${gradient};display:grid;place-items:center"><div style="width:94px;height:94px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 1px 5px #00000012"><strong style="font-size:19px;color:#193f2a">${total ? Math.round(total).toLocaleString("en-IN") : "0"}</strong><small style="color:#718076;font-size:10px;letter-spacing:1px">${unit.toUpperCase()}</small></div></div><div style="flex:1;min-width:130px">${legend || '<small style="color:#7b887e">No grade data available</small>'}</div></div>`;
    };

    const qtySlices = grades.map((g, i) => ({ name: g, value: faGradeQty[g], color: chartColors[i] })).filter(x => x.value > 0);
    const amtSlices = grades.map((g, i) => ({ name: g, value: faGradeAmount[g], color: chartColors[i] })).filter(x => x.value > 0);

    const dayMap = new Map();
    rows.forEach(x => { const key = String(x.date || ""); dayMap.set(key, (dayMap.get(key) || 0) + Number(x.qty.total || 0)); });
    const dayRows = [...dayMap.entries()].map(([date, value]) => ({ date, value, stamp: dateValue(date) })).sort((a, b) => a.stamp - b.stamp);

    const trend = (() => {
      if (!dayRows.length) return '<p style="color:#718076">No daily purchase data available.</p>';
      const w = 760, h = 250, left = 58, right = 18, top = 18, bottom = 48, plotW = w - left - right, plotH = h - top - bottom;
      const max = Math.max(...dayRows.map(x => x.value), 1);
      const niceMax = Math.ceil(max / 5) * 5 || max;
      const x = i => left + (dayRows.length === 1 ? plotW / 2 : i * plotW / (dayRows.length - 1));
      const y = v => top + plotH - (v / niceMax) * plotH;
      const pts = dayRows.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
      const area = `${x(0)},${top + plotH} ${pts} ${x(dayRows.length - 1)},${top + plotH}`;

      const grid = [0, 1, 2, 3, 4].map(i => {
        const val = niceMax * i / 4, yy = y(val);
        return `<line x1="${left}" y1="${yy}" x2="${w - right}" y2="${yy}" stroke="#e8eee9" stroke-width="1"/><text x="${left - 9}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#718076">${Math.round(val).toLocaleString("en-IN")}</text>`;
      }).join("");

      const labels = dayRows.length === 1 ? [0] : [...new Set([0, Math.floor((dayRows.length - 1) / 2), dayRows.length - 1])];
      const xLabels = labels.map(i => `<text x="${x(i)}" y="${h - 15}" text-anchor="${i === 0 ? "start" : i === dayRows.length - 1 ? "end" : "middle"}" font-size="11" fill="#718076">${esc(dayRows[i].date)}</text>`).join("");
      const dots = dayRows.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.value)}" r="4.5" fill="#fff" stroke="#187346" stroke-width="2"><title>${esc(d.date)}: ${kg(d.value)}</title></circle>`).join("");

      return `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily purchased quantity trend" style="width:100%;min-width:520px;height:auto;display:block">${grid}<polygon points="${area}" fill="#3b9a65" opacity=".12"/><polyline points="${pts}" fill="none" stroke="#187346" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${xLabels}<text x="14" y="${top + plotH / 2}" transform="rotate(-90 14 ${top + plotH / 2})" text-anchor="middle" font-size="11" fill="#718076">Quantity (kg)</text></svg></div><div style="font-size:11px;color:#718076;margin-top:4px">Hover over a point to see its exact date and quantity · ${dayRows.length} purchase dates</div>`;
    })();

    faOverview = `<section class="fa-performance">
     <div class="fa-performance-head"><div><div class="eyebrow">FIELD ASSISTANT PERFORMANCE</div><h2>${esc(fa)}</h2><p>${esc(rows[0]?.fa || fa)} · ${people.length} farmers in current-season purchase records</p></div><span class="live-tag"><i></i>Live purchase data</span></div>
     <div class="fruit-kpis">
      <div class="fruit-kpi"><span class="fruit-kpi-icon">♟</span><div><small>Farmers</small><strong>${people.length}</strong></div></div>
      <div class="fruit-kpi"><span class="fruit-kpi-icon">⚖</span><div><small>Total Quantity</small><strong>${kg(faQty)}</strong></div></div>
      <div class="fruit-kpi"><span class="fruit-kpi-icon">▤</span><div><small>Total Earnings</small><strong>${money(faAmount)}</strong></div></div>
      <div class="fruit-kpi"><span class="fruit-kpi-icon">◇</span><div><small>Average Price/kg</small><strong>${money(faAvg)}</strong></div></div>
     </div>
     <div class="fruit-subhead"><h3>FA Grade-wise Performance</h3><p>${faReceipts} purchase receipts across ${people.length} farmers</p></div>
     <div class="grade-cards">${faGradeCards}</div>
     <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;margin:20px 0">
      <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:16px">Grade Mix · Quantity</h3><p style="margin:0;color:#718076;font-size:12px">Share of total purchased volume</p>${donut(qtySlices, "kg")}</article>
      <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:16px">Grade Mix · Earnings</h3><p style="margin:0;color:#718076;font-size:12px">Share of total farmer payments</p>${donut(amtSlices, "₹")}</article>
     </div>
     <article style="${chartCardStyle};margin:16px 0"><h3 style="margin:0 0 4px;color:#234b32;font-size:16px">Daily Purchase Trend</h3><p style="margin:0 0 12px;color:#718076;font-size:12px">Total quantity purchased each day</p>${trend}</article>
     <div class="farmer-list-heading"><h3>Farmers under ${esc(fa)}</h3><p>Individual purchase statements appear below</p></div>
    </section>`;
  }

  $("fout").innerHTML = faOverview + people.map(p => {
    let r = rows.filter(x => String(x.code) === String(p.code)), q = {}, v = {};
    grades.forEach(g => { q[g] = sum(r, x => x.qty[g]); v[g] = sum(r, x => x.amount[g]); });
    let tq = sum(r, x => x.qty.total), tv = sum(r, x => x.amount.total), avg = tq ? tv / tq : 0;
    let gradeCards = grades.map(g => `<article class="grade-card"><div class="grade-card-head">${g}</div><div class="grade-card-body"><span>${kg(q[g])}<small>QUANTITY</small></span><span>${money(v[g])}<small>AMOUNT</small></span></div></article>`).join("");
    let historyRows = r.map(x => `<tr><td>${esc(x.date)}</td><td>${esc(x.buyingSheet)}</td><td>${esc(x.receipt)}</td>${grades.map(g => `<td>${Number(x.qty[g] || 0).toLocaleString("en-IN")}</td>`).join("")}<td class="sum-qty">${Number(x.qty.total || 0).toLocaleString("en-IN")}</td>${grades.map(g => `<td>${money(x.amount[g])}</td>`).join("")}<td class="money-total">${money(x.amount.total)}</td><td>${money(x.avg)}</td></tr>`).join("");
    let totalCells = grades.map(g => `<td>${q[g].toLocaleString("en-IN")}</td>`).join("") + `<td>${tq.toLocaleString("en-IN")}</td>` + grades.map(g => `<td>${money(v[g])}</td>`).join("") + `<td>${money(tv)}</td><td>${money(avg)}</td>`;
    return `<article class="farmer-statement">
     <div class="farmer-identity"><span class="farmer-avatar">♟</span><div class="farmer-name">${esc(p.farmer)} · ${esc(p.code)}</div><div class="farmer-meta">● &nbsp; Village: <b>${esc(p.village || "—")}</b></div><div class="farmer-meta">♟ &nbsp; Assigned FA: <b>${esc(p.fa || "—")}</b></div></div>
     <div class="fruit-kpis">
      <div class="fruit-kpi"><span class="fruit-kpi-icon">⚖</span><div><small>Total Quantity</small><strong>${kg(tq)}</strong></div></div>
      <div class="fruit-kpi"><span class="fruit-kpi-icon">▤</span><div><small>Total Earnings</small><strong>${money(tv)}</strong></div></div>
      <div class="fruit-kpi"><span class="fruit-kpi-icon">▣</span><div><small>Receipts</small><strong>${r.length}</strong></div></div>
      <div class="fruit-kpi"><span class="fruit-kpi-icon">◇</span><div><small>Average Price/kg</small><strong>${money(avg)}</strong></div></div>
     </div>
     <div class="fruit-subhead"><h3>Grade-wise Summary</h3><p>Quantity received and amount earned by grade</p></div>
     <div class="grade-cards">${gradeCards}</div>
     <section class="purchase-card"><div class="purchase-card-heading"><div><h3>Purchase History</h3><p>Receipt-wise grade quantities, earnings and average price for the selected farmer.</p></div><span class="live-tag"><i></i>${r.length} receipts</span></div>
      <div class="history-wrap"><table class="history-table"><thead><tr><th>Date</th><th>Buying<br>sheet</th><th>Receipt</th>${grades.map(g => `<th>${g} kg</th>`).join("")}<th>Total kg</th>${grades.map(g => `<th>${g} ₹</th>`).join("")}<th>Total ₹</th><th>Avg ₹/kg</th></tr></thead><tbody>${historyRows}</tbody><tfoot><tr><td colspan="3">TOTAL</td>${totalCells}</tr></tfoot></table></div>
      <button class="fruit-print" onclick="print()">Print / Save PDF</button>
     </section>
    </article>`;
  }).join("");
}

const FA_AREA = {
  "LAVAKUMAR T S": "CHELUR",
  "MANJAPPA": "CHELUR",
  "UMESH S": "CHELUR",
  "LOKESH R N": "CHELUR",
  "SHANTHAPPA": "HOSKERE",
  "ASHOK N G": "HOSKERE",
  "ULLAS K S": "HOSKERE"
};

function populateCropFAs() {
  if (!$("carea") || !$("cfa")) return;
  const area = $("carea").value, current = $("cfa").value;
  const names = [...new Set(C.map(x => x.fa).filter(n => n && (!area || FA_AREA[n] === area)))].sort((a, b) => a.localeCompare(b));
  $("cfa").innerHTML = '<option value="">All Field Assistants</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  if (names.includes(current)) $("cfa").value = current;
}

function crop() {
  if (!$("cout") || !$("carea") || !$("cfa") || !$("csearch")) return;
  const area = $("carea").value || "", fa = $("cfa").value || "", q = ($("csearch").value || "").toLowerCase().trim();

  const r = (C || []).filter(x => 
    (!area || FA_AREA[x.fa] === area) &&
    (!fa || x.fa === fa) &&
    (!q || String(x.code || "").toLowerCase().includes(q) || String(x.farmer || "").toLowerCase().includes(q) || String(x.village || "").toLowerCase().includes(q))
  );

  if (!r.length) {
    $("cout").innerHTML = `
      <div style="background:#fff;border:1px solid #e3eae4;border-radius:14px;padding:32px;text-align:center;color:#718076;margin-top:16px">
        <h3>No matching crop records found</h3>
        <p style="margin-top:6px;font-size:13px">Try adjusting your area, assistant filter, or search keywords.</p>
      </div>`;
    return;
  }

  const farmersCount = r.length;
  const acres = sum(r, x => x.acres);
  const qtyv = sum(r, x => x.quantity);
  const val = sum(r, x => x.cropValue);
  const cost = sum(r, x => x.inputCost);
  const bal = sum(r, x => x.closingBalance);

  const isNetPositive = bal >= 0;
  const balColor = isNetPositive ? "#15803d" : "#dc2626";
  const balBg = isNetPositive ? "#f0fdf4" : "#fef2f2";
  const balBorder = isNetPositive ? "#bbf7d0" : "#fecaca";

  const kpisHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr));gap:14px;margin-bottom:20px">
      <div class="kpi" style="background:#fff;border:1px solid #e3eae4;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">👥</span>
        <div><div style="font-size:11px;color:#718076;text-transform:uppercase;font-weight:600">Farmers</div><b style="font-size:18px;color:#193f2a">${farmersCount}</b></div>
      </div>
      <div class="kpi" style="background:#fff;border:1px solid #e3eae4;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">🌾</span>
        <div><div style="font-size:11px;color:#718076;text-transform:uppercase;font-weight:600">Total Acres</div><b style="font-size:18px;color:#193f2a">${Number(acres || 0).toFixed(2)} <small style="font-size:11px;font-weight:normal">Acres</small></b></div>
      </div>
      <div class="kpi" style="background:#fff;border:1px solid #e3eae4;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">⚖️</span>
        <div><div style="font-size:11px;color:#718076;text-transform:uppercase;font-weight:600">Quantity Received</div><b style="font-size:18px;color:#193f2a">${kg(qtyv)}</b></div>
      </div>
      <div class="kpi" style="background:#fff;border:1px solid #e3eae4;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">🌾₹</span>
        <div><div style="font-size:11px;color:#718076;text-transform:uppercase;font-weight:600">Total Crop Value</div><b style="font-size:18px;color:#193f2a">${money(val)}</b></div>
      </div>
      <div class="kpi" style="background:#fffbeb;border:1px solid #fef3c7;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">🪙</span>
        <div><div style="font-size:11px;color:#92400e;text-transform:uppercase;font-weight:600">Input Cost</div><b style="font-size:18px;color:#b45309">${money(cost)}</b></div>
      </div>
      <div class="kpi" style="background:${balBg};border:1px solid ${balBorder};border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">👛</span>
        <div><div style="font-size:11px;color:${balColor};text-transform:uppercase;font-weight:600">Closing Balance</div><b style="font-size:18px;color:${balColor}">${money(bal)}</b></div>
      </div>
    </div>
  `;

  const chartCardStyle = "background:#fff;border:1px solid #e3eae4;border-radius:14px;padding:18px;min-width:0;box-shadow:0 3px 12px rgba(25,60,35,.05);display:flex;flex-direction:column";

  let financeSvg = "";
  try {
    let entities = [];
    if (fa) {
      entities = [...r].sort((a,b) => Number(b.cropValue || 0) - Number(a.cropValue || 0)).slice(0, 6).map(x => ({
        label: String(x.farmer || "Farmer").trim().split(" ")[0],
        cropVal: Number(x.cropValue || 0),
        inputCost: Number(x.inputCost || 0)
      }));
    } else {
      const faSet = [...new Set(r.map(x => x.fa).filter(Boolean))];
      entities = faSet.map(faName => {
        const faRows = r.filter(x => x.fa === faName);
        return {
          label: String(faName).replace(/ T S| R N| S| K S| N G/g, "").trim(),
          cropVal: sum(faRows, x => x.cropValue),
          inputCost: sum(faRows, x => x.inputCost)
        };
      }).sort((a,b) => b.cropVal - a.cropVal);
    }

    if (entities.length > 0) {
      const w = 460, h = 240, left = 55, right = 15, top = 25, bottom = 38, plotW = w - left - right, plotH = h - top - bottom;
      const maxVal = Math.max(...entities.map(e => Math.max(e.cropVal, e.inputCost)), 1000);
      const niceMax = Math.ceil(maxVal / 10000) * 10000 || maxVal;
      const groupW = plotW / entities.length;
      const barW = Math.min(Math.max(groupW * 0.32, 8), 18);

      const grid = [0, 1, 2, 3].map(i => {
        const v = niceMax * i / 3, yy = top + plotH - (v / niceMax) * plotH;
        const lbl = v >= 100000 ? (v / 100000).toFixed(1) + "L" : v >= 1000 ? (v / 1000).toFixed(0) + "k" : v;
        return `<line x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}" stroke="#e8eee9" stroke-width="1"/><text x="${left-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#718076">₹${lbl}</text>`;
      }).join("");

      const bars = entities.map((e, i) => {
        const cx = left + (i + 0.5) * groupW;
        const hVal = (e.cropVal / niceMax) * plotH;
        const hCost = (e.inputCost / niceMax) * plotH;
        const yVal = top + plotH - hVal;
        const yCost = top + plotH - hCost;

        return `
          <rect x="${cx - barW - 1}" y="${yVal}" width="${barW}" height="${Math.max(hVal, 1)}" fill="#1c7c4a" rx="2"><title>${esc(e.label)} Crop Value: ${money(e.cropVal)}</title></rect>
          <rect x="${cx + 1}" y="${yCost}" width="${barW}" height="${Math.max(hCost, 1)}" fill="#d97706" rx="2"><title>${esc(e.label)} Input Cost: ${money(e.inputCost)}</title></rect>
          <text x="${cx}" y="${h - 12}" text-anchor="middle" font-size="10" font-weight="600" fill="#2d3748">${esc(e.label)}</text>
        `;
      }).join("");

      const legend = `
        <g transform="translate(${left + 20}, 10)" font-size="10">
          <rect x="0" y="0" width="10" height="10" rx="2" fill="#1c7c4a"/>
          <text x="14" y="9" fill="#2d3748" font-weight="600">Crop Value</text>
          <rect x="95" y="0" width="10" height="10" rx="2" fill="#d97706"/>
          <text x="109" y="9" fill="#2d3748" font-weight="600">Input Cost</text>
        </g>`;

      financeSvg = `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Financial Performance" style="width:100%;min-width:320px;height:auto;display:block">${grid}${legend}${bars}</svg></div>`;
    } else {
      financeSvg = '<p style="color:#718076;padding:12px">No financial comparison available</p>';
    }
  } catch (err) {
    financeSvg = '<p style="color:#718076;padding:12px">Unable to display chart</p>';
  }

  let riskAlertsHtml = "";
  let riskCount = 0;
  try {
    const riskFarmers = r.filter(x => Number(x.closingBalance || 0) < 0).sort((a, b) => Number(a.closingBalance || 0) - Number(b.closingBalance || 0));
    riskCount = riskFarmers.length;

    if (riskFarmers.length > 0) {
      riskAlertsHtml = riskFarmers.map(x => `
        <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:#dc2626;font-size:15px">⚠️</span>
            <div>
              <div style="font-weight:700;color:#991b1b;font-size:12px">${esc(x.farmer || "Farmer")} (${esc(x.code || "—")})</div>
              <div style="font-size:10px;color:#b91c1c">${esc(x.village || "—")} · FA: ${esc(x.fa || "—")}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:#dc2626;font-size:13px">${money(x.closingBalance)}</div>
            <small style="color:#b91c1c;font-size:9px">DEFICIT</small>
          </div>
        </div>
      `).join("");
    } else {
      riskAlertsHtml = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:22px;text-align:center;color:#15803d">
          <div style="font-size:20px;margin-bottom:4px">✓</div>
          <strong>All Accounts Clear</strong>
          <div style="font-size:12px;color:#166534;margin-top:2px">No negative balances or pending recovery deficits found.</div>
        </div>
      `;
    }
  } catch (err) {
    riskAlertsHtml = '<p style="color:#718076;padding:12px">No risk records to display</p>';
  }

  const rowsHtml = r.map(x => {
    const isNeg = Number(x.closingBalance || 0) < 0;
    const badgeStyle = isNeg
      ? "background:#fee2e2;color:#dc2626;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-block"
      : "background:#dcfce7;color:#15803d;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-block";

    return `
      <tr>
        <td><strong>${esc(x.fa)}</strong></td>
        <td>${esc(x.code)}</td>
        <td><strong>${esc(x.farmer)}</strong></td>
        <td>${esc(x.father || "—")}</td>
        <td>${esc(x.village || "—")}</td>
        <td>${esc(x.dos || "—")}</td>
        <td>${Number(x.acres || 0).toFixed(2)}</td>
        <td>${esc(x.dofh || "—")}</td>
        <td>${esc(x.dolh || "—")}</td>
        <td>${Number(x.thd || 0)}</td>
        <td>${Number(x.quantity || 0).toLocaleString("en-IN")}</td>
        <td>${money(x.cropValue)}</td>
        <td>${money(x.inputCost)}</td>
        <td><span style="${badgeStyle}">${money(x.closingBalance)}</span></td>
      </tr>
    `;
  }).join("");

  const chartSubtitle = fa ? ("Top farmers under " + esc(fa)) : "Crop Value vs. Input Costs by Field Assistant";

  $("cout").innerHTML = `
    ${kpisHtml}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;margin-bottom:20px">
      <article style="${chartCardStyle}">
        <div style="margin-bottom:6px">
          <h3 style="margin:0;color:#234b32;font-size:15px;font-weight:700">Financial Performance</h3>
          <p style="margin:2px 0 8px;color:#718076;font-size:11px">${chartSubtitle}</p>
        </div>
        ${financeSvg}
      </article>

      <article style="${chartCardStyle}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <h3 style="margin:0;color:#991b1b;font-size:15px;font-weight:700">High Recovery Risk Alerts</h3>
            <p style="margin:2px 0 8px;color:#718076;font-size:11px">${riskCount} farmer(s) with advances exceeding crop output</p>
          </div>
          <span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px">${riskCount} Risks</span>
        </div>
        <div style="max-height:220px;overflow-y:auto;padding-right:4px">
          ${riskAlertsHtml}
        </div>
      </article>
    </div>

    <section class="report-card" style="background:#fff;border:1px solid #e3eae4;border-radius:14px;overflow:hidden;box-shadow:0 3px 12px rgba(25,60,35,.05)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e8eee9">
        <div>
          <div style="font-size:10px;font-weight:700;color:#187346;text-transform:uppercase;letter-spacing:0.5px">SETTLEMENT AUDIT</div>
          <h2 style="font-size:16px;font-weight:700;color:#1f2937;margin:2px 0 0">Farmer Crop & Settlement Ledger</h2>
        </div>
        <span class="live-tag" style="font-size:12px;color:#15803d;font-weight:600">● ${farmersCount} Farmers Listed</span>
      </div>
      <div class="tablewrap" style="overflow-x:auto">
        <table class="summary-table" style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#064e3b;color:#fff">
              <th style="padding:10px 14px;text-align:left">FA</th>
              <th style="padding:10px 14px;text-align:left">Code</th>
              <th style="padding:10px 14px;text-align:left">Farmer</th>
              <th style="padding:10px 14px;text-align:left">Father</th>
              <th style="padding:10px 14px;text-align:left">Village</th>
              <th style="padding:10px 14px;text-align:left">DOS</th>
              <th style="padding:10px 14px;text-align:left">Acres</th>
              <th style="padding:10px 14px;text-align:left">DOFH</th>
              <th style="padding:10px 14px;text-align:left">DOLH</th>
              <th style="padding:10px 14px;text-align:left">THD</th>
              <th style="padding:10px 14px;text-align:left">Qty</th>
              <th style="padding:10px 14px;text-align:left">Crop Value</th>
              <th style="padding:10px 14px;text-align:left">Input Cost</th>
              <th style="padding:10px 14px;text-align:left">Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="total" style="background:#f3f4f6;font-weight:700;border-top:2px solid #064e3b">
              <td colspan="6" style="padding:12px 14px">TOTAL (${farmersCount} Farmers)</td>
              <td style="padding:12px 14px">${Number(acres || 0).toFixed(2)}</td>
              <td colspan="3" style="padding:12px 14px"></td>
              <td style="padding:12px 14px">${Number(qtyv || 0).toLocaleString("en-IN")} kg</td>
              <td style="padding:12px 14px">${money(val)}</td>
              <td style="padding:12px 14px;color:#b45309">${money(cost)}</td>
              <td style="padding:12px 14px;color:${balColor}">${money(bal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="padding:14px 20px;background:#f9fafb;display:flex;justify-content:flex-end;border-top:1px solid #e8eee9">
        <button class="btn print-btn" onclick="print()" style="background:#064e3b;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:600;cursor:pointer">Print / Save PDF</button>
      </div>
    </section>
  `;
}

function dashboard() {
  if (!S || !$("dash-content")) return;
  const all = S.rows || [], combined = all.find(x => x.type === "combined") || {}, faRows = all.filter(x => x.type === "fa");
  const fmt = x => Number(x || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const pct = x => `${Number(x || 0).toFixed(2)}%`;
  const activeExtra = !!S.showA1B2;
  const visibleGrades = [...(activeExtra ? ["A1", "B2"] : []), "60+", "30+", "-30"];
  const qtyKey = { "A1": "A1", "B2": "B2", "60+": "g60", "30+": "g30", "-30": "g30m" };
  const pctKey = { "A1": "pA1", "B2": "pB2", "60+": "p60", "30+": "p30", "-30": "p30m" };

  const cards = [
    { label: "Total Area", value: `${fmt(combined.acres)} <small>Acres</small>`, tone: "area", icon: "▥" },
    { label: "Total Tonnage", value: `${fmt(combined.total)} <small>kg</small>`, tone: "tonnage", icon: "⚖" },
    { label: "60+ Grade", value: pct(combined.p60), tone: "grade60", icon: "❧" },
    { label: "30+ Grade", value: pct(combined.p30), tone: "grade30", icon: "❧" },
    { label: "-30 Grade", value: pct(combined.p30m), tone: "grade30m", icon: "❧" },
    { label: "Overall Yield", value: `${fmt(combined.yield)} <small>t/acre</small>`, tone: "yield", icon: "▥" }
  ];
  const kpis = cards.map(c => `<article class="kpi ${c.tone}"><span class="kpi-icon">${c.icon}</span><div><div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div></div></article>`).join("");

  const chartCardStyle = "background:#fff;border:1px solid #e3eae4;border-radius:14px;padding:18px;min-width:0;box-shadow:0 3px 12px rgba(25,60,35,.05);display:flex;flex-direction:column";

  let yieldSvg = "";
  try {
    const sorted = [...faRows].filter(x => x && x.name).sort((a, b) => Number(b.yield || 0) - Number(a.yield || 0));
    if (sorted.length) {
      const w = 400, h = 240, left = 110, right = 45, top = 20, bottom = 32, plotW = w - left - right, plotH = h - top - bottom;
      const avg = Number(combined.yield || 0);
      const maxVal = Math.max(...sorted.map(x => Number(x.yield || 0)), avg, 1);
      const niceMax = Math.ceil(maxVal * 1.15) || 10;
      const barH = 14, spacing = plotH / (sorted.length || 1);
      
      const bars = sorted.map((fa, i) => {
        const y = top + i * spacing + (spacing - barH) / 2;
        const bw = (Number(fa.yield || 0) / niceMax) * plotW;
        return `<text x="${left - 8}" y="${y + 11}" text-anchor="end" font-size="11" font-weight="600" fill="#2d3748">${esc(fa.name)}</text>
        <rect x="${left}" y="${y}" width="${Math.max(bw, 2)}" height="${barH}" rx="3" fill="#187346"/>
        <text x="${left + bw + 6}" y="${y + 11}" font-size="11" font-weight="700" fill="#187346">${Number(fa.yield || 0).toFixed(2)}</text>`;
      }).join("");

      const xRef = left + (avg / niceMax) * plotW;
      const refLine = `<line x1="${xRef}" y1="${top - 4}" x2="${xRef}" y2="${h - bottom}" stroke="#bd5360" stroke-width="1.5" stroke-dasharray="3,3"/><text x="${xRef}" y="${top - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="#bd5360">Avg ${avg.toFixed(2)}</text>`;

      yieldSvg = `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="FA Yield Leaderboard" style="width:100%;min-width:300px;height:auto;display:block">
        <line x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}" stroke="#e8eee9" stroke-width="1"/>
        <line x1="${left}" y1="${h - bottom}" x2="${w - right}" y2="${h - bottom}" stroke="#e8eee9" stroke-width="1"/>
        ${bars}${refLine}
        <text x="${left}" y="${h - 10}" font-size="10" fill="#718076">0</text>
        <text x="${w - right}" y="${h - 10}" text-anchor="end" font-size="10" fill="#718076">${niceMax} t/a</text>
      </svg></div>`;
    }
  } catch (e) { yieldSvg = '<p style="color:#718076;padding:12px">No yield data available</p>'; }

  let qualitySvg = "";
  try {
    const locations = [...new Set(all.filter(x => x.type === 'fa' || x.type === 'subtotal').map(x => x.location).filter(x => x && x !== 'Combined'))];
    const regionList = locations.map(loc => {
      const sub = all.find(x => x.type === 'subtotal' && x.location === loc);
      if (sub) return { name: loc, p60: Number(sub.p60 || 0), p30: Number(sub.p30 || 0), p30m: Number(sub.p30m || 0) };
      const fas = all.filter(x => x.type === 'fa' && x.location === loc), tot = sum(fas, x => x.total);
      return { name: loc, p60: tot ? (sum(fas, x => x.g60) / tot) * 100 : 0, p30: tot ? (sum(fas, x => x.g30) / tot) * 100 : 0, p30m: tot ? (sum(fas, x => x.g30m) / tot) * 100 : 0 };
    });

    if (regionList.length) {
      const w = 320, h = 240, left = 40, right = 18, top = 28, bottom = 36, plotW = w - left - right, plotH = h - top - bottom;
      const barW = 50;
      const grid = [0, 25, 50, 75, 100].map(p => {
        const yy = top + plotH - (p / 100) * plotH;
        return `<line x1="${left}" y1="${yy}" x2="${w - right}" y2="${yy}" stroke="#e8eee9" stroke-width="1"/><text x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#718076">${p}%</text>`;
      }).join("");

      const bars = regionList.map((r, i) => {
        const cx = left + (i + 0.5) * (plotW / regionList.length) - barW / 2;
        const h60 = (r.p60 / 100) * plotH, h30 = (r.p30 / 100) * plotH, h30m = (r.p30m / 100) * plotH;
        const y60 = top + plotH - h60, y30 = y60 - h30, y30m = y30 - h30m;
        const lbl = (y, h, v) => h > 16 ? `<text x="${cx + barW / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${v.toFixed(1)}%</text>` : '';

        return `<rect x="${cx}" y="${y60}" width="${barW}" height="${h60}" fill="#1c7c4a"/>${lbl(y60, h60, r.p60)}
        <rect x="${cx}" y="${y30}" width="${barW}" height="${h30}" fill="#e3b341"/>${lbl(y30, h30, r.p30)}
        <rect x="${cx}" y="${y30m}" width="${barW}" height="${h30m}" fill="#bd5360"/>${lbl(y30m, h30m, r.p30m)}
        <text x="${cx + barW / 2}" y="${h - 12}" text-anchor="middle" font-size="12" font-weight="700" fill="#2d3748">${esc(r.name)}</text>`;
      }).join("");

      const leg = `<g transform="translate(${left}, 12)" font-size="10">
        <rect x="0" y="0" width="10" height="10" rx="2" fill="#1c7c4a"/><text x="14" y="9" fill="#555">60+</text>
        <rect x="55" y="0" width="10" height="10" rx="2" fill="#e3b341"/><text x="69" y="9" fill="#555">30+</text>
        <rect x="110" y="0" width="10" height="10" rx="2" fill="#bd5360"/><text x="124" y="9" fill="#555">-30</text>
      </g>`;

      qualitySvg = `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Regional Quality Mix" style="width:100%;min-width:260px;height:auto;display:block">${grid}${leg}${bars}</svg></div>`;
    }
  } catch (e) { qualitySvg = '<p style="color:#718076;padding:12px">No quality data available</p>'; }

  let trendSvg = "";
  try {
    const parseDate = s => {
      const t = String(s || "").trim();
      let m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
      let d = new Date(t);
      return isNaN(d) ? 0 : d.getTime();
    };
    const dayMap = new Map();
    F.forEach(x => {
      const key = String(x.date || "").trim();
      if (key) dayMap.set(key, (dayMap.get(key) || 0) + Number(x.qty?.total || 0));
    });
    const dayRows = [...dayMap.entries()].map(([date, value]) => ({ date, value, stamp: parseDate(date) })).sort((a, b) => a.stamp - b.stamp);

    if (dayRows.length) {
      const w = 400, h = 240, left = 50, right = 18, top = 20, bottom = 36, plotW = w - left - right, plotH = h - top - bottom;
      const maxVal = Math.max(...dayRows.map(x => x.value), 1);
      const niceMax = Math.ceil(maxVal / 1000) * 1000 || maxVal;
      const x = i => left + (dayRows.length === 1 ? plotW / 2 : i * plotW / (dayRows.length - 1));
      const y = v => top + plotH - (v / niceMax) * plotH;
      const pts = dayRows.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
      const area = `${x(0)},${top + plotH} ${pts} ${x(dayRows.length - 1)},${top + plotH}`;

      const grid = [0, 1, 2, 3].map(i => {
        const val = niceMax * i / 3, yy = y(val);
        return `<line x1="${left}" y1="${yy}" x2="${w - right}" y2="${yy}" stroke="#e8eee9" stroke-width="1"/><text x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#718076">${Math.round(val / 1000)}k</text>`;
      }).join("");

      const labels = dayRows.length === 1 ? [0] : [...new Set([0, Math.floor((dayRows.length - 1) / 2), dayRows.length - 1])];
      const xLabels = labels.map(i => `<text x="${x(i)}" y="${h - 12}" text-anchor="${i === 0 ? "start" : i === dayRows.length - 1 ? "end" : "middle"}" font-size="10" fill="#718076">${esc(dayRows[i].date)}</text>`).join("");
      const dots = dayRows.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.value)}" r="4" fill="#fff" stroke="#187346" stroke-width="2"><title>${esc(d.date)}: ${kg(d.value)}</title></circle>`).join("");

      trendSvg = `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily Purchase Trend" style="width:100%;min-width:300px;height:auto;display:block">${grid}<polygon points="${area}" fill="#3b9a65" opacity=".12"/><polyline points="${pts}" fill="none" stroke="#187346" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${xLabels}<text x="14" y="${top + plotH / 2}" transform="rotate(-90 14 ${top + plotH / 2})" text-anchor="middle" font-size="10" fill="#718076">Quantity (kg)</text></svg></div>`;
    }
  } catch (e) { trendSvg = '<p style="color:#718076;padding:12px">No purchase records available</p>'; }

  const groupHead = `<tr><th rowspan="2">Location</th><th rowspan="2">Field Assistant</th><th rowspan="2">Acres</th><th colspan="${visibleGrades.length + 1}">Quantity (kg)</th><th colspan="${visibleGrades.length}">Share of Total</th><th rowspan="2">Yield<br>(t/acre)</th></tr><tr>${visibleGrades.map(g => `<th class="grade-head ${g === '60+' ? 'g60' : g === '30+' ? 'g30' : g === '-30' ? 'gm30' : 'extra'}">${g}</th>`).join("")}<th class="total-head">Total</th>${visibleGrades.map(g => `<th class="grade-head ${g === '60+' ? 'g60' : g === '30+' ? 'g30' : g === '-30' ? 'gm30' : 'extra'}">${g} %</th>`).join("")}</tr>`;
  const locations = [...new Set(all.filter(x => x.type === 'fa' || x.type === 'subtotal').map(x => x.location).filter(x => x && x !== 'Combined'))];
  let body = '';
  
  for (const loc of locations) {
    const group = all.filter(x => x.location === loc && x.type !== 'combined');
    const regular = group.filter(x => x.type === 'fa'), subtotal = group.find(x => x.type === 'subtotal');
    const rows = [...regular, ...(subtotal ? [subtotal] : [])];
    rows.forEach((x, i) => {
      const isTotal = x.type === 'subtotal';
      let cells = '';
      if (i === 0) cells += `<td class="location-cell" rowspan="${rows.length}"><span class="pin">●</span>${esc(loc)}</td>`;
      cells += `<td class="fa-cell ${isTotal ? 'subtotal-name' : ''}">${isTotal ? 'Σ ' : ''}${esc(x.name)}</td><td>${fmt(x.acres)}</td>`;
      cells += visibleGrades.map(g => `<td class="qty-${g.replace(/[^a-z0-9]/gi, '').toLowerCase()}">${fmt(x[qtyKey[g]])}</td>`).join('');
      cells += `<td class="strong-col">${fmt(x.total)}</td>`;
      cells += visibleGrades.map(g => `<td>${pct(x[pctKey[g]])}</td>`).join('');
      cells += `<td class="yield-cell">${fmt(x.yield)}</td>`;
      body += `<tr class="${isTotal ? 'subtotal-row' : ''}">${cells}</tr>`;
    });
  }
  
  if (combined && combined.type === 'combined') {
    let cells = `<td class="combined-label" colspan="3">COMBINED TOTAL</td>`;
    cells += visibleGrades.map(g => `<td>${fmt(combined[qtyKey[g]])}</td>`).join('');
    cells += `<td>${fmt(combined.total)}</td>`;
    cells += visibleGrades.map(g => `<td>${pct(combined[pctKey[g]])}</td>`).join('');
    cells += `<td>${fmt(combined.yield)}</td>`;
    body += `<tr class="combined-row">${cells}</tr>`;
  }

  const month = S.month || "Current season";
  if ($("season-label")) $("season-label").textContent = month;

  $("dash-content").innerHTML = `<div class="kpi-grid">${kpis}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px;margin:20px 0">
   <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:15px;font-weight:700">FA Yield Leaderboard</h3><p style="margin:0 0 10px;color:#718076;font-size:11px">Tons harvested per acre vs. season average</p>${yieldSvg}</article>
   <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:15px;font-weight:700">Regional Quality Mix</h3><p style="margin:0 0 10px;color:#718076;font-size:11px">Grade percentage share: Chelur vs. Hoskere</p>${qualitySvg}</article>
   <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:15px;font-weight:700">Daily Purchase Trend</h3><p style="margin:0 0 10px;color:#718076;font-size:11px">Combined procurement volume across all dates</p>${trendSvg}</article>
  </div>
  <section class="report-card"><div class="report-heading"><div><div class="eyebrow">FIELD PERFORMANCE</div><h2>FA-wise tonnage summary</h2><p>Harvest grading and yield across Chelur and Hoskere</p></div><div class="live-tag"><i></i> Live spreadsheet data</div></div>
  <div class="table-shell"><table class="summary-table"><thead>${groupHead}</thead><tbody>${body}</tbody></table></div>
  <div class="report-foot"><span>Source: FA Wise Summary · ${esc(month)}</span><span>A1 and B2 appear automatically when quantities are recorded.</span></div>
  <button class="btn print-btn" onclick="print()">Print / Save PDF</button></section>`;
}

document.querySelectorAll("[data-v]").forEach(b => b.onclick = () => {
  document.querySelectorAll("[data-v]").forEach(x => x.classList.toggle("active", x === b));
  ["dashboard", "fruit", "crop"].forEach(id => $(id)?.classList.toggle("hidden", b.dataset.v !== id));
  window.scrollTo({ top: 0, behavior: "smooth" });
});

if ($("ffa")) $("ffa").onchange = () => { farmers(); fruit(); };
if ($("ffarmer")) $("ffarmer").onchange = fruit;
if ($("fsearch")) $("fsearch").oninput = fruit;
if ($("carea")) $("carea").onchange = () => { populateCropFAs(); crop(); };
if ($("cfa")) $("cfa").onchange = crop;
if ($("csearch")) $("csearch").oninput = crop;

start();
