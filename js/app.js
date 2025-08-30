// ======================
// Configuração do Supabase
// ======================
const SUPABASE_URL = "https://ucqxwhukiewwcbsafslf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcXh3aHVraWV3d2Nic2Fmc2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTAxMzIsImV4cCI6MjA3MjEyNjEzMn0.vm6-UcuObZdNEmJ53RmhNr-_ajF4a6MuUuFbuexYEUI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ======================
// Seletores
// ======================
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const footerMenu = document.getElementById("footer-menu");

const saldoEl = document.getElementById("saldo");
const entradasEl = document.getElementById("total-entradas");
const saidasEl = document.getElementById("total-saidas");

let grafico = null;

// ======================
// Login / Logout
// ======================
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("Erro no login: " + error.message);
  } else {
    loadDashboard();
  }
}

async function logout() {
  await supabase.auth.signOut();
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  footerMenu.classList.add("hidden");
}

// ======================
// Carregar Dashboard
// ======================
async function loadDashboard() {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  footerMenu.classList.remove("hidden");
  await loadRelatorio();
}

async function loadRelatorio() {
  const { data: { user } } = await supabase.auth.getUser();

  // Buscar entradas do usuário logado
  const { data: entradas, error: errEntradas } = await supabase
    .from("entradas")
    .select("*")
    .eq("user_id", user.id);

  // Buscar saídas do usuário logado
  const { data: saidas, error: errSaidas } = await supabase
    .from("saidas")
    .select("*")
    .eq("user_id", user.id);

  if (errEntradas || errSaidas) {
    console.error("Erro carregando dados", errEntradas || errSaidas);
    return;
  }

  const totalEntradas = entradas.reduce((acc, e) => acc + Number(e.valor), 0);
  const totalSaidas = saidas.reduce((acc, s) => acc + Number(s.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  entradasEl.textContent = `R$ ${totalEntradas.toFixed(2)}`;
  saidasEl.textContent = `R$ ${totalSaidas.toFixed(2)}`;
  saldoEl.textContent = `R$ ${saldo.toFixed(2)}`;

  renderGrafico(totalEntradas, totalSaidas);
}

// ======================
// Gráfico
// ======================
function renderGrafico(entradas, saidas) {
  const ctx = document.getElementById("grafico").getContext("2d");

  if (grafico) {
    grafico.destroy();
  }

  grafico = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Entradas", "Saídas"],
      datasets: [
        {
          data: [entradas, saidas],
          backgroundColor: ["#22c55e", "#ef4444"], // verde, vermelho
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: "#fff",
          },
        },
      },
    },
  });
}

// ======================
// Adicionar Entrada
// ======================
async function addEntrada() {
  const desc = document.getElementById("entrada-desc").value;
  const valor = parseFloat(document.getElementById("entrada-valor").value);

  if (!desc || !valor) {
    alert("Preencha descrição e valor");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("entradas").insert([
    { descricao: desc, valor, user_id: user.id }
  ]);

  if (error) {
    alert("Erro ao adicionar entrada: " + error.message);
  } else {
    document.getElementById("entrada-desc").value = "";
    document.getElementById("entrada-valor").value = "";
    loadRelatorio();
  }
}

// ======================
// Adicionar Saída
// ======================
async function addSaida() {
  const desc = document.getElementById("saida-desc").value;
  const valor = parseFloat(document.getElementById("saida-valor").value);

  if (!desc || !valor) {
    alert("Preencha descrição e valor");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("saidas").insert([
    { descricao: desc, valor, user_id: user.id }
  ]);

  if (error) {
    alert("Erro ao adicionar saída: " + error.message);
  } else {
    document.getElementById("saida-desc").value = "";
    document.getElementById("saida-valor").value = "";
    loadRelatorio();
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
