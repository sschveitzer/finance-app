// ===============================
// FinanceAPP - scripts.js
// ===============================

window.onload = function () {
  // Inicializa Supabase
  const supabase = window.supabase.createClient(
    "https://ppoufxezqmbxzflijmpx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY"
  );

  // Estado global
  let S = {
    month: nowYMD().slice(0, 7),
    hide: false,
    dark: false,
    editingId: null,
    tx: [],
    cats: [],
  };

  let modalTipo = "Despesa";

  // ==== Utils ====
  function gid() {
    return crypto.randomUUID();
  }
  function nowYMD() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }
  function isIsoDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }
  function fmtMoney(v) {
    const n = Number(v);
    return isFinite(n)
      ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";
  }
  function parseMoneyMasked(s) {
    if (!s) return 0;
    return Number(
      String(s).replace(/[^\d,-]/g, "").replace(",", ".")
    );
  }
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => [...document.querySelectorAll(sel)];
  // ==== Normalização ====
  function normalizeTx(t) {
    if (!t) return null;
    return {
      id: t.id || gid(),
      tipo: ["Receita", "Despesa", "Transferência"].includes(t.tipo)
        ? t.tipo
        : "Despesa",
      categoria: t.categoria || "",
      data: isIsoDate(t.data) ? t.data : nowYMD(),
      valor:
        typeof t.valor === "number" ? t.valor : parseMoneyMasked(t.valor),
      desc: t.desc || "",
      obs: t.obs || "",
    };
  }

  // ==== Load All ====
  async function loadAll() {
    // transações
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("*");
    S.tx = txError ? [] : tx.map(normalizeTx).filter(Boolean);

    // categorias
    const { data: cats, error: catsError } = await supabase
      .from("categories")
      .select("*");
    S.cats = catsError ? [] : cats;

    // preferências (pega só a mais recente)
    const { data: prefs } = await supabase
      .from("preferences")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (prefs && prefs.length) {
      S.month = prefs[0].month;
      S.hide = prefs[0].hide;
      S.dark = prefs[0].dark;
    }

    if (S.cats.length === 0) {
      S.cats = [
        { id: gid(), nome: "Alimentação", cor: "#60a5fa" },
        { id: gid(), nome: "Moradia", cor: "#f59e0b" },
      ];
      saveCatsToSupabase();
    }

    render();
  }

  // ==== Save ====
  async function saveTxToSupabase() {
    await supabase.from("transactions").upsert(S.tx);
  }
  async function saveCatsToSupabase() {
    await supabase.from("categories").upsert(S.cats);
  }
  async function savePrefsToSupabase() {
    await supabase.from("preferences").insert([
      { month: S.month, hide: S.hide, dark: S.dark },
    ]);
  }
  // ==== Navegação de abas ====
  function setTab(name) {
    qsa(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === name)
    );
    qsa("section").forEach((s) =>
      s.classList.toggle("active", s.id === name)
    );
  }

  // ==== Modal ====
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
    qsa("#tipoTabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.type === modalTipo)
    );
    if (!S.editingId) {
      qs("#modalTitle").textContent = "Nova " + modalTipo;
    }
  }

  function rebuildCatSelect(selected) {
    const sel = qs("#mCategoria");
    sel.innerHTML = '<option value="">Selecione…</option>';
    S.cats.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.nome;
      o.textContent = c.nome;
      if (c.nome === selected) o.selected = true;
      sel.append(o);
    });
  }

  // ==== Adicionar/Editar Lançamentos ====
  async function addOrUpdate() {
    const valor = parseMoneyMasked(qs("#mValorBig").value);
    const t = {
      id: S.editingId || gid(),
      tipo: modalTipo,
      categoria: qs("#mCategoria").value,
      data: isIsoDate(qs("#mData").value) ? qs("#mData").value : nowYMD(),
      desc: (qs("#mDesc").value || "").trim(),
      valor: isFinite(valor) ? valor : 0,
      obs: (qs("#mObs").value || "").trim(),
    };
    if (!t.categoria) {
      alert("Selecione categoria");
      return;
    }
    if (!t.desc) {
      alert("Descrição obrigatória");
      return;
    }
    if (!(t.valor > 0)) {
      alert("Informe o valor");
      return;
    }

    if (S.editingId) {
      await supabase.from("transactions").upsert([t]);
    } else {
      await supabase.from("transactions").insert([t]);
    }

    loadAll();
    toggleModal(false);
  }

  // ==== Excluir Lançamentos ====
  async function delTx(id) {
    if (confirm("Excluir lançamento?")) {
      await supabase.from("transactions").delete().match({ id });
      loadAll();
    }
  }

  // ==== Renderização de Itens de Transações ====
  function itemTx(x, readOnly = false) {
    const li = document.createElement("li");
    li.className = "item";
    const v = isFinite(Number(x.valor)) ? Number(x.valor) : 0;
    const actions = readOnly
      ? ""
      : [
          '<button class="icon edit" title="Editar"><i class="ph ph-pencil-simple"></i></button>',
          '<button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>',
        ].join("");
    li.innerHTML = `
      <div class="left">
        <div class="tag">${x.tipo}</div>
        <div>
          <div><strong>${x.desc || "-"}</strong></div>
          <div class="muted" style="font-size:12px">${x.categoria} • ${x.data}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="${S.hide ? "blurred" : ""}" style="font-weight:700">${fmtMoney(
      v
    )}</div>${actions}
      </div>
    `;
    if (!readOnly) {
      li.querySelector(".edit").onclick = () => openEdit(x.id);
      li.querySelector(".del").onclick = () => delTx(x.id);
    }
    return li;
  }

  function openEdit(id) {
    const x = S.tx.find((t) => t.id === id);
    if (!x) return;
    S.editingId = id;
    modalTipo = x.tipo;
    syncTipoTabs();
    rebuildCatSelect(x.categoria);
    qs("#mData").value = isIsoDate(x.data) ? x.data : nowYMD();
    qs("#mDesc").value = x.desc || "";
    qs("#mValorBig").value = fmtMoney(Number(x.valor) || 0);
    qs("#mObs").value = x.obs || "";
    qs("#modalTitle").textContent = "Editar lançamento";
    qs("#modalLanc").style.display = "flex";
    setTimeout(() => qs("#mValorBig").focus(), 0);
  }

  // ==== Eventos Principais ====
  qs("#btnNovo").onclick = () => toggleModal(true);
  qs("#fab").onclick = () => toggleModal(true);
  qs("#closeModal").onclick = () => toggleModal(false);
  qs("#cancelar").onclick = () => toggleModal(false);
  qs("#salvar").onclick = addOrUpdate;

  // tabs
  qsa(".tab").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));

  // dark mode
  qs("#toggleDark").onclick = () => {
    S.dark = !S.dark;
    savePrefsToSupabase();
    render();
  };

  // esconder valores
  qs("#toggleHide").onchange = (e) => {
    S.hide = e.target.checked;
    savePrefsToSupabase();
    render();
  };

  // filtro tipo + busca
  qs("#filterTipo").onchange = renderRecentes;
  qs("#searchLanc").oninput = renderRecentes;

  // adicionar categoria
  qs("#addCat").onclick = async () => {
    const name = qs("#newCatName").value.trim();
    if (!name) return;
    S.cats.push({ id: gid(), nome: name, cor: "#6366f1" });
    await saveCatsToSupabase();
    qs("#newCatName").value = "";
    render();
  };
  // ==== Renderizações ====
  function renderRecentes() {
    const ul = qs("#listaRecentes");
    let list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data));

    // aplica filtros
    const tipoSel = qs("#filterTipo").value;
    if (tipoSel !== "todos") list = list.filter((x) => x.tipo === tipoSel);
    const search = qs("#searchLanc").value.toLowerCase();
    if (search) {
      list = list.filter(
        (x) =>
          x.desc.toLowerCase().includes(search) ||
          x.categoria.toLowerCase().includes(search)
      );
    }

    ul.innerHTML = "";
    list.slice(0, 10).forEach((x) => ul.append(itemTx(x, true)));
  }

  function renderLancamentos() {
    const ul = qs("#listaLanc");
    const list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data));
    ul.innerHTML = "";
    list.forEach((x) => ul.append(itemTx(x, false)));
  }

  function renderCategorias() {
    const ul = qs("#listaCats");
    ul.innerHTML = "";
    S.cats.forEach((c) => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:12px;height:12px;background:${c.cor};border-radius:50%"></span>
          ${c.nome}
        </div>
      `;
      ul.append(li);
    });
  }

  function renderMonthSelect() {
    const sel = qs("#monthSelect");
    sel.innerHTML = "";
    const meses = [...new Set(S.tx.map((t) => t.data.slice(0, 7)))].sort().reverse();
    meses.forEach((m) => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      if (m === S.month) o.selected = true;
      sel.append(o);
    });
    sel.onchange = (e) => {
      S.month = e.target.value;
      savePrefsToSupabase();
      render();
    };
  }

  function renderKPIs() {
    const mesTx = S.tx.filter((t) => t.data.slice(0, 7) === S.month);
    const receitas = mesTx.filter((t) => t.tipo === "Receita").reduce((a, b) => a + Number(b.valor), 0);
    const despesas = mesTx.filter((t) => t.tipo === "Despesa").reduce((a, b) => a + Number(b.valor), 0);
    const saldo = receitas - despesas;

    qs("#kpiReceitas").textContent = S.hide ? "••••" : fmtMoney(receitas);
    qs("#kpiDespesas").textContent = S.hide ? "••••" : fmtMoney(despesas);
    qs("#kpiSaldo").textContent = S.hide ? "••••" : fmtMoney(saldo);
  }

  let chartSaldo, chartPie, chartFluxo;

  function renderCharts() {
    const mesTx = S.tx.filter((t) => t.data.slice(0, 7) === S.month);

    // limpa gráficos existentes
    if (chartSaldo) chartSaldo.destroy();
    if (chartPie) chartPie.destroy();
    if (chartFluxo) chartFluxo.destroy();

    // Saldo acumulado 12 meses
    const hoje = new Date();
    const meses = [];
    const valores = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ym = d.toISOString().slice(0, 7);
      meses.push(ym);
      const mes = S.tx.filter((t) => t.data.slice(0, 7) === ym);
      const receitas = mes.filter((t) => t.tipo === "Receita").reduce((a, b) => a + Number(b.valor), 0);
      const despesas = mes.filter((t) => t.tipo === "Despesa").reduce((a, b) => a + Number(b.valor), 0);
      valores.push(receitas - despesas);
    }
    chartSaldo = new Chart(qs("#chartSaldo"), {
      type: "line",
      data: { labels: meses, datasets: [{ data: valores, fill: true, borderColor: "#3b82f6" }] },
    });

    // Despesas por categoria (mês atual)
    const porCat = {};
    mesTx.filter((t) => t.tipo === "Despesa").forEach((t) => {
      porCat[t.categoria] = (porCat[t.categoria] || 0) + Number(t.valor);
    });
    chartPie = new Chart(qs("#chartPie"), {
      type: "pie",
      data: { labels: Object.keys(porCat), datasets: [{ data: Object.values(porCat) }] },
    });

    // Fluxo por mês (barras receitas vs despesas)
    const receitas12 = [];
    const despesas12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ym = d.toISOString().slice(0, 7);
      const mes = S.tx.filter((t) => t.data.slice(0, 7) === ym);
      receitas12.push(mes.filter((t) => t.tipo === "Receita").reduce((a, b) => a + Number(b.valor), 0));
      despesas12.push(mes.filter((t) => t.tipo === "Despesa").reduce((a, b) => a + Number(b.valor), 0));
    }
    chartFluxo = new Chart(qs("#chartFluxo"), {
      type: "bar",
      data: {
        labels: meses,
        datasets: [
          { label: "Receitas", data: receitas12, backgroundColor: "#22c55e" },
          { label: "Despesas", data: despesas12, backgroundColor: "#ef4444" },
        ],
      },
    });
  }

  function renderTopCategorias() {
    const tbody = qs("#tblTop tbody");
    tbody.innerHTML = "";
    const hoje = new Date();
    const ult12 = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      ult12.push(d.toISOString().slice(0, 7));
    }
    const porCat = {};
    S.tx.forEach((x) => {
      if (x.tipo === "Despesa" && ult12.includes(x.data.slice(0, 7))) {
        porCat[x.categoria] = (porCat[x.categoria] || 0) + Number(x.valor);
      }
    });
    const ranking = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    if (ranking.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2" class="muted">Nenhuma despesa nos últimos 12 meses.</td>`;
      tbody.append(tr);
    } else {
      ranking.forEach(([cat, total]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${cat}</td><td>${fmtMoney(total)}</td>`;
        tbody.append(tr);
      });
    }
  }

  function render() {
    renderRecentes();
    renderLancamentos();
    renderCategorias();
    renderMonthSelect();
    renderKPIs();
    renderCharts();
    renderTopCategorias();
    document.body.classList.toggle("dark", S.dark);
    qs("#toggleHide").checked = S.hide;
  }

  // ==== Inicialização ====
  loadAll();
};
