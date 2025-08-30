window.onload = function() {
  // Inicializar Supabase (via CDN global)
  const supabase = window.supabase.createClient(
    'https://ppoufxezqmbxzflijmpx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY'
  );

  // Estado global
  let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };
  let modalTipo = "Despesa";

  // Helpers
  function gid() { return Math.random().toString(36).slice(2, 9); }
  function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return [...document.querySelectorAll(sel)]; }
  function fmtMoney(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'; }

  // Converte objeto de transação em formato correto
  function normalizeTx(t) {
    if (!t) return null;
    const id = t.id || gid();
    const tipo = (t.tipo === 'Receita' || t.tipo === 'Despesa' || t.tipo === 'Transferência') ? t.tipo : 'Despesa';
    const categoria = (t.categoria && String(t.categoria).trim()) ? String(t.categoria).trim() : '';
    const data = isIsoDate(t.data) ? t.data : nowYMD();
    const valor = (typeof t.valor === 'number') ? t.valor : parseFloat(t.valor);
    const v = isFinite(valor) ? valor : 0;
    const descricao = (t.descricao != null) ? String(t.descricao).trim() : '';
    return categoria ? { id, tipo, categoria, data, descricao, valor: v, obs: t.obs ? String(t.obs) : '' } : null;
  }

  // =================== LOAD DATA ===================
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await supabase.from('transactions').select('*');
    S.tx = txError ? [] : tx.map(normalizeTx).filter(Boolean);

    // Categorias
    const { data: cats, error: catsError } = await supabase.from('categories').select('*');
    S.cats = catsError ? [] : cats;

    // Preferências
    const { data: prefs, error: prefsError } = await supabase.from('preferences').select('*').eq('id', 1).single();
    if (!prefsError && prefs) {
      S.month = prefs.month;
      S.hide = prefs.hide;
      S.dark = prefs.dark;
    }

    // Se não houver categorias, cria padrão
    if (S.cats.length === 0) {
      S.cats = [
        { id: gid(), nome: 'Alimentação', cor: '#60a5fa' },
        { id: gid(), nome: 'Moradia', cor: '#f59e0b' }
      ];
      saveCatsToSupabase();
    }

    render();
  }

  // =================== SAVE DATA ===================
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
  // =================== UI HELPERS ===================
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

  // Adicionar ou atualizar transação
  async function addOrUpdate() {
    const valor = parseFloat(qs('#mValorBig').value.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
    const t = {
      id: S.editingId || gid(),
      tipo: modalTipo,
      categoria: qs('#mCategoria').value,
      data: isIsoDate(qs('#mData').value) ? qs('#mData').value : nowYMD(),
      descricao: (qs('#mDesc').value || '').trim(),
      valor: isFinite(valor) ? valor : 0,
      obs: (qs('#mObs').value || '').trim()
    };
    if (!t.categoria) return alert('Selecione categoria');
    if (!t.descricao) return alert('Descrição obrigatória');
    if (!(t.valor > 0)) return alert('Informe o valor');

    if (S.editingId) await supabase.from('transactions').upsert([t]);
    else await supabase.from('transactions').insert([t]);

    loadAll();
    toggleModal(false);
  }

  async function delTx(id) {
    if (confirm('Excluir lançamento?')) {
      await supabase.from('transactions').delete().match({ id });
      loadAll();
    }
  }

  // =================== RENDER ===================
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
      <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>`;
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
      </div>`;
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
  // =================== DASHBOARD ===================
  function renderKpis() {
    const receitas = S.tx.filter(t => t.tipo === 'Receita' && t.data.startsWith(S.month)).reduce((s, t) => s + t.valor, 0);
    const despesas = S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(S.month)).reduce((s, t) => s + t.valor, 0);
    const saldo = receitas - despesas;

    qs('#kpiReceitas').textContent = fmtMoney(receitas);
    qs('#kpiDespesas').textContent = fmtMoney(despesas);
    qs('#kpiSaldo').textContent = fmtMoney(saldo);
  }

  function renderChartSaldo() {
    const ctx = qs('#chartSaldo').getContext('2d');
    const meses = [], valores = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      const receitas = S.tx.filter(t => t.tipo === 'Receita' && t.data.startsWith(ym)).reduce((s, t) => s + t.valor, 0);
      const despesas = S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(ym)).reduce((s, t) => s + t.valor, 0);
      meses.push(ym); valores.push(receitas - despesas);
    }
    new Chart(ctx, { type: 'line', data: { labels: meses, datasets: [{ label: 'Saldo', data: valores }] } });
  }

  function renderChartPie() {
    const ctx = qs('#chartPie').getContext('2d');
    const categorias = {};
    S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(S.month)).forEach(t => { categorias[t.categoria] = (categorias[t.categoria] || 0) + t.valor; });
    new Chart(ctx, { type: 'pie', data: { labels: Object.keys(categorias), datasets: [{ data: Object.values(categorias) }] } });
  }

  function renderTopCategorias() {
    const soma = {};
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12);
    S.tx.filter(t => new Date(t.data) >= cutoff && t.tipo === 'Despesa').forEach(t => { soma[t.categoria] = (soma[t.categoria] || 0) + t.valor; });
    const tbody = qs('#tblTop tbody'); tbody.innerHTML = '';
    Object.entries(soma).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${cat}</td><td>${fmtMoney(total)}</td>`; tbody.append(tr);
    });
  }

  // =================== RENDER ROOT ===================
  function render() {
    renderRecentes();
    renderLancamentos();
    renderKpis();
    renderChartSaldo();
    renderChartPie();
    renderTopCategorias();
  }

  // =================== INIT ===================
  loadAll();
};
