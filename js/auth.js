// =============================
// auth.js - Autenticação
// =============================
import { setCurrentUser } from "./state.js";
import { loadAll } from "./storage.js";
import { render } from "./ui.js";

export async function checkUser() {
  try {
    if (!window.supabase) {
      setCurrentUser(null);
      await loadAll();
      render();
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
    await loadAll();
    render();
  } catch (e) {
    console.warn("checkUser falhou", e);
    setCurrentUser(null);
    await loadAll();
    render();
  }
}

export async function doLogin(email, password) {
  try {
    if (!window.supabase) { 
      alert("Sem Supabase configurado. Os dados serão salvos localmente."); 
      return; 
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  } finally {
    await checkUser();
  }
}

export async function doSignup(email, password) {
  try {
    if (!window.supabase) { 
      alert("Sem Supabase configurado."); 
      return; 
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("Conta criada! Verifique seu email e depois faça login.");
  } catch (e) {
    alert(e.message || "Erro ao cadastrar");
  }
}

export async function doLogout() {
  try {
    if (window.supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Erro no logout:", error.message);
        alert("Erro ao sair: " + error.message);
      }
    }
  } catch (e) {
    console.error("Falha no logout", e);
  } finally {
    // Força resetar estado e voltar pro login
    setCurrentUser(null);
    await checkUser();
  }
}
