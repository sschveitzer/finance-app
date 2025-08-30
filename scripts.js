window.onload = function () {
  // Inicialização do cliente Supabase
  const supabase = window.supabase.createClient(
    'https://ppoufxezqmbxzflijmpx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY'
  );

  let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };
  let modalTipo = "Despesa";

  // ======================== Funções utilitárias ========================
  function gid() { return Math.random().toString(36).slice(2, 9); }
  function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return [...document.querySelectorAll(sel)]; }

  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  }

  function parseMoneyMasked(v) {
    if (!v) return 0;
    const num = Number(String(v).replace(/[^\d,-]/g, "").replace(",", "."));
    return isFinite(num) ? num : 0;
  }

  // ======================== Normalização ========================
  function normalizeTx(t) {
    if (!t) return null;
    return {
      id: t.id,
      tipo: (t.tipo === 'Receita' || t.tipo === 'Despesa' || t.tipo === 'Transferência') ? t.tipo : 'Despesa',
      categoria: (t.categoria && String(t.categoria).trim()) ? String(t.categoria).trim() : '',
      data: isIsoDate(t.data) ? t.data : nowYMD(),
      descricao: (t.descricao != null) ? String(t.descricao).trim() : '',
      valor: (typeof t.valor === 'number') ? t.valor : parseMoneyMasked(t.valor),
      obs: t.obs ? String(t.obs) : ''
    };
  }

  // ======================== Load All ========================
  async function loadAll() {
    // Carregar transações
    const { data: tx, error: txError } = await supabase.from('transactions').select('*');
    if (txError) {
      console.error('Erro ao carregar transações:', txError);
      S.tx = [];
    } else {
      S.tx = tx.map(normalizeTx).filter(Boolean);
    }

    // Carregar categorias
    const { data: cats, error: catsError } = await supabase.from('categories').select('*');
    if (catsError) {
      console.error('Erro ao carregar categorias:', catsError);
      S.cats = [];
    } else {
      S.cats = cats;
    }

    // Carregar preferências (pega a primeira linha)
    const { data: prefs, error: prefsError } = await supabase.from('preferences').select('*').limit(1).single();
    if (prefsError) {
      console.error('Erro ao carregar preferências:', prefsError);
    } else if (prefs) {
      S.month = prefs.month;
      S.hide = prefs.hide;
      S.dark = prefs.dark;
      applyDarkMode();
    }

    render();
  }
  // ======================== Salvamentos ========================
  async function saveTxToSupabase() {
    const { error } = await supabase.from('transactions').upsert(S.tx);
    if (error) console.error('Erro ao salvar transações:', error);
  }

  async function saveCatsToSupabase() {
    const { error } = await supabase.from('categories').upsert(S.cats);
    if (error) console.error('Erro ao salvar categorias:', error);
  }

  async function savePrefsToSupabase() {
    const { error } = await supabase.from('preferences').upsert([{ id: 1, month: S.month, hide: S.hide, dark: S.dark }]);
    if (error) console.error('Erro ao salvar preferências:', error);
  }

  // ======================== Tabs & Modal ========================
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

  // ======================== Add/Update/Delete ========================
  async function addOrUpdate() {
    const valor = parseMoneyMasked(qs('#mValorBig').value);
    const t = {
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

    if (S.editingId) {
      t.id = S.editingId;
      const { error } = await supabase.from('transactions').upsert([t]);
      if (error) console.error('Erro ao atualizar transação:', error);
    } else {
      const { error } = await supabase.from('transactions').insert([t]);
      if (error) console.error('Erro ao adicionar transação:', error);
    }

    loadAll();
    toggleModal(false);
  }

  async function delTx(id) {
    if (confirm('Excluir lançamento?')) {
      const { error } = await supabase.from('transactions').delete().match({ id });
      if (error) {
        console.error('Erro ao excluir transação:', error);
      } else {
        loadAll();
      }
    }
  }
  // ======================== Renderização ========================
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

  function render() {
    renderRecentes();
    renderLancamentos();
  }

  // ======================== Dark Mode ========================
  function applyDarkMode() {
    document.body.classList.toggle('dark', S.dark);
  }

  // ======================== Eventos ========================
  qs('#btnNovo').onclick = () => toggleModal(true);
  qs('#salvar').onclick = () => addOrUpdate();
  qs('#cancelar').onclick = () => toggleModal(false);
  qs('#closeModal').onclick = () => toggleModal(false);

  qsa('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  qs('#toggleDark').onclick = () => { S.dark = !S.dark; applyDarkMode(); savePrefsToSupabase(); };
  qs('#toggleHide').onchange = (e) => { S.hide = e.target.checked; savePrefsToSupabase(); render(); };

  // Inicialização
  loadAll();
};
