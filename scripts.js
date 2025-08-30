window.onload = function () {
  // ========= Conexão com Supabase =========
  const supabase = window.supabase.createClient(
    'https://ppoufxezqmbxzflijmpx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY'
  );

  // ========= Estado global =========
  let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };
  let modalTipo = 'Despesa';

  // ========= Helpers =========
  function gid() { return crypto.randomUUID(); }
  function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function qs(s) { return document.querySelector(s); }
  function qsa(s) { return [...document.querySelectorAll(s)]; }
  function fmtMoney(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'; }
  function parseMoneyMasked(v) { if (!v) return 0; return Number(String(v).replace(/[^\d,-]/g, '').replace(',', '.')) || 0; }

  // ========= Normalização =========
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

  // ========= Carregar do Supabase =========
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await supabase.from('transactions').select('*');
    if (txError) { console.error('Erro ao carregar transações:', txError); S.tx = []; }
    else { S.tx = tx.map(normalizeTx).filter(Boolean); }

    // Categorias
    const { data: cats, error: catsError } = await supabase.from('categories').select('*');
    if (catsError) { console.error('Erro ao carregar categorias:', catsError); S.cats = []; }
    else { S.cats = cats; }

    // Preferências → pega só a mais recente
    const { data: prefs, error: prefsError } = await supabase.from('preferences').select('*').order('id', { ascending: false }).limit(1);
    if (prefsError) { console.error('Erro ao carregar preferências:', prefsError); }
    else if (prefs && prefs.length) {
      S.month = prefs[0].month;
      S.hide = prefs[0].hide;
      S.dark = prefs[0].dark;
    }

    render();
  }
  // ========= Salvar no Supabase =========
  async function saveTxToSupabase() {
    const { error } = await supabase.from('transactions').upsert(S.tx);
    if (error) console.error('Erro ao salvar transações:', error);
  }
  async function saveCatsToSupabase() {
    const { error } = await supabase.from('categories').upsert(S.cats);
    if (error) console.error('Erro ao salvar categorias:', error);
  }
  async function savePrefsToSupabase() {
    const { error } = await supabase.from('preferences').insert([{ month: S.month, hide: S.hide, dark: S.dark }]);
    if (error) console.error('Erro ao salvar preferências:', error);
  }

  // ========= Modal =========
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
    if (!S.editingId) qs('#modalTitle').textContent = 'Nova ' + modalTipo;
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

  async function addOrUpdate() {
    const valor = parseMoneyMasked(qs('#mValorBig').value);
    const t = {
      id: S.editingId || gid(),
      tipo: modalTipo,
      categoria: qs('#mCategoria').value,
      data: isIsoDate(qs('#mData').value) ? qs('#mData').value : nowYMD(),
      descricao: (qs('#mDesc').value || '').trim(),
      valor: isFinite(valor) ? valor : 0,
      obs: (qs('#mObs').value || '').trim()
    };
    if (!t.categoria) { alert('Selecione categoria'); return }
    if (!t.descricao) { alert('Descrição obrigatória'); return }
    if (!(t.valor > 0)) { alert('Informe o valor'); return }

    if (S.editingId) await supabase.from('transactions').upsert([t]);
    else await supabase.from('transactions').insert([t]);

    loadAll();
    toggleModal(false);
  }

  async function delTx(id) {
    if (confirm('Excluir lançamento?')) {
      const { error } = await supabase.from('transactions').delete().match({ id });
      if (error) console.error('Erro ao excluir transação:', error);
      else loadAll();
    }
  }
  // ========= Renderização =========
  function itemTx(x, readOnly = false) {
    const li = document.createElement('li');
    li.className = 'item';
    const v = isFinite(Number(x.valor)) ? Number(x.valor) : 0;
    const actions = readOnly ? '' : `
      <button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>
      <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>`;
    li.innerHTML = `
      <div class="left">
        <div class="tag">${x.tipo}</div>
        <div><strong>${x.descricao || '-'}</strong><div class="muted" style="font-size:12px">${x.categoria} • ${x.data}</div></div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="${S.hide ? 'blurred' : ''}" style="font-weight:700">${fmtMoney(v)}</div>${actions}
      </div>`;
    if (!readOnly) {
      li.querySelector('.edit').onclick = () => openEdit(x.id);
      li.querySelector('.del').onclick = () => delTx(x.id);
    }
    return li;
  }

  function renderRecentes() {
    const ul = qs('#listaRecentes');
    const list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10);
    ul.innerHTML = '';
    list.forEach(x => ul.append(itemTx(x, true)));
  }

  function renderLancamentos() {
    const ul = qs('#listaLanc');
    let list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data));

    const tipo = qs('#filterTipo').value;
    if (tipo !== 'todos') list = list.filter(t => t.tipo === tipo);

    const search = qs('#searchLanc').value.toLowerCase();
    if (search) {
      list = list.filter(t =>
        (t.descricao && t.descricao.toLowerCase().includes(search)) ||
        (t.categoria && t.categoria.toLowerCase().includes(search))
      );
    }

    ul.innerHTML = '';
    list.forEach(x => ul.append(itemTx(x, false)));
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
  }

  function render() {
    renderRecentes();
    renderLancamentos();
  }
  // ========= Troca de Abas =========
  function setTab(name) {
    qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    qsa('section').forEach(s => s.classList.toggle('active', s.id === name));
  }
  // ========= Eventos =========
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  qs('#fab').addEventListener('click', () => { modalTipo = 'Despesa'; toggleModal(true, 'Nova Despesa'); });
  qs('#btnNovo').addEventListener('click', () => { modalTipo = 'Despesa'; toggleModal(true, 'Nova Despesa'); });
  qs('#closeModal').addEventListener('click', () => toggleModal(false));
  qs('#cancelar').addEventListener('click', () => toggleModal(false));
  qs('#salvar').addEventListener('click', () => addOrUpdate());
  qsa('#tipoTabs button').forEach(btn => btn.addEventListener('click', () => { modalTipo = btn.dataset.type; syncTipoTabs(); }));
  qs('#filterTipo').addEventListener('change', renderLancamentos);
  qs('#searchLanc').addEventListener('input', renderLancamentos);

  // ========= Inicialização =========
  loadAll();
};

