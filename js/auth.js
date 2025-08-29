import { setCurrentUser } from "./state.js";
import { loadAll } from "./storage.js";
import { render } from "./ui.js";

export async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();
  setCurrentUser(user);
  if (user) {
    await loadAll();
    render();
  }
}

export async function doLogin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
  await checkUser();
}

export async function doSignup(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert("Conta criada! Agora faça login.");
}

export async function doLogout() {
  await supabase.auth.signOut();
  await checkUser();
}
