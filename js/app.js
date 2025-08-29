import { qs, qsa, setModalTipo } from "./state.js";
import { addOrUpdate, toggleModal } from "./ui.js";
import { checkUser, doLogin, doSignup, doLogout } from "./auth.js";
import { exportData, importData, resetAll } from "./backup.js";

function init() {
  qs("#btnLogin")?.addEventListener("click", () => doLogin(qs("#email").value, qs("#password").value));
  qs("#btnSignup")?.addEventListener("click", () => doSignup(qs("#email").value, qs("#password").value));
  qs("#btnLogout")?.addEventListener("click", doLogout);

  qs("#fab")?.addEventListener("click", () => { setModalTipo("Despesa"); toggleModal(true, "Nova Despesa"); });
  qs("#salvar")?.addEventListener("click", addOrUpdate);

  qs("#btnExport")?.addEventListener("click", exportData);
  qs("#fileImport")?.addEventListener("change", importData);
  qs("#btnReset")?.addEventListener("click", resetAll);

  checkUser();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

supabase.auth.onAuthStateChange(() => checkUser());