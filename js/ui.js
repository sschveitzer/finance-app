import { S, qs, qsa, fmtMoney, uid, monthOf, getModalTipo, setModalTipo } from "./state.js";
import { saveTx, saveCats } from "./storage.js";
import { renderRelatorios } from "./reports.js";

export function toggleModal(show, title = "") {
  const m = qs("#modalLanc");
  if (!m) return;
  if (show) {
    m.style.display = "flex";
    const titleEl = qs("#modalTitle");
    if (titleEl) titleEl.innerText = title;
    qs("#mValorBig").value = "";
    qs("#mData").value = new Date().toISOString().slice(0, 10);
    if (qs("#mCategoria") && S.cats.length && !qs("#mCategoria").value) {
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
    categoria: qs("#mCategoria")?.value || "",
    data: qs("#mData")?.value || "",
    descricao: qs("#mDesc")?.value?.trim() || "",
    obs: qs("#mObs")?.value?.trim() || "",
    valor: parseFloat(qs("#mValorBig")?.value || "0")
  };
  if (!tx.data || !tx.valor || isNaN(tx.valor)) { alert("Preencha Data e Valor!"); return; }
  if (S.editingId) {
    const idx = S.tx.findIndex((t) => t.id === id);
    if (idx >= 0) S.tx[idx] = tx;
  } else {
    S.tx.push(tx);
  }
  await saveTx();
  render();
  toggleModal(false);
}

export async function delTx(id) {
  if (!confirm("Excluir lançamento?")) return;
  S.tx = S.tx.filter((t) => t.id !== id);
  await supabase.from("transactions").delete().eq("id", id);
  render();
}

export function render() {
  applyTheme();
  renderDashboard();
  renderLancamentos();
  renderCategorias();
  renderRelatorios();
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", !!S.dark);
}

function renderDashboard() {
  const mes = S.month;
  const txMes = S.tx.filter((t) => monthOf(t.data) === mes);
  const rec = txMes.filter((t) => t.tipo === "Receita").reduce((a, b) => a + b.valor, 0);
  const desp = txMes.filter((t) => t.tipo === "Despesa").reduce((a, b) => a + b.valor, 0);
  const saldo = rec - desp;

  if (qs("#kpiReceitas")) qs("#kpiReceitas").innerText = S.hide ? "••••" : fmtMoney(rec);
  if (qs("#kpiDespesas")) qs("#kpiDespesas").innerText = S.hide ? "••••" : fmtMoney(desp);
  if (qs("#kpiSaldo")) qs("#kpiSaldo").innerText = S.hide ? "••••" : fmtMoney(saldo);
}

function renderLancamentos() {
  const mes = S.month;
  const txMes = S.tx.filter((t) => monthOf(t.data) === mes);
  const tbody = qs("#tbodyLanc");
  if (!tbody) return;
  tbody.innerHTML = "";
  txMes.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.data}</td><td>${t.descricao || "-"}</td><td>${t.categoria || "-"}</td><td>${S.hide ? "••••" : fmtMoney(t.valor)}</td>
    <td><button onclick="delTx('${t.id}')">Excluir</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderCategorias() {
  const ul = qs("#listaCats");
  if (ul) {
    ul.innerHTML = "";
    S.cats.forEach((c) => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `<div>${c.nome}</div>`;
      ul.appendChild(li);
    });
  }
  const sel = qs("#mCategoria");
  if (sel) {
    sel.innerHTML = "";
    S.cats.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.nome;
      o.textContent = c.nome;
      sel.appendChild(o);
    });
  }
}