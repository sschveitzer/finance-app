window.onload = function () {
  // =================== Supabase ===================
  const supabase = window.supabase.createClient(
    'https://ppoufxezqmbxzflijmpx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY'
  );

  // =================== Estado global ===================
  let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };
  let modalTipo = "Despesa";

  // =================== Utils ===================
  function gid() { return crypto.randomUUID(); }
  function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  }

  function parseMoneyMasked(v) {
    if (!v) return 0;
    let str = v.toString().replace(/[^\d,.-]/g, "").replace(",", ".");
    let num = parseFloat(str);
    return isFinite(num) ? num : 0;
  }

  // =================== Navegação entre abas ===================
  function setTab(name) {
    qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    qsa('section').forEach(s => s.classList.toggle('active', s.id === name));
    if (name === "relatorios") renderGraficos();
  }
  // =================== Normalização ===================
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

  // =================== Load All ===================
  async function loadAll() {
    const { data: tx } = await supabase.from('transactions').select('*');
    S.tx = tx ? tx.map(normalizeTx).filter(Boolean) : [];

    const { data: cats } = await supabase.from('categories').select('*');
    S.cats = cats || [];

    const { data: prefs } = await supabase.from('preferences').select('*').limit(1);
    if (prefs && prefs.length > 0) {
      S.month = prefs[0].month;
      S.hide = prefs[0].hide;
      S.dark = prefs[0].dark;
    }

    if (S.cats.length === 0) {
      S.cats = [
        { id: gid(), nome: 'Alimentação', cor: '#60a5fa' },
        { id: gid(), nome: 'Moradia', cor: '#f59e0b' }
      ];
      saveCatsToSupabase();
    }

    render();
  }

  // =================== Salvar ===================
  async function saveTxToSupabase() { await supabase.from('transactions').upsert(S.tx); }
  async function saveCatsToSupabase() { await supabase.from('categories').upsert(S.cats); }
  async function savePrefsToSupabase() {
    await supabase.from('preferences').upsert([{ id: "1", month: S.month, hide: S.hide, dark: S.dark }]);
  }

  // =================== Modal ===================
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
  // =================== CRUD ===================
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
    if (!t.categoria) return alert('Selecione categoria');
    if (!t.descricao) return alert('Descrição obrigatória');
    if (!(t.valor > 0)) return alert('Informe o valor');

    if (S.editingId) await supabase.from('transactions').upsert([t]);
    else await supabase.from('transactions').insert([t]);

    loadAll(); toggleModal(false);
  }

  async function delTx(id) {
    if (confirm('Excluir lançamento?')) {
      await supabase.from('transactions').delete().match({ id });
      loadAll();
    }
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

  // =================== Renderização ===================
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
        <div><strong>${x.descricao || '-'}</strong></div>
        <div class="muted" style="font-size:12px">${x.categoria} • ${x.data}</div>
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
    ul.innerHTML = ''; list.forEach(x => ul.append(itemTx(x, true)));
  }

  function renderLancamentos() {
    const ul = qs('#listaLanc');
    const list = [...S.tx].filter(t => t.data.startsWith(S.month)).sort((a, b) => b.data.localeCompare(a.data));
    ul.innerHTML = ''; list.forEach(x => ul.append(itemTx(x, false)));
  }

  function renderResumo() {
    const receitas = S.tx.filter(t => t.tipo === "Receita" && t.data.startsWith(S.month)).reduce((a, b) => a + b.valor, 0);
    const despesas = S.tx.filter(t => t.tipo === "Despesa" && t.data.startsWith(S.month)).reduce((a, b) => a + b.valor, 0);
    const saldo = receitas - despesas;

    qs('#resumoReceitas').textContent = S.hide ? "••••" : fmtMoney(receitas);
    qs('#resumoDespesas').textContent = S.hide ? "••••" : fmtMoney(despesas);
    qs('#resumoSaldo').textContent = S.hide ? "••••" : fmtMoney(saldo);
  }

  function renderFiltrosMes() {
    const meses = [...new Set(S.tx.map(t => t.data.slice(0, 7)))].sort().reverse();
    const sel = qs('#selectMes');
    sel.innerHTML = '';
    meses.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      if (m === S.month) o.selected = true;
      sel.append(o);
    });
    sel.onchange = () => { S.month = sel.value; savePrefsToSupabase(); render(); };
  }

  function render() {
    renderRecentes();
    renderLancamentos();
    renderResumo();
    renderFiltrosMes();
  }
  // =================== Gráficos ===================
  let chartSaldo, chartCats;
  function renderGraficos() {
    const receitas = S.tx.filter(t => t.tipo === "Receita").reduce((a, b) => a + b.valor, 0);
    const despesas = S.tx.filter(t => t.tipo === "Despesa").reduce((a, b) => a + b.valor, 0);

    if (chartSaldo) chartSaldo.destroy();
    chartSaldo = new Chart(qs('#chartSaldo'), {
      type: 'doughnut',
      data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{ data: [receitas, despesas], backgroundColor: ['#4caf50', '#f44336'] }]
      }
    });

    const catMap = {};
    S.tx.forEach(t => { if (t.tipo === "Despesa") catMap[t.categoria] = (catMap[t.categoria] || 0) + t.valor; });
    const labels = Object.keys(catMap);
    const valores = Object.values(catMap);

    if (chartCats) chartCats.destroy();
    chartCats = new Chart(qs('#chartCats'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Top Categorias', data: valores, backgroundColor: '#2196f3' }]
      }
    });
  }

  // =================== Eventos ===================
  qsa('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  qs('#fab').onclick = () => toggleModal(true);
  qs('#btnNovo').onclick = () => toggleModal(true);
  qs('#salvar').onclick = () => addOrUpdate();
  qs('#cancelar').onclick = () => toggleModal(false);
  qs('#closeModal').onclick = () => toggleModal(false);
  qsa('#tipoTabs button').forEach(b => b.onclick = () => { modalTipo = b.dataset.type; syncTipoTabs(); });

  qs('#toggleHide').onclick = () => { S.hide = !S.hide; savePrefsToSupabase(); renderResumo(); renderLancamentos(); renderRecentes(); };
  qs('#toggleDark').onclick = () => { S.dark = !S.dark; document.body.classList.toggle('dark', S.dark); savePrefsToSupabase(); };

  // =================== Inicialização ===================
  loadAll();
};
