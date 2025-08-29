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
      document.getElementById("authScreen").style.display = "block";
      document.querySelector(".container").style.display = "none";
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    if (user) {
      // Usuário logado → mostra dashboard
      document.getElementById("authScreen").style.display = "none";
      document.querySelector(".container").style.display = "block";
      await loadAll();
      render();
    } else {
      // Sem usuário → mostra tela de login
      document.getElementById("authScreen").style.display = "block";
      document.querySelector(".container").style.display = "none";
    }
  } catch (e) {
    console.warn("checkUser falhou", e);
    setCurrentUser(null);
    document.getElementById("authScreen").style.display = "block";
    document.querySelector(".container").style.display = "none";
  }
}

export async function doLogin(email, password) {
  try {
    if (!window.supabase) {
      alert("Sem Supabase configurado.");
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
    // Força resetar o usuário e exibir tela de login
    setCurrentUser(null);
    document.getElementById("authScreen").style.display = "block";
    document.querySelector(".container").style.display = "none";
  }
}
