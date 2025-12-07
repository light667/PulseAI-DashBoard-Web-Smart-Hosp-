import supabase from './supabase.js'

const profileForm = document.getElementById('profileForm')
const servicesGrid = document.getElementById('servicesGrid')
const btnSubmit = document.getElementById('btnSubmit')
const btnGeo = document.getElementById('btnGeo')
let openings = []
let userLocation = null


// populate day/time selects
const daySelect = document.getElementById('daySelect')
const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
days.forEach((d,i)=>{ const opt = document.createElement('option'); opt.value = d; opt.textContent = d; daySelect.appendChild(opt) })


const timeRange = document.getElementById('timeRange')
const ranges = ['00:00-08:00','08:00-12:00','12:00-16:00','16:00-20:00','20:00-23:59']
ranges.forEach(r=>{ const opt = document.createElement('option'); opt.value=r; opt.textContent=r; timeRange.appendChild(opt) })


// addOpening
document.getElementById('addOpening')?.addEventListener('click', ()=>{
openings.push({day: daySelect.value, range: timeRange.value})
document.getElementById('openingsList').innerText = openings.map(o=>`${o.day} ${o.range}`).join(' | ')
})


// geoloc
btnGeo?.addEventListener('click', ()=>{
if(!navigator.geolocation) return alert('Géo non supportée')
navigator.geolocation.getCurrentPosition(p=>{ userLocation = {lat: p.coords.latitude, lng: p.coords.longitude}; document.getElementById('geoStatus').innerText = `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}` }, e=>alert(e.message))
})


// load services and show form if user has a hospital row
(async function init(){
// Vérifier la session
const { data: { session } } = await supabase.auth().getSession()
const user = session?.user
// load services
const { data: services } = await supabase.from('services').select('*').order('id')
services.forEach(s=>{
const div = document.createElement('div'); div.className='service-item'
div.innerHTML = `<input type=checkbox id='svc_${s.id}' value='${s.id}'><label for='svc_${s.id}'>${s.name}</label>`
servicesGrid.appendChild(div)
})


if(!user) return
// if user already has hospital row -> show management instead (handled by separate page)
const { data: hospital } = await supabase.from('hospitals').select('*').eq('owner_id', user.id).single()
if(hospital){
// show profile form to complete if not completed
profileForm.hidden = false
document.getElementById('name').value = hospital.name || ''
document.getElementById('email').value = hospital.email || ''
document.getElementById('phone').value = hospital.phone || ''
document.getElementById('address').value = hospital.address || ''
// load service relations
const { data: rels } = await supabase.from('hospital_services').select('service_id').eq('hospital_id', hospital.id)
rels.forEach(r=>{ const cb = document.getElementById('svc_'+r.service_id); if(cb) cb.checked = true })
}
})()


btnSubmit?.addEventListener('click', async ()=>{
const { data: { session } } = await supabase.auth().getSession()
const user = session?.user
if(!user) return alert('Connecte toi d abord')
const name = document.getElementById('name').value
const email = document.getElementById('email').value
const phone = document.getElementById('phone').value
const address = document.getElementById('address').value
const description = document.getElementById('description').value
const checked = Array.from(document.querySelectorAll('#servicesGrid input:checked')).map(i=>parseInt(i.value))


// update hospitals row
const payload = {
owner_id: user.id, name, email, phone, address, description,
location: userLocation ? { type:'Point', coordinates:[userLocation.lng, userLocation.lat] } : null,
openings: openings, status: 'pending'
}
const { data, error } = await supabase.from('hospitals').update(payload).eq('owner_id', user.id).select()
if(error) return alert(error.message)
const hospitalId = data[0].id

// upsert services relations
await supabase.from('hospital_services').delete().eq('hospital_id', hospitalId)
for(const svcId of checked){
await supabase.from('hospital_services').insert({ hospital_id: hospitalId, service_id: svcId })
}

alert('Profil mis à jour avec succès!')
})