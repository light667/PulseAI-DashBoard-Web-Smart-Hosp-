// auth.js — gestion basique de l'authentification
import { supabase } from './supabase.js'


const btnSignup = document.getElementById('btnSignup')
const btnLogin = document.getElementById('btnLogin')
const btnLogout = document.getElementById('btnLogout')


btnSignup?.addEventListener('click', async ()=>{
const email = document.getElementById('signupEmail').value
const password = document.getElementById('signupPassword').value
const hospitalName = document.getElementById('signupHospitalName').value
if(!email||!password||!hospitalName) return alert('Remplis tous les champs')
const { data, error } = await supabase.auth.signUp({ email, password })
if(error) return alert(error.message)
// create minimal hospital row
await supabase.from('hospitals').insert([{ owner_id: data.user.id, name: hospitalName, email, status:'pending', created_at: new Date() }])
alert('Compte créé. Vérifie ton email si nécessaire.')
})


btnLogin?.addEventListener('click', async ()=>{
const email = document.getElementById('loginEmail').value
const password = document.getElementById('loginPassword').value
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if(error) return alert(error.message)
window.location.reload()
})


btnLogout?.addEventListener('click', async ()=>{
await supabase.auth.signOut(); window.location.reload()
})


// On charge l'état d'auth et affiche le formulaire
export async function currentUser(){
const { data } = await supabase.auth.getUser()
return data.user
}


// écoute des changements d'auth
supabase.auth.onAuthStateChange(()=>{
// simple reload pour actualiser l'UI
// pour dev : mieux la rafraîchir proprement
window.location.reload()
})