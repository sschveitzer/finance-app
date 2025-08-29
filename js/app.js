// =============================
// app.js - Inicialização da UI
// =============================

import { doLogin, doSignup, doLogout } from "./js/auth.js";
import { addTransaction } from "./js/storage.js";
import { setModalTipo, toggleModal } from "./js/ui.js";

// =============================
// Utilitários
// =============================
const qs = (sel) => document.querySelector(sel);

// =============================
// Autenticação (login / signup / logout)
// =============================

// Login
qs("#btnLogin")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = qs("#email").value;
  const password = qs("#password").value;
  await doLogin(email, password);
});

// Cadastro
qs("#btnSignup")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = qs("#email").value;
  const password = qs("#password").value;
  await doSignup(email, password);
});

// Logout (dashboard)
qs("#btnLogout")?.addEventListener("click", async () => {
  await doLogout();
});

// =============================
// Modal de lançamentos
// =============================

// Abrir modal (FAB → btnAdd)
qs("#btnAdd")?.addEventListener("click", () => {
  setModalTipo("Despesa");
  toggleModal(true, "Nova Despesa");
});

// Fechar modal
qs("#btnCloseModal")?.addEventListener("click", () => toggleModal(false));
qs("#btnCancel")?.addEventListener("click", () => toggleModal(false));

// Salvar lançamento
qs("#salvar")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const valor = parseFloat(qs("#valor").value || 0);
  const tipo = document.querySelector(".typetabs button.active")?.dataset.type || "Despesa";
  const categoria = qs("#categoria").value;
  const data = qs("#data").value;
  const descricao = qs("#descricao").value;
  const obs = qs("#obs").value;

  if (!valor || !data || !categoria) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  await addTransaction({
    valor,
    tipo,
    categoria,
    data,
    descricao,
    obs,
  });

  toggleModal(false);
});

// =============================
// Supabase Auth State
// =============================

// Não chamamos checkUser() aqui diretamente para evitar conflito no F5.
// O controle de sessão já é feito no index.html e dashboard.html
// usando supabase.auth.getSession() + onAuthStateChange.

// Apenas mantemos o listener caso a sessão mude:
if (window.supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      // Se perder sessão → volta pro login
      if (!window.location.pathname.includes("index.html")) {
        window.location.href = "index.html";
      }
    }
  });
}
