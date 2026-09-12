import { useMemo, useState } from 'react'
import { AGENCIES, COURIERS } from '../data/agencies'
import {
  addAgencies,
  addAgency,
  clearCustom,
  exportCustom,
  getCustomAgencies,
  parseCsv,
  parseListado,
} from '../utils/customAgencies'
import { IconBox, IconCheck, IconDownload, IconTrash } from './icons'

const COURIER_LIST = Object.values(COURIERS)

const EMPTY = {
  courier: 'shalom',
  department: '',
  province: '',
  district: '',
  zone: '',
  address: '',
  reference: '',
  lat: '',
  lng: '',
}

const FORMAT_HELP = {
  listado:
    'Pega bloques de 3 líneas: (1) nombre/zona, (2) Departamento / Provincia / Distrito, (3) dirección (con "Ref." o "Referencia:" opcional). El courier se toma del selector de arriba.',
  csv: 'Primera fila = cabecera. Columnas: courier,department,province,district,zone,address,reference[,lat,lng]. Si una fila no trae courier, se usa el del selector.',
  json: 'Un arreglo JSON de objetos { courier, department, province, district, zone, address, reference, lat?, lng? }. Es el mismo formato que exporta el botón "Exportar".',
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
  const [form, setForm] = useState(EMPTY)
  const [addMsg, setAddMsg] = useState(null)

  const [importFormat, setImportFormat] = useState('listado')
  const [importCourier, setImportCourier] = useState('shalom')
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState(null)

  function refresh() {
    setCustom(getCustomAgencies())
  }

  const counts = useMemo(() => {
    const builtIn = {}
    const cust = {}
    for (const a of AGENCIES) builtIn[a.courier] = (builtIn[a.courier] || 0) + 1
    for (const a of custom) cust[a.courier] = (cust[a.courier] || 0) + 1
    return { builtIn, cust }
  }, [custom])

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function handleAddOne(e) {
    e.preventDefault()
    if (!form.courier || !form.address.trim()) {
      setAddMsg({ ok: false, text: 'Faltan datos: courier y dirección son obligatorios.' })
      return
    }
    addAgency(form)
    refresh()
    setForm({ ...EMPTY, courier: form.courier })
    setAddMsg({ ok: true, text: 'Agencia agregada al directorio de este dispositivo.' })
  }

  function runImport() {
    let raw = []
    try {
      if (importFormat === 'json') {
        const parsed = JSON.parse(importText)
        raw = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.agencies)
            ? parsed.agencies
            : []
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
    refresh()
    if (n > 0) {
      setImportText('')
      setImportMsg({ ok: true, text: `Se agregaron ${n} agencia(s).` })
    } else {
      setImportMsg({
        ok: false,
        text: 'No se agregó nada. Revisa el formato: cada entrada necesita courier y dirección.',
      })
    }
  }

  function handleFile(e) {
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

  function handleExport() {
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

  function handleClear() {
    if (!window.confirm('¿Borrar TODAS las agencias personalizadas de este dispositivo? El directorio oficial no se toca.')) return
    clearCustom()
    refresh()
    setImportMsg(null)
    setAddMsg(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <IconBox className="h-5 w-5 text-amber-300" />
          Base de datos de agencias
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
          Al directorio oficial (baked-in) puedes sumarle tus propias agencias. Se guardan en{' '}
          <b>este dispositivo</b> (localStorage) y aparecen en el buscador del formulario junto a las
          oficiales. Expórtalas para respaldarlas o llevarlas a otro equipo.
        </p>
      </div>

      {/* Resumen por courier */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COURIER_LIST.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white">{c.label}</p>
            <p className="mt-1 text-xs text-gray-400">
              <span className="text-gray-200">{counts.builtIn[c.id] || 0}</span> oficiales
              {counts.cust[c.id] ? (
                <span className="text-amber-300"> · +{counts.cust[c.id]} propias</span>
              ) : null}
            </p>
          </div>
        ))}
      </div>

      {/* Agregar una agencia */}
      <form
        onSubmit={handleAddOne}
        className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
      >
        <p className="text-sm font-semibold text-white">Agregar una agencia</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-300">
              Courier<span className="text-red-400"> *</span>
            </span>
            <select
              value={form.courier}
              onChange={(e) => setField('courier', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            >
              {COURIER_LIST.map((c) => (
                <option key={c.id} value={c.id} className="bg-gray-900">
                  {c.label}
                </option>
              ))}
            </select>
          </label>
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
          Si dejas lat/lng vacíos, se calcula una ubicación aproximada por distrito/departamento para el
          orden por cercanía.
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

      {/* Importar en lote */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="text-sm font-semibold text-white">Importar en lote</p>
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
              {COURIER_LIST.map((c) => (
                <option key={c.id} value={c.id} className="bg-gray-900">
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10">
            <IconDownload className="h-4 w-4 rotate-180" /> Subir archivo (.txt/.csv/.json)
            <input type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" onChange={handleFile} className="hidden" />
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{FORMAT_HELP[importFormat]}</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder="Pega aquí el listado, CSV o JSON…"
          className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={runImport}
            disabled={!importText.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:from-amber-400 hover:to-orange-500 disabled:opacity-40"
          >
            <IconBox className="h-4 w-4" /> Importar
          </button>
          {importMsg && (
            <span className={`text-xs font-semibold ${importMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {importMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* Agencias personalizadas cargadas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Agencias propias cargadas ({custom.length})</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!custom.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-40"
          >
            <IconDownload className="h-4 w-4" /> Exportar JSON
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!custom.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
          >
            <IconTrash className="h-4 w-4" /> Vaciar
          </button>
        </div>
      </div>

      {custom.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-gray-400">Todavía no has cargado agencias propias en este dispositivo.</p>
          <p className="mt-1 text-xs text-gray-500">
            El formulario ya usa el directorio oficial; lo que agregues aquí se suma a esa búsqueda.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-white/5 text-[11px] tracking-wide text-gray-400 uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Courier</th>
                <th className="px-3 py-2 font-semibold">Ubicación</th>
                <th className="px-3 py-2 font-semibold">Dirección</th>
                <th className="px-3 py-2 font-semibold">Referencia</th>
                <th className="px-3 py-2 font-semibold">Coords</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {custom.map((a) => (
                <tr key={a.id} className="text-gray-200">
                  <td className="px-3 py-2 whitespace-nowrap">{COURIERS[a.courier]?.label || a.courier}</td>
                  <td className="px-3 py-2">{a.label || '—'}</td>
                  <td className="px-3 py-2">{a.address}</td>
                  <td className="px-3 py-2 text-gray-400">{a.reference || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-gray-500">
                    {Number(a.lat).toFixed(3)}, {Number(a.lng).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
