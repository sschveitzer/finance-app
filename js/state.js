// =============================
// Estado Global & Utilidades
// =============================
export let S = { tx: [], cats: [], month: new Date().toISOString().slice(0, 7), hide: false, dark: false };
export let currentUser = null;
export let modalTipo = "Despesa";

export const qs = (s) => document.querySelector(s);
export const qsa = (s) => Array.from(document.querySelectorAll(s));
export const fmtMoney = (v) => (isNaN(v) ? "R$ 0,00" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
export const monthOf = (date) => String(date || "").slice(0, 7);
export const normalizeTx = (t) => (t && t.id ? { ...t, valor: Number(t.valor) } : null);

// funções para alterar estado compartilhado
export function setCurrentUser(u) { currentUser = u; }
export function getCurrentUser() { return currentUser; }
export function setModalTipo(t) { modalTipo = t; }
export function getModalTipo() { return modalTipo; }