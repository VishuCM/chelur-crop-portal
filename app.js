function dashboard(){
 if(!S)return;
 const all=S.rows||[],combined=all.find(x=>x.type==="combined")||{},faRows=all.filter(x=>x.type==="fa");
 const fmt=x=>Number(x||0).toLocaleString("en-IN",{maximumFractionDigits:2});
 const pct=x=>`${Number(x||0).toFixed(2)}%`;
 const activeExtra=!!S.showA1B2;
 const visibleGrades=[...(activeExtra?["A1","B2"]:[]),"60+","30+","-30"];
 const qtyKey={"A1":"A1","B2":"B2","60+":"g60","30+":"g30","-30":"g30m"};
 const pctKey={"A1":"pA1","B2":"pB2","60+":"p60","30+":"p30","-30":"p30m"};

 // 1. KPI Cards
 const cards=[
  {label:"Total Area",value:`${fmt(combined.acres)} <small>Acres</small>`,tone:"area",icon:"▥"},
  {label:"Total Tonnage",value:`${fmt(combined.total)} <small>kg</small>`,tone:"tonnage",icon:"⚖"},
  {label:"60+ Grade",value:pct(combined.p60),tone:"grade60",icon:"❧"},
  {label:"30+ Grade",value:pct(combined.p30),tone:"grade30",icon:"❧"},
  {label:"-30 Grade",value:pct(combined.p30m),tone:"grade30m",icon:"❧"},
  {label:"Overall Yield",value:`${fmt(combined.yield)} <small>t/acre</small>`,tone:"yield",icon:"▥"}
 ];
 const kpis=cards.map(c=>`<article class="kpi ${c.tone}"><span class="kpi-icon">${c.icon}</span><div><div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div></div></article>`).join("");

 // Common Chart Styling
 const chartCardStyle="background:#fff;border:1px solid #e3eae4;border-radius:14px;padding:18px;min-width:0;box-shadow:0 3px 12px rgba(25,60,35,.05);display:flex;flex-direction:column";

 // 2. Visual 1: FA Yield Leaderboard (SVG)
 const yieldChart=(()=>{
  const sortedFAs=[...faRows].sort((a,b)=>Number(b.yield||0)-Number(a.yield||0));
  if(!sortedFAs.length)return '<p style="color:#718076">No FA data available.</p>';
  const w=420,h=260,left=110,right=45,top=24,bottom=35,plotW=w-left-right,plotH=h-top-bottom;
  const avgYield=Number(combined.yield||0);
  const maxY=Math.max(...sortedFAs.map(x=>Number(x.yield||0)),avgYield,1);
  const niceMax=Math.ceil(maxY*1.15)||10;
  const barH=14,spacing=plotH/sortedFAs.length;

  const bars=sortedFAs.map((fa,i)=>{
   const y=top+i*spacing+(spacing-barH)/2;
   const bw=(Number(fa.yield||0)/niceMax)*plotW;
   return `<text x="${left-8}" y="${y+11}" text-anchor="end" font-size="11" font-weight="600" fill="#2d3748">${esc(fa.name)}</text>
   <rect x="${left}" y="${y}" width="${Math.max(bw,2)}" height="${barH}" rx="3" fill="#187346"/>
   <text x="${left+bw+6}" y="${y+11}" font-size="11" font-weight="700" fill="#187346">${Number(fa.yield||0).toFixed(2)}</text>`;
  }).join("");

  const xRef=left+(avgYield/niceMax)*plotW;
  const refLine=`<line x1="${xRef}" y1="${top-6}" x2="${xRef}" y2="${h-bottom}" stroke="#bd5360" stroke-width="1.5" stroke-dasharray="3,3"/><text x="${xRef}" y="${top-10}" text-anchor="middle" font-size="10" font-weight="700" fill="#bd5360">Avg ${avgYield.toFixed(2)}</text>`;

  return `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="FA Yield Leaderboard" style="width:100%;min-width:320px;height:auto;display:block">
   <line x1="${left}" y1="${top-6}" x2="${left}" y2="${h-bottom}" stroke="#e8eee9" stroke-width="1"/>
   <line x1="${left}" y1="${h-bottom}" x2="${w-right}" y2="${h-bottom}" stroke="#e8eee9" stroke-width="1"/>
   ${bars}${refLine}
   <text x="${left}" y="${h-12}" font-size="10" fill="#718076">0</text>
   <text x="${w-right}" y="${h-12}" text-anchor="end" font-size="10" fill="#718076">${niceMax} t/a</text>
  </svg></div>`;
 })();

 // 3. Visual 2: Regional Quality Mix (100% Stacked Bar SVG)
 const qualityChart=(()=>{
  const locations=[...new Set(all.filter(x=>x.type==='fa'||x.type==='subtotal').map(x=>x.location).filter(x=>x&&x!=='Combined'))];
  const regionData=locations.map(loc=>{
   const sub=all.find(x=>x.type==='subtotal'&&x.location===loc);
   if(sub)return {name:loc,p60:Number(sub.p60||0),p30:Number(sub.p30||0),p30m:Number(sub.p30m||0)};
   const fas=all.filter(x=>x.type==='fa'&&x.location===loc),tot=sum(fas,x=>x.total);
   return {name:loc,p60:tot?(sum(fas,x=>x.g60)/tot)*100:0,p30:tot?(sum(fas,x=>x.g30)/tot)*100:0,p30m:tot?(sum(fas,x=>x.g30m)/tot)*100:0};
  });

  const w=340,h=260,left=42,right=18,top=32,bottom=42,plotW=w-left-right,plotH=h-top-bottom;
  const barW=58;

  const grid=[0,25,50,75,100].map(p=>{
   const yy=top+plotH-(p/100)*plotH;
   return `<line x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}" stroke="#e8eee9" stroke-width="1"/><text x="${left-6}" y="${yy+4}" text-anchor="end" font-size="10" fill="#718076">${p}%</text>`;
  }).join("");

  const bars=regionData.map((r,i)=>{
   const cx=left+(i+0.5)*(plotW/regionData.length)-barW/2;
   const h60=(r.p60/100)*plotH,h30=(r.p30/100)*plotH,h30m=(r.p30m/100)*plotH;
   const y60=top+plotH-h60,y30=y60-h30,y30m=y30-h30m;

   const txt=(y,h,val)=>h>16?`<text x="${cx+barW/2}" y="${y+h/2+4}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${val.toFixed(1)}%</text>`:'';

   return `<rect x="${cx}" y="${y60}" width="${barW}" height="${h60}" fill="#1c7c4a"/>${txt(y60,h60,r.p60)}
   <rect x="${cx}" y="${y30}" width="${barW}" height="${h30}" fill="#e3b341"/>${txt(y30,h30,r.p30)}
   <rect x="${cx}" y="${y30m}" width="${barW}" height="${h30m}" fill="#bd5360"/>${txt(y30m,h30m,r.p30m)}
   <text x="${cx+barW/2}" y="${h-15}" text-anchor="middle" font-size="12" font-weight="700" fill="#2d3748">${esc(r.name)}</text>`;
  }).join("");

  const legend=`<g transform="translate(${left}, 14)" font-size="10">
   <rect x="0" y="0" width="10" height="10" rx="2" fill="#1c7c4a"/><text x="14" y="9" fill="#555">60+</text>
   <rect x="60" y="0" width="10" height="10" rx="2" fill="#e3b341"/><text x="74" y="9" fill="#555">30+</text>
   <rect x="120" y="0" width="10" height="10" rx="2" fill="#bd5360"/><text x="134" y="9" fill="#555">-30</text>
  </g>`;

  return `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Regional Quality Mix" style="width:100%;min-width:280px;height:auto;display:block">${grid}${legend}${bars}</svg></div>`;
 })();

 // 4. Visual 3: Daily Purchase Trend across all purchases (SVG)
 const trendChart=(()=>{
  const dateValue=s=>{const t=String(s||"").trim();let m=t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);if(m)return new Date(+m[3],+m[2]-1,+m[1]).getTime();let d=new Date(t);return isNaN(d)?0:d.getTime()};
  const dayMap=new Map();
  F.forEach(x=>{const key=String(x.date||"");if(key)dayMap.set(key,(dayMap.get(key)||0)+Number(x.qty?.total||0));});
  const dayRows=[...dayMap.entries()].map(([date,value])=>({date,value,stamp:dateValue(date)})).sort((a,b)=>a.stamp-b.stamp);

  if(!dayRows.length)return '<p style="color:#718076">No daily purchase records available.</p>';
  const w=420,h=260,left=56,right=18,top=24,bottom=42,plotW=w-left-right,plotH=h-top-bottom;
  const max=Math.max(...dayRows.map(x=>x.value),1);
  const niceMax=Math.ceil(max/1000)*1000||max;
  const x=i=>left+(dayRows.length===1?plotW/2:i*plotW/(dayRows.length-1));
  const y=v=>top+plotH-(v/niceMax)*plotH;
  const pts=dayRows.map((d,i)=>`${x(i)},${y(d.value)}`).join(" ");
  const area=`${x(0)},${top+plotH} ${pts} ${x(dayRows.length-1)},${top+plotH}`;

  const grid=[0,1,2,3].map(i=>{
   const val=niceMax*i/3,yy=y(val);
   return `<line x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}" stroke="#e8eee9" stroke-width="1"/><text x="${left-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#718076">${Math.round(val/1000)}k</text>`;
  }).join("");

  const labels=dayRows.length===1?[0]:[...new Set([0,Math.floor((dayRows.length-1)/2),dayRows.length-1])];
  const xLabels=labels.map(i=>`<text x="${x(i)}" y="${h-15}" text-anchor="${i===0?"start":i===dayRows.length-1?"end":"middle"}" font-size="10" fill="#718076">${esc(dayRows[i].date)}</text>`).join("");
  const dots=dayRows.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d.value)}" r="4" fill="#fff" stroke="#187346" stroke-width="2"><title>${esc(d.date)}: ${kg(d.value)}</title></circle>`).join("");

  return `<div style="width:100%;overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily Purchase Trend" style="width:100%;min-width:320px;height:auto;display:block">${grid}<polygon points="${area}" fill="#3b9a65" opacity=".12"/><polyline points="${pts}" fill="none" stroke="#187346" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${xLabels}<text x="14" y="${top+plotH/2}" transform="rotate(-90 14 ${top+plotH/2})" text-anchor="middle" font-size="10" fill="#718076">Quantity (kg)</text></svg></div>`;
 })();

 // 5. Table Rows Assembly
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

 // 6. Inject Full Dashboard View
 $("dash-content").innerHTML=`<div class="kpi-grid">${kpis}</div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;margin:20px 0">
  <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:15px;font-weight:700">FA Yield Leaderboard</h3><p style="margin:0 0 10px;color:#718076;font-size:11px">Tons harvested per acre vs. season average</p>${yieldChart}</article>
  <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:15px;font-weight:700">Regional Quality Mix</h3><p style="margin:0 0 10px;color:#718076;font-size:11px">Grade percentage share: Chelur vs. Hoskere</p>${qualityChart}</article>
  <article style="${chartCardStyle}"><h3 style="margin:0 0 4px;color:#234b32;font-size:15px;font-weight:700">Daily Purchase Trend</h3><p style="margin:0 0 10px;color:#718076;font-size:11px">Combined procurement volume across all dates</p>${trendChart}</article>
 </div>
 <section class="report-card"><div class="report-heading"><div><div class="eyebrow">FIELD PERFORMANCE</div><h2>FA-wise tonnage summary</h2><p>Harvest grading and yield across Chelur and Hoskere</p></div><div class="live-tag"><i></i> Live spreadsheet data</div></div>
 <div class="table-shell"><table class="summary-table"><thead>${groupHead}</thead><tbody>${body}</tbody></table></div>
 <div class="report-foot"><span>Source: FA Wise Summary · ${esc(month)}</span><span>A1 and B2 appear automatically when quantities are recorded.</span></div>
 <button class="btn print-btn" onclick="print()">Print / Save PDF</button></section>`;
}
