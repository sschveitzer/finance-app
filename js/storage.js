// storage.js - Persistência no Supabase (sem localStorage)
import { S, getCurrentUser, normalizeTx } from "./state.js";

// =============================
// Carregar todos os dados
// =============================
export async function loadAll() {
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  const uid = user.id || user.user?.id;
  try {
    const { data: tx } = await supabase.from("transactions").select("*").eq("user_id", uid).order("data");
    const { data: cats } = await supabase.from("categories").select("*").eq("user_id", uid).order("nome");
    const { data: prefs } = await supabase.from("prefs").select("*").eq("user_id", uid);

    S.tx = (tx || []).map(normalizeTx).filter(Boolean);
    S.cats = cats && cats.length ? cats : [];

    if (prefs && prefs.length) {
      S.month = prefs[0].month || S.month;
      S.hide = !!prefs[0].hide;
      S.dark = !!prefs[0].dark;
    }
  } catch (e) {
    alert("Erro ao carregar dados do Supabase");
    console.error(e);
  }
}

// =============================
// Transações
// =============================
export async function saveTransaction() {   // 🔄 antes saveTx
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  const uid = user.id || user.user?.id;
  try {
    const withUser = S.tx.map((t) => ({ ...t, user_id: uid }));
    const { error } = await supabase.from("transactions").upsert(withUser, { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    alert("Erro ao salvar lançamentos");
    console.error(e);
  }
}

export async function deleteTransaction(id) {  // 🔄 antes deleteTx
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  try {
    await supabase.from("transactions").delete().eq("id", id);
  } catch (e) {
    alert("Erro ao excluir lançamento");
    console.error(e);
  }
}

// =============================
// Categorias
// =============================
export async function saveCategory() {   // 🔄 antes saveCats
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  const uid = user.id || user.user?.id;
  try {
    const withUser = S.cats.map((c) => ({ ...c, user_id: uid }));
    const { error } = await supabase.from("categories").upsert(withUser, { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    alert("Erro ao salvar categorias");
    console.error(e);
  }
}

// =============================
// Preferências
// =============================
export async function savePrefs() {
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  const uid = user.id || user.user?.id;
  try {
    const prefs = { id: uid, user_id: uid, month: S.month, hide: S.hide, dark: S.dark };
    const { error } = await supabase.from("prefs").upsert(prefs, { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    alert("Erro ao salvar preferências");
    console.error(e);
  }
}
