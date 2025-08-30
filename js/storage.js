// =============================
// storage.js - Integração com Supabase
// =============================
import { S, normalizeTx } from "./state.js";

// Salva ou atualiza uma transação
export async function saveTransaction(tx) {
  const user = S.currentUser;
  if (!user) return;

  const t = normalizeTx(tx);
  try {
    const { error, data } = await supabase
      .from("transactions")
      .upsert({ ...t, user_id: user.id });

    if (error) throw error;

    // Atualiza estado local
    const idx = S.transactions.findIndex((x) => x.id === t.id);
    if (idx >= 0) S.transactions[idx] = t;
    else S.transactions.push(t);
  } catch (e) {
    console.error("Erro ao salvar transação", e);
    alert("Erro ao salvar transação: " + e.message);
  }
}

// Exclui transação
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

    S.transactions = S.transactions.filter((x) => x.id !== id);
  } catch (e) {
    console.error("Erro ao excluir transação", e);
    alert("Erro ao excluir: " + e.message);
  }
}

// Carrega todas as informações do usuário
export async function loadAll() {
  const user = S.currentUser;
  if (!user) {
    S.transactions = [];
    S.categories = [];
    return;
  }

  try {
    // Carrega transações
    const { data: txs, error: e1 } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false });

    if (e1) throw e1;
    S.transactions = (txs || []).map(normalizeTx);

    // Carrega categorias
    const { data: cats, error: e2 } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("id");

    if (e2) throw e2;
    S.categories = cats || [];

    // Carrega preferências
    const { data: prefs, error: e3 } = await supabase
      .from("prefs")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!e3 && prefs) {
      S.dark = prefs.dark ?? false;
      S.hide = prefs.hide ?? false;
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
    const { error } = await supabase.from("prefs").upsert({
      user_id: user.id,
      dark: S.dark,
      hide: S.hide,
    });

    if (error) throw error;
  } catch (e) {
    console.error("Erro ao salvar preferências", e);
    alert("Erro ao salvar preferências: " + e.message);
  }
}
