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
      if (!window.location.pathname.includes("index.html")) {
        window.location.href = "index.html";
      }
      return;
    }

    // ✅ usa getUser (mais estável no reload do Supabase)
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("Erro ao obter usuário:", error.message);
    }
    setCurrentUser(user);

    if (user) {
      // Usuário logado
      if (window.location.pathname.includes("dashboard.html")) {
        await loadAll();
        render();
      } else if (window.location.pathname.includes("index.html")) {
        // se já está logado mas na tela de login → manda pro dashboard
        window.location.href = "dashboard.html";
      }
    } else {
      // Sem usuário → sempre força login
      if (!window.location.pathname.includes("index.html")) {
        window.location.href = "index.html";
      }
    }
  } catch (e) {
    console.warn("checkUser falhou", e);
    setCurrentUser(null);
    if (!window.location.pathname.includes("index.html")) {
      window.location.href = "index.html";
    }
  }
}

// Login
export async function doLogin(email, password) {
  try {
    if (!window.supabase) {
      alert("Sem Supabase configurado.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    } else {
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
    window.location.href = "index.html"; // 🚪 volta pro login
  }
}
