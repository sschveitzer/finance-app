// app.js FINAL COMPLETO

// ====================== CONFIGURAÇÃO SUPABASE ======================
const dbUrl = "https://xkflckzrjnyadobgeerh.supabase.co"; // substitua pelo seu
const dbKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZmxja3pyam55YWRvYmdlZXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NjQ2NzksImV4cCI6MjA3MjA0MDY3OX0.Me2Ch8t2w1id4VRRncRoCA2PH_OTFHD_Iy7mBBS0SNg"; // substitua pelo seu
const db = window.db.createClient(supabaseUrl, supabaseKey);

// ====================== ESTADO GLOBAL ======================
let S = { month: nowYMD().slice(0,7), hide:false, dark:false, editingId:null, tx:[], cats:[] };
let modalTipo='Despesa';

// ====================== FUNÇÕES UTILITÁRIAS ======================
function gid(){return crypto.randomUUID();}
function nowYMD(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function fmtMoney(v){const n=Number(v);return isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'R$ 0,00';}
function parseMoney(str){if(!str) return 0;return parseFloat(String(str).replace(/[^0-9,-]/g,'').replace(',','.'))||0;}
function qs(s){return document.querySelector(s);}
function qsa(s){return Array.from(document.querySelectorAll(s));}
function monthOf(d){return d.slice(0,7);}
function shiftMonth(month,delta){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+delta);return d.toISOString().slice(0,7);}

// ====================== SUPABASE LOAD/SAVE ======================
async function loadAll(){
  const {data:tx} = await db.from("transactions").select("*");
  const {data:cats} = await db.from("categories").select("*");
  const {data:prefs} = await db.from("prefs").select("*");
  S.tx = tx||[]; S.cats = cats||[];
  if(prefs && prefs.length){ Object.assign(S, prefs[0]); }
}
async function saveTx(){
  await db.from("transactions").upsert(S.tx);
}
async function saveCats(){
  const cats = S.cats.map(c=>({nome:c.nome, cor:c.cor}));
  await db.from("categories").upsert(cats);
}
async function savePrefs(){
  await db.from("prefs").upsert([{id:'unique_pref', month:S.month, hide:S.hide, dark:S.dark}]);
}

// ====================== RENDER ======================
function render(){
  renderLancamentos();
  renderCategorias();
  renderRelatorios();
}
function renderLancamentos(){
  const ul=qs('#listaLanc'); ul.innerHTML='';
  const search=qs('#searchLanc').value.toLowerCase();
  const filter=qs('#filterTipo').value;
  S.tx.filter(t=>monthOf(t.data)==S.month)
      .filter(t=>(filter==='todos'||t.tipo===filter))
      .filter(t=>(!search||t.descricao.toLowerCase().includes(search)||t.categoria.toLowerCase().includes(search)))
      .sort((a,b)=>b.data.localeCompare(a.data))
      .forEach(t=>{
        const li=document.createElement('li');
        li.textContent=`${t.data} ${t.categoria} ${t.descricao} ${fmtMoney(t.valor)}`;
        li.onclick=()=>openEdit(t.id);
        ul.appendChild(li);
      });
}
function renderCategorias(){
  const ul=qs('#listaCats'); ul.innerHTML='';
  S.cats.forEach(c=>{
    const li=document.createElement('li');
    li.textContent=`${c.nome} (${c.cor})`;
    ul.appendChild(li);
  });
}
function renderRelatorios(){
  // pode adicionar Chart.js aqui se quiser gerar gráficos
  const tbody=qs('#tblTop tbody'); tbody.innerHTML='';
  let sums={};
  S.tx.filter(t=>monthOf(t.data)==S.month && t.tipo==='Despesa').forEach(t=>{
    sums[t.categoria]=(sums[t.categoria]||0)+Number(t.valor);
  });
  Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([cat,total])=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${cat}</td><td>${fmtMoney(total)}</td>`;
    tbody.appendChild(tr);
  });
}

// ====================== CRUD LANCAMENTOS ======================
function toggleModal(show){
  qs('#modalLanc').style.display=show?'block':'none';
  if(show){ qs('#mData').value=nowYMD(); modalTipo='Despesa'; syncTipoTabs(); }
}
function syncTipoTabs(){
  qsa('#tipoTabs button').forEach(b=> b.classList.toggle('active', b.dataset.type===modalTipo));
}
function openEdit(id){
  const t=S.tx.find(x=>x.id===id); if(!t) return;
  S.editingId=id;
  qs('#mData').value=t.data;
  qs('#mCategoria').value=t.categoria;
  qs('#mDesc').value=t.descricao;
  qs('#mValorBig').value=t.valor;
  qs('#mObs').value=t.obs;
  modalTipo=t.tipo;
  syncTipoTabs();
  toggleModal(true);
}
function addOrUpdate(){
  const tx={
    id:S.editingId||gid(),
    data:qs('#mData').value,
    categoria:qs('#mCategoria').value,
    descricao:qs('#mDesc').value,
    valor:parseMoney(qs('#mValorBig').value),
    obs:qs('#mObs').value,
    tipo:modalTipo
  };
  if(S.editingId){
    const idx=S.tx.findIndex(x=>x.id===S.editingId);
    S.tx[idx]=tx; S.editingId=null;
  } else {
    S.tx.push(tx);
  }
  saveTx(); render(); toggleModal(false);
}
async function delTx(id){
  if(!confirm('Excluir?')) return;
  await db.from("transactions").delete().eq('id',id);
  S.tx=S.tx.filter(x=>x.id!==id);
  render();
}

// ====================== EVENTOS ======================
window.addEventListener('DOMContentLoaded', async()=>{
  await loadAll(); render();

  qs('#btnAddLanc').onclick=()=>toggleModal(true);
  qs('#btnSaveLanc').onclick=()=>addOrUpdate();
  qs('#btnCancelLanc').onclick=()=>toggleModal(false);
  qsa('#tipoTabs button').forEach(b=> b.onclick=()=>{modalTipo=b.dataset.type; syncTipoTabs();});
  qs('#searchLanc').oninput=()=>renderLancamentos();
  qs('#filterTipo').onchange=()=>renderLancamentos();

  const btnCat=qs('#btnAddCat');
  if(btnCat){
    btnCat.onclick=()=>{
      const nome=prompt('Nome da nova categoria:');
      if(nome){
        S.cats.push({nome:nome, cor:'#3b82f6'});
        saveCats();
        render();
      }
    };
  }
});
