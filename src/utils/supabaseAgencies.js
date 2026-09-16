// Capa de datos para la tabla COMPARTIDA `agencies` en Supabase — el
// reemplazo "de verdad" de las agencias cargadas por el admin: a diferencia
// de utils/customAgencies.js (localStorage, solo ESTE dispositivo), lo que
// se guarda aquí lo ve cualquier visitante del sitio (clientes llenando el
// formulario incluidos), en cualquier dispositivo.
//
// Ver README → "Base de datos compartida (Supabase)" para el SQL de la
// tabla y las políticas de Row Level Security.
import { geocodePlace } from '../data/peruGeo'
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient'

const TABLE = 'agencies'
const BATCH_SIZE = 400 // margen bajo el límite de payload de PostgREST

function label(a) {
  return [a.department, a.province, a.district, a.zone].filter(Boolean).join(' / ')
}

function fromRow(row) {
  const a = {
    courier: String(row.courier || '').trim().toLowerCase(),
    courierLabel: row.courier_label || '',
    department: row.department || '',
    province: row.province || '',
    district: row.district || '',
    zone: row.zone || row.district || '',
    address: row.address || '',
    reference: row.reference || '',
    lat: Number(row.lat),
    lng: Number(row.lng),
  }
  return {
    ...a,
    id: `sb-${row.id}`,
    label: label(a),
    custom: true,
    source: 'supabase',
  }
}

// Cache en memoria (no localStorage: queremos datos frescos por sesión,
// pero sin re-consultar en cada tecleo del buscador o cada cambio de courier).
let cache = null
let cacheAt = 0
const TTL_MS = 60_000

export function invalidateSupabaseAgenciesCache() {
  cache = null
}

/** Todas las agencias guardadas en Supabase, normalizadas. [] si no hay conexión o no está configurado. */
export async function fetchAllSupabaseAgencies({ force = false } = {}) {
  if (!isSupabaseConfigured()) return []
  if (!force && cache && Date.now() - cacheAt < TTL_MS) return cache
  try {
    const supabase = await getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: true })
    if (error) throw error
    const rows = (data || []).map(fromRow)
    cache = rows
    cacheAt = Date.now()
    return rows
  } catch (err) {
    console.warn('[supabase] No se pudo leer agencias:', err?.message || err)
    return []
  }
}

export async function fetchSupabaseAgenciesForCourier(courierId) {
  const all = await fetchAllSupabaseAgencies()
  return all.filter((a) => a.courier === courierId)
}

/** Couriers detectados en las filas de Supabase que no vengan ya en un set conocido. */
export function extractCouriersFromRows(rows, knownIds = new Set()) {
  const seen = new Map()
  for (const r of rows) {
    if (!r.courier || knownIds.has(r.courier) || seen.has(r.courier)) continue
    const lbl = r.courierLabel?.trim() || r.courier.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    seen.set(r.courier, { id: r.courier, label: lbl })
  }
  return [...seen.values()]
}

function normalizeForInsert(raw) {
  const a = {
    courier: String(raw.courier || '').trim().toLowerCase(),
    courier_label: raw.courierLabel ? String(raw.courierLabel).trim() : null,
    department: String(raw.department || '').trim(),
    province: String(raw.province || '').trim(),
    district: String(raw.district || '').trim(),
    zone: String(raw.zone || raw.district || '').trim(),
    address: String(raw.address || '').trim(),
    reference: String(raw.reference || '').trim(),
  }
  let lat = Number(raw.lat)
  let lng = Number(raw.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const g = geocodePlace(a)
    lat = g.lat
    lng = g.lng
  }
  return { ...a, lat, lng }
}

/**
 * Inserta agencias en Supabase en lotes. Devuelve { inserted, errors } —
 * `errors` trae un mensaje por lote fallido (el resto de los lotes se
 * intenta igual, no se detiene todo por un lote con problemas).
 */
export async function insertAgenciesToSupabase(rawList) {
  const supabase = await getSupabaseClient()
  if (!supabase) return { inserted: 0, errors: ['Supabase no está configurado.'] }

  const valid = rawList.filter((r) => r && r.courier && r.address).map(normalizeForInsert)
  if (!valid.length) return { inserted: 0, errors: ['Ninguna fila tiene courier y dirección.'] }

  let inserted = 0
  const errors = []
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE)
    const { error, count } = await supabase.from(TABLE).insert(batch, { count: 'exact' })
    if (error) errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
    else inserted += count ?? batch.length
  }
  invalidateSupabaseAgenciesCache()
  return { inserted, errors }
}

/** Borra TODAS las agencias de un courier en Supabase (dato compartido con todos los visitantes). */
export async function deleteSupabaseAgenciesForCourier(courierId) {
  const supabase = await getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.' }
  const { error } = await supabase.from(TABLE).delete().eq('courier', courierId)
  invalidateSupabaseAgenciesCache()
  return { ok: !error, error: error?.message }
}

/** Borra TODAS las agencias de TODOS los couriers en Supabase. Úsalo con cuidado: es compartido. */
export async function deleteAllSupabaseAgencies() {
  const supabase = await getSupabaseClient()
  if (!supabase) return { ok: false, error: 'Supabase no está configurado.' }
  const { error } = await supabase.from(TABLE).delete().not('id', 'is', null)
  invalidateSupabaseAgenciesCache()
  return { ok: !error, error: error?.message }
}
