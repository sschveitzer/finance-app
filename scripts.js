window.onload = function () {
  // Supabase Client
  const supabase = window.supabase.createClient(
    'https://ppoufxezqmbxzflijmpx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY'
  );

  let S = {
    month: nowYMD().slice(0, 7),
    hide: false,
    dark: false,
    editingId: null,
    tx: [],
    cats: []
  };

  // ===== Funções utilitárias =====
  function gid() {
    return crypto.randomUUID();
  }
  function nowYMD() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function isIsoDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }
  function qs(sel) {
    return document.querySelector(sel);
  }
  function qsa(sel) {
    return [...document.querySelectorAll(sel)];
  }

  // ===== Normalização de transações =====
  function normalizeTx(t) {
    if (!t) return null;
    const id = t.id || gid();
    const tipo = ['Receita', 'Despesa', 'Transferência'].includes(t.tipo) ? t.tipo : 'Despesa';
    const categoria = (t.categoria && String(t.categoria).trim()) ? String(t.categoria).trim() : '';
    const data = isIsoDate(t.data) ? t.data : nowYMD();
    const valor = (typeof t.valor === 'number') ? t.valor : parseMoneyMasked(t.valor);
    const v = isFinite(valor) ? valor : 0;
    const descricao = (t.descricao != null) ? String(t.descricao).trim() : '';
    return categoria ? { id, tipo, categoria, data, descricao, valor: v, obs: t.obs ? String(t.obs) : '' } : null;
  }

  // ===== Carregar tudo do Supabase =====
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await supabase.from('transactions').select('*');
    if (txError) {
      console.error('Erro ao carregar transações:', txError);
      S.tx = [];
    } else {
      S.tx = tx.map(normalizeTx).filter(Boolean);
    }

    // Categorias
    const { data: cats, error: catsError } = await supabase.from('categories').select('*');
    if (catsError) {
      console.error('Erro ao carregar categorias:', catsError);
      S.cats = [];
    } else {
      S.cats = cats;
    }

    // Preferências (só 1 registro)
    const { data: prefs, error: prefsError } = await supabase.from('preferences').select('*').limit(1).single();
    if (prefsError) {
      console.warn('Erro ao carregar preferências:', prefsError);
      S.month = nowYMD().slice(0, 7);
      S.hide = false;
      S.dark = false;
    } else {
      S.month = prefs.month;
      S.hide = prefs.hide;
      S.dark = prefs.dark;
    }

    // Categorias padrão, se não houver nenhuma
    if (S.cats.length === 0) {
      S.cats = [
        { id: gid(), nome: 'Alimentação', cor: '#60a5fa' },
        { id: gid(), nome: 'Moradia', cor: '#f59e0b' }
      ];
      saveCatsToSupabase();
    }

    render();
  }

  // ===== Salvar no Supabase =====
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
  // ===== Modal de lançamento =====
  let modalTipo = 'Despesa';

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
    qsa('#tipoTabs button').forEach(b =>
      b.classList.toggle('active', b.dataset.type === modalTipo)
    );
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

  // ===== Adicionar ou atualizar transação =====
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

    // Inserir ou atualizar no Supabase
    if (S.editingId) {
      const { error } = await supabase.from('transactions').upsert([t]);
      if (error) console.error('Erro ao atualizar transação:', error);
    } else {
      const { error } = await supabase.from('transactions').insert([t]);
      if (error) console.error('Erro ao adicionar transação:', error);
    }

    loadAll();
    toggleModal(false);
  }

  // ===== Excluir transação =====
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

  // ===== Renderização =====
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

  // ===== Editar transação =====
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

  // ===== Formatação de valores =====
  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  }
  // ===== Relatórios =====
  let chartSaldo, chartPie, chartFluxo;

  function renderRelatorios() {
    renderChartSaldo();
    renderChartPie();
    renderChartFluxo();
    renderTopCategorias();
  }

  function renderChartSaldo() {
    const ctx = qs('#chartSaldo');
    if (chartSaldo) chartSaldo.destroy();

    const months = [...new Set(S.tx.map(t => t.data.slice(0, 7)))].sort();
    const saldoData = months.map(m => {
      const receitas = S.tx.filter(t => t.tipo === 'Receita' && t.data.startsWith(m))
                           .reduce((sum, t) => sum + t.valor, 0);
      const despesas = S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(m))
                           .reduce((sum, t) => sum + t.valor, 0);
      return receitas - despesas;
    });

    chartSaldo = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{ label: 'Saldo', data: saldoData, fill: false, borderColor: '#3b82f6' }]
      }
    });
  }

  function renderChartPie() {
    const ctx = qs('#chartPie');
    if (chartPie) chartPie.destroy();

    const despesas = S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(S.month));
    const porCat = {};
    despesas.forEach(d => { porCat[d.categoria] = (porCat[d.categoria] || 0) + d.valor; });

    chartPie = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(porCat),
        datasets: [{ data: Object.values(porCat) }]
      }
    });
  }

  function renderChartFluxo() {
    const ctx = qs('#chartFluxo');
    if (chartFluxo) chartFluxo.destroy();

    const months = [...new Set(S.tx.map(t => t.data.slice(0, 7)))].sort();
    const receitasData = months.map(m => S.tx.filter(t => t.tipo === 'Receita' && t.data.startsWith(m))
                                             .reduce((sum, t) => sum + t.valor, 0));
    const despesasData = months.map(m => S.tx.filter(t => t.tipo === 'Despesa' && t.data.startsWith(m))
                                             .reduce((sum, t) => sum + t.valor, 0));

    chartFluxo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Receitas', data: receitasData, backgroundColor: '#16a34a' },
          { label: 'Despesas', data: despesasData, backgroundColor: '#dc2626' }
        ]
      }
    });
  }

  function renderTopCategorias() {
    const tbody = qs('#tblTop tbody');
    tbody.innerHTML = '';
    const ult12m = new Date();
    ult12m.setFullYear(ult12m.getFullYear() - 1);

    const top = {};
    S.tx.filter(t => t.tipo === 'Despesa' && new Date(t.data) >= ult12m).forEach(t => {
      top[t.categoria] = (top[t.categoria] || 0) + t.valor;
    });

    Object.entries(top).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${cat}</td><td>${fmtMoney(total)}</td>`;
      tbody.append(tr);
    });
  }

  // ===== Filtros de lançamentos =====
  function aplicarFiltros() {
    const tipo = qs('#filterTipo').value;
    const busca = qs('#searchLanc').value.toLowerCase();

    const filtrados = S.tx.filter(t => {
      const matchTipo = tipo === 'todos' || t.tipo === tipo;
      const matchBusca = t.descricao.toLowerCase().includes(busca) ||
                         t.categoria.toLowerCase().includes(busca);
      return matchTipo && matchBusca;
    });

    const ul = qs('#listaRecentes');
    ul.innerHTML = '';
    filtrados.slice(0, 10).forEach(x => ul.append(itemTx(x, true)));
  }

  // ===== Preferências: Dark mode e esconder valores =====
  function aplicarPreferencias() {
    document.body.classList.toggle('dark', S.dark);
    qsa('.value').forEach(el => el.classList.toggle('blurred', S.hide));
  }

  // ===== Render principal =====
  function render() {
    renderRecentes();
    renderLancamentos();
    renderRelatorios();
    aplicarPreferencias();
  }

  // ===== Eventos =====
  qs('#btnNovo').onclick = () => toggleModal(true);
  qs('#fab').onclick = () => toggleModal(true);
  qs('#salvar').onclick = addOrUpdate;
  qs('#cancelar').onclick = () => toggleModal(false);
  qs('#closeModal').onclick = () => toggleModal(false);

  qsa('#tipoTabs button').forEach(b => {
    b.onclick = () => { modalTipo = b.dataset.type; syncTipoTabs(); }
  });

  qsa('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  qs('#toggleDark').onclick = () => { S.dark = !S.dark; savePrefsToSupabase(); aplicarPreferencias(); };
  qs('#toggleHide').onchange = e => { S.hide = e.target.checked; savePrefsToSupabase(); aplicarPreferencias(); };

  qs('#filterTipo').onchange = aplicarFiltros;
  qs('#searchLanc').oninput = aplicarFiltros;

  // ===== Inicialização =====
  loadAll();
};
