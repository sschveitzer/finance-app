// =============================
// auth.js - Autenticação
// =============================
import { setCurrentUser } from "./js/state.js";
import { loadAll } from "./js/storage.js";
import { render } from "./js/ui.js";

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

    // ✅ usa getSession (pega direto do localStorage, sem perder no F5)
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.warn("Erro ao obter sessão:", error);

    const user = session?.user || null;
    setCurrentUser(user);

    if (user) {
      // Usuário logado
      if (window.location.pathname.includes("dashboard.html")) {
        await loadAll();
        render();
      } else if (window.location.pathname.includes("index.html")) {
        window.location.href = "dashboard.html";
      }
    } else {
      // Sem usuário → sempre força login
      if (!window.location.pathname.includes("index.html")) {
        window.location.href = "index.html";
      }
    }
  } catch (e) {
    console.error("checkUser falhou", e);
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
      window.location.href = "dashboard.html"; // ✅ redireciona após login
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
    window.location.href = "index.html"; // 🚪 força login sempre
  }
}
