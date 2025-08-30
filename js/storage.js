// =============================
// storage.js - Operações com Supabase
// =============================
import { S } from "./state.js";
import { render } from "./ui.js";

// =============================
// Transações
// =============================

// Salvar ou atualizar transação
export async function saveTransaction(tx) {
  try {
    const uid = S.currentUser?.id;
    if (!uid) return;

    const payload = {
      ...tx,
      user_id: uid
    };

    const { error } = await supabase
      .from("transactions")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;
    await loadTransactions();
  } catch (e) {
    console.error("Erro ao salvar transação:", e.message);
    alert("Erro ao salvar transação: " + e.message);
  }
}

// Excluir transação
export async function deleteTransaction(id) {
  try {
    const uid = S.currentUser?.id;
    if (!uid) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", uid);

    if (error) throw error;
    await loadTransactions();
  } catch (e) {
    console.error("Erro ao excluir transação:", e.message);
    alert("Erro ao excluir transação: " + e.message);
  }
}

// Carregar transações do usuário
export async function loadTransactions() {
  try {
    const uid = S.currentUser?.id;
    if (!uid) {
      S.transactions = [];
      render();
      return;
    }

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", uid)
      .order("data", { ascending: false });

    if (error) throw error;

    S.transactions = data || [];
    render();
  } catch (e) {
    console.error("Erro ao carregar transações:", e.message);
    S.transactions = [];
    render();
  }
}

// =============================
// Categorias
// =============================

// Carregar categorias
export async function loadCategories() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("nome");

    if (error) throw error;

    S.categories = data || [];
  } catch (e) {
    console.error("Erro ao carregar categorias:", e.message);
    S.categories = [];
  }
}

// =============================
// Preferências do usuário
// =============================

// Salvar preferências
export async function savePrefs(S) {
  try {
    const uid = S.currentUser?.id;
    if (!uid) return;

    const prefs = {
      user_id: uid,   // 🔑 agora é a chave primária
      month: S.month,
      hide: S.hide,
      dark: S.dark
    };

    const { error } = await supabase
      .from("prefs")
      .upsert(prefs, { onConflict: "user_id" });

    if (error) throw error;
  } catch (e) {
    console.error("Erro ao salvar preferências:", e.message);
    alert("Erro ao salvar preferências: " + e.message);
  }
}

// Carregar preferências
export async function loadPrefs() {
  try {
    const uid = S.currentUser?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from("prefs")
      .select("*")
      .eq("user_id", uid)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found

    if (data) {
      S.month = data.month ?? S.month;
      S.hide  = data.hide ?? S.hide;
      S.dark  = data.dark ?? S.dark;
    }
  } catch (e) {
    console.error("Erro ao carregar preferências:", e.message);
  }
}

// =============================
// Carregar tudo (quando loga)
// =============================
export async function loadAll() {
  await Promise.all([
    loadTransactions(),
    loadCategories(),
    loadPrefs()
  ]);
}
