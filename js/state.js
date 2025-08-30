// =============================
// state.js - Estado global
// =============================

export const S = {
  transactions: [],      // lista de transações
  categories: [],        // lista de categorias
  month: new Date().toISOString().slice(0, 7),
  hide: false,           // esconder valores
  dark: false,           // tema escuro
  filterTipo: "todos",   // filtro por tipo
  search: "",            // filtro de busca
  tab: "dashboard",      // aba ativa
  editingId: null        // id em edição
};

let _currentUser = null;
let _modalTipo = "Despesa";

// =============================
// Helpers utilitários
// =============================
export const qs = (s) => document.querySelector(s);
export const qsa = (s) => Array.from(document.querySelectorAll(s));
export const fmtMoney = (v) =>
  isNaN(v)
    ? "R$ 0,00"
    : Number(v).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

export const uid = () =>
  crypto?.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

export const monthOf = (isoDate) => String(isoDate || "").slice(0, 7);

export const parseCurrency = (str) => {
  if (typeof str === "number") return str;
  if (!str) return 0;
  const s = String(str).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export const monthsBack = (n = 12, from = new Date()) => {
  const arr = [];
  const d = new Date(from);
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    arr.unshift(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return arr;
};

// =============================
// Normalização de transações
// =============================
export const normalizeTx = (t) => {
  if (!t) return null;
  return {
    id: t.id || uid(),
    tipo: t.tipo || "Despesa",
    categoria: t.categoria || "Geral",
    data: t.data || new Date().toISOString().slice(0, 10),
    descricao: t.descricao || "",
    obs: t.obs || "",
    valor:
      typeof t.valor === "number" ? t.valor : parseCurrency(t.valor),
  };
};

// =============================
// Controle de usuário e modal
// =============================
export function setCurrentUser(u) {
  _currentUser = u || null;
}
export function getCurrentUser() {
  return _currentUser;
}
export function setModalTipo(t) {
  _modalTipo = t;
}
export function getModalTipo() {
  return _modalTipo;
}
