// Agencias personalizadas cargadas por el administrador (sección "Base de
// datos"). Se guardan en localStorage de ESTE dispositivo y se combinan con
// el directorio oficial en la búsqueda. Sin backend son locales al
// dispositivo; expórtalas para llevarlas a otro o para integrarlas al código.
import { geocodePlace } from '../data/peruGeo'

const KEY = 'anotate-custom-agencies'

function label(a) {
  return [a.department, a.province, a.district, a.zone].filter(Boolean).join(' / ')
}

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // sin persistencia
  }
}

/** Normaliza una entrada cruda a la forma que espera la app (con coords + id + label). */
export function normalizeAgency(raw, index = 0) {
  const a = {
    courier: String(raw.courier || '').trim().toLowerCase(),
    courierLabel: raw.courierLabel ? String(raw.courierLabel).trim() : '',
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
  return {
    ...a,
    lat,
    lng,
    id: `custom-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    label: label(a),
    custom: true,
  }
}

export function getCustomAgencies() {
  return read()
}

export function getCustomForCourier(courierId) {
  return read().filter((a) => a.courier === courierId)
}

/** Couriers nuevos (no incluidos en `knownIds`) detectados entre las agencias locales. */
export function getCustomCouriers(knownIds = new Set()) {
  const seen = new Map()
  for (const a of read()) {
    if (!a.courier || knownIds.has(a.courier) || seen.has(a.courier)) continue
    const lbl = a.courierLabel?.trim() || a.courier.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    seen.set(a.courier, { id: a.courier, label: lbl })
  }
  return [...seen.values()]
}

/** Agrega varias entradas crudas. Devuelve cuántas se agregaron. */
export function addAgencies(rawList) {
  const valid = rawList.filter((r) => r && r.courier && r.address)
  const normalized = valid.map((r, i) => normalizeAgency(r, i))
  const list = read().concat(normalized)
  write(list)
  return normalized.length
}

export function addAgency(raw) {
  return addAgencies([raw])
}

export function clearCustom() {
  write([])
}

export function exportCustom() {
  return JSON.stringify(read(), null, 2)
}

// ---- Parsers de importación ----

/** CSV con cabecera: courier,department,province,district,zone,address,reference[,lat,lng] */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const split = (line) => {
    const out = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"'
          i++
        } else q = !q
      } else if (c === ',' && !q) {
        out.push(cur)
        cur = ''
      } else cur += c
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }
  const headers = split(lines[0]).map((h) => h.toLowerCase())
  return lines.slice(1).map((line) => {
    const cells = split(line)
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = cells[i]
    })
    return obj
  })
}

/**
 * Formato "listado" pegado: bloques de 3 líneas
 *   Nombre
 *   Departamento / Provincia / Distrito / Zona
 *   Dirección(, Ref. ... | Referencia: ...)
 * El courier se toma del parámetro (selector del importador).
 */
export function parseListado(text, courier) {
  const norm = (s) =>
    String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const DEPTS = new Set(
    ['Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco',
      'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto',
      'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes',
      'Ucayali'].map(norm),
  )
  const isPath = (line) => {
    const parts = line.split(' / ')
    return parts.length >= 3 && DEPTS.has(norm(parts[0]))
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue
    if (isPath(lines[i])) {
      const parts = lines[i].split(' / ').map((s) => s.trim())
      const [department, province, district, ...rest] = parts
      const zone = rest.join(' / ') || district
      let j = i + 1
      while (j < lines.length && !lines[j]) j++
      let addr = lines[j] || ''
      let reference = ''
      const m = addr.match(/,?\s*(Referencia:|Ref\.?:?)\s*/i)
      if (m) {
        reference = addr.slice(m.index + m[0].length).trim()
        addr = addr.slice(0, m.index).replace(/[,\s]+$/, '')
      }
      out.push({ courier, department, province, district, zone, address: addr, reference })
      i = j
    }
  }
  return out
}
