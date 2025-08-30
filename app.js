// === APP.JS FINAL (Supabase apenas) ===

// Estado global
let S={month:nowYMD().slice(0,7), hide:false, dark:false, editingId:null, tx:[], cats:[]};
let modalTipo='Despesa';

// ======================= SUPABASE LOAD/SAVE =======================
async function loadAll(){
  try {
    let { data: tx }   = await supabase.from("transactions").select("*");
    let { data: cats } = await supabase.from("categories").select("*");
    let { data: prefs }= await supabase.from("prefs").select("*");

    S.tx   = (tx || []).map(normalizeTx).filter(Boolean);
    S.cats = cats || [];
    if(prefs && prefs.length){
      S.month = prefs[0].month || nowYMD().slice(0,7);
      S.hide  = prefs[0].hide || false;
      S.dark  = prefs[0].dark || false;
    }
  } catch (e) {
    console.error("Erro ao carregar do Supabase:", e);
    S.tx=[]; S.cats=[];
  }

  if(S.cats.length===0){
    S.cats=[
      {nome:'Alimentação',cor:'#60a5fa'},
      {nome:'Moradia',cor:'#f59e0b'},
      {nome:'Transporte',cor:'#34d399'},
      {nome:'Salário',cor:'#22c55e'}
    ];
    saveCats();
  }
}

async function saveTx(){
  await supabase.from("transactions").upsert(S.tx, { onConflict: "id" });
}
async function saveCats(){
  const cats = S.cats.map(c => ({ nome: c.nome, cor: c.cor }));
  await supabase.from("categories").upsert(cats);
}
async function savePrefs(){
  await supabase.from("prefs").upsert([{ 
    id: "unique_pref",
    month: S.month, hide: S.hide, dark: S.dark
  }]);
}

// ======================= HELPERS =======================
function gid(){return Math.random().toString(36).slice(2,9)}
function nowYMD(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function fmtMoney(v){const n=Number(v);return isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'R$ 0,00'}
function parseMoneyMasked(str){ if(str==null) return 0; if(typeof str==='number') return Math.round(str*100)/100; let s=String(str).trim(); if(!s) return 0; if(/[,]/.test(s)){ s=s.replace(/[^\d\.,]/g,''); if(s.indexOf(',')>-1){s=s.replace(/\./g,'').replace(',', '.');}} else {s=s.replace(/[^\d\.]/g,'');} const n=Number(s.replace(/\s+/g,'')); return isFinite(n)?Math.round(n*100)/100:0; }
function monthOf(d){ if(!d) return nowYMD().slice(0,7); const str = String(d); return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str.slice(0,7) : nowYMD().slice(0,7); }
function isIsoDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)}
function shiftMonth(m, delta){ let str = String(m || nowYMD().slice(0,7)); const [y,mo] = str.split('-').map(Number); if(!y || !mo) return nowYMD().slice(0,7); const date = new Date(y, (mo-1)+delta, 1); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,7); }

function normalizeTx(t){ if(!t) return null; const id = t.id || gid(); const tipo = (t.tipo==='Receita'||t.tipo==='Despesa'||t.tipo==='Transferência') ? t.tipo : 'Despesa'; const categoria = (t.categoria && String(t.categoria).trim()) ? String(t.categoria).trim() : ''; const data = isIsoDate(t.data) ? t.data : nowYMD(); const valor = (typeof t.valor==='number') ? t.valor : parseMoneyMasked(t.valor); const v = isFinite(valor) ? valor : 0; const descricao = (t.descricao!=null) ? String(t.descricao).trim() : ''; const obs=(t.obs!=null)?String(t.obs).trim():''; return {id,tipo,categoria,data,descricao,valor:v,obs}; }
function sumMonth(m){ let r=0,d=0; const target = String(m || nowYMD().slice(0,7)); S.tx.filter(t=>monthOf(t.data)===target).forEach(t=>{ const v = Number(t.valor); const val = isFinite(v) ? v : 0; if(t.tipo==='Receita') r+=val; if(t.tipo==='Despesa') d+=val; }); return {r,d, bal:r-d}; }
const qs=(s,p=document)=>p.querySelector(s), qsa=(s,p=document)=>[...p.querySelectorAll(s)];

// ======================= RENDER =======================

function setTab(name){
  qsa('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
  qsa('section').forEach(s=>s.classList.toggle('active', s.id===name));
}

function toggleModal(show,titleOverride){
  const m=qs('#modalLanc'); 
  m.style.display=show?'flex':'none'; 
  if(show){
    qs('#mData').value=nowYMD(); 
    rebuildCatSelect(); 
    qs('#mDesc').value=''; 
    qs('#mObs').value=''; 
    qs('#mValorBig').value=''; 
    modalTipo='Despesa'; 
    syncTipoTabs(); 
    qs('#modalTitle').textContent=titleOverride||'Nova Despesa'; 
    setTimeout(()=>qs('#mValorBig').focus(),0)
  } else {
    S.editingId=null
  }
}

function syncTipoTabs(){
  qsa('#tipoTabs button').forEach(b=>b.classList.toggle('active', b.dataset.type===modalTipo));
  if(!S.editingId){qs('#modalTitle').textContent='Nova '+modalTipo}
}

let lineChart=null,pieChart=null,fluxoChart=null;

function render(){
  qs('#toggleHide').checked=S.hide; 
  document.body.classList.toggle('dark', S.dark); 
  buildMonthSelect(); 
  const {r,d,bal}=sumMonth(S.month); 
  setMoney('#kpiReceitas',r); 
  setMoney('#kpiDespesas',d); 
  setMoney('#kpiSaldo',bal); 
  const prev=shiftMonth(S.month,-1); 
  const {r:pr,d:pd,bal:pbal}=sumMonth(prev); 
  setDelta('#kpiReceitasDelta',r,pr); 
  setDelta('#kpiDespesasDelta',d,pd); 
  setDelta('#kpiSaldoDelta',bal,pbal); 
  renderRecentes(); 
  renderLancamentos(); 
  renderCategorias(); 
  renderCharts(); 
  renderRelatorios();
}

function setMoney(sel,v){
  const el=qs(sel); 
  el.textContent=fmtMoney(isFinite(v)?v:0); 
  el.classList.toggle('blurred', S.hide)
}

function setDelta(sel,now,prev){
  const el=qs(sel); 
  const n=isFinite(now)?now:0, p=isFinite(prev)?prev:0; 
  const pct=(p===0)?100:((n-p)/Math.abs(p))*100; 
  const sign=pct>=0?'+':''; 
  el.textContent=sign+pct.toFixed(1)+'%';
}

function renderRecentes(){
  const ul=qs('#listaRecentes'); 
  const term=(qs('#searchLanc').value||'').toLowerCase(); 
  const tipo=qs('#filterTipo').value; 
  let list=[...S.tx].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,10); 
  if(tipo!=='todos') list=list.filter(x=>x.tipo===tipo); 
  if(term) list=list.filter(x=>(x.descricao||'').toLowerCase().includes(term)); 
  ul.innerHTML=''; 
  if(list.length===0){ul.innerHTML='<div class="muted">Sem lançamentos…</div>'; return;} 
  list.forEach(x=> ul.append(itemTx(x, true))) 
}

function itemTx(x, readOnly=false){
  const li=document.createElement('li'); 
  li.className='item'; 
  const base=Number(x.valor); 
  const v=(isFinite(base)?base:0)*(x.tipo==='Despesa'?-1:1); 
  const actions = readOnly ? '' : [ 
    '<button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>', 
    '<button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>' 
  ].join(''); 
  li.innerHTML = 
    '<div class="left">'+ 
      '<div class="tag">'+x.tipo+'</div>'+ 
      '<div>'+ 
        '<div><strong>'+(x.descricao||'-')+'</strong></div>'+ 
        '<div class="muted" style="font-size:12px">'+x.categoria+' • '+x.data+'</div>'+ 
      '</div>'+ 
    '</div>'+ 
    '<div style="display:flex;gap:6px;align-items:center">'+ 
      '<div class="'+(S.hide?'blurred':'')+'" style="font-weight:700">'+fmtMoney(v)+'</div>'+ 
      actions+ 
    '</div>'; 
  if(!readOnly){ 
    li.querySelector('.edit').onclick=()=>openEdit(x.id); 
    li.querySelector('.del').onclick=()=>delTx(x.id); 
  } 
  return li; 
}

function renderLancamentos(){
  const ul=qs('#listaLanc'); 
  const list=[...S.tx].sort((a,b)=>b.data.localeCompare(a.data)); 
  ul.innerHTML=''; 
  list.forEach(x=> ul.append(itemTx(x, false)))
}

function renderCategorias(){
  const ul=qs('#listaCats'); 
  ul.innerHTML=''; 
  S.cats.forEach(c=>{
    const li=document.createElement('li'); 
    li.className='item'; 
    li.innerHTML=
      '<div class="left">'+
        '<div class="tag" style="background:'+c.cor+';color:#fff">'+(c.nome||'?')+'</div>'+
        '<div><strong>'+c.nome+'</strong></div>'+
      '</div>'+
      '<div style="display:flex;gap:6px">'+
        '<button class="icon" title="Renomear"><i class="ph ph-pencil-simple"></i></button>'+
        '<button class="icon" title="Remover"><i class="ph ph-trash"></i></button>'+
      '</div>'; 
    const btns=li.querySelectorAll('button'); 
    btns[0].onclick=()=>{
      const nv=prompt('Novo nome da categoria', c.nome); 
      if(nv){c.nome=nv.trim(); saveCats(); render();}
    }; 
    btns[1].onclick=()=>{
      if(confirm('Remover categoria e manter lançamentos?')){
        S.cats=S.cats.filter(k=>k.id!==c.id); 
        saveCats(); render();
      }
    }; 
    ul.append(li); 
  })
}

function cleanNumberArray(a){return a.map(v=>{const n=Number(v); return isFinite(n)?n:0})}

function renderCharts(){
  const labels=[], vals=[];
  for(let i=11;i>=0;i--){
    const m=shiftMonth(S.month,-i);
    labels.push(m);
    const {bal}=sumMonth(m);
    vals.push(bal);
  }
  const ctx1=qs('#chartSaldo');
  if(lineChart) lineChart.destroy();
  lineChart=new Chart(ctx1,{
    type:'line', 
    data:{labels, datasets:[{data:cleanNumberArray(vals), tension:.35, fill:false}]}, 
    options:{
      responsive:true, 
      plugins:{legend:{display:false}}, 
      scales:{x:{grid:{display:false}}, y:{grid:{color:'rgba(148,163,184,.2)'}}}
    }
  });

  const month=S.month; 
  const byCat={};
  S.tx.filter(t=>t.tipo==='Despesa'&&monthOf(t.data)===month).forEach(t=>{
    const v=Number(t.valor);
    byCat[t.categoria]=(byCat[t.categoria]||0)+(isFinite(v)?v:0)
  });
  const labels2=Object.keys(byCat);
  const vals2=cleanNumberArray(Object.values(byCat));
  const ctx2=qs('#chartPie');
  if(pieChart) pieChart.destroy();
  pieChart=new Chart(ctx2,{
    type:'doughnut', 
    data:{labels:labels2, datasets:[{data:vals2}]}, 
    options:{plugins:{legend:{position:'bottom'}}}
  })
}
// ======================= RELATÓRIOS & EDIÇÃO =======================

function renderRelatorios(){
  const labels=[], r=[], d=[];
  for (let i=11; i>=0; i--) {
    const m = shiftMonth(S.month, -i);
    labels.push(m);
    const s = sumMonth(m);
    r.push(s.r);
    d.push(s.d);
  }

  const ctx = qs('#chartFluxo');
  if (fluxoChart) fluxoChart.destroy();
  fluxoChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Receitas', data: cleanNumberArray(r) },
        { label: 'Despesas', data: cleanNumberArray(d) }
      ]
    },
    options: {
      responsive: true,
      scales: { x: { grid: { display: false } } }
    }
  });

  const agg = {};
  S.tx.filter(t => t.tipo === 'Despesa').forEach(t => {
    const key = monthOf(t.data);
    if (shiftMonth(S.month, -11) <= key && key <= S.month) {
      const v = Number(t.valor);
      agg[t.categoria] = (agg[t.categoria] || 0) + (isFinite(v) ? v : 0);
    }
  });

  const tbody = qs('#tblTop tbody');
  tbody.innerHTML = '';
  Object.entries(agg)
    .sort((a,b)=> b[1]-a[1])
    .slice(0,8)
    .forEach(([k,v]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>'+k+'</td><td>'+fmtMoney(v)+'</td>';
      tbody.append(tr);
    });
}

function buildMonthSelect(){
  const sel=qs('#monthSelect'); 
  sel.innerHTML=''; 
  const monthsSet=new Set(S.tx.map(t=>monthOf(t.data)).filter(Boolean)); 
  let months=Array.from(monthsSet); 
  if(months.length===0){months=[nowYMD().slice(0,7)]} 
  months.sort((a,b)=>b.localeCompare(a)); 
  months.forEach(m=>{
    const opt=document.createElement('option'); 
    opt.value=m; 
    opt.textContent=m; 
    sel.append(opt)
  }); 
  if(!monthsSet.has(S.month)){S.month=months[0]} 
  sel.value=S.month
}

function openEdit(id){
  const x=S.tx.find(t=>t.id===id); 
  if(!x) return; 
  S.editingId=id; 
  modalTipo=x.tipo; 
  syncTipoTabs(); 
  rebuildCatSelect(x.categoria); 
  qs('#mData').value=isIsoDate(x.data)?x.data:nowYMD(); 
  qs('#mDesc').value=x.descricao||''; 
  qs('#mValorBig').value=fmtMoney(Number(x.valor)||0); 
  qs('#mObs').value=x.obs||''; 
  qs('#modalTitle').textContent='Editar lançamento'; 
  qs('#modalLanc').style.display='flex'; 
  setTimeout(()=>qs('#mValorBig').focus(),0)
}

function addOrUpdate(){
  const valor=parseMoneyMasked(qs('#mValorBig').value); 
  const t={
    id:S.editingId||gid(), 
    tipo:modalTipo, 
    categoria:qs('#mCategoria').value, 
    data:isIsoDate(qs('#mData').value)?qs('#mData').value:nowYMD(), 
    descricao:(qs('#mDesc').value||'').trim(), 
    valor:isFinite(valor)?valor:0, 
    obs:(qs('#mObs').value||'').trim()
  }; 
  if(!t.categoria){alert('Selecione categoria'); return} 
  if(!t.descricao){alert('Descrição obrigatória'); return} 
  if(!(t.valor>0)){alert('Informe o valor'); return} 
  if(S.editingId){
    const i=S.tx.findIndex(x=>x.id===S.editingId); 
    if(i>=0) S.tx[i]=t
  }else{
    S.tx.push(t)
  } 
  saveTx(); 
  toggleModal(false); 
  render()
}

async function delTx(id){ 
  if(confirm("Excluir lançamento?")){
    await supabase.from("transactions").delete().eq("id", id); 
    S.tx = S.tx.filter(x => x.id !== id); 
    render(); 
  } 
}

function rebuildCatSelect(selected){
  const sel=qs('#mCategoria'); 
  sel.innerHTML='<option value="">Selecione…</option>'; 
  S.cats.forEach(c=>{
    const o=document.createElement('option'); 
    o.value=c.nome; 
    o.textContent=c.nome; 
    if(c.nome===selected) o.selected=true; 
    sel.append(o)
  })
}

// ======================= EVENTOS =======================

window.addEventListener('DOMContentLoaded', async()=>{
  await loadAll(); 
  render();

  qs('#monthSelect').onchange=()=>{S.month=qs('#monthSelect').value; savePrefs(); render()};
  qs('#toggleHide').onchange=()=>{S.hide=qs('#toggleHide').checked; savePrefs(); render()};
  qs('#btnDark').onclick=()=>{S.dark=!S.dark; savePrefs(); render()};
  qs('#btnAddLanc').onclick=()=>toggleModal(true);
  qs('#btnSaveLanc').onclick=()=>addOrUpdate();
  qs('#btnCancelLanc').onclick=()=>toggleModal(false);
  qsa('#tipoTabs button').forEach(b=> b.onclick=()=>{modalTipo=b.dataset.type; syncTipoTabs()});
  qs('#searchLanc').oninput=()=>renderRecentes();
  qs('#filterTipo').onchange=()=>renderRecentes();

  const btnCat = qs('#btnAddCat');
  if(btnCat){
    btnCat.onclick=()=>{
      const nome=prompt('Nome da nova categoria:');
      if(nome){ S.cats.push({nome:nome, cor:'#3b82f6'}); saveCats(); render();}
    };
  }
});
