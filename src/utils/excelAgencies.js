// Plantilla Excel (.xlsx) para que el administrador cargue agencias/couriers
// nuevos, y el parser del archivo que sube de vuelta. La librería `xlsx`
// (SheetJS) se importa de forma DINÁMICA: no viaja en el bundle que
// descargan los clientes del formulario, solo se pide cuando el admin
// realmente usa esta sección.
//
// Nota de seguridad: la versión de `xlsx` publicada en npm tiene 2 CVEs
// conocidos sin parche (prototype pollution / ReDoS) en su lector — ver
// README → "Base de datos compartida (Supabase)". Por eso: (1) esto solo
// se carga tras el login de administrador, nunca para visitantes; (2) se
// limita el tamaño del archivo antes de intentar leerlo; (3) el parseo va
// en try/catch. Para eliminar el riesgo del todo, instala la build
// parcheada de SheetJS (ver README).
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

const HEADER_ALIASES = {
  courier: 'courier',
  courierid: 'courier',
  empresa: 'courier',
  transportista: 'courier',
  courierlabel: 'courierLabel',
  nombrecourier: 'courierLabel',
  nombreempresa: 'courierLabel',
  empresanombre: 'courierLabel',
  department: 'department',
  departamento: 'department',
  province: 'province',
  provincia: 'province',
  district: 'district',
  distrito: 'district',
  zone: 'zone',
  zona: 'zone',
  address: 'address',
  direccion: 'address',
  reference: 'reference',
  referencia: 'reference',
  ref: 'reference',
  lat: 'lat',
  latitud: 'lat',
  lng: 'lng',
  lon: 'lng',
  long: 'lng',
  longitud: 'lng',
}

function normHeader(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const TEMPLATE_HEADERS = [
  'courier', 'courier_label', 'department', 'province', 'district', 'zone', 'address', 'reference', 'lat', 'lng',
]

const TEMPLATE_EXAMPLE_ROWS = [
  ['shalom', '', 'Lima', 'Lima', 'Miraflores', 'Av. Larco', 'Av. Larco 123', 'Across from the park', '', ''],
  ['rapidito', 'Rapidito Courier', 'Arequipa', 'Arequipa', 'Cayma', 'Av. Ejercito', 'Av. Ejercito 456', '', -16.38, -71.55],
]

/**
 * Genera y descarga la plantilla .xlsx (encabezados e instrucciones en
 * inglés). `knownCouriers` es la lista actual de couriers ({id,label}) para
 * incluirla como referencia en la 2da hoja.
 */
export async function downloadAgencyTemplate(knownCouriers = []) {
  const XLSX = await import('xlsx')

  const wsData = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 4) }))

  const instructions = [
    ['How to fill in this template'],
    [''],
    ['courier', 'Short courier code, lowercase, no spaces (e.g. "shalom", "rapidito"). Required.'],
    ['courier_label', 'Display name — ONLY if "courier" is a brand-new company (e.g. "Rapidito Courier"). Leave empty if the code already exists.'],
    ['department / province / district', 'Branch location (as listed in the courier\'s own directory).'],
    ['zone', 'Short zone/landmark shown to the client as the branch name (defaults to the district if left empty).'],
    ['address', 'Full street address. Required.'],
    ['reference', 'Extra landmark reference (optional): "across from...", "one block from...".'],
    ['lat / lng', 'Coordinates (optional). Left empty, they are auto-computed from district/department.'],
    [''],
    ['Couriers that already exist (use their code as-is to add branches to that company):'],
    ...knownCouriers.map((c) => [c.id, c.label]),
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(instructions)
  wsInfo['!cols'] = [{ wch: 28 }, { wch: 70 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Agencies')
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions')

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'anotate-agencies-template.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Lee un archivo .xlsx/.xls subido por el admin y devuelve las filas
 * normalizadas (courier, courierLabel, department, province, district,
 * zone, address, reference, lat, lng). Lanza Error con un mensaje legible
 * si el archivo es inválido o demasiado grande.
 */
export async function parseAgencyExcelFile(file) {
  if (!file) throw new Error('No se seleccionó ningún archivo.')
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo permitido es 5 MB.`)
  }

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch (err) {
    throw new Error(`No se pudo leer el Excel: ${err.message}`)
  }

  const sheetName = workbook.SheetNames.find((n) => /agenc/i.test(n)) || workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('El archivo no tiene hojas legibles.')

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return rows
    .map((row) => {
      const out = {}
      for (const [key, value] of Object.entries(row)) {
        const field = HEADER_ALIASES[normHeader(key)]
        if (field) out[field] = value
      }
      return out
    })
    .filter((r) => r.courier || r.address)
}
