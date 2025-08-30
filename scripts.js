window.onload = function () {
  // Inicialização do Supabase
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

  // ======== Helpers ========
  function qs(sel, el = document) {
    return el.querySelector(sel);
  }
  function qsa(sel, el = document) {
    return [...el.querySelectorAll(sel)];
  }
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

  // ======== Normalização ========
  function normalizeTx(t) {
    if (!t) return null;
    const id = t.id || gid();
    const tipo =
      t.tipo === "Receita" || t.tipo === "Despesa" || t.tipo === "Transferência"
        ? t.tipo
        : "Despesa";
    const categoria = t.categoria ? String(t.categoria).trim() : "";
    const data = isIsoDate(t.data) ? t.data : nowYMD();
    const valor =
      typeof t.valor === "number" ? t.valor : parseFloat(t.valor) || 0;
    const desc = t.descricao ? String(t.descricao).trim() : "";
    return categoria
      ? {
          id,
          tipo,
          categoria,
          data,
          descricao: desc,
          valor,
          obs: t.obs ? String(t.obs) : "",
        }
      : null;
  }

  // ======== Carregar dados ========
  async function loadAll() {
    // Transações
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("*");
    if (txError) {
      console.error("Erro ao carregar transações:", txError);
      S.tx = [];
    } else {
      S.tx = tx.map(normalizeTx).filter(Boolean);
    }

    // Categorias
    const { data: cats, error: catsError } = await supabase
      .from("categories")
      .select("*");
    if (catsError) {
      console.error("Erro ao carregar categorias:", catsError);
      S.cats = [];
    } else {
      S.cats = cats;
    }

    // Preferências (pega só uma linha)
    const { data: prefs, error: prefsError } = await supabase
      .from("preferences")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (prefsError) {
      console.warn("Erro ao carregar preferências:", prefsError);
    } else if (prefs) {
      S.month = prefs.month || S.month;
      S.hide = prefs.hide || false;
      S.dark = prefs.dark || false;
    }

    render();
  }

  // ======== Salvamento ========
  async function saveTxToSupabase() {
    const { error } = await supabase.from("transactions").upsert(S.tx);
    if (error) console.error("Erro ao salvar transações:", error);
  }

  async function saveCatsToSupabase() {
    const { error } = await supabase.from("categories").upsert(S.cats);
    if (error) console.error("Erro ao salvar categorias:", error);
  }

  async function savePrefsToSupabase() {
    const prefs = { id: 1, month: S.month, hide: S.hide, dark: S.dark };
    const { error } = await supabase.from("preferences").upsert(prefs);
    if (error) console.error("Erro ao salvar preferências:", error);
  }
  // ======== Renderização ========
  function render() {
    renderKPIs();
    renderRecentes();
    renderLancamentos();
    renderCategorias();
    renderCharts();
    renderMonthSelect();
    renderTopCategorias();
  }

  function renderKPIs() {
    const receitas = S.tx
      .filter((t) => t.tipo === "Receita" && t.data.startsWith(S.month))
      .reduce((a, b) => a + b.valor, 0);
    const despesas = S.tx
      .filter((t) => t.tipo === "Despesa" && t.data.startsWith(S.month))
      .reduce((a, b) => a + b.valor, 0);
    const saldo = receitas - despesas;

    qs("#kpiReceitas").textContent = fmtMoney(receitas);
    qs("#kpiDespesas").textContent = fmtMoney(despesas);
    qs("#kpiSaldo").textContent = fmtMoney(saldo);

    if (S.hide) {
      qsa(".value").forEach((el) => (el.classList.add("blurred")));
    } else {
      qsa(".value").forEach((el) => (el.classList.remove("blurred")));
    }
  }

  function renderRecentes() {
    const ul = qs("#listaRecentes");
    const list = [...S.tx]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 10);
    ul.innerHTML = "";
    list.forEach((x) => ul.append(itemTx(x, true)));
  }

  function renderLancamentos() {
    const ul = qs("#listaLanc");
    let list = [...S.tx].sort((a, b) => b.data.localeCompare(a.data));

    const filtro = qs("#filterTipo").value;
    if (filtro !== "todos") {
      list = list.filter((t) => t.tipo === filtro);
    }

    const busca = qs("#searchLanc").value.toLowerCase();
    if (busca) {
      list = list.filter(
        (t) =>
          (t.descricao || "").toLowerCase().includes(busca) ||
          (t.categoria || "").toLowerCase().includes(busca)
      );
    }

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
        <div class="left">
          <div style="width:14px;height:14px;background:${c.cor};border-radius:3px"></div>
          <span>${c.nome}</span>
        </div>
        <button class="icon del" title="Excluir"><i class="ph ph-trash"></i></button>
      `;
      li.querySelector(".del").onclick = async () => {
        if (confirm("Excluir categoria?")) {
          await supabase.from("categories").delete().eq("id", c.id);
          loadAll();
        }
      };
      ul.append(li);
    });
  }

  // ======== Itens de transações ========
  function itemTx(x, readOnly = false) {
    const li = document.createElement("li");
    li.className = "item";
    const v = Number(x.valor) || 0;
    const actions = readOnly
      ? ""
      : `
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

  // ======== Relatórios ========
  let chartSaldo, chartPie, chartFluxo;

  function renderCharts() {
    const ctxSaldo = qs("#chartSaldo");
    const ctxPie = qs("#chartPie");
    const ctxFluxo = qs("#chartFluxo");

    if (chartSaldo) chartSaldo.destroy();
    if (chartPie) chartPie.destroy();
    if (chartFluxo) chartFluxo.destroy();

    const meses = [...new Set(S.tx.map((t) => t.data.slice(0, 7)))].sort();
    const saldoPorMes = meses.map((m) => {
      const receitas = S.tx
        .filter((t) => t.tipo === "Receita" && t.data.startsWith(m))
        .reduce((a, b) => a + b.valor, 0);
      const despesas = S.tx
        .filter((t) => t.tipo === "Despesa" && t.data.startsWith(m))
        .reduce((a, b) => a + b.valor, 0);
      return receitas - despesas;
    });

    chartSaldo = new Chart(ctxSaldo, {
      type: "line",
      data: {
        labels: meses,
        datasets: [
          {
            label: "Saldo",
            data: saldoPorMes,
            borderColor: "#2563eb",
            backgroundColor: "#60a5fa88",
            tension: 0.3,
          },
        ],
      },
    });

    const despesasMes = S.tx.filter(
      (t) => t.tipo === "Despesa" && t.data.startsWith(S.month)
    );
    const porCat = {};
    despesasMes.forEach((d) => {
      porCat[d.categoria] = (porCat[d.categoria] || 0) + d.valor;
    });

    chartPie = new Chart(ctxPie, {
      type: "pie",
      data: {
        labels: Object.keys(porCat),
        datasets: [
          {
            data: Object.values(porCat),
            backgroundColor: ["#f87171", "#60a5fa", "#34d399", "#fbbf24"],
          },
        ],
      },
    });

    const fluxoReceita = meses.map((m) =>
      S.tx
        .filter((t) => t.tipo === "Receita" && t.data.startsWith(m))
        .reduce((a, b) => a + b.valor, 0)
    );
    const fluxoDespesa = meses.map((m) =>
      S.tx
        .filter((t) => t.tipo === "Despesa" && t.data.startsWith(m))
        .reduce((a, b) => a + b.valor, 0)
    );

    chartFluxo = new Chart(ctxFluxo, {
      type: "bar",
      data: {
        labels: meses,
        datasets: [
          { label: "Receitas", data: fluxoReceita, backgroundColor: "#22c55e" },
          { label: "Despesas", data: fluxoDespesa, backgroundColor: "#ef4444" },
        ],
      },
    });
  }

  function renderMonthSelect() {
    const sel = qs("#monthSelect");
    const meses = [...new Set(S.tx.map((t) => t.data.slice(0, 7)))].sort();
    sel.innerHTML = "";
    meses.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === S.month) opt.selected = true;
      sel.append(opt);
    });
  }

  function renderTopCategorias() {
    const tbl = qs("#tblTop tbody");
    tbl.innerHTML = "";
    const ultimos12 = new Date();
    ultimos12.setMonth(ultimos12.getMonth() - 12);

    const tx = S.tx.filter(
      (t) => new Date(t.data) >= ultimos12 && t.tipo === "Despesa"
    );
    const porCat = {};
    tx.forEach((t) => {
      porCat[t.categoria] = (porCat[t.categoria] || 0) + t.valor;
    });

    Object.entries(porCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, total]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${cat}</td><td>${fmtMoney(total)}</td>`;
        tbl.append(tr);
      });
  }
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

  async function addOrUpdate() {
    const valor = parseMoneyMasked(qs("#mValorBig").value);
    const t = {
      id: S.editingId || crypto.randomUUID(),
      tipo: modalTipo,
      categoria: qs("#mCategoria").value,
      data: isIsoDate(qs("#mData").value) ? qs("#mData").value : nowYMD(),
      descricao: (qs("#mDesc").value || "").trim(),
      valor: isFinite(valor) ? valor : 0,
      obs: (qs("#mObs").value || "").trim(),
    };
    if (!t.categoria) { alert("Selecione categoria"); return; }
    if (!t.descricao) { alert("Descrição obrigatória"); return; }
    if (!(t.valor > 0)) { alert("Informe o valor"); return; }

    if (S.editingId) {
      await supabase.from("transactions").update(t).eq("id", t.id);
    } else {
      await supabase.from("transactions").insert([t]);
    }
    loadAll();
    toggleModal(false);
  }

  async function delTx(id) {
    if (confirm("Excluir lançamento?")) {
      await supabase.from("transactions").delete().eq("id", id);
      loadAll();
    }
  }

  function openEdit(id) {
    const x = S.tx.find((t) => t.id === id);
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

  // ======== Navegação e binds ========
  qsa(".tab").forEach((b) => {
    b.onclick = () => setTab(b.dataset.tab);
  });

  qs("#fab").onclick = () => {
    S.editingId = null;
    modalTipo = "Despesa";
    toggleModal(true, "Nova Despesa");
  };

  qs("#btnNovo").onclick = () => {
    S.editingId = null;
    modalTipo = "Despesa";
    toggleModal(true, "Nova Despesa");
  };

  qs("#salvar").onclick = () => addOrUpdate();
  qs("#cancelar").onclick = () => toggleModal(false);
  qs("#closeModal").onclick = () => toggleModal(false);

  qs("#toggleDark").onclick = () => {
    S.dark = !S.dark;
    document.body.classList.toggle("dark", S.dark);
    savePrefsToSupabase();
  };

  qs("#toggleHide").onchange = (e) => {
    S.hide = e.target.checked;
    render();
    savePrefsToSupabase();
  };

  qs("#addCat").onclick = async () => {
    const nome = qs("#newCatName").value.trim();
    if (!nome) return;
    if (S.cats.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      alert("Categoria já existe");
      return;
    }
    const cat = { id: crypto.randomUUID(), nome, cor: "#6366f1" };
    S.cats.push(cat);
    await saveCatsToSupabase();
    qs("#newCatName").value = "";
    render();
  };

  qs("#filterTipo").onchange = renderLancamentos;
  qs("#searchLanc").oninput = renderLancamentos;

  qs("#monthSelect").onchange = (e) => {
    S.month = e.target.value;
    render();
    savePrefsToSupabase();
  };

  // ======== Inicialização ========
  loadAll();
};
