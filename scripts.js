window.onload = function () {
  // Conexão com Supabase
  const supabase = window.supabase.createClient(
    'https://ppoufxezqmbxzflijmpx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY'
  );

  // Estado da aplicação
  let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };
  let modalTipo = 'Despesa';

  // Utils
  function gid() { return Math.random().toString(36).slice(2, 9); }
  function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return [...document.querySelectorAll(sel)]; }

  // ========= Normalização =========
  function normalizeTx(t) {
    if (!t) return null;
    const id = t.id || gid();
    const tipo = (t.tipo === 'Receita' || t.tipo === 'Despesa' || t.tipo === 'Transferência') ? t.tipo : 'Despesa';
    const categoria = (t.categoria && String(t.categoria).trim()) ? String(t.categoria).trim() : '';
    const data = isIsoDate(t.data) ? t.data : nowYMD();
    const valor = (typeof t.valor === 'number') ? t.valor : parseFloat(t.valor) || 0;
    const desc = (t.descricao != null) ? String(t.descricao).trim() : '';
    return categoria ? { id, tipo, categoria, data, descricao: desc, valor, obs: t.obs ? String(t.obs) : '' } : null;
  }

  // ========= Supabase CRUD =========
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await supabase.from('transactions').select('*');
    S.tx = txError ? [] : tx.map(normalizeTx).filter(Boolean);

    // Categorias
    const { data: cats, error: catsError } = await supabase.from('categories').select('*');
    S.cats = catsError ? [] : cats;

    // Preferências
    const { data: prefs, error: prefsError } = await supabase.from('preferences').select('*').limit(1);
    if (!prefsError && prefs && prefs.length) {
      const p = prefs[0];
      S.month = p.month;
      S.hide = p.hide;
      S.dark = p.dark;
    }

    // Se não houver categorias, cria padrão
    if (S.cats.length === 0) {
      S.cats = [
        { id: gid(), nome: 'Alimentação', cor: '#60a5fa' },
        { id: gid(), nome: 'Moradia', cor: '#f59e0b' }
      ];
      await supabase.from('categories').upsert(S.cats);
    }

    render();
  }

  async function saveTxToSupabase() {
    const { error } = await supabase.from('transactions').upsert(S.tx);
    if (error) console.error('Erro ao salvar transações:', error);
  }

  async function saveCatsToSupabase() {
    const { error } = await supabase.from('categories').upsert(S.cats);
    if (error) console.error('Erro ao salvar categorias:', error);
  }

  async function savePrefsToSupabase() {
    const prefs = [{ id: 1, month: S.month, hide: S.hide, dark: S.dark }];
    const { error } = await supabase.from('preferences').upsert(prefs);
    if (error) console.error('Erro ao salvar preferências:', error);
  }

  // ========= UI helpers =========
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

  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  }
  // ========= Lançamentos =========
  async function addOrUpdate() {
    const valor = parseFloat(qs('#mValorBig').value.replace(/\D/g, '')) / 100 || 0;
    const t = {
      tipo: modalTipo,
      categoria: qs('#mCategoria').value,
      data: isIsoDate(qs('#mData').value) ? qs('#mData').value : nowYMD(),
      descricao: (qs('#mDesc').value || '').trim(),
      valor: valor,
      obs: (qs('#mObs').value || '').trim()
    };

    if (!t.categoria) { alert('Selecione categoria'); return }
    if (!t.descricao) { alert('Descrição obrigatória'); return }
    if (!(t.valor > 0)) { alert('Informe o valor'); return }

    if (S.editingId) {
      await supabase.from('transactions').upsert([t]);
    } else {
      await supabase.from('transactions').insert([t]);
    }

    loadAll();
    toggleModal(false);
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
    setTimeout(() => qs('#mValorBig').focus(), 0);
  }

  // ========= Renderização de lançamentos =========
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
        <div class="${S.hide ? 'blurred' : ''}" style="font-weight:700">${fmtMoney(v)}</div>
        ${actions}
      </div>
    `;
    if (!readOnly) {
      li.querySelector('.edit').onclick = () => openEdit(x.id);
      li.querySelector('.del').onclick = () => delTx(x.id);
    }
    return li;
  }

  function renderRecentes() {
    const ul = qs('#listaRecentes');
    const list = [...S.tx]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 10);
    ul.innerHTML = '';
    list.forEach(x => ul.append(itemTx(x, true)));
  }

  function renderLancamentos() {
    const ul = qs('#listaLanc');
    const tipo = qs('#filterTipo').value;
    const search = qs('#searchLanc').value.toLowerCase();
    const list = [...S.tx]
      .filter(t => tipo === 'todos' || t.tipo === tipo)
      .filter(t =>
        t.descricao.toLowerCase().includes(search) ||
        t.categoria.toLowerCase().includes(search)
      )
      .sort((a, b) => b.data.localeCompare(a.data));
    ul.innerHTML = '';
    list.forEach(x => ul.append(itemTx(x, false)));
  }

  // ========= Eventos =========
  qs('#salvar').addEventListener('click', addOrUpdate);
  qs('#cancelar').addEventListener('click', () => toggleModal(false));
  qs('#fab').addEventListener('click', () => toggleModal(true));
  qs('#btnNovo').addEventListener('click', () => toggleModal(true));
  qs('#closeModal').addEventListener('click', () => toggleModal(false));

  qs('#filterTipo').addEventListener('change', renderLancamentos);
  qs('#searchLanc').addEventListener('input', renderLancamentos);

  qsa('#tipoTabs button').forEach(b => {
    b.onclick = () => { modalTipo = b.dataset.type; syncTipoTabs(); };
  });
  // ========= Categorias =========
  async function addCategoria() {
    const nome = (qs('#newCatName').value || '').trim();
    if (!nome) { alert('Informe o nome da categoria'); return; }
    const nova = { id: gid(), nome, cor: '#60a5fa' };
    const { error } = await supabase.from('categories').insert([nova]);
    if (error) { console.error('Erro ao adicionar categoria:', error); alert('Erro ao adicionar categoria.'); return; }
    qs('#newCatName').value = '';
    await loadAll();
  }

  async function delCategoria(nome) {
    if (!confirm('Excluir categoria?')) return;
    const { error } = await supabase.from('categories').delete().match({ nome });
    if (error) { console.error('Erro ao excluir categoria:', error); alert('Erro ao excluir categoria.'); return; }
    await loadAll();
  }

  function renderCategorias() {
    const ul = qs('#listaCats');
    if (!ul) return;
    ul.innerHTML = '';
    S.cats.forEach(c => {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `
        <div class="left" style="gap:10px;align-items:center">
          <div style="width:14px;height:14px;border-radius:50%;background:${c.cor}"></div>
          <span>${c.nome}</span>
        </div>
        <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>
      `;
      li.querySelector('.del').onclick = () => delCategoria(c.nome);
      ul.append(li);
    });
  }

  // ========= Relatórios / KPIs =========
  function renderKpis() {
    const mes = S.month; // YYYY-MM
    const receitas = S.tx.filter(t => t.tipo === 'Receita' && t.data.startsWith(mes)).reduce((s, t) => s + Number(t.valor || 0), 0);
    const despesas = S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(mes)).reduce((s, t) => s + Number(t.valor || 0), 0);
    const saldo = receitas - despesas;

    const r = qs('#kpiReceitas'); if (r) r.textContent = fmtMoney(receitas);
    const d = qs('#kpiDespesas'); if (d) d.textContent = fmtMoney(despesas);
    const s = qs('#kpiSaldo');    if (s) s.textContent = fmtMoney(saldo);
  }

  let chartSaldoRef = null;
  let chartPieRef = null;
  let chartFluxoRef = null;

  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(n => +n);
    return `${String(m).padStart(2, '0')}/${y}`;
  }

  function renderChartSaldo() {
    const canv = qs('#chartSaldo');
    if (!canv || typeof Chart === 'undefined') return;
    if (chartSaldoRef) { chartSaldoRef.destroy(); chartSaldoRef = null; }

    const meses = [];
    const saldos = [];
    let acumulado = 0;

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);

      const rec = S.tx.filter(t => t.tipo === 'Receita' && t.data.startsWith(ym)).reduce((s, t) => s + Number(t.valor || 0), 0);
      const des = S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(ym)).reduce((s, t) => s + Number(t.valor || 0), 0);

      acumulado += (rec - des);
      meses.push(monthLabel(ym));
      saldos.push(acumulado);
    }

    chartSaldoRef = new Chart(canv, {
      type: 'line',
      data: { labels: meses, datasets: [{ label: 'Saldo acumulado', data: saldos }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  function renderChartPie() {
    const canv = qs('#chartPie');
    if (!canv || typeof Chart === 'undefined') return;
    if (chartPieRef) { chartPieRef.destroy(); chartPieRef = null; }

    const mes = S.month;
    const porCat = {};
    S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(mes)).forEach(t => {
      porCat[t.categoria] = (porCat[t.categoria] || 0) + Number(t.valor || 0);
    });

    chartPieRef = new Chart(canv, {
      type: 'pie',
      data: { labels: Object.keys(porCat), datasets: [{ data: Object.values(porCat) }] },
      options: { responsive: true }
    });
  }

  function renderChartFluxo() {
    const canv = qs('#chartFluxo');
    if (!canv || typeof Chart === 'undefined') return;
    if (chartFluxoRef) { chartFluxoRef.destroy(); chartFluxoRef = null; }

    const labels = [];
    const receitas = [];
    const despesas = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);

      const rec = S.tx.filter(t => t.tipo === 'Receita' && t.data.startsWith(ym)).reduce((s, t) => s + Number(t.valor || 0), 0);
      const des = S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(ym)).reduce((s, t) => s + Number(t.valor || 0), 0);

      labels.push(monthLabel(ym));
      receitas.push(rec);
      despesas.push(des);
    }

    chartFluxoRef = new Chart(canv, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Receitas', data: receitas }, { label: 'Despesas', data: despesas }] },
      options: { responsive: true }
    });
  }

  function renderTopCategorias() {
    const tbody = qs('#tblTop tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const mapa = {};
    // últimos 12 meses
    for (let i = 0; i < S.tx.length; i++) {
      const t = S.tx[i];
      // considera só 12 meses para trás
      const dt = new Date();
      const limite = new Date(); limite.setMonth(dt.getMonth() - 11);
      const td = new Date(t.data);
      if (td < limite) continue;

      if (t.tipo === 'Despesa') {
        mapa[t.categoria] = (mapa[t.categoria] || 0) + Number(t.valor || 0);
      }
    }

    const arr = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 10);
    arr.forEach(([cat, total]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${cat}</td><td style="text-align:right">${fmtMoney(total)}</td>`;
      tbody.append(tr);
    });
  }

  function renderRelatorios() {
    renderKpis();
    renderChartSaldo();
    renderChartPie();
    renderChartFluxo();
    renderTopCategorias();
  }

  // ========= Dark Mode & Esconder valores =========
  function applyDarkMode() {
    document.body.classList.toggle('dark', !!S.dark);
  }
  function applyHideValues() {
    // KPI values
    qsa('#kpiReceitas, #kpiDespesas, #kpiSaldo').forEach(el => {
      el.classList.toggle('blurred', !!S.hide);
    });
    // Lista de itens
    qsa('#listaRecentes .item .right div, #listaLanc .item .right div').forEach(el => {
      el.classList.toggle('blurred', !!S.hide);
    });
  }

  // ========= Render geral =========
  function render() {
    renderRecentes();
    renderLancamentos();
    renderCategorias();
    renderRelatorios();
    applyDarkMode();
    applyHideValues();

    // estado dos controles
    const chk = qs('#toggleHide'); if (chk) chk.checked = !!S.hide;
  }

  // ========= Eventos globais / Navegação =========
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  const btnDark = qs('#toggleDark');
  if (btnDark) {
    btnDark.addEventListener('click', () => {
      S.dark = !S.dark;
      applyDarkMode();
      savePrefsToSupabase();
    });
  }
  const chkHide = qs('#toggleHide');
  if (chkHide) {
    chkHide.addEventListener('change', (e) => {
      S.hide = !!e.target.checked;
      applyHideValues();
      savePrefsToSupabase();
    });
  }
  const btnAddCat = qs('#addCat');
  if (btnAddCat) btnAddCat.addEventListener('click', addCategoria);

  // ========= Inicialização =========
  loadAll();
};

