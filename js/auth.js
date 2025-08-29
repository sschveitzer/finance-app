// =============================
// auth.js - Autenticação
// =============================
import { setCurrentUser } from "./state.js";
import { loadAll } from "./storage.js";
import { render } from "./ui.js";

// Verifica usuário logado
export async function checkUser() {
  try {
    if (!window.supabase) {
      setCurrentUser(null);
      window.location.href = "index.html"; // sem supabase → login
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    if (user) {
      // Usuário logado → só carrega dados se estiver no dashboard
      if (window.location.pathname.includes("dashboard.html")) {
        await loadAll();
        render();
      } else {
        // se estiver no login mas já logado → manda pro dashboard
        window.location.href = "dashboard.html";
      }
    } else {
      // sem usuário → manda pro login
      if (!window.location.pathname.includes("index.html")) {
        window.location.href = "index.html";
      }
    }
  } catch (e) {
    console.warn("checkUser falhou", e);
    setCurrentUser(null);
    window.location.href = "index.html";
  }
}

// Login
export async function doLogin(email, password) {
  try {
    if (!window.supabase) {
      alert("Sem Supabase configurado.");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    } else {
      // 🔑 Login OK → redireciona para dashboard
      window.location.href = "dashboard.html";
    }
  } catch (e) {
    alert(e.message || "Erro ao entrar");
  }
}

// Cadastro
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

// Logout
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
    // 🚪 sempre volta para login
    window.location.href = "index.html";
  }
}
