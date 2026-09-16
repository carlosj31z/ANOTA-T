// Gestión de clientes/seriales (antes: lista fija en src/data/serials.js) —
// ahora vive en Supabase para que el admin pueda agregar o retirar clientes
// sin tocar código ni redesplegar.
//
// A diferencia de `agencies` (pública por diseño), la tabla `clients` NO
// tiene ninguna política pública de lectura/escritura: toda la gestión pasa
// por funciones de Postgres (RPC) marcadas `security definer`, protegidas
// con un "admin_secret" que vive SOLO en la base de datos — nunca viaja en
// el bundle del navegador (a diferencia de ADMIN_PASSWORD en serial.js, que
// sí es visible para cualquiera que inspeccione el código). Ver README →
// "Clientes y seriales (Supabase)" para el SQL completo.
import { VALID_SERIALS } from '../data/serials'
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient'

const ADMIN_SECRET_KEY = 'anotate-admin-secret'

export function getAdminSecret() {
  try {
    return localStorage.getItem(ADMIN_SECRET_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminSecret(secret) {
  try {
    if (secret && secret.trim()) localStorage.setItem(ADMIN_SECRET_KEY, secret.trim())
    else localStorage.removeItem(ADMIN_SECRET_KEY)
  } catch {
    // sin persistencia
  }
}

/**
 * ¿El serial desbloquea el formulario? Consulta la función pública
 * `check_client_serial` (no expone la lista completa, solo boolean). Si
 * Supabase no está configurado, o la llamada falla (sin red, etc.), cae de
 * respaldo a la lista fija VALID_SERIALS para no dejar a nadie sin acceso.
 */
export async function checkClientSerial(rawSerial) {
  const serial = String(rawSerial || '').trim().toUpperCase()
  if (!serial) return false
  if (!isSupabaseConfigured()) return VALID_SERIALS.has(serial)
  try {
    const supabase = await getSupabaseClient()
    if (!supabase) return VALID_SERIALS.has(serial)
    const { data, error } = await supabase.rpc('check_client_serial', { p_serial: serial })
    if (error) throw error
    return Boolean(data)
  } catch (err) {
    console.warn('[supabase] check_client_serial falló, usando respaldo local:', err?.message || err)
    return VALID_SERIALS.has(serial)
  }
}

function unauthorizedMessage(err) {
  const msg = String(err?.message || err || '')
  if (/unauthorized/i.test(msg)) return 'Clave de administrador incorrecta.'
  return msg || 'Error desconocido.'
}

/** Lista completa de clientes (requiere la clave de administrador). */
export async function adminListClients() {
  const supabase = await getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.', clients: [] }
  const { data, error } = await supabase.rpc('admin_list_clients', { p_secret: getAdminSecret() })
  if (error) return { ok: false, error: unauthorizedMessage(error), clients: [] }
  return { ok: true, clients: data || [] }
}

export async function adminAddClient({ serial, name, notes }) {
  const supabase = await getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.' }
  const { data, error } = await supabase.rpc('admin_add_client', {
    p_secret: getAdminSecret(),
    p_serial: String(serial || '').trim().toUpperCase(),
    p_name: String(name || '').trim() || null,
    p_notes: String(notes || '').trim() || null,
  })
  if (error) return { ok: false, error: unauthorizedMessage(error) }
  return { ok: true, client: data }
}

export async function adminSetClientActive(id, active) {
  const supabase = await getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.' }
  const { data, error } = await supabase.rpc('admin_set_client_active', {
    p_secret: getAdminSecret(),
    p_id: id,
    p_active: active,
  })
  if (error) return { ok: false, error: unauthorizedMessage(error) }
  return { ok: true, client: data }
}

export async function adminDeleteClient(id) {
  const supabase = await getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.' }
  const { error } = await supabase.rpc('admin_delete_client', { p_secret: getAdminSecret(), p_id: id })
  if (error) return { ok: false, error: unauthorizedMessage(error) }
  return { ok: true }
}
