// Configuração do Supabase
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_KEY = "chave-anon-do-supabase";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==== Autenticação ====
async function login() {
  const { error } = await supabase.auth.signInWithPassword({
    email: document.getElementById('email').value,
    password: document.getElementById('password').value
  });
  if (error) alert(error.message);
  else checkUser();
}

async function signup() {
  const { error } = await supabase.auth.signUp({
    email: document.getElementById('email').value,
    password: document.getElementById('password').value
  });
  if (error) alert(error.message);
  else alert("Cadastro realizado! Verifique seu email.");
}

async function logout() {
  await supabase.auth.signOut();
  checkUser();
}

async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    document.getElementById("auth").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadEntradas();
    loadSaidas();
    loadRelatorio();
  } else {
    document.getElementById("auth").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
}

// ==== Entradas ====
async function addEntrada() {
  const desc = document.getElementById("descEntrada").value;
  const valor = parseFloat(document.getElementById("valorEntrada").value);

  const { error } = await supabase.from("entradas").insert([{ descricao: desc, valor }]);
  if (error) alert(error.message);
  else loadEntradas();
}

async function loadEntradas() {
  const { data, error } = await supabase.from("entradas").select("*").order("data", { ascending: false });
  if (error) alert(error.message);
  else {
    const lista = document.getElementById("listaEntradas");
    lista.innerHTML = "";
    data.forEach(e => {
      const li = document.createElement("li");
      li.textContent = `${e.descricao} - R$${e.valor}`;
      lista.appendChild(li);
    });
  }
}

// ==== Saídas ====
async function addSaida() {
  const desc = document.getElementById("descSaida").value;
  const valor = parseFloat(document.getElementById("valorSaida").value);

  const { error } = await supabase.from("saidas").insert([{ descricao: desc, valor }]);
  if (error) alert(error.message);
  else loadSaidas();
}

async function loadSaidas() {
  const { data, error } = await supabase.from("saidas").select("*").order("data", { ascending: false });
  if (error) alert(error.message);
  else {
    const lista = document.getElementById("listaSaidas");
    lista.innerHTML = "";
    data.forEach(e => {
      const li = document.createElement("li");
      li.textContent = `${e.descricao} - R$${e.valor}`;
      lista.appendChild(li);
    });
  }
}

// ==== Relatório ====
async function loadRelatorio() {
  const { data: entradas } = await supabase.from("entradas").select("valor");
  const { data: saidas } = await supabase.from("saidas").select("valor");

  const totalEntradas = entradas?.reduce((acc, e) => acc + Number(e.valor), 0) || 0;
  const totalSaidas = saidas?.reduce((acc, e) => acc + Number(e.valor), 0) || 0;
  const saldo = totalEntradas - totalSaidas;

  document.getElementById("saldo").textContent =
    `Entradas: R$${totalEntradas} | Saídas: R$${totalSaidas} | Saldo: R$${saldo}`;

  renderGrafico(totalEntradas, totalSaidas);
}

// ==== Gráfico ====
function renderGrafico(entradas, saidas) {
  const ctx = document.getElementById("grafico");
  new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Entradas", "Saídas"],
      datasets: [{
        data: [entradas, saidas],
        backgroundColor: ["#4CAF50", "#F44336"]
      }]
    }
  });
}

// ==== Navegação ====
function showSection(sectionId) {
  document.querySelectorAll(".page").forEach(sec => sec.style.display = "none");
  document.getElementById(sectionId).style.display = "block";
}

// Inicializar
checkUser();
