// =============================
// ui.js - Renderização & UI
// =============================
import { S, qs, qsa, fmtMoney, uid, monthOf, parseCurrency, monthsBack, getModalTipo, setModalTipo } from "./state.js";
import { saveTx, saveCats, savePrefs, deleteTx } from "./storage.js";
import { renderRelatorios } from "./reports.js";

// Expor algumas funções no window para botões inline
window.delTx = (id) => delTx(id);

export function render() {
  applyTheme();
  buildMonthSelect();
  renderDashboard();
  renderListaRecentes();
  renderLancamentos();
  renderCategorias();
  renderRelatorios();
  highlightTab();
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", !!S.dark);
  savePrefs();
}

function highlightTab() {
  qsa(".tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === S.tab));
  qsa("section").forEach((s) => s.classList.toggle("active", s.id === S.tab));
}

function buildMonthSelect() {
  const sel = qs("#monthSelect");
  if (!sel) return;
  const items = monthsBack(18);
  sel.innerHTML = items.map((m) => `<option value="${m}" ${m === S.month ? "selected" : ""}>${m}</option>`).join("");
  sel.onchange = () => { S.month = sel.value; savePrefs(); render(); };
}

function renderDashboard() {
  const mes = S.month;
  const txMes = S.tx.filter((t) => monthOf(t.data) === mes);
  const rec = sum(txMes.filter((t) => t.tipo === "Receita"));
  const desp = sum(txMes.filter((t) => t.tipo === "Despesa"));
  const saldo = rec - desp;
  setText("#kpiReceitas", S.hide ? "••••" : fmtMoney(rec));
  setText("#kpiDespesas", S.hide ? "••••" : fmtMoney(desp));
  setText("#kpiSaldo", S.hide ? "••••" : fmtMoney(saldo));
}

function renderListaRecentes() {
  const ul = qs("#ultimosLanc");
  if (!ul) return;
  const mes = S.month;
  const filtros = (t) => monthOf(t.data) === mes
    && (S.filterTipo === "todos" || t.tipo === S.filterTipo)
    && (!S.search || (t.descricao || "").toLowerCase().includes(S.search.toLowerCase()));
  const itens = S.tx.filter(filtros).slice(-10).reverse();
  ul.innerHTML = itens.map((t) => `
    <li class="item">
      <div>
        <div class="title">${t.descricao || "(sem descrição)"}</div>
        <div class="muted">${t.data} • ${t.categoria} • ${t.tipo}</div>
      </div>
      <div class="value ${t.tipo === "Receita" ? "pos" : "neg"}">${S.hide ? "••••" : fmtMoney(t.valor)}</div>
    </li>
  `).join("");
}

function renderLancamentos() {
  const tbody = qs("#tbodyLanc");
  if (!tbody) return;
  const mes = S.month;
  const txMes = S.tx.filter((t) => monthOf(t.data) === mes);
  tbody.innerHTML = txMes.map((t) => `
    <tr>
      <td>${t.data}</td>
      <td>${t.descricao || "-"}</td>
      <td>${t.categoria || "-"}</td>
      <td class="${t.tipo === "Receita" ? "pos" : "neg"}">${S.hide ? "••••" : fmtMoney(t.valor)}</td>
      <td><button class="link" onclick="delTx('${t.id}')">Excluir</button></td>
    </tr>
  `).join("");
}

async function delTx(id) {
  if (!confirm("Excluir lançamento?")) return;
  await deleteTx(id);
  render();
}

function renderCategorias() {
  const ul = qs("#listaCats");
  if (ul) {
    ul.innerHTML = S.cats.map((c) => `<li class="item"><div>${c.nome}</div></li>`).join("");
  }
  const sel = qs("#mCategoria");
  if (sel) {
    sel.innerHTML = S.cats.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join("");
  }
}

export function toggleModal(show, title = "") {
  const m = qs("#modalLanc");
  if (!m) return;
  if (show) {
    m.style.display = "flex";
    const titleEl = qs("#modalTitle");
    if (titleEl) titleEl.innerText = title;
    qs("#mValorBig").value = "";
    qs("#mData").value = new Date().toISOString().slice(0, 10);
    if (qs("#mCategoria") && S.cats.length) {
      qs("#mCategoria").value = S.cats[0].nome;
    }
  } else {
    m.style.display = "none";
  }
}

export async function addOrUpdate() {
  const id = S.editingId || uid();
  const tx = {
    id,
    tipo: getModalTipo(),
    categoria: qs("#mCategoria")?.value || "Geral",
    data: qs("#mData")?.value || new Date().toISOString().slice(0,10),
    descricao: qs("#mDesc")?.value?.trim() || "",
    obs: qs("#mObs")?.value?.trim() || "",
    valor: parseCurrency(qs("#mValorBig")?.value || "0")
  };
  if (!tx.data || !tx.valor || isNaN(tx.valor)) {
    alert("Preencha Data e Valor!");
    return;
  }
  if (S.editingId) {
    const idx = S.tx.findIndex((t) => t.id === id);
    if (idx >= 0) S.tx[idx] = tx;
  } else {
    S.tx.push(tx);
  }
  await saveTx();
  S.editingId = null;
  toggleModal(false);
  render();
}

function sum(arr) { return arr.reduce((a, b) => a + (Number(b.valor) || 0), 0); }
function setText(sel, v) { const el = qs(sel); if (el) el.innerText = v; }

