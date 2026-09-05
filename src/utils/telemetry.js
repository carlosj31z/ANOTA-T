// Telemetría de activaciones para el panel de administrador (anti-piratería).
//
// Registra un evento cada vez que alguien entra (con serial o como admin):
// dispositivo, navegador/OS, hora, zona horaria e IDIOMA, ubicación por IP
// (aprox.) y, si el usuario acepta el permiso, coordenadas GPS.
//
// El evento se guarda SIEMPRE en localStorage (visible en el panel de ESTE
// dispositivo) y, si hay un endpoint configurado, se ENVÍA a ese backend
// (fire-and-forget) para poder verlo de forma centralizada. Sin backend, el
// panel solo muestra las activaciones de este mismo navegador.

const LOG_KEY = 'anotate-activation-log'
const DEVICE_KEY = 'anotate-device-id'
const ENDPOINT_KEY = 'anotate-telemetry-endpoint'
const MAX_EVENTS = 500

// Pega aquí tu URL de backend para fijarla en el código, o déjalo vacío y
// configúralo desde el panel de administrador. Ver README ("Telemetría").
export const DEFAULT_ENDPOINT = ''

export function getEndpoint() {
  try {
    return localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT
  } catch {
    return DEFAULT_ENDPOINT
  }
}

export function setEndpoint(url) {
  try {
    if (url && url.trim()) localStorage.setItem(ENDPOINT_KEY, url.trim())
    else localStorage.removeItem(ENDPOINT_KEY)
  } catch {
    // sin persistencia
  }
}

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'dev_desconocido'
  }
}

function parseUA(ua = '') {
  const s = ua.toLowerCase()
  let browser = 'Desconocido'
  if (s.includes('edg/')) browser = 'Edge'
  else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera'
  else if (s.includes('samsungbrowser')) browser = 'Samsung Internet'
  else if (s.includes('chrome') || s.includes('crios')) browser = 'Chrome'
  else if (s.includes('firefox') || s.includes('fxios')) browser = 'Firefox'
  else if (s.includes('safari')) browser = 'Safari'

  let os = 'Desconocido'
  if (s.includes('windows')) os = 'Windows'
  else if (s.includes('android')) os = 'Android'
  else if (s.includes('iphone') || s.includes('ipad') || s.includes('ipod')) os = 'iOS'
  else if (s.includes('mac os')) os = 'macOS'
  else if (s.includes('linux')) os = 'Linux'

  const mobile = /android|iphone|ipad|ipod|mobile/.test(s)
  return { browser, os, deviceType: mobile ? 'Móvil' : 'PC' }
}

export function getLog() {
  try {
    const list = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveLog(list) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(-MAX_EVENTS)))
  } catch {
    // sin persistencia
  }
}

export function clearLog() {
  try {
    localStorage.removeItem(LOG_KEY)
  } catch {
    // sin persistencia
  }
}

async function ipInfo() {
  // Servicios públicos con CORS y sin API key. Se intenta uno y luego otro.
  const sources = [
    async () => {
      const r = await fetch('https://ipwho.is/', { cache: 'no-store' })
      const d = await r.json()
      if (d && d.success !== false) {
        return {
          ip: d.ip,
          city: d.city,
          region: d.region,
          country: d.country,
          isp: d.connection?.isp || d.connection?.org || '',
          ipLat: d.latitude,
          ipLng: d.longitude,
        }
      }
      return null
    },
    async () => {
      const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' })
      const d = await r.json()
      if (d && !d.error) {
        return {
          ip: d.ip,
          city: d.city,
          region: d.region,
          country: d.country_name || d.country,
          isp: d.org || '',
          ipLat: d.latitude,
          ipLng: d.longitude,
        }
      }
      return null
    },
  ]
  for (const src of sources) {
    try {
      const info = await src()
      if (info) return info
    } catch {
      // intentar el siguiente
    }
  }
  return {}
}

function gpsInfo() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({})
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          gpsLat: p.coords.latitude,
          gpsLng: p.coords.longitude,
          gpsAccuracy: Math.round(p.coords.accuracy),
        }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  })
}

/**
 * Registra una activación. `base` = { type: 'admin' | 'serial', serial? }.
 * No bloquea la UI: llámalo sin await (fire-and-forget).
 */
export async function logActivation(base) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const event = {
    id: 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    ts: new Date().toISOString(),
    deviceId: getDeviceId(),
    type: base.type,
    serial: base.serial || '',
    ua,
    ...parseUA(ua),
    language: navigator.language || '',
    screen: window.screen ? `${window.screen.width}x${window.screen.height}` : '',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  }

  // Ubicación: IP (aprox., sin permiso) + GPS (exacto, pide permiso).
  const [ip, gps] = await Promise.all([ipInfo(), gpsInfo()])
  Object.assign(event, ip, gps)

  const list = getLog()
  list.push(event)
  saveLog(list)

  const endpoint = getEndpoint()
  if (endpoint) {
    try {
      const body = JSON.stringify(event)
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' })
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, blob)) {
        // enviado por beacon
      } else {
        fetch(endpoint, {
          method: 'POST',
          mode: 'no-cors',
          keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body,
        }).catch(() => {})
      }
    } catch {
      // el envío es best-effort; el evento ya quedó guardado localmente
    }
  }

  return event
}
