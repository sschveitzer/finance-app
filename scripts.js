window.onload = function () {
  // ======== Inicializa Supabase ========
  const client = window.supabase.createClient(
    "https://ppoufxezqmbxzflijmpx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY"
  );
  const supabase = client;

  // ======== Estado global ========
  let S = {
    month: nowYMD().slice(0, 7),
    hide: false,
    dark: false,
    editingId: null,
    tx: [],
    cats: []
  };

  // ======== Helpers ========
  function gid() { return crypto.randomUUID(); }
  function nowYMD() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return [...document.querySelectorAll(sel)]; }
  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
  }
  function parseMoneyMasked(v) {
    if (!v) return 0;
    return Number(v.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
  }

  // ======== Normalização de transação ========
  function normalizeTx(t) {
    if (!t) return null;
    return {
      id: t.id || gid(),
      tipo: ["Receita", "Despesa", "Transferência"].includes(t.tipo) ? t.tipo : "Despesa",
      categoria: (t.categoria && String(t.categoria).trim()) || "",
      data: isIsoDate(t.data) ? t.data : nowYMD(),
      valor: isFinite(Number(t.valor)) ? Number(t.valor) : 0,
      descricao: (t.descricao || "").trim(),
      obs: (t.obs || "").trim()
    };
  }

  // ======== Load principal ========
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await supabase.from("transactions").select("*");
    if (txError) { console.error("Erro ao carregar transações:", txError); S.tx = []; }
    else { S.tx = tx.map(normalizeTx).filter(Boolean); }

    // Categorias
    const { data: cats, error: catsError } = await supabase.from("categories").select("*");
    if (catsError) { console.error("Erro ao carregar categorias:", catsError); S.cats = []; }
    else { S.cats = cats; }

    // Preferências (pega apenas 1ª linha)
    const { data: prefs, error: prefsError } = await supabase.from("preferences").select("*").limit(1).maybeSingle();
    if (!prefsError && prefs) {
      S.month = prefs.month || nowYMD().slice(0, 7);
      S.hide = prefs.hide || false;
      S.dark = prefs.dark || false;
    }

    render();
  }
  // ======== Renderização ========
  function render() {
    renderRecentes();
    renderLancamentos();
    renderCategorias();
    buildMonthSelect();
    updateKpis();
    renderCharts();

    // Dark mode toggle
    document.body.classList.toggle("dark", S.dark);
  }

  // Lista últimos lançamentos
  function renderRecentes() {
    const ul = qs("#listaRecentes");
    const list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10);
    ul.innerHTML = "";
    list.forEach(x => ul.append(itemTx(x, true)));
  }

  // Lista completa de lançamentos
  function renderLancamentos() {
    const ul = qs("#listaLanc");
    let list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data));

    // filtro tipo
    const tipo = qs("#filterTipo").value;
    if (tipo !== "todos") list = list.filter(x => x.tipo === tipo);

    // filtro busca
    const search = qs("#searchLanc").value.toLowerCase();
    if (search) {
      list = list.filter(x =>
        (x.descricao && x.descricao.toLowerCase().includes(search)) ||
        (x.categoria && x.categoria.toLowerCase().includes(search))
      );
    }

    ul.innerHTML = "";
    list.forEach(x => ul.append(itemTx(x, false)));
  }

  // Monta item na lista
  function itemTx(x, readOnly = false) {
    const li = document.createElement("li");
    li.className = "item";
    const v = Number(x.valor) || 0;
    const actions = readOnly ? "" : `
      <button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>
      <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>
    `;
    li.innerHTML = `
      <div class="left">
        <div class="tag">${x.tipo}</div>
        <div>
          <div><strong>${x.descricao || "-"}</strong></div>
          <div class="muted" style="font-size:12px">${x.categoria} • ${x.data}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="${S.hide ? "blurred" : ""}" style="font-weight:700">${fmtMoney(v)}</div>
        ${actions}
      </div>
    `;
    if (!readOnly) {
      li.querySelector(".edit").onclick = () => openEdit(x.id);
      li.querySelector(".del").onclick = () => delTx(x.id);
    }
    return li;
  }

  // Render categorias
  function renderCategorias() {
    const ul = qs("#listaCats");
    ul.innerHTML = "";
    S.cats.forEach(c => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="left"><strong>${c.nome}</strong></div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>
        </div>
      `;
      li.querySelector(".del").onclick = async () => {
        if (confirm(`Excluir categoria "${c.nome}"?`)) {
          await supabase.from("categories").delete().eq("id", c.id);
          loadAll();
        }
      };
      ul.append(li);
    });
  }

  // Constrói seletor de mês
  function buildMonthSelect() {
    const sel = qs("#monthSelect");
    sel.innerHTML = "";
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const cur = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const ym = cur.toISOString().slice(0, 7);
      const opt = document.createElement("option");
      opt.value = ym;
      opt.textContent = cur.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      if (ym === S.month) opt.selected = true;
      sel.append(opt);
    }
  }

  // Alternar abas
  function setTab(name) {
    qsa(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    qsa("section").forEach(s => s.classList.toggle("active", s.id === name));
  }

  // ======== Eventos globais ========
  qs("#filterTipo").onchange = () => renderLancamentos();
  qs("#searchLanc").oninput = () => renderLancamentos();
  qs("#monthSelect").onchange = e => { S.month = e.target.value; render(); };
  qsa(".tab").forEach(btn => btn.onclick = () => setTab(btn.dataset.tab));
  // ======== Modal Lançamentos ========
  let modalTipo = "Despesa";

  function toggleModal(show, titleOverride) {
    const m = qs("#modalLanc");
    m.style.display = show ? "flex" : "none";
    if (show) {
      qs("#mData").value = nowYMD();
      rebuildCatSelect();
      qs("#mDesc").value = "";
      qs("#mObs").value = "";
      qs("#mValorBig").value = "";
      modalTipo = "Despesa";
      syncTipoTabs();
      qs("#modalTitle").textContent = titleOverride || "Nova Despesa";
      setTimeout(() => qs("#mValorBig").focus(), 0);
    } else {
      S.editingId = null;
    }
  }

  function syncTipoTabs() {
    qsa("#tipoTabs button").forEach(b => b.classList.toggle("active", b.dataset.type === modalTipo));
    if (!S.editingId) {
      qs("#modalTitle").textContent = "Nova " + modalTipo;
    }
  }

  function rebuildCatSelect(selected) {
    const sel = qs("#mCategoria");
    sel.innerHTML = '<option value="">Selecione…</option>';
    S.cats.forEach(c => {
      const o = document.createElement("option");
      o.value = c.nome;
      o.textContent = c.nome;
      if (c.nome === selected) o.selected = true;
      sel.append(o);
    });
  }

  // Adicionar ou atualizar lançamento
  async function addOrUpdate() {
    const valor = parseMoneyMasked(qs("#mValorBig").value);
    const t = {
      id: S.editingId || gid(),
      tipo: modalTipo,
      categoria: qs("#mCategoria").value,
      data: isIsoDate(qs("#mData").value) ? qs("#mData").value : nowYMD(),
      descricao: (qs("#mDesc").value || "").trim(),
      valor: isFinite(valor) ? valor : 0,
      obs: (qs("#mObs").value || "").trim()
    };
    if (!t.categoria) return alert("Selecione categoria");
    if (!t.descricao) return alert("Descrição obrigatória");
    if (!(t.valor > 0)) return alert("Informe o valor");

    if (S.editingId) {
      await supabase.from("transactions").upsert([t]);
    } else {
      await supabase.from("transactions").insert([t]);
    }
    loadAll();
    toggleModal(false);
  }

  // Editar lançamento
  function openEdit(id) {
    const x = S.tx.find(t => t.id === id);
    if (!x) return;
    S.editingId = id;
    modalTipo = x.tipo;
    syncTipoTabs();
    rebuildCatSelect(x.categoria);
    qs("#mData").value = isIsoDate(x.data) ? x.data : nowYMD();
    qs("#mDesc").value = x.descricao || "";
    qs("#mValorBig").value = fmtMoney(Number(x.valor) || 0);
    qs("#mObs").value = x.obs || "";
    qs("#modalTitle").textContent = "Editar lançamento";
    qs("#modalLanc").style.display = "flex";
    setTimeout(() => qs("#mValorBig").focus(), 0);
  }

  // Excluir lançamento
  async function delTx(id) {
    if (confirm("Excluir lançamento?")) {
      await supabase.from("transactions").delete().eq("id", id);
      loadAll();
    }
  }

  // ======== Categorias ========
  qs("#addCat").onclick = async () => {
    const nome = qs("#newCatName").value.trim();
    if (!nome) return;
    await supabase.from("categories").insert([{ id: gid(), nome }]);
    qs("#newCatName").value = "";
    loadAll();
  };

  // ======== Preferências ========
  qs("#toggleDark").onclick = async () => {
    S.dark = !S.dark;

    // aplica no DOM
    document.body.classList.toggle("dark", S.dark);

    await supabase.from("preferences").upsert([
      { id: 1, month: S.month, hide: S.hide, dark: S.dark }
    ]);
  };

  qs("#toggleHide").onchange = async e => {
    S.hide = e.target.checked;

    // re-renderiza lista para aplicar blur
    render();

    await supabase.from("preferences").upsert([
      { id: 1, month: S.month, hide: S.hide, dark: S.dark }
    ]);
  };

  // ======== KPIs ========
  function updateKpis() {
    const txMonth = S.tx.filter(x => x.data.startsWith(S.month));
    const receitas = txMonth.filter(x => x.tipo === "Receita").reduce((a, b) => a + Number(b.valor), 0);
    const despesas = txMonth.filter(x => x.tipo === "Despesa").reduce((a, b) => a + Number(b.valor), 0);
    const saldo = receitas - despesas;
    qs("#kpiReceitas").textContent = fmtMoney(receitas);
    qs("#kpiDespesas").textContent = fmtMoney(despesas);
    qs("#kpiSaldo").textContent = fmtMoney(saldo);
  }

  // ======== Gráficos ========
  function renderCharts() {
    const ctxSaldo = document.getElementById("chartSaldo");
    const ctxPie = document.getElementById("chartPie");
    const ctxFluxo = document.getElementById("chartFluxo");
    if (!ctxSaldo || !ctxPie || !ctxFluxo) return;

    const months = [];
    const saldoData = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const cur = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const ym = cur.toISOString().slice(0, 7);
      const txs = S.tx.filter(x => x.data.startsWith(ym));
      const receitas = txs.filter(x => x.tipo === "Receita").reduce((a, b) => a + Number(b.valor), 0);
      const despesas = txs.filter(x => x.tipo === "Despesa").reduce((a, b) => a + Number(b.valor), 0);
      months.push(cur.toLocaleDateString("pt-BR", { month: "short" }));
      saldoData.push(receitas - despesas);
    }

    new Chart(ctxSaldo, {
      type: "line",
      data: { labels: months, datasets: [{ label: "Saldo", data: saldoData }] }
    });

    const txMonth = S.tx.filter(x => x.data.startsWith(S.month));
    const porCat = {};
    txMonth.filter(x => x.tipo === "Despesa").forEach(x => {
      porCat[x.categoria] = (porCat[x.categoria] || 0) + Number(x.valor);
    });
    new Chart(ctxPie, {
      type: "pie",
      data: { labels: Object.keys(porCat), datasets: [{ data: Object.values(porCat) }] }
    });
  }

  // ======== Eventos de botões ========
  qs("#fab").onclick = () => toggleModal(true);
  qs("#btnNovo").onclick = () => toggleModal(true);
  qs("#salvar").onclick = () => addOrUpdate();
  qs("#cancelar").onclick = () => toggleModal(false);
  qs("#closeModal").onclick = () => toggleModal(false);

  // ======== Inicialização ========
  loadAll();
};
