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
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", uid)
      .order("data");

    const { data: cats, error: catErr } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", uid)
      .order("nome");

    const { data: prefs, error: prefErr } = await supabase
      .from("prefs")
      .select("*")
      .eq("user_id", uid);

    if (txErr) throw txErr;
    if (catErr) throw catErr;
    if (prefErr) throw prefErr;

    S.tx = (tx || []).map(normalizeTx).filter(Boolean);
    S.cats = cats && cats.length ? cats : [];

    if (prefs && prefs.length) {
      S.month = prefs[0].month || S.month;
      S.hide = !!prefs[0].hide;
      S.dark = !!prefs[0].dark;
    }
  } catch (e) {
    alert("Erro ao carregar dados do Supabase: " + e.message);
    console.error(e);
  }
}

// =============================
// Transações
// =============================
export async function saveTransaction(tx) {
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  const uid = user.id || user.user?.id;
  try {
    const withUser = { ...tx, user_id: uid };
    const { error } = await supabase
      .from("transactions")
      .upsert(withUser, { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    alert("Erro ao salvar transação: " + e.message);
    console.error(e);
  }
}

export async function deleteTransaction(id) {
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  try {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } catch (e) {
    alert("Erro ao excluir lançamento: " + e.message);
    console.error(e);
  }
}

// =============================
// Categorias
// =============================
export async function saveCategory(cat) {
  const user = getCurrentUser();
  if (!user || !window.supabase) return;
  const uid = user.id || user.user?.id;
  try {
    const withUser = { ...cat, user_id: uid };
    const { error } = await supabase
      .from("categories")
      .upsert(withUser, { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    alert("Erro ao salvar categoria: " + e.message);
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
    // removi `id: uid` pq pode não existir essa coluna
    const prefs = { user_id: uid, month: S.month, hide: S.hide, dark: S.dark };
    const { error } = await supabase
      .from("prefs")
      .upsert(prefs, { onConflict: "user_id" });
    if (error) throw error;
  } catch (e) {
    alert("Erro ao salvar preferências: " + e.message);
    console.error(e);
  }
}
