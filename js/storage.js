// =============================
// storage.js - Persistência no Supabase
// =============================
import { S, normalizeTx } from "./state.js";

// Salva ou atualiza uma transação
export async function saveTransaction(tx) {
  const user = S.currentUser;
  if (!user) return;

  const t = normalizeTx(tx);
  try {
    const { error } = await supabase
      .from("transactions")
      .upsert({ ...t, user_id: user.id });

    if (error) throw error;

    const idx = S.transactions.findIndex((x) => x.id === t.id);
    if (idx >= 0) S.transactions[idx] = t;
    else S.transactions.push(t);
  } catch (e) {
    console.error("Erro ao salvar transação", e);
    alert("Erro ao salvar transação: " + e.message);
  }
}

// Deleta uma transação
export async function deleteTransaction(id) {
  const user = S.currentUser;
  if (!user) return;

  try {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    S.transactions = S.transactions.filter((t) => t.id !== id);
  } catch (e) {
    console.error("Erro ao deletar transação", e);
    alert("Erro ao deletar transação: " + e.message);
  }
}

// Carrega todas as entidades (transações, categorias, prefs)
export async function loadAll() {
  const user = S.currentUser;
  if (!user) return;

  try {
    // Transações
    let { data: txs, error: err1 } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false });
    if (!err1 && txs) S.transactions = txs;

    // Categorias
    let { data: cats, error: err2 } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id);
    if (!err2 && cats) S.categories = cats;

    // Preferências
    let { data: prefs, error: err3 } = await supabase
      .from("prefs")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!err3 && prefs) {
      S.hide = prefs.hide || false;
      S.dark = prefs.dark || false;
    }
  } catch (e) {
    console.error("Erro ao carregar dados", e);
  }
}

// Salva preferências do usuário
export async function savePrefs() {
  const user = S.currentUser;
  if (!user) return;

  try {
    const { error } = await supabase
      .from("prefs")
      .upsert({
        user_id: user.id,
        hide: S.hide,
        dark: S.dark
      }, { onConflict: "user_id" });

    if (error) throw error;
  } catch (e) {
    console.error("Erro ao salvar preferências", e);
    alert("Erro ao salvar preferências: " + e.message);
  }
}
