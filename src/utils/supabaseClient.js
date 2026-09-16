// Cliente de Supabase para la base de datos COMPARTIDA de agencias.
//
// La app sigue siendo un sitio estático (sin backend propio): el navegador
// habla directo con Supabase usando la "anon key" (pensada para ser pública
// — la seguridad real se controla con Row Level Security en la base de
// datos, no ocultando esta clave). Ver README → "Base de datos compartida
// (Supabase)" para el SQL de la tabla + políticas RLS.
//
// Para que TODOS los visitantes (no solo el admin) puedan leer/escribir,
// la URL y la anon key deben ir como variables de entorno de build
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, ver .env.example) — quedan
// horneadas en el bundle igual que el resto del código.
//
// Además, el panel de administrador permite pegar estos mismos valores y
// guardarlos en localStorage SOLO para probarlos en ESE dispositivo sin
// esperar un redeploy (útil en desarrollo). Esa copia local nunca llega a
// los demás visitantes.
const LOCAL_URL_KEY = 'anotate-supabase-url'
const LOCAL_ANON_KEY = 'anotate-supabase-anon-key'

function readLocal(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

/** De dónde sale la config activa: variables de entorno (build) o localStorage (solo este dispositivo). */
export function getSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const localUrl = readLocal(LOCAL_URL_KEY)
  const localKey = readLocal(LOCAL_ANON_KEY)

  if (envUrl && envKey) return { url: envUrl, key: envKey, source: 'env' }
  if (localUrl && localKey) return { url: localUrl, key: localKey, source: 'local' }
  return { url: '', key: '', source: null }
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().source !== null
}

export function setLocalSupabaseConfig({ url, key }) {
  try {
    localStorage.setItem(LOCAL_URL_KEY, (url || '').trim())
    localStorage.setItem(LOCAL_ANON_KEY, (key || '').trim())
  } catch {
    // sin persistencia
  }
}

export function clearLocalSupabaseConfig() {
  try {
    localStorage.removeItem(LOCAL_URL_KEY)
    localStorage.removeItem(LOCAL_ANON_KEY)
  } catch {
    // sin persistencia
  }
}

let cached = null
let cachedKey = ''

/**
 * Devuelve el cliente de Supabase (creado bajo demanda) o `null` si no hay
 * configuración disponible. El import de la librería es dinámico para que
 * no viaje en el bundle principal de los clientes que nunca usan esto.
 */
export async function getSupabaseClient() {
  const { url, key } = getSupabaseConfig()
  if (!url || !key) return null
  const cacheId = `${url}::${key}`
  if (cached && cachedKey === cacheId) return cached
  const { createClient } = await import('@supabase/supabase-js')
  cached = createClient(url, key)
  cachedKey = cacheId
  return cached
}
