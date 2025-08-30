// ============================
// Configuração do Supabase
// ============================
const SUPABASE_URL = "https://ucqxwhukiewwcbsafslf.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcXh3aHVraWV3d2Nic2Fmc2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTAxMzIsImV4cCI6MjA3MjEyNjEzMn0.vm6-UcuObZdNEmJ53RmhNr-_ajF4a6MuUuFbuexYEUI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================
// Login e Logout
// ============================
async function login(event) {
  event.preventDefault(); // Evita o envio padrão do formulário e o recarregamento da página

  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    alert("Erro no login: " + error.message);
  } else {
    checkUser();
  }

async function logout() {
  await supabase.auth.signOut();
  document.getElementById("auth-section").classList.remove("hidden");
  document.getElementById("app-section").classList.add("hidden");
  document.getElementById("footer-menu").classList.add("hidden");
}

// ============================
// Checar usuário logado
// ============================
async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("footer-menu").classList.remove("hidden");
    showTab("dashboard");
    loadDashboard();
  } else {
    document.getElementById("auth-section").classList.remove("hidden");
    document.getElementById("app-section").classList.add("hidden");
    document.getElementById("footer-menu").classList.add("hidden");
  }
} // <--- A chave de fechamento foi adicionada aqui

checkUser();

// ============================
// Dashboard com saldo
// ============================
async function loadDashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: entradas } = await supabase
    .from("entradas")
    .select("valor")
    .eq("user_id", user.id);

  const { data: saidas } = await supabase
    .from("saidas")
    .select("valor")
    .eq("user_id", user.id);

  const totalEntradas = entradas.reduce((acc, e) => acc + Number(e.valor), 0);
  const totalSaidas = saidas.reduce((acc, s) => acc + Number(s.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  document.getElementById("total-entradas").textContent = `R$ ${totalEntradas.toFixed(2)}`;
  document.getElementById("total-saidas").textContent = `R$ ${totalSaidas.toFixed(2)}`;
  document.getElementById("saldo").textContent = `R$ ${saldo.toFixed(2)}`;

  renderGrafico(totalEntradas, totalSaidas);
}

// ============================
// Gráfico do Dashboard
// ============================
let grafico = null;
function renderGrafico(entradas, saidas) {
  const ctx = document.getElementById("grafico")?.getContext("2d");
  if (ctx) {
    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Entradas", "Saídas"],
        datasets: [{
          data: [entradas, saidas],
          backgroundColor: ["#22c55e", "#ef4444"],
          borderWidth: 0
        }]
      },
      options: {
        plugins: {
          legend: {
            labels: { color: "#fff" }
          }
        }
      }
    });
  } else {
    console.error("Elemento canvas não encontrado.");
  }
}

// ============================
// Aguardar carregamento do DOM
// ============================
document.addEventListener("DOMContentLoaded", function() {
  loadDashboard();
});
// ============================
// Carregar Extrato
// ============================
async function loadExtrato() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let { data: entradas } = await supabase
    .from("entradas")
    .select("id, descricao, valor, categoria, created_at")
    .eq("user_id", user.id);

  let { data: saidas } = await supabase
    .from("saidas")
    .select("id, descricao, valor, categoria, created_at")
    .eq("user_id", user.id);

  let extrato = [
    ...entradas.map(e => ({ ...e, tipo: "entrada" })),
    ...saidas.map(s => ({ ...s, tipo: "saida" }))
  ];

  extrato.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const lista = document.getElementById("extrato-lista");
  lista.innerHTML = "";

  extrato.forEach(item => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center bg-gray-700 p-3 rounded-lg";
    li.innerHTML = ` 
      <div>
        <p class="font-semibold">${item.descricao} <small class="text-gray-400">(${item.categoria})</small></p>
        <small class="text-gray-400">${new Date(item.created_at).toLocaleDateString("pt-BR")}</small>
      </div>
      <span class="${item.tipo === "entrada" ? "text-green-400" : "text-red-400"} font-bold">
        ${item.tipo === "entrada" ? "+" : "-"} R$ ${Number(item.valor).toFixed(2)}
      </span>
    `;
    lista.appendChild(li);
  });
}

// ============================
// Relatórios Mensais
// ============================
async function loadRelatorios() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let { data: entradas } = await supabase
    .from("entradas")
    .select("valor, created_at")
    .eq("user_id", user.id);

  let { data: saidas } = await supabase
    .from("saidas")
    .select("valor, created_at")
    .eq("user_id", user.id);

  function getMesAno(dateStr) {
    const d = new Date(dateStr);
    return `${("0" + (d.getMonth() + 1)).slice(-2)}/${d.getFullYear()}`;
  }

  let resumo = {};
  entradas.forEach(e => {
    let mes = getMesAno(e.created_at);
    if (!resumo[mes]) resumo[mes] = { entradas: 0, saidas: 0 };
    resumo[mes].entradas += Number(e.valor);
  });

  saidas.forEach(s => {
    let mes = getMesAno(s.created_at);
    if (!resumo[mes]) resumo[mes] = { entradas: 0, saidas: 0 };
    resumo[mes].saidas += Number(s.valor);
  });

  let meses = Object.keys(resumo).sort((a, b) => {
    let [ma, aa] = a.split("/").map(Number);
    let [mb, ab] = b.split("/").map(Number);
    return new Date(aa, ma - 1) - new Date(ab, mb - 1);
  });

  let valoresEntradas = meses.map(m => resumo[m].entradas);
  let valoresSaidas = meses.map(m => resumo[m].saidas);

  const ctx = document.getElementById("grafico-relatorio").getContext("2d");
  if (window.relatorioChart) window.relatorioChart.destroy();

  window.relatorioChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [
        { label: "Entradas", data: valoresEntradas, backgroundColor: "rgba(34,197,94,0.7)" },
        { label: "Saídas", data: valoresSaidas, backgroundColor: "rgba(239,68,68,0.7)" }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: value => `R$ ${value}` }
        }
      }
    }
  });

  loadRelatorioCategorias();
}

// ============================
// Relatório por Categoria (Saídas)
// ============================
async function loadRelatorioCategorias() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let { data: saidas } = await supabase
    .from("saidas")
    .select("valor, categoria")
    .eq("user_id", user.id);

  let resumo = {};
  saidas.forEach(s => {
    let cat = s.categoria || "Outros";
    if (!resumo[cat]) resumo[cat] = 0;
    resumo[cat] += Number(s.valor);
  });

  let categorias = Object.keys(resumo);
  let valores = Object.values(resumo);
  let cores = categorias.map((_, i) => `hsl(${(i * 60) % 360}, 70%, 55%)`);

  const ctx = document.getElementById("grafico-categorias").getContext("2d");
  if (window.categoriasChart) window.categoriasChart.destroy();

  window.categoriasChart = new Chart(ctx, {
    type: "doughnut",
    data: { labels: categorias, datasets: [{ data: valores, backgroundColor: cores }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

// ============================
// Controle de Tabs
// ============================
function showTab(tabId) {
  const sections = ["dashboard", "extrato", "relatorios", "metas", "perfil"];
  sections.forEach(sec => {
    document.getElementById(sec).classList.add("hidden");
  });
  document.getElementById(tabId).classList.remove("hidden");

  if (tabId === "extrato") {
    loadExtrato();
  } else if (tabId === "relatorios") {
    loadRelatorios();
  } else if (tabId === "dashboard") {
    loadDashboard();
  }
}
// ======================
// Checar sessão inicial
// ======================
async function checkUser() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    loadDashboard();
  }
}

checkUser();

