// =============================
// reports.js - Gráficos
// =============================
import { S, qs, monthOf, monthsBack, fmtMoney } from "./js/state.js";

let chartSaldo = null;
let chartPie = null;
let chartLine = null;

export function renderRelatorios() {
  renderSaldoAcumulado12m();
  renderPieCategoriaMesAtual();
  renderFluxoMensal();
  renderTopCategorias12m();
}

function ensureCtx(id) {
  const el = qs("#" + id);
  return el ? el.getContext("2d") : null;
}

function renderSaldoAcumulado12m() {
  const ctx = ensureCtx("chartSaldo");
  if (!ctx || !window.Chart) return;
  chartSaldo?.destroy();
  const labels = monthsBack(12);
  let saldo = 0;
  const data = labels.map((m) => {
    const rec = S.tx.filter((t) => monthOf(t.data) === m && t.tipo === "Receita").reduce((a, b) => a + b.valor, 0);
    const desp = S.tx.filter((t) => monthOf(t.data) === m && t.tipo === "Despesa").reduce((a, b) => a + b.valor, 0);
    saldo += (rec - desp);
    return saldo;
  });
  chartSaldo = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Saldo acumulado", data, tension: 0.25, fill: false }] },
    options: {
      responsive: true,
      plugins: { legend: { display: true }, tooltip: { callbacks: { label: (c) => fmtMoney(c.parsed.y) } } },
      scales: { y: { ticks: { callback: (v) => fmtMoney(v) } } }
    }
  });
}

function renderPieCategoriaMesAtual() {
  const ctx = ensureCtx("pieChart");
  if (!ctx || !window.Chart) return;
  chartPie?.destroy();
  const mes = S.month;
  const map = {};
  S.tx.filter((t) => monthOf(t.data) === mes && t.tipo === "Despesa").forEach((t) => {
    map[t.categoria || "Outros"] = (map[t.categoria || "Outros"] || 0) + t.valor;
  });
  const labels = Object.keys(map);
  const data = labels.map((k) => map[k]);
  chartPie = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

function renderFluxoMensal() {
  const ctx = ensureCtx("lineChart");
  if (!ctx || !window.Chart) return;
  chartLine?.destroy();
  const labels = monthsBack(12);
  const receitas = labels.map((m) => S.tx.filter((t) => monthOf(t.data) === m && t.tipo === "Receita").reduce((a, b) => a + b.valor, 0));
  const despesas = labels.map((m) => S.tx.filter((t) => monthOf(t.data) === m && t.tipo === "Despesa").reduce((a, b) => a + b.valor, 0));
  chartLine = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [
      { label: "Receitas", data: receitas, tension: 0.25 },
      { label: "Despesas", data: despesas, tension: 0.25 }
    ]},
    options: {
      responsive: true,
      plugins: { legend: { display: true }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } } },
      scales: { y: { ticks: { callback: (v) => fmtMoney(v) } } }
    }
  });
}

function renderTopCategorias12m() {
  const tbody = qs("#tblTop tbody");
  if (!tbody) return;
  const labels = monthsBack(12);
  const map = {};
  S.tx.filter((t) => t.tipo === "Despesa" && labels.includes(monthOf(t.data))).forEach((t) => {
    map[t.categoria || "Outros"] = (map[t.categoria || "Outros"] || 0) + t.valor;
  });
  const arr = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 8);
  tbody.innerHTML = arr.map(([cat, total]) => `<tr><td>${cat}</td><td>${fmtMoney(total)}</td></tr>`).join("") || `<tr><td colspan="2" class="muted">Sem dados no período</td></tr>`;
}

