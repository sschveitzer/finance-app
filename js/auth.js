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
      window.location.href = "index.html"; // se não tiver supabase → vai pro login
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    if (user) {
      // Usuário logado → carrega dashboard
      await loadAll();
      render();
    } else {
      // Não logado → manda pro login
      window.location.href = "index.html";
    }
  } catch (e) {
    console.warn("checkUser falhou", e);
    setCurrentUser(null);
    window.location.href = "index.html";
  }
}

export async function doLogin(email, password) {
  try {
    if (!window.supabase) {
      alert("Sem Supabase configurado.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    // login OK → redireciona para dashboard
    window.location.href = "dashboard.html";
  } catch (e) {
    alert(e.message || "Erro ao entrar");
  }
}

export async function doSignup(email, password) {
  try {
    if (!window.supabase) {
      alert("Sem Supabase configurado.");
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
    } else {
      alert("Conta criada! Verifique seu email e depois faça login.");
    }
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
    setCurrentUser(null);
    // sempre redireciona para login
    window.location.href = "index.html";
  }
}
