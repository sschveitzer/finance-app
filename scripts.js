window.onload = function () {
  // Inicialização Supabase
  const supabase = window.supabase.createClient(
    "https://ppoufxezqmbxzflijmpx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  );

  let S = { month: nowYMD().slice(0, 7), hide: false, dark: false, editingId: null, tx: [], cats: [] };
  let modalTipo = "Despesa";

  // === Funções utilitárias ===
  function gid() { return crypto.randomUUID(); }
  function nowYMD() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function fmtMoney(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"; }
  const qs = s => document.querySelector(s);
  const qsa = s => [...document.querySelectorAll(s)];

  // === Normalização de transação ===
  function normalizeTx(t) {
    if (!t) return null;
    return {
      id: t.id || gid(),
      tipo: ["Receita", "Despesa", "Transferência"].includes(t.tipo) ? t.tipo : "Despesa",
      categoria: t.categoria || "",
      data: isIsoDate(t.data) ? t.data : nowYMD(),
      valor: Number(t.valor) || 0,
      descricao: t.descricao || "",
      obs: t.obs || ""
    };
  }

  // === CRUD Supabase ===
  async function loadAll() {
    const { data: tx } = await supabase.from("transactions").select("*");
    S.tx = (tx || []).map(normalizeTx);

    const { data: cats } = await supabase.from("categories").select("*");
    S.cats = cats || [];

    const { data: prefs } = await supabase.from("preferences").select("*").limit(1);
    if (prefs && prefs.length > 0) {
      S.month = prefs[0].month;
      S.hide = prefs[0].hide;
      S.dark = prefs[0].dark;
    }

    render();
  }

  async function savePrefsToSupabase() {
    await supabase.from("preferences").delete().neq("id", ""); // limpa prefs antigas
    await supabase.from("preferences").insert([{ id: gid(), month: S.month, hide: S.hide, dark: S.dark }]);
  }

  async function saveCatsToSupabase() {
    await supabase.from("categories").upsert(S.cats);
  }

  async function addOrUpdate(t) {
    await supabase.from("transactions").upsert([t]);
    loadAll();
  }

  async function delTx(id) {
    if (confirm("Excluir lançamento?")) {
      await supabase.from("transactions").delete().eq("id", id);
      loadAll();
    }
  }
  // === Renderizações ===
  function renderRecentes() {
    const ul = qs("#listaRecentes");
    const list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10);
    ul.innerHTML = "";
    list.forEach(x => ul.append(itemTx(x, true)));
  }

  function renderLancamentos() {
    const ul = qs("#listaLanc");
    let list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data));

    // Filtros
    const tipo = qs("#filterTipo").value;
    if (tipo !== "todos") list = list.filter(x => x.tipo === tipo);
    const search = qs("#searchLanc").value.toLowerCase();
    if (search) list = list.filter(x =>
      (x.descricao && x.descricao.toLowerCase().includes(search)) ||
      (x.categoria && x.categoria.toLowerCase().includes(search))
    );

    ul.innerHTML = "";
    list.forEach(x => ul.append(itemTx(x, false)));
  }

  function renderCategorias() {
    const ul = qs("#listaCats");
    ul.innerHTML = "";
    S.cats.forEach(c => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `<div class="left"><strong>${c.nome}</strong></div>
        <div><button class="icon del"><i class="ph ph-trash"></i></button></div>`;
      li.querySelector(".del").onclick = async () => {
        if (confirm(`Excluir categoria "${c.nome}"?`)) {
          await supabase.from("categories").delete().eq("id", c.id);
          loadAll();
        }
      };
      ul.append(li);
    });
  }

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

  function itemTx(x, readOnly) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="left">
        <div class="tag">${x.tipo}</div>
        <div><strong>${x.descricao}</strong>
          <div class="muted">${x.categoria} • ${x.data}</div>
        </div>
      </div>
      <div>
        <div class="${S.hide ? "blurred" : ""}">${fmtMoney(x.valor)}</div>
        ${!readOnly ? `<button class="icon del"><i class="ph ph-trash"></i></button>` : ""}
      </div>`;
    if (!readOnly) li.querySelector(".del").onclick = () => delTx(x.id);
    return li;
  }
  // === Gráficos e KPIs ===
  function renderChartSaldo() {
    const meses = [], saldos = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      meses.push(ym);
      const lanc = S.tx.filter(t => t.data.startsWith(ym));
      const rec = lanc.filter(t => t.tipo === "Receita").reduce((s, t) => s + t.valor, 0);
      const des = lanc.filter(t => t.tipo === "Despesa").reduce((s, t) => s + t.valor, 0);
      saldos.push(rec - des);
    }
    new Chart(qs("#chartSaldo"), { type: "line", data: { labels: meses, datasets: [{ data: saldos }] } });
  }

  function renderChartPie(lancMes) {
    const porCat = {};
    lancMes.filter(t => t.tipo === "Despesa").forEach(t => {
      porCat[t.categoria] = (porCat[t.categoria] || 0) + t.valor;
    });
    new Chart(qs("#chartPie"), { type: "pie", data: { labels: Object.keys(porCat), datasets: [{ data: Object.values(porCat) }] } });
  }

  function renderTopCategorias() {
    const ultimos12 = new Date(); ultimos12.setFullYear(ultimos12.getFullYear() - 1);
    const porCat = {};
    S.tx.filter(t => new Date(t.data) >= ultimos12 && t.tipo === "Despesa").forEach(t => {
      porCat[t.categoria] = (porCat[t.categoria] || 0) + t.valor;
    });
    const tbody = qs("#tblTop tbody"); tbody.innerHTML = "";
    Object.entries(porCat).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${cat}</td><td>${fmtMoney(total)}</td>`;
      tbody.append(tr);
    });
  }

  function render() {
    renderRecentes();
    renderLancamentos();
    renderCategorias();
    buildMonthSelect();

    const lancMes = S.tx.filter(tx => tx.data.startsWith(S.month));
    const rec = lancMes.filter(t => t.tipo === "Receita").reduce((s, t) => s + t.valor, 0);
    const des = lancMes.filter(t => t.tipo === "Despesa").reduce((s, t) => s + t.valor, 0);
    qs("#kpiReceitas").textContent = fmtMoney(rec);
    qs("#kpiDespesas").textContent = fmtMoney(des);
    qs("#kpiSaldo").textContent = fmtMoney(rec - des);

    renderChartSaldo();
    renderChartPie(lancMes);
    renderTopCategorias();
  }

  // === Eventos ===
  qs("#filterTipo").onchange = () => renderLancamentos();
  qs("#searchLanc").oninput = () => renderLancamentos();
  qs("#monthSelect").onchange = e => { S.month = e.target.value; render(); };

  // === Inicialização ===
  loadAll();
};
