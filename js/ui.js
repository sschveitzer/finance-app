// =============================
// ui.js - Interface do usuário
// =============================
import { S, qs, fmtMoney } from "./state.js";
import { deleteTransaction, savePrefs } from "./storage.js";

// Renderiza dashboard
export function render() {
  renderTransactions();
  renderCategories();
  renderPrefs();
}

// Lista transações
function renderTransactions() {
  const list = qs("#txList");
  if (!list) return;

  if (!S.transactions.length) {
    list.innerHTML = `<li class="item">Nenhuma transação</li>`;
    return;
  }

  list.innerHTML = S.transactions.map((t) => `
    <li class="item">
      <div>
        <strong>${t.descricao || "(Sem descrição)"}</strong><br>
        <span class="muted">${t.categoria} • ${t.data}</span>
      </div>
      <div>
        <span class="${t.tipo === "Receita" ? "ok" : "warn"}">
          ${fmtMoney(t.valor)}
        </span>
        <button class="btn secondary" data-del="${t.id}">🗑</button>
      </div>
    </li>
  `).join("");

  // Bind delete
  list.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await deleteTransaction(btn.dataset.del);
      render();
    })
  );
}

// Lista categorias
function renderCategories() {
  const el = qs("#catList");
  if (!el) return;

  if (!S.categories.length) {
    el.innerHTML = `<li class="item">Nenhuma categoria</li>`;
    return;
  }

  el.innerHTML = S.categories.map((c) => `
    <li class="item">
      <span>${c.nome}</span>
    </li>
  `).join("");
}

// Renderiza preferências (dark/hide)
function renderPrefs() {
  document.body.classList.toggle("dark", S.dark);

  const hideBtn = qs("#btnToggleHide");
  if (hideBtn) {
    hideBtn.textContent = S.hide ? "👁 Mostrar valores" : "🙈 Esconder valores";
    hideBtn.onclick = async () => {
      S.hide = !S.hide;
      await savePrefs();
      render();
    };
  }
}
