// =============================
// app.js - Inicialização do App
// =============================
import { S, qs } from "./state.js";
import { loadAll, saveTransaction } from "./storage.js";
import { render } from "./ui.js";
import { getCurrentUser } from "./state.js";

// =============================
// Inicialização
// =============================
async function init() {
  const user = getCurrentUser();
  if (!user) {
    console.warn("Nenhum usuário logado.");
    return;
  }

  await loadAll();
  render();
  bindUI();
}

// =============================
// Eventos da interface
// =============================
function bindUI() {
  // Botão de adicionar transação (FAB)
  const fab = qs("#btnAddTx");
  if (fab) {
    fab.onclick = () => {
      openTxModal();
    };
  }

  // Botão sair
  const btnLogout = qs("#btnLogout");
  if (btnLogout) {
    btnLogout.onclick = async () => {
      if (window.supabase) {
        await supabase.auth.signOut();
      }
      window.location.href = "index.html";
    };
  }

  // Botão salvar transação no modal
  const btnSave = qs("#btnSaveTx");
  if (btnSave) {
    btnSave.onclick = async () => {
      const tx = {
        descricao: qs("#txDescricao").value,
        categoria: qs("#txCategoria").value,
        data: qs("#txData").value,
        tipo: document.querySelector("[name=tipoTx]:checked")?.value || "Despesa",
        valor: parseFloat(qs("#txValor").value) || 0,
        obs: qs("#txObs").value,
      };
      await saveTransaction(tx);
      closeTxModal();
      render();
    };
  }

  // Botão cancelar modal
  const btnCancel = qs("#btnCancelTx");
  if (btnCancel) {
    btnCancel.onclick = () => {
      closeTxModal();
    };
  }
}

// =============================
// Controle do Modal
// =============================
function openTxModal() {
  const modal = qs("#txModal");
  if (modal) modal.style.display = "flex";
}

function closeTxModal() {
  const modal = qs("#txModal");
  if (modal) modal.style.display = "none";
}

// =============================
// Start
// =============================
document.addEventListener("DOMContentLoaded", init);
