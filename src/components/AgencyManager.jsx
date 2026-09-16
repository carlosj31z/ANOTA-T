import { useEffect, useMemo, useState } from 'react'
import { AGENCIES, getKnownCouriers } from '../data/agencies'
import {
  addAgencies,
  addAgency,
  clearCustom,
  exportCustom,
  getCustomAgencies,
  parseCsv,
  parseListado,
} from '../utils/customAgencies'
import { downloadAgencyTemplate, parseAgencyExcelFile } from '../utils/excelAgencies'
import {
  clearLocalSupabaseConfig,
  getSupabaseConfig,
  setLocalSupabaseConfig,
} from '../utils/supabaseClient'
import {
  deleteSupabaseAgenciesForCourier,
  extractCouriersFromRows,
  fetchAllSupabaseAgencies,
  insertAgenciesToSupabase,
} from '../utils/supabaseAgencies'
import { IconBox, IconCheck, IconDownload, IconRefresh, IconTrash } from './icons'

const NEW_COURIER = '__new__'

const FORMAT_HELP = {
  listado:
    'Pega bloques de 3 líneas: (1) nombre/zona, (2) Departamento / Provincia / Distrito, (3) dirección (con "Ref." o "Referencia:" opcional). El courier se toma del selector de arriba.',
  csv: 'Primera fila = cabecera. Columnas: courier,department,province,district,zone,address,reference[,lat,lng]. Si una fila no trae courier, se usa el del selector.',
  json: 'Un arreglo JSON de objetos { courier, department, province, district, zone, address, reference, lat?, lng? }. Es el mismo formato que exporta el botón "Exportar".',
}

const EMPTY = {
  courierChoice: 'shalom',
  newCourierId: '',
  newCourierLabel: '',
  department: '',
  province: '',
  district: '',
  zone: '',
  address: '',
  reference: '',
  lat: '',
  lng: '',
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-300">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
      />
    </label>
  )
}

export default function AgencyManager() {
  const [custom, setCustom] = useState(() => getCustomAgencies())
  const [couriers, setCouriers] = useState(() => getKnownCouriers())
  const [form, setForm] = useState(EMPTY)
  const [addMsg, setAddMsg] = useState(null)

  const [importFormat, setImportFormat] = useState('listado')
  const [importCourier, setImportCourier] = useState('shalom')
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState(null)

  // ---- Supabase: config + conteos compartidos ----
  const [sbConfig, setSbConfig] = useState(() => getSupabaseConfig())
  const [sbUrlDraft, setSbUrlDraft] = useState('')
  const [sbKeyDraft, setSbKeyDraft] = useState('')
  const [sbSavedMsg, setSbSavedMsg] = useState(false)
  const [sbRows, setSbRows] = useState([])
  const [sbLoading, setSbLoading] = useState(false)
  const [sbMsg, setSbMsg] = useState(null)

  // ---- Excel → Supabase ----
  const [excelRows, setExcelRows] = useState(null) // null = nada cargado aún; [] = archivo vacío/ inválido
  const [excelFileName, setExcelFileName] = useState('')
  const [excelMsg, setExcelMsg] = useState(null)
  const [excelSaving, setExcelSaving] = useState(false)

  function refreshCustom() {
    setCustom(getCustomAgencies())
    // Si se acaba de crear un courier nuevo por la vía local, súmalo al
    // resumen de arriba sin perder los que ya se hubieran descubierto en
    // Supabase (que no viven en localStorage, así que getKnownCouriers()
    // no los trae de vuelta).
    setCouriers((prev) => {
      const baseline = getKnownCouriers()
      const knownIds = new Set(baseline.map((c) => c.id))
      const supabaseOnly = prev.filter((c) => !knownIds.has(c.id))
      return [...baseline, ...supabaseOnly]
    })
  }

  async function refreshSupabase() {
    setSbLoading(true)
    try {
      const rows = await fetchAllSupabaseAgencies({ force: true })
      setSbRows(rows)
      setCouriers((prev) => {
        const knownIds = new Set(prev.map((c) => c.id))
        const extra = extractCouriersFromRows(rows, knownIds)
        return extra.length ? [...prev, ...extra] : prev
      })
    } finally {
      setSbLoading(false)
    }
  }

  useEffect(() => {
    if (sbConfig.source) refreshSupabase()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar / al guardar config
  }, [sbConfig.source])

  const counts = useMemo(() => {
    const builtIn = {}
    const cust = {}
    const shared = {}
    for (const a of AGENCIES) builtIn[a.courier] = (builtIn[a.courier] || 0) + 1
    for (const a of custom) cust[a.courier] = (cust[a.courier] || 0) + 1
    for (const a of sbRows) shared[a.courier] = (shared[a.courier] || 0) + 1
    return { builtIn, cust, shared }
  }, [custom, sbRows])

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function resolveCourier() {
    if (form.courierChoice === NEW_COURIER) {
      const id = form.newCourierId.trim().toLowerCase().replace(/\s+/g, '-')
      return { courier: id, courierLabel: form.newCourierLabel.trim() || form.newCourierId.trim() }
    }
    return { courier: form.courierChoice, courierLabel: '' }
  }

  async function handleAddOne(e) {
    e.preventDefault()
    const { courier, courierLabel } = resolveCourier()
    if (!courier || !form.address.trim()) {
      setAddMsg({ ok: false, text: 'Faltan datos: courier y dirección son obligatorios.' })
      return
    }
    if (form.courierChoice === NEW_COURIER && !courierLabel) {
      setAddMsg({ ok: false, text: 'Ponle un nombre a la nueva empresa.' })
      return
    }
    const raw = { ...form, courier, courierLabel }

    if (sbConfig.source) {
      const { inserted, errors } = await insertAgenciesToSupabase([raw])
      if (inserted > 0) {
        await refreshSupabase()
        setForm({ ...EMPTY, courierChoice: form.courierChoice })
        setAddMsg({ ok: true, text: 'Agencia guardada en Supabase — ya la ven todos los visitantes.' })
      } else {
        setAddMsg({ ok: false, text: `No se pudo guardar en Supabase: ${errors[0] || 'error desconocido'}` })
      }
    } else {
      addAgency(raw)
      refreshCustom()
      setForm({ ...EMPTY, courierChoice: form.courierChoice })
      setAddMsg({ ok: true, text: 'Agencia agregada localmente (Supabase no está configurado — ver abajo).' })
    }
  }

  function runLocalImport() {
    let raw = []
    try {
      if (importFormat === 'json') {
        const parsed = JSON.parse(importText)
        raw = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.agencies) ? parsed.agencies : []
      } else if (importFormat === 'csv') {
        raw = parseCsv(importText)
      } else {
        raw = parseListado(importText, importCourier)
      }
    } catch (err) {
      setImportMsg({ ok: false, text: `No se pudo leer el contenido: ${err.message}` })
      return
    }
    raw = raw.map((r) => ({ ...r, courier: r.courier || importCourier }))
    const n = addAgencies(raw)
    refreshCustom()
    if (n > 0) {
      setImportText('')
      setImportMsg({ ok: true, text: `Se agregaron ${n} agencia(s) en este dispositivo.` })
    } else {
      setImportMsg({ ok: false, text: 'No se agregó nada. Revisa el formato: cada entrada necesita courier y dirección.' })
    }
  }

  function handleLocalFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name.toLowerCase()
    const fmt = name.endsWith('.json') ? 'json' : name.endsWith('.csv') ? 'csv' : 'listado'
    const reader = new FileReader()
    reader.onload = () => {
      setImportFormat(fmt)
      setImportText(String(reader.result || ''))
      setImportMsg({ ok: true, text: `Archivo "${file.name}" cargado. Revisa y pulsa Importar.` })
    }
    reader.onerror = () => setImportMsg({ ok: false, text: 'No se pudo leer el archivo.' })
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleExportLocal() {
    const blob = new Blob([exportCustom()], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anotate-agencias-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleClearLocal() {
    if (!window.confirm('¿Borrar TODAS las agencias personalizadas de ESTE dispositivo? El directorio oficial y lo guardado en Supabase no se tocan.')) return
    clearCustom()
    refreshCustom()
  }

  // ---- Supabase: config ----
  function handleSaveSbConfig() {
    setLocalSupabaseConfig({ url: sbUrlDraft, key: sbKeyDraft })
    setSbConfig(getSupabaseConfig())
    setSbSavedMsg(true)
    setTimeout(() => setSbSavedMsg(false), 2000)
  }

  function handleClearSbConfig() {
    clearLocalSupabaseConfig()
    setSbConfig(getSupabaseConfig())
    setSbUrlDraft('')
    setSbKeyDraft('')
  }

  // ---- Excel ----
  async function handleDownloadTemplate() {
    await downloadAgencyTemplate(couriers)
  }

  async function handleExcelFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setExcelMsg(null)
    setExcelRows(null)
    setExcelFileName(file.name)
    try {
      const rows = await parseAgencyExcelFile(file)
      setExcelRows(rows)
      if (!rows.length) {
        setExcelMsg({ ok: false, text: 'No se encontraron filas válidas (revisa que tengan courier y dirección).' })
      } else {
        setExcelMsg({ ok: true, text: `${rows.length} fila(s) listas para revisar.` })
      }
    } catch (err) {
      setExcelMsg({ ok: false, text: err.message })
    }
  }

  async function handleSaveExcelToSupabase() {
    if (!excelRows?.length) return
    setExcelSaving(true)
    try {
      const { inserted, errors } = await insertAgenciesToSupabase(excelRows)
      await refreshSupabase()
      if (inserted > 0) {
        setExcelMsg({
          ok: errors.length === 0,
          text: `Se guardaron ${inserted} de ${excelRows.length} fila(s) en Supabase.${errors.length ? ` Errores: ${errors.join(' | ')}` : ''}`,
        })
      } else {
        setExcelMsg({ ok: false, text: `No se guardó nada: ${errors.join(' | ') || 'error desconocido'}` })
      }
      if (inserted > 0) {
        setExcelRows(null)
        setExcelFileName('')
      }
    } finally {
      setExcelSaving(false)
    }
  }

  async function handleDeleteCourierFromSupabase(courierId, courierLabel) {
    if (!window.confirm(`¿Borrar TODAS las agencias de "${courierLabel}" en Supabase? Esto afecta a TODOS los visitantes del sitio, no solo a este dispositivo.`)) return
    const { ok, error } = await deleteSupabaseAgenciesForCourier(courierId)
    if (ok) {
      setSbMsg({ ok: true, text: `Se borraron las agencias de "${courierLabel}" en Supabase.` })
      refreshSupabase()
    } else {
      setSbMsg({ ok: false, text: `No se pudo borrar: ${error}` })
    }
  }

  const excelPreview = excelRows?.slice(0, 8) ?? []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <IconBox className="h-5 w-5 text-amber-300" />
          Base de datos de agencias
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
          Descarga la plantilla Excel, llénala con las agencias/empresas nuevas y súbela: se guarda en{' '}
          <b>Supabase</b> (compartido — lo ve cualquier visitante del sitio, no solo este dispositivo). También
          puedes agregar una agencia suelta o usar el importador local como respaldo sin conexión.
        </p>
      </div>

      {/* Resumen por courier */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {couriers.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white">{c.label}</p>
            <p className="mt-1 space-x-1.5 text-xs text-gray-400">
              <span>{counts.builtIn[c.id] || 0} oficiales</span>
              {counts.shared[c.id] ? <span className="text-cyan-300">· {counts.shared[c.id]} Supabase</span> : null}
              {counts.cust[c.id] ? <span className="text-amber-300">· {counts.cust[c.id]} local</span> : null}
            </p>
          </div>
        ))}
      </div>

      {/* ---- Supabase: conexión ---- */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="text-sm font-semibold text-white">Base de datos compartida (Supabase)</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Con esto configurado, lo que cargues aquí (Excel o el formulario de abajo) lo ve{' '}
          <b>cualquier visitante del sitio</b>, en cualquier dispositivo — no solo este navegador.
        </p>
        <p className="mt-2 text-xs">
          {sbConfig.source === 'env' ? (
            <span className="font-semibold text-emerald-400">
              ● Conectado (variables de entorno del sitio) — activo para todos los visitantes.
            </span>
          ) : sbConfig.source === 'local' ? (
            <span className="font-semibold text-cyan-400">
              ● Conectado solo en este dispositivo (prueba local) — para que aplique a todos, configura las
              variables de entorno en Vercel (ver README) y quita esta copia local.
            </span>
          ) : (
            <span className="font-semibold text-amber-400">
              ● Sin configurar — las cargas de abajo se guardan solo en este dispositivo.
            </span>
          )}
        </p>

        {sbConfig.source !== 'env' && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <p className="text-xs text-gray-400">
              Prueba rápida en este dispositivo (Settings → API de tu proyecto Supabase). Para producción real,
              usa las variables de entorno del sitio — ver README.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={sbUrlDraft}
                onChange={(e) => setSbUrlDraft(e.target.value)}
                placeholder="https://tu-proyecto.supabase.co"
                spellCheck={false}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
              />
              <input
                value={sbKeyDraft}
                onChange={(e) => setSbKeyDraft(e.target.value)}
                placeholder="anon public key"
                spellCheck={false}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveSbConfig}
                disabled={!sbUrlDraft.trim() || !sbKeyDraft.trim()}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-1.5 text-xs font-bold text-white transition hover:from-amber-400 hover:to-orange-500 disabled:opacity-40"
              >
                Guardar
              </button>
              {sbConfig.source === 'local' && (
                <button
                  type="button"
                  onClick={handleClearSbConfig}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10"
                >
                  Quitar
                </button>
              )}
              {sbSavedMsg && <span className="text-xs font-semibold text-emerald-400">Guardado.</span>}
            </div>
          </div>
        )}

        {sbConfig.source && (
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={refreshSupabase}
              disabled={sbLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-50"
            >
              <IconRefresh className="h-3.5 w-3.5" /> {sbLoading ? 'Actualizando…' : `Actualizar (${sbRows.length} en Supabase)`}
            </button>
            {sbMsg && (
              <span className={`text-xs font-semibold ${sbMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {sbMsg.text}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ---- Plantilla + subir Excel ---- */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 backdrop-blur-sm">
        <p className="text-sm font-semibold text-white">Plantilla Excel (recomendado)</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Descarga la plantilla, complétala (una fila por agencia; para una empresa nueva usa un código propio en
          "courier" y su nombre en "courier_label") y súbela aquí. Se guarda en Supabase para todos.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
          >
            <IconDownload className="h-4 w-4" /> Descargar plantilla .xlsx
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2 text-xs font-bold text-white transition hover:from-amber-400 hover:to-orange-500">
            <IconDownload className="h-4 w-4 rotate-180" /> Subir Excel completado
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelFile} className="hidden" />
          </label>
        </div>

        {excelFileName && (
          <p className="mt-2 text-xs text-gray-400">
            Archivo: <span className="font-mono">{excelFileName}</span>
          </p>
        )}
        {excelMsg && (
          <p className={`mt-1 text-xs font-semibold ${excelMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {excelMsg.text}
          </p>
        )}

        {excelRows?.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[560px] text-left text-[12px]">
                <thead className="bg-white/5 text-[10px] tracking-wide text-gray-400 uppercase">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Courier</th>
                    <th className="px-2 py-1.5 font-semibold">Ubicación</th>
                    <th className="px-2 py-1.5 font-semibold">Dirección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {excelPreview.map((r, i) => (
                    <tr key={i} className="text-gray-300">
                      <td className="px-2 py-1.5">{r.courier}{r.courierLabel ? ` (${r.courierLabel})` : ''}</td>
                      <td className="px-2 py-1.5">{[r.department, r.province, r.district].filter(Boolean).join(' / ')}</td>
                      <td className="px-2 py-1.5">{r.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {excelRows.length > excelPreview.length && (
              <p className="text-[11px] text-gray-500">… y {excelRows.length - excelPreview.length} fila(s) más.</p>
            )}
            <button
              type="button"
              onClick={handleSaveExcelToSupabase}
              disabled={excelSaving || !sbConfig.source}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-bold text-white transition hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40"
            >
              <IconCheck className="h-4 w-4" />
              {excelSaving ? 'Guardando…' : `Guardar ${excelRows.length} fila(s) en Supabase`}
            </button>
            {!sbConfig.source && (
              <p className="text-[11px] text-amber-400">Configura Supabase arriba antes de guardar.</p>
            )}
          </div>
        )}
      </div>

      {/* ---- Agregar una agencia suelta ---- */}
      <form onSubmit={handleAddOne} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="text-sm font-semibold text-white">Agregar una agencia</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-300">
              Courier<span className="text-red-400"> *</span>
            </span>
            <select
              value={form.courierChoice}
              onChange={(e) => setField('courierChoice', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            >
              {couriers.map((c) => (
                <option key={c.id} value={c.id} className="bg-gray-900">
                  {c.label}
                </option>
              ))}
              <option value={NEW_COURIER} className="bg-gray-900">+ Nueva empresa…</option>
            </select>
          </label>
          {form.courierChoice === NEW_COURIER ? (
            <>
              <Field label="Código de la empresa nueva" required value={form.newCourierId} onChange={(v) => setField('newCourierId', v)} placeholder="rapidito" />
              <Field label="Nombre para mostrar" required value={form.newCourierLabel} onChange={(v) => setField('newCourierLabel', v)} placeholder="Rapidito Courier" />
            </>
          ) : null}
          <Field label="Departamento" value={form.department} onChange={(v) => setField('department', v)} placeholder="Lima" />
          <Field label="Provincia" value={form.province} onChange={(v) => setField('province', v)} placeholder="Lima" />
          <Field label="Distrito" value={form.district} onChange={(v) => setField('district', v)} placeholder="Miraflores" />
          <Field label="Zona / referencia corta" value={form.zone} onChange={(v) => setField('zone', v)} placeholder="Av. Larco" />
          <Field label="Dirección" required value={form.address} onChange={(v) => setField('address', v)} placeholder="Av. Larco 123" />
          <Field label="Referencia" value={form.reference} onChange={(v) => setField('reference', v)} placeholder="Frente al parque" />
          <Field label="Latitud (opcional)" value={form.lat} onChange={(v) => setField('lat', v)} placeholder="-12.12" />
          <Field label="Longitud (opcional)" value={form.lng} onChange={(v) => setField('lng', v)} placeholder="-77.03" />
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Si dejas lat/lng vacíos, se calcula una ubicación aproximada por distrito/departamento. Se guarda en{' '}
          {sbConfig.source ? 'Supabase (compartido)' : 'este dispositivo (Supabase no está configurado)'}.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:from-amber-400 hover:to-orange-500"
          >
            <IconCheck className="h-4 w-4" /> Agregar
          </button>
          {addMsg && (
            <span className={`text-xs font-semibold ${addMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {addMsg.text}
            </span>
          )}
        </div>
      </form>

      {/* ---- Importador local (respaldo sin conexión) ---- */}
      <details className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <summary className="cursor-pointer text-sm font-semibold text-white">
          Importador local (texto/CSV/JSON) — respaldo sin Supabase
        </summary>
        <p className="mt-2 text-xs text-gray-400">
          Guarda solo en este dispositivo (localStorage). Útil si aún no configuraste Supabase o para pruebas
          rápidas pegando texto.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-300">Formato</span>
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            >
              <option value="listado" className="bg-gray-900">Listado (texto pegado)</option>
              <option value="csv" className="bg-gray-900">CSV</option>
              <option value="json" className="bg-gray-900">JSON</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-300">Courier por defecto</span>
            <select
              value={importCourier}
              onChange={(e) => setImportCourier(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            >
              {couriers.map((c) => (
                <option key={c.id} value={c.id} className="bg-gray-900">
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10">
            <IconDownload className="h-4 w-4 rotate-180" /> Subir archivo (.txt/.csv/.json)
            <input type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" onChange={handleLocalFile} className="hidden" />
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{FORMAT_HELP[importFormat]}</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder="Pega aquí el listado, CSV o JSON…"
          className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={runLocalImport}
            disabled={!importText.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-gray-200 transition hover:bg-white/10 disabled:opacity-40"
          >
            <IconBox className="h-4 w-4" /> Importar localmente
          </button>
          {importMsg && (
            <span className={`text-xs font-semibold ${importMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {importMsg.text}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <p className="text-sm font-semibold text-white">Agencias propias en este dispositivo ({custom.length})</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportLocal}
              disabled={!custom.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              <IconDownload className="h-4 w-4" /> Exportar JSON
            </button>
            <button
              type="button"
              onClick={handleClearLocal}
              disabled={!custom.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              <IconTrash className="h-4 w-4" /> Vaciar
            </button>
          </div>
        </div>
      </details>

      {/* ---- Mantenimiento Supabase por courier ---- */}
      {sbConfig.source && sbRows.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold text-white">Borrar por courier en Supabase</p>
          <p className="mt-1 text-xs text-gray-400">Afecta a todos los visitantes — úsalo solo para corregir una carga equivocada.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {couriers.filter((c) => counts.shared[c.id]).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleDeleteCourierFromSupabase(c.id, c.label)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/20"
              >
                <IconTrash className="h-3.5 w-3.5" /> {c.label} ({counts.shared[c.id]})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
