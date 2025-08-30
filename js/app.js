// Configuração do Supabase
const SUPABASE_URL = "https://ucqxwhukiewwcbsafslf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcXh3aHVraWV3d2Nic2Fmc2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTAxMzIsImV4cCI6MjA3MjEyNjEzMn0.vm6-UcuObZdNEmJ53RmhNr-_ajF4a6MuUuFbuexYEUI";
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

  const { data: { user } } = await supabase.auth.getUser(); // ✅ pega usuário logado

  const { error } = await supabase.from("entradas").insert([
    { descricao: desc, valor, user_id: user.id } // ✅ inclui user_id
  ]);

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

  const { data: { user } } = await supabase.auth.getUser(); // ✅ pega usuário logado

  const { error } = await supabase.from("saidas").insert([
    { descricao: desc, valor, user_id: user.id } // ✅ inclui user_id
  ]);

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

  // Destroi gráfico antigo se já existir (evita duplicar)
  if (window.myChart) {
    window.myChart.destroy();
  }

  window.myChart = new Chart(ctx, {
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

