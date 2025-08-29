import { S, qs, monthOf, fmtMoney } from "./state.js";

let chartPieInstance = null;
let chartLineInstance = null;
let chartSaldoInstance = null;

export function renderRelatorios() {
  const mes = S.month;
  const tx = S.tx;

  // saldo acumulado (12m)
  // despesas por categoria (mês atual)
  // fluxo por mês
  // top categorias (12m)
  // (mesmo código que já ajustamos antes)
}
