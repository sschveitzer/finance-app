window.onload = function() {
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

  // ======== Funções de acesso ao Supabase ========
  async function loadAll() {
    // Carregar transações
    const { data: tx, error: txError } = await db.from('transactions').select('*');
    S.tx = txError ? [] : tx.map(normalizeTx).filter(Boolean);

    // Carregar categorias
    const { data: cats, error: catsError } = await db.from('categories').select('*');
    S.cats = catsError ? [] : cats;

    // Carregar preferências
    const { data: prefs, error: prefsError } = await db.from('preferences').select('*').single();
    if (prefsError) {
      S.month = nowYMD().slice(0, 7);
      S.hide = false;
      S.dark = false;
    } else {
      S.month = prefs.month;
      S.hide = prefs.hide;
      S.dark = prefs.dark;
    }

    // Categorias padrão
    if (S.cats.length === 0) {
      S.cats = [
        { id: gid(), nome: 'Alimentação', cor: '#60a5fa' },
        { id: gid(), nome: 'Moradia', cor: '#f59e0b' }
      ];
      saveCatsToSupabase();
    }

    render();
  }

  async function saveTxToSupabase() {
    const { error } = await db.from('transactions').upsert(S.tx);
    if (error) console.error('Erro ao salvar transações:', error);
  }

  async function saveCatsToSupabase() {
    const { error } = await db.from('categories').upsert(S.cats);
    if (error) console.error('Erro ao salvar categorias:', error);
  }

  async function savePrefsToSupabase() {
    const { error } = await db.from('preferences').upsert([{ month: S.month, hide: S.hide, dark: S.dark }]);
    if (error) console.error('Erro ao salvar preferências:', error);
  }

  // Executa salvamentos iniciais
  saveTxToSupabase();
  saveCatsToSupabase();
  savePrefsToSupabase();
  // ======== Função para resetar os dados ========
  function resetData() {
    if (confirm('Isso vai apagar TODOS os dados (lançamentos, categorias e preferências). Deseja continuar?')) {
      S.tx = [];
      S.cats = [];
      S.month = nowYMD().slice(0, 7);
      S.hide = false;
      S.dark = false;
      S.editingId = null;

      saveTxToSupabase();
      saveCatsToSupabase();
      savePrefsToSupabase();
      render();
      alert('Dados resetados com sucesso.');
    }
  }

  // ======== Funções de interface ========
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

  // ======== CRUD de transações ========
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

    if (S.editingId) {
      await db.from('transactions').upsert([t]);
    } else {
      await db.from('transactions').insert([t]);
    }

    loadAll();
    toggleModal(false);
  }

  async function delTx(id) {
    if (confirm('Excluir lançamento?')) {
      await db.from('transactions').delete().match({ id });
      loadAll();
    }
  }
  // ======== Renderização ========
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

  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  }

  function render() {
    renderRecentes();
    renderLancamentos();
    // aqui você pode chamar outras funções de render se tiver (ex: KPIs, gráficos etc)
  }
  
  // ======== Inicialização ========
  loadAll();
};

