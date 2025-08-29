import { S, qs, monthOf, fmtMoney } from "./state.js";

let chartPieInstance = null;
let chartLineInstance = null;
let chartSaldoInstance = null;

export function renderRelatorios() {
  const mes = S.month;
  const tx = S.tx;

  // Aqui você adiciona os gráficos de saldo acumulado, despesas por categoria, fluxo mensal e top categorias
}