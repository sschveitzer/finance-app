import { S, getCurrentUser, normalizeTx } from "./state.js";

export async function loadAll() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  try {
    const uid = currentUser.id || currentUser.user?.id;
    const { data: tx } = await supabase.from("transactions").select("*").eq("user_id", uid).order("data", { ascending: true });
    const { data: cats } = await supabase.from("categories").select("*").eq("user_id", uid).order("nome", { ascending: true });
    const { data: prefs } = await supabase.from("prefs").select("*").eq("user_id", uid);

    S.tx = (tx || []).map(normalizeTx).filter(Boolean);
    S.cats = cats || [];
    if (prefs && prefs.length) {
      S.month = prefs[0].month || S.month;
      S.hide = !!prefs[0].hide;
      S.dark = !!prefs[0].dark;
    }
  } catch (e) {
    console.error("Erro loadAll", e);
    S.tx = [];
  }
}

export async function saveTx() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const uid = currentUser.id || currentUser.user?.id;
  const withUser = S.tx.map((t) => ({ ...t, user_id: uid }));
  await supabase.from("transactions").upsert(withUser, { onConflict: "id" });
}

export async function saveCats() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const uid = currentUser.id || currentUser.user?.id;
  const withUser = S.cats.map((c) => ({ ...c, user_id: uid }));
  await supabase.from("categories").upsert(withUser, { onConflict: "id" });
}

export async function savePrefs() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const uid = currentUser.id || currentUser.user?.id;
  const prefs = { id: uid, user_id: uid, month: S.month, hide: S.hide, dark: S.dark };
  await supabase.from("prefs").upsert(prefs, { onConflict: "id" });
}
