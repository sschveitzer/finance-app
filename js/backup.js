// =============================
// backup.js - Export/Import/Reset
// =============================
import { S, normalizeTx } from "./js/state.js";
import { saveTx, saveCats, savePrefs } from "./js/storage.js";
import { render } from "./js/ui.js";

export function exportData() {
  const data = { tx: S.tx, cats: S.cats, prefs: { month: S.month, hide: S.hide, dark: S.dark } };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "backup.json";
  a.click();
}

export function importData(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.tx)) S.tx = data.tx.map(normalizeTx).filter(Boolean);
      if (Array.isArray(data.cats)) S.cats = data.cats;
      if (data.prefs) {
        S.month = data.prefs.month || S.month;
        S.hide = !!data.prefs.hide;
        S.dark = !!data.prefs.dark;
      }
      await saveTx(); await saveCats(); await savePrefs();
      render();
    } catch { alert("Arquivo inválido"); }
  };
  reader.readAsText(file);
}

export function resetAll() {
  if (!confirm("Apagar TODOS os dados locais?")) return;
  S.tx = [];
  S.cats = [{ id: "c1", nome: "Geral" }];
  saveTx(); saveCats(); savePrefs();
  render();
}

