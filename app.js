const API="https://script.google.com/macros/s/AKfycbw2zzARX3MqaXdP6WMTQRLamlyRpC6moKKTXijdXfwOml-TCp-xEnHO7qdhwm65ARmx/exec";let F=[],C=[],S=null;const $=x=>document.getElementById(x),money=x=>"₹"+Number(x||0).toLocaleString("en-IN",{maximumFractionDigits:2}),kg=x=>Number(x||0).toLocaleString("en-IN")+" kg",esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));function sum(a,f){return a.reduce((s,x)=>s+Number(f(x)||0),0)}
function api(action){return new Promise((ok,no)=>{if(!API.startsWith("https://"))return no(Error("Add your Apps Script /exec URL in app.js"));let cb="cb"+Date.now()+Math.random().toString(36).slice(2),s=document.createElement("script"),t=setTimeout(()=>{delete window[cb];s.remove();no(Error("Data service timed out"))},20000);window[cb]=x=>{clearTimeout(t);delete window[cb];s.remove();ok(x)};s.onerror=()=>{clearTimeout(t);delete window[cb];no(Error("Cannot reach spreadsheet service"))};s.src=API+"?action="+action+"&callback="+cb;document.body.append(s)})}
async function start(){try{$("status").textContent="Loading latest sheet data…";let [f,c,s]=await Promise.all([api("fruit"),api("crop"),api("summary")]);if(!f.ok||!c.ok||!s.ok)throw Error(f.error||c.error||s.error);F=f.data.rows;C=c.data.rows;S=s.data;
const canonicalFA=name=>{const n=String(name||"").trim().toUpperCase().replace(/\s+/g," ");if(n==="LAVAKUMAR")return "LAVAKUMAR T S";if(n==="LOKESH")return "LOKESH R N";return String(name||"").trim()};
F.forEach(x=>x.fa=canonicalFA(x.fa));C.forEach(x=>x.fa=canonicalFA(x.fa));let fas=[...new Set(F.map(x=>x.fa).concat(C.map(x=>x.fa)).filter(Boolean))].sort();$("ffa").innerHTML='<option value="">All Field Assistants</option>'+fas.map(x=>`<option>${esc(x)}</option>`).join("");populateCropFAs();farmers();fruit();crop();dashboard();$("status").textContent="Data loaded · refresh to check for new entries"}catch(e){$("status").textContent=e.message;$("fout").textContent=e.message}}
function farmers(){let a=F.filter(x=>!$("ffa").value||x.fa===$("ffa").value),u=[...new Map(a.map(x=>[x.code,x])).values()];u.sort((a,b)=>{let an=Number(a.code),bn=Number(b.code);if(Number.isFinite(an)&&Number.isFinite(bn)&&an!==bn)return an-bn;return String(a.code).localeCompare(String(b.code),undefined,{numeric:true,sensitivity:"base"})});$("ffarmer").innerHTML='<option value="">All Farmers</option>'+u.map(x=>`<option value="${esc(x.code)}">${esc(x.code)} · ${esc(x.farmer)}</option>`).join("")}
function fruit(){
 let fa=$("ffa").value,code=$("fsearch").value.trim()||$("ffarmer").value;
 let rows=F.filter(x=>(!fa||x.fa===fa)&&(!code||String(x.code)===String(code)));
 const dateValue=s=>{const t=String(s||"").trim();let m=t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);if(m)return new Date(+m[3],+m[2]-1,+m[1]).getTime();let d=new Date(t);return isNaN(d)?0:d.getTime()};rows.sort((a,b)=>dateValue(a.date)-dateValue(b.date));
 if(!rows.length){$("fout").innerHTML='<div class="fruit-empty">No purchase records found. Try another Field Assistant or farmer account number.</div>';return}
 let people=[...new Map(rows.map(x=>[x.code,x])).values()];
 const grades=["A1","B2","C3","D4","E5"];
 let faOverview="";
 if(fa&&!code){
  let faQty=sum(rows,x=>x.qty.total),faAmount=sum(rows,x=>x.amount.total),faReceipts=rows.length,faAvg=faQty?faAmount/faQty:0;
  let faGradeQty={},faGradeAmount={};grades.forEach(g=>{faGradeQty[g]=sum(rows,x=>x.qty[g]);faGradeAmount[g]=sum(rows,x=>x.amount[g])});
  let faGradeCards=grades.map(g=>`<article class="grade-card"><div class="grade-card-head">${g}</div><div class="grade-card-body"><span>${kg(faGradeQty[g])}<small>QUANTITY</small></span><span>${money(faGradeAmount[g])}<small>AMOUNT</small></span></div></article>`).join("");
  faOverview=`<section class="fa-performance">
   <div class="fa-performance-head"><div><div class="eyebrow">FIELD ASSISTANT PERFORMANCE</div><h2>${esc(fa)}</h2><p>${esc(rows[0]?.fa||fa)} · ${people.length} farmers in current-season purchase records</p></div><span class="live-tag"><i></i>Live purchase data</span></div>
   <div class="fruit-kpis">
    <div class="fruit-kpi"><span class="fruit-kpi-icon">♟</span><div><small>Farmers</small><strong>${people.length}</strong></div></div>
    <div class="fruit-kpi"><span class="fruit-kpi-icon">⚖</span><div><small>Total Quantity</small><strong>${kg(faQty)}</strong></div></div>
    <div class="fruit-kpi"><span class="fruit-kpi-icon">▤</span><div><small>Total Earnings</small><strong>${money(faAmount)}</strong></div></div>
    <div class="fruit-kpi"><span class="fruit-kpi-icon">◇</span><div><small>Average Price/kg</small><strong>${money(faAvg)}</strong></div></div>
   </div>
   <div class="fruit-subhead"><h3>FA Grade-wise Performance</h3><p>${faReceipts} purchase receipts across ${people.length} farmers</p></div>
   <div class="grade-cards">${faGradeCards}</div>
   <div class="farmer-list-heading"><h3>Farmers under ${esc(fa)}</h3><p>Individual purchase statements appear below</p></div>
  </section>`;
 }
 $("fout").innerHTML=faOverview+people.map(p=>{
  let r=rows.filter(x=>String(x.code)===String(p.code)),q={},v={};
  grades.forEach(g=>{q[g]=sum(r,x=>x.qty[g]);v[g]=sum(r,x=>x.amount[g])});
  let tq=sum(r,x=>x.qty.total),tv=sum(r,x=>x.amount.total),avg=tq?tv/tq:0;
  let gradeCards=grades.map(g=>`<article class="grade-card"><div class="grade-card-head">${g}</div><div class="grade-card-body"><span>${kg(q[g])}<small>QUANTITY</small></span><span>${money(v[g])}<small>AMOUNT</small></span></div></article>`).join("");
  let historyRows=r.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.buyingSheet)}</td><td>${esc(x.receipt)}</td>${grades.map(g=>`<td>${Number(x.qty[g]||0).toLocaleString("en-IN")}</td>`).join("")}<td class="sum-qty">${Number(x.qty.total||0).toLocaleString("en-IN")}</td>${grades.map(g=>`<td>${money(x.amount[g])}</td>`).join("")}<td class="money-total">${money(x.amount.total)}</td><td>${money(x.avg)}</td></tr>`).join("");
  let totalCells=grades.map(g=>`<td>${q[g].toLocaleString("en-IN")}</td>`).join("")+`<td>${tq.toLocaleString("en-IN")}</td>`+grades.map(g=>`<td>${money(v[g])}</td>`).join("")+`<td>${money(tv)}</td><td>${money(avg)}</td>`;
  return `<article class="farmer-statement">
   <div class="farmer-identity"><span class="farmer-avatar">♟</span><div class="farmer-name">${esc(p.farmer)} · ${esc(p.code)}</div><div class="farmer-meta">● &nbsp; Village: <b>${esc(p.village||"—")}</b></div><div class="farmer-meta">♟ &nbsp; Assigned FA: <b>${esc(p.fa||"—")}</b></div></div>
   <div class="fruit-kpis">
    <div class="fruit-kpi"><span class="fruit-kpi-icon">⚖</span><div><small>Total Quantity</small><strong>${kg(tq)}</strong></div></div>
    <div class="fruit-kpi"><span class="fruit-kpi-icon">▤</span><div><small>Total Earnings</small><strong>${money(tv)}</strong></div></div>
    <div class="fruit-kpi"><span class="fruit-kpi-icon">▣</span><div><small>Receipts</small><strong>${r.length}</strong></div></div>
    <div class="fruit-kpi"><span class="fruit-kpi-icon">◇</span><div><small>Average Price/kg</small><strong>${money(avg)}</strong></div></div>
   </div>
   <div class="fruit-subhead"><h3>Grade-wise Summary</h3><p>Quantity received and amount earned by grade</p></div>
   <div class="grade-cards">${gradeCards}</div>
   <section class="purchase-card"><div class="purchase-card-heading"><div><h3>Purchase History</h3><p>Receipt-wise grade quantities, earnings and average price for the selected farmer.</p></div><span class="live-tag"><i></i>${r.length} receipts</span></div>
    <div class="history-wrap"><table class="history-table"><thead><tr><th>Date</th><th>Buying<br>sheet</th><th>Receipt</th>${grades.map(g=>`<th>${g} kg</th>`).join("")}<th>Total kg</th>${grades.map(g=>`<th>${g} ₹</th>`).join("")}<th>Total ₹</th><th>Avg ₹/kg</th></tr></thead><tbody>${historyRows}</tbody><tfoot><tr><td colspan="3">TOTAL</td>${totalCells}</tr></tfoot></table></div>
    <button class="fruit-print" onclick="print()">Print / Save PDF</button>
   </section>
  </article>`;
 }).join("");
}

const FA_AREA={
 "LAVAKUMAR T S":"CHELUR",
 "MANJAPPA":"CHELUR",
 "UMESH S":"CHELUR",
 "LOKESH R N":"CHELUR",
 "SHANTHAPPA":"HOSKERE",
 "ASHOK N G":"HOSKERE",
 "ULLAS K S":"HOSKERE"
};
function populateCropFAs(){
 const area=$("carea").value, current=$("cfa").value;
 const names=[...new Set(C.map(x=>x.fa).filter(n=>n&&(!area||FA_AREA[n]===area)))].sort((a,b)=>a.localeCompare(b));
 $("cfa").innerHTML='<option value="">All Field Assistants</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
 if(names.includes(current))$("cfa").value=current;
}
function crop(){let area=$("carea").value,fa=$("cfa").value,q=$("csearch").value.toLowerCase(),r=C.filter(x=>(!area||FA_AREA[x.fa]===area)&&(!fa||x.fa===fa)&&(!q||String(x.code).toLowerCase().includes(q)||String(x.farmer).toLowerCase().includes(q)));if(!r.length){$("cout").innerHTML='<div class="panel">No crop records found.</div>';return}let acres=sum(r,x=>x.acres),qtyv=sum(r,x=>x.quantity),val=sum(r,x=>x.cropValue),cost=sum(r,x=>x.inputCost),bal=sum(r,x=>x.closingBalance);$("cout").innerHTML=`<div class="panel"><div class="grid"><div class="metric"><small>Farmers</small><b>${r.length}</b></div><div class="metric"><small>Total acres</small><b>${acres.toFixed(2)}</b></div><div class="metric"><small>Quantity received</small><b>${kg(qtyv)}</b></div><div class="metric"><small>Crop value</small><b>${money(val)}</b></div></div><div class="tablewrap"><table><tr><th>FA</th><th>Code</th><th>Farmer</th><th>Father</th><th>Village</th><th>DOS</th><th>Acres</th><th>DOFH</th><th>DOLH</th><th>THD</th><th>Qty</th><th>Crop value</th><th>Input cost</th><th>Closing balance</th></tr>${r.map(x=>`<tr><td>${esc(x.fa)}</td><td>${esc(x.code)}</td><td>${esc(x.farmer)}</td><td>${esc(x.father)}</td><td>${esc(x.village)}</td><td>${esc(x.dos)}</td><td>${x.acres}</td><td>${esc(x.dofh)}</td><td>${esc(x.dolh)}</td><td>${x.thd}</td><td>${x.quantity}</td><td>${money(x.cropValue)}</td><td>${money(x.inputCost)}</td><td>${money(x.closingBalance)}</td></tr>`).join("")}<tr class="total"><td colspan="6">TOTAL</td><td>${acres.toFixed(2)}</td><td colspan="3"></td><td>${qtyv}</td><td>${money(val)}</td><td>${money(cost)}</td><td>${money(bal)}</td></tr></table></div><button class="btn" onclick="print()">Print / Save PDF</button></div>`}

function dashboard(){
 if(!S)return;
 const all=S.rows||[],combined=all.find(x=>x.type==="combined")||{},faRows=all.filter(x=>x.type==="fa");
 const fmt=x=>Number(x||0).toLocaleString("en-IN",{maximumFractionDigits:2});
 const pct=x=>`${Number(x||0).toFixed(2)}%`;
 const activeExtra=!!S.showA1B2;
 const visibleGrades=[...(activeExtra?["A1","B2"]:[]),"60+","30+","-30"];
 const qtyKey={"A1":"A1","B2":"B2","60+":"g60","30+":"g30","-30":"g30m"};
 const pctKey={"A1":"pA1","B2":"pB2","60+":"p60","30+":"p30","-30":"p30m"};
 const cards=[
  {label:"Total Area",value:`${fmt(combined.acres)} <small>Acres</small>`,tone:"area",icon:"▥"},
  {label:"Total Tonnage",value:`${fmt(combined.total)} <small>kg</small>`,tone:"tonnage",icon:"⚖"},
  {label:"60+ Grade",value:pct(combined.p60),tone:"grade60",icon:"❧"},
  {label:"30+ Grade",value:pct(combined.p30),tone:"grade30",icon:"❧"},
  {label:"-30 Grade",value:pct(combined.p30m),tone:"grade30m",icon:"❧"},
  {label:"Overall Yield",value:`${fmt(combined.yield)} <small>t/acre</small>`,tone:"yield",icon:"▥"}
 ];
 const kpis=cards.map(c=>`<article class="kpi ${c.tone}"><span class="kpi-icon">${c.icon}</span><div><div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div></div></article>`).join("");
 const groupHead=`<tr><th rowspan="2">Location</th><th rowspan="2">Field Assistant</th><th rowspan="2">Acres</th><th colspan="${visibleGrades.length+1}">Quantity (kg)</th><th colspan="${visibleGrades.length}">Share of Total</th><th rowspan="2">Yield<br>(t/acre)</th></tr><tr>${visibleGrades.map(g=>`<th class="grade-head ${g==='60+'?'g60':g==='30+'?'g30':g==='-30'?'gm30':'extra'}">${g}</th>`).join("")}<th class="total-head">Total</th>${visibleGrades.map(g=>`<th class="grade-head ${g==='60+'?'g60':g==='30+'?'g30':g==='-30'?'gm30':'extra'}">${g} %</th>`).join("")}</tr>`;
 const locations=[...new Set(all.filter(x=>x.type==='fa'||x.type==='subtotal').map(x=>x.location).filter(x=>x&&x!=='Combined'))];
 let body='';
 for(const loc of locations){
   const group=all.filter(x=>x.location===loc && x.type!=='combined');
   const regular=group.filter(x=>x.type==='fa'),subtotal=group.find(x=>x.type==='subtotal');
   const rows=[...regular,...(subtotal?[subtotal]:[])];
   rows.forEach((x,i)=>{
    const isTotal=x.type==='subtotal';
    let cells='';
    if(i===0)cells+=`<td class="location-cell" rowspan="${rows.length}"><span class="pin">●</span>${esc(loc)}</td>`;
    cells+=`<td class="fa-cell ${isTotal?'subtotal-name':''}">${isTotal?'Σ ':''}${esc(x.name)}</td><td>${fmt(x.acres)}</td>`;
    cells+=visibleGrades.map(g=>`<td class="qty-${g.replace(/[^a-z0-9]/gi,'').toLowerCase()}">${fmt(x[qtyKey[g]])}</td>`).join('');
    cells+=`<td class="strong-col">${fmt(x.total)}</td>`;
    cells+=visibleGrades.map(g=>`<td>${pct(x[pctKey[g]])}</td>`).join('');
    cells+=`<td class="yield-cell">${fmt(x.yield)}</td>`;
    body+=`<tr class="${isTotal?'subtotal-row':''}">${cells}</tr>`;
   });
 }
 if(combined && combined.type==='combined'){
  let cells=`<td class="combined-label" colspan="3">COMBINED TOTAL</td>`;
  cells+=visibleGrades.map(g=>`<td>${fmt(combined[qtyKey[g]])}</td>`).join('');
  cells+=`<td>${fmt(combined.total)}</td>`;
  cells+=visibleGrades.map(g=>`<td>${pct(combined[pctKey[g]])}</td>`).join('');
  cells+=`<td>${fmt(combined.yield)}</td>`;
  body+=`<tr class="combined-row">${cells}</tr>`;
 }
 const month=S.month||"Current season";
 $("season-label").textContent=month;
 $("dash-content").innerHTML=`<div class="kpi-grid">${kpis}</div>
 <section class="report-card"><div class="report-heading"><div><div class="eyebrow">FIELD PERFORMANCE</div><h2>FA-wise tonnage summary</h2><p>Harvest grading and yield across Chelur and Hoskere</p></div><div class="live-tag"><i></i> Live spreadsheet data</div></div>
 <div class="table-shell"><table class="summary-table"><thead>${groupHead}</thead><tbody>${body}</tbody></table></div>
 <div class="report-foot"><span>Source: FA Wise Summary · ${esc(month)}</span><span>A1 and B2 appear automatically when quantities are recorded.</span></div>
 <button class="btn print-btn" onclick="print()">Print / Save PDF</button></section>`;
}
document.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-v]").forEach(x=>x.classList.toggle("active",x===b));["dashboard","fruit","crop"].forEach(id=>$(id).classList.toggle("hidden",b.dataset.v!==id));window.scrollTo({top:0,behavior:"smooth"})});$("ffa").onchange=()=>{farmers();fruit()};$("ffarmer").onchange=fruit;$("fsearch").oninput=fruit;$("carea").onchange=()=>{populateCropFAs();crop()};$("cfa").onchange=crop;$("csearch").oninput=crop;start();
