// =============================
// app.js - Inicialização & binds
// =============================
import { qs, qsa, setModalTipo } from "./state.js";
import { addOrUpdate, toggleModal, render } from "./ui.js";
import { checkUser, doLogin, doSignup, doLogout } from "./auth.js";
import { exportData, importData, resetAll } from "./backup.js";

function bindGlobalUI() {
  // Nav tabs
  qsa(".tabs .tab").forEach((b) => {
    b.addEventListener("click", () => {
      const tab = b.dataset.tab;
      document.querySelectorAll(".tabs .tab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("section").forEach((s) => s.classList.toggle("active", s.id === tab));
    });
  });

  // Botões auth
  qs("#btnLogin")?.addEventListener("click", () => doLogin(qs("#email").value, qs("#password").value));
  qs("#btnSignup")?.addEventListener("click", () => doSignup(qs("#email").value, qs("#password").value));
  qs("#btnLogout")?.addEventListener("click", doLogout);

  // Novo lançamento
  qs("#fab")?.addEventListener("click", () => { setModalTipo("Despesa"); toggleModal(true, "Nova Despesa"); });
  qs("#btnNovo")?.addEventListener("click", () => { setModalTipo("Despesa"); toggleModal(true, "Nova Despesa"); });
  qs("#salvar")?.addEventListener("click", addOrUpdate);
  qs("#cancelar")?.addEventListener("click", () => toggleModal(false));
  qs("#closeModal")?.addEventListener("click", () => toggleModal(false));

  // Tabs de tipo (Despesa/Receita/Transferência)
  qs("#tipoTabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-type]");
    if (!btn) return;
    qsa("#tipoTabs button").forEach((x) => x.classList.toggle("active", x === btn));
    setModalTipo(btn.dataset.type);
  });

  // Filtros e busca da dashboard
  qs("#filterTipo")?.addEventListener("change", (e) => { window.S.filterTipo = e.target.value; render(); });
  qs("#searchLanc")?.addEventListener("input", (e) => { window.S.search = e.target.value || ""; render(); });

  // Toggle hide/dark
  qs("#toggleHide")?.addEventListener("change", () => { window.S.hide = !!qs("#toggleHide").checked; render(); });
  qs("#toggleDark")?.addEventListener("click", () => { window.S.dark = !window.S.dark; render(); });

  // Categorias
  qs("#addCat")?.addEventListener("click", async () => {
    const name = (qs("#newCatName")?.value || "").trim();
    if (!name) return;
    window.S.cats.push({ id: crypto.randomUUID?.() || Date.now().toString(), nome: name });
    qs("#newCatName").value = "";
    const { saveCats } = await import("./storage.js"); // lazy import para evitar ciclo
    await saveCats();
    render();
  });

  // Backup
  qs("#btnExport")?.addEventListener("click", exportData);
  qs("#fileImport")?.addEventListener("change", importData);
  qs("#btnReset")?.addEventListener("click", resetAll);

  // Atalhos
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "n") { setModalTipo("Despesa"); toggleModal(true, "Nova Despesa"); }
    if (e.key === "Escape") toggleModal(false);
  });
}

async function start() {
  // Expor S global para handlers simples
  window.S = (await import("./state.js")).S;
  bindGlobalUI();
  await checkUser();
}

// DOM ready
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();

// Reagir à mudança de auth
if (window.supabase?.auth) {
  supabase.auth.onAuthStateChange(() => checkUser());
}

