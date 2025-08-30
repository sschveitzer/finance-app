window.onload = function() {
  // ======== Helpers ========
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  // O objeto 'supabase' já está globalmente disponível após o carregamento do CDN
  const db = supabase.createClient(
    'https://ppoufxezqmbxzflijmpx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY'
  );

  let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };

  // ======== Funções utilitárias ========
  function gid() { return Math.random().toString(36).slice(2, 9); }
  function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function fmtMoney(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'; }

  // ======== Normalização ========
  function normalizeTx(t) {
    if (!t) return null;
    const id = t.id || gid();
    const tipo = (t.tipo === 'Receita' || t.tipo === 'Despesa' || t.tipo === 'Transferência') ? t.tipo : 'Despesa';
    const categoria = (t.categoria && String(t.categoria).trim()) ? String(t.categoria).trim() : '';
    const data = isIsoDate(t.data) ? t.data : nowYMD();
    const valor = (typeof t.valor === 'number') ? t.valor : parseMoneyMasked(t.valor);
    const v = isFinite(valor) ? valor : 0;
    const descricao = (t.descricao != null) ? String(t.descricao).trim() : '';
    return categoria ? { id, tipo, categoria, data, descricao, valor: v, obs: t.obs ? String(t.obs) : '' } : null;
  }
    // ======== Carregamento ========
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await db.from('transactions').select('*');
    if (txError) {
      console.error('Erro ao carregar transações:', txError);
      S.tx = [];
    } else {
      S.tx = tx.map(normalizeTx).filter(Boolean);
    }

    // Categorias
    const { data: cats, error: catsError } = await db.from('categories').select('*');
    if (catsError) {
      console.error('Erro ao carregar categorias:', catsError);
      S.cats = [];
    } else {
      S.cats = cats;
    }

    // Preferências (pega só a primeira linha)
    const { data: prefs, error: prefsError } = await db.from('preferences').select('*').limit(1);
    if (prefsError) {
      console.error('Erro ao carregar preferências:', prefsError);
    }
    if (prefs && prefs.length > 0) {
      S.month = prefs[0].month;
      S.hide = prefs[0].hide;
      S.dark = prefs[0].dark;
    } else {
      S.month = nowYMD().slice(0, 7);
      S.hide = false;
      S.dark = false;
    }

    // Categorias padrão se não houver nenhuma
    if (S.cats.length === 0) {
      S.cats = [
        { id: gid(), nome: 'Alimentação', cor: '#60a5fa' },
        { id: gid(), nome: 'Moradia', cor: '#f59e0b' }
      ];
      saveCatsToSupabase();
    }

    render();
  }

  // ======== Persistência ========
  async function saveTxToSupabase() {
    const { data, error } = await db.from('transactions').upsert(S.tx);
    if (error) console.error('Erro ao salvar transações:', error);
  }

  async function saveCatsToSupabase() {
    const { data, error } = await db.from('categories').upsert(S.cats);
    if (error) console.error('Erro ao salvar categorias:', error);
  }

  async function savePrefsToSupabase() {
    const { data, error } = await db
      .from('preferences')
      .upsert([{ id: 1, month: S.month, hide: S.hide, dark: S.dark }], { onConflict: 'id' });
    if (error) console.error('Erro ao salvar preferências:', error);
  }
  // ======== UI ========
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
    const actions = readOnly ? '' : `
      <button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>
      <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>
    `;
    li.innerHTML = `
      <div class="left">
        <div class="tag">${x.tipo}</div>
        <div>
          <div><strong>${x.descricao || '-'}</strong></div>
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

  function openEdit(id) {
    const x = S.tx.find(t => t.id === id);
    if (!x) return;
    S.editingId = id;
    modalTipo = x.tipo;
    syncTipoTabs();
    rebuildCatSelect(x.categoria);
    qs('#mData').value = isIsoDate(x.data) ? x.data : nowYMD();
    qs('#mDesc').value = x.descricao || '';
    qs('#mValorBig').value = fmtMoney(Number(x.valor) || 0);
    qs('#mObs').value = x.obs || '';
    qs('#modalTitle').textContent = 'Editar lançamento';
    qs('#modalLanc').style.display = 'flex';
    setTimeout(() => qs('#mValorBig').focus(), 0);
  }

  // ======== Renderização geral ========
  function render() {
    renderRecentes();
    renderLancamentos();
    // aqui pode chamar render de gráficos e KPIs depois
  }

  // ======== Inicialização ========
  loadAll();
};
