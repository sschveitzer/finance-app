// =============================
// app.js - Fluxo principal
// =============================
import { saveTransaction } from "./storage.js";
import { render } from "./ui.js";
import { getCurrentUser } from "./state.js";

// =============================
// Utils
// =============================
const qs = (s) => document.querySelector(s);

// =============================
// Modal Lançamento
// =============================
const modal = qs("#modalLanc");
qs("#btnAdd")?.addEventListener("click", () => {
  modal.style.display = "flex";
});
qs("#btnCloseModal")?.addEventListener("click", () => {
  modal.style.display = "none";
});
qs("#btnCancel")?.addEventListener("click", () => {
  modal.style.display = "none";
});

// =============================
// Tabs de tipo
// =============================
document.querySelectorAll(".typetabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".typetabs button").forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");
  });
});

// =============================
// Salvar lançamento
// =============================
qs("#salvar")?.addEventListener("click", async (e) => {
  e.preventDefault();

  const valor = parseFloat(qs("#mValorBig").value || 0);
  const tipo =
    document.querySelector(".typetabs button.active")?.dataset.type ||
    "Despesa";
  const categoria = qs("#mCategoria").value;
  const data = qs("#mData").value;
  const descricao = qs("#mDesc").value;
  const obs = qs("#mObs").value;

  if (!valor || !data || !categoria) {
    alert("Preencha os campos obrigatórios.");
    return;
  }

  const tx = {
    user_id: getCurrentUser()?.id,
    tipo,
    categoria,
    data,
    descricao,
    obs,
    valor,
  };

  await addTransaction(tx);
  modal.style.display = "none";
  render();
});
