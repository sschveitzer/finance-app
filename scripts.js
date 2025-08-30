// Inicializar o cliente Supabase
const supabase = createClient('https://ppoufxezqmbxzflijmpx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY');

let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };

// Função para carregar todos os dados do Supabase
async function loadAll() {
  // Carregar transações do Supabase
  const { data: tx, error: txError } = await supabase.from('transactions').select('*');
  if (txError) {
    console.error('Erro ao carregar transações:', txError);
    S.tx = [];
  } else {
    S.tx = tx.map(normalizeTx).filter(Boolean);
  }

  // Carregar categorias do Supabase
  const { data: cats, error: catsError } = await supabase.from('categories').select('*');
  if (catsError) {
    console.error('Erro ao carregar categorias:', catsError);
    S.cats = [];
  } else {
    S.cats = cats;
  }

  // Carregar preferências do Supabase
  const { data: prefs, error: prefsError } = await supabase.from('preferences').select('*').single();
  if (prefsError) {
    console.error('Erro ao carregar preferências:', prefsError);
    S.month = nowYMD().slice(0, 7);
    S.hide = false;
    S.dark = false;
  } else {
    S.month = prefs.month;
    S.hide = prefs.hide;
    S.dark = prefs.dark;
  }

  // Carregar categorias padrão, se necessário
  if (S.cats.length === 0) {
    S.cats = [{ id: gid(), nome: 'Alimentação', cor: '#60a5fa' }, { id: gid(), nome: 'Moradia', cor: '#f59e0b' }];
    saveCatsToSupabase(); // Salvar as categorias padrão no Supabase
  }

  render();
}

// Função para gerar um ID único
function gid() { return Math.random().toString(36).slice(2, 9); }

// Função para carregar a data atual no formato YMD
function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

// Normaliza as transações para garantir que o formato esteja correto
function normalizeTx(t) {
  if (!t) return null;
  const id = t.id || gid();
  const tipo = (t.tipo === 'Receita' || t.tipo === 'Despesa' || t.tipo === 'Transferência') ? t.tipo : 'Despesa';
  const categoria = (t.categoria && String(t.categoria).trim()) ? String(t.categoria).trim() : '';
  const data = isIsoDate(t.data) ? t.data : nowYMD();
  const valor = (typeof t.valor === 'number') ? t.valor : parseMoneyMasked(t.valor);
  const v = isFinite(valor) ? valor : 0;
  const desc = (t.desc != null) ? String(t.desc).trim() : '';
  return categoria ? { id, tipo, categoria, data, desc, valor: v, obs: t.obs ? String(t.obs) : '' } : null;
}

// Função para verificar se a data é no formato ISO
function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

// Função para salvar transações no Supabase
async function saveTxToSupabase() {
  const { data, error } = await supabase.from('transactions').upsert(S.tx);
  if (error) {
    console.error('Erro ao salvar transações:', error);
  } else {
    console.log('Transações salvas com sucesso:', data);
  }
}

// Função para salvar categorias no Supabase
async function saveCatsToSupabase() {
  const { data, error } = await supabase.from('categories').upsert(S.cats);
  if (error) {
    console.error('Erro ao salvar categorias:', error);
  } else {
    console.log('Categorias salvas com sucesso:', data);
  }
}

// Função para salvar preferências no Supabase
async function savePrefsToSupabase() {
  const { data, error } = await supabase.from('preferences').upsert([{ month: S.month, hide: S.hide, dark: S.dark }]);
  if (error) {
    console.error('Erro ao salvar preferências:', error);
  } else {
    console.log('Preferências salvas com sucesso:', data);
  }
}

// Exemplo de chamadas de salvamento
saveTxToSupabase();
saveCatsToSupabase();
savePrefsToSupabase();

// Funções de manipulação da interface
function setTab(name) {
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  qsa('section').forEach(s => s.classList.toggle('active', s.id === name));
}

function toggleModal(show, titleOverride) {
  const m = qs('#modalLanc');
  m.style.display = show ? 'flex' : 'none';
  if (show) {
    qs('#mData').value = nowYMD();
    rebuildCatSelect();
    qs('#mDesc').value = '';
    qs('#mObs').value = '';
    qs('#mValorBig').value = '';
    modalTipo = 'Despesa';
    syncTipoTabs();
    qs('#modalTitle').textContent = titleOverride || 'Nova Despesa';
    setTimeout(() => qs('#mValorBig').focus(), 0);
  } else {
    S.editingId = null;
  }
}

function syncTipoTabs() {
  qsa('#tipoTabs button').forEach(b => b.classList.toggle('active', b.dataset.type === modalTipo));
  if (!S.editingId) {
    qs('#modalTitle').textContent = 'Nova ' + modalTipo;
  }
}

function rebuildCatSelect(selected) {
  const sel = qs('#mCategoria');
  sel.innerHTML = '<option value="">Selecione…</option>';
  S.cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c.nome;
    o.textContent = c.nome;
    if (c.nome === selected) o.selected = true;
    sel.append(o);
  });
}

// Função para adicionar ou atualizar uma transação
async function addOrUpdate() {
  const valor = parseMoneyMasked(qs('#mValorBig').value);
  const t = {
    id: S.editingId || gid(),
    tipo: modalTipo,
    categoria: qs('#mCategoria').value,
    data: isIsoDate(qs('#mData').value) ? qs('#mData').value : nowYMD(),
    desc: (qs('#mDesc').value || '').trim(),
    valor: isFinite(valor) ? valor : 0,
    obs: (qs('#mObs').value || '').trim()
  };
  if (!t.categoria) { alert('Selecione categoria'); return }
  if (!t.desc) { alert('Descrição obrigatória'); return }
  if (!(t.valor > 0)) { alert('Informe o valor'); return }
  
  // Atualiza ou adiciona a transação no Supabase
  if (S.editingId) {
    const { data, error } = await supabase.from('transactions').upsert([t]);
    if (error) {
      console.error('Erro ao atualizar transação:', error);
    }
  } else {
    const { data, error } = await supabase.from('transactions').insert([t]);
    if (error) {
      console.error('Erro ao adicionar transação:', error);
    }
  }

  // Atualiza a interface e recarrega os dados
  loadAll();
  toggleModal(false);
}

// Função para deletar uma transação
async function delTx(id) {
  if (confirm('Excluir lançamento?')) {
    const { data, error } = await supabase.from('transactions').delete().match({ id });
    if (error) {
      console.error('Erro ao excluir transação:', error);
    } else {
      loadAll();
    }
  }
}

// Renderização das transações
function renderRecentes() {
  const ul = qs('#listaRecentes');
  const list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10);
  ul.innerHTML = '';
  list.forEach(x => ul.append(itemTx(x, true)));
}

function renderLancamentos() {
  const ul = qs('#listaLanc');
  const list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data));
  ul.innerHTML = '';
  list.forEach(x => ul.append(itemTx(x, false)));
}

function itemTx(x, readOnly = false) {
  const li = document.createElement('li');
  li.className = 'item';
  const v = isFinite(Number(x.valor)) ? Number(x.valor) : 0;
  const actions = readOnly ? '' : [
    '<button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>',
    '<button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>'
  ].join('');
  li.innerHTML = `
    <div class="left">
      <div class="tag">${x.tipo}</div>
      <div>
        <div><strong>${x.desc || '-'}</strong></div>
        <div class="muted" style="font-size:12px">${x.categoria} • ${x.data}</div>
      </div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <div class="${S.hide ? 'blurred' : ''}" style="font-weight:700">${fmtMoney(v)}</div>${actions}
    </div>
  `;
  if (!readOnly) {
    li.querySelector('.edit').onclick = () => openEdit(x.id);
    li.querySelector('.del').onclick = () => delTx(x.id);
  }
  return li;
}

// Função para abrir o modal de edição
function openEdit(id) {
  const x = S.tx.find(t => t.id === id);
  if (!x) return;
  S.editingId = id;
  modalTipo = x.tipo;
  syncTipoTabs();
  rebuildCatSelect(x.categoria);
  qs('#mData').value = isIsoDate(x.data) ? x.data : nowYMD();
  qs('#mDesc').value = x.desc || '';
  qs('#mValorBig').value = fmtMoney(Number(x.valor) || 0);
  qs('#mObs').value = x.obs || '';
  qs('#modalTitle').textContent = 'Editar lançamento';
  qs('#modalLanc').style.display = 'flex';
  setTimeout(() => qs('#mValorBig').focus(), 0);
}

// Função para formatação de valores em BRL
function fmtMoney(v) {
  const n = Number(v);
  return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
}

