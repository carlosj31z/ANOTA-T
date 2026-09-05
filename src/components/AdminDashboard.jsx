import { useMemo, useState } from 'react'
import { clearLog, getEndpoint, getLog, setEndpoint } from '../utils/telemetry'
import { IconChart, IconDownload, IconLogout, IconRefresh, IconStore, IconTrash } from './icons'

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

function StatTile({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
      <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}

function ipLocation(e) {
  const parts = [e.city, e.region, e.country].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function toCsv(events) {
  const cols = [
    'ts', 'type', 'serial', 'deviceId', 'browser', 'os', 'deviceType',
    'language', 'tz', 'ip', 'city', 'region', 'country', 'isp',
    'ipLat', 'ipLng', 'gpsLat', 'gpsLng', 'gpsAccuracy', 'screen', 'ua',
  ]
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = events.map((e) => cols.map((c) => esc(e[c])).join(','))
  return [cols.join(','), ...rows].join('\n')
}

export default function AdminDashboard({ onLogout, onOpenForm }) {
  const [log, setLog] = useState(() => getLog())
  const [endpoint, setEndpointState] = useState(() => getEndpoint())
  const [savedMsg, setSavedMsg] = useState(false)

  const events = useMemo(() => [...log].reverse(), [log]) // más recientes primero

  const stats = useMemo(() => {
    const devices = new Set(log.map((e) => e.deviceId))
    const serials = new Set(log.filter((e) => e.type === 'serial' && e.serial).map((e) => e.serial))
    // eslint-disable-next-line react/purity -- "últimas 24 h" depende de la hora actual real
    const since = Date.now() - 24 * 60 * 60 * 1000
    const last24 = log.filter((e) => new Date(e.ts).getTime() >= since).length
    return { total: log.length, devices: devices.size, serials: serials.size, last24 }
  }, [log])

  function refresh() {
    setLog(getLog())
  }

  function handleSaveEndpoint() {
    setEndpoint(endpoint)
    setEndpointState(getEndpoint())
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  function handleExport() {
    const csv = toCsv(log)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anotate-activaciones-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleClear() {
    if (!window.confirm('¿Borrar el historial de activaciones de ESTE dispositivo? (no afecta lo ya enviado a tu backend)')) return
    clearLog()
    setLog([])
  }

  return (
    <div className="animate-fade-in-up space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-white">
            <IconChart className="h-5 w-5 text-amber-300" />
            Panel de administrador
          </h1>
          <p className="mt-0.5 text-xs text-gray-400">Registro de activaciones y dispositivos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
          >
            <IconRefresh className="h-4 w-4" /> Actualizar
          </button>
          <button
            type="button"
            onClick={onOpenForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
          >
            <IconStore className="h-4 w-4" /> Ver formulario
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-400/20"
          >
            <IconLogout className="h-4 w-4" /> Salir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Activaciones" value={stats.total} accent="text-white" />
        <StatTile label="Dispositivos" value={stats.devices} accent="text-cyan-300" />
        <StatTile label="Seriales usados" value={stats.serials} accent="text-amber-300" />
        <StatTile label="Últimas 24 h" value={stats.last24} accent="text-emerald-300" />
      </div>

      {/* Config del backend */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="text-sm font-semibold text-white">Endpoint de telemetría (backend)</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Sin un endpoint, este panel solo muestra las activaciones de <b>este</b> dispositivo. Pega la URL
          de tu backend (Google Apps Script, Firebase, etc.) para recolectar TODAS las activaciones de tus
          clientes de forma centralizada. Instrucciones en el README.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={endpoint}
            onChange={(e) => setEndpointState(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveEndpoint}
            className="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:from-amber-400 hover:to-orange-500"
          >
            Guardar
          </button>
        </div>
        <p className="mt-1.5 text-xs">
          {savedMsg ? (
            <span className="font-semibold text-emerald-400">Guardado.</span>
          ) : getEndpoint() ? (
            <span className="text-emerald-400">● Backend configurado — las activaciones se envían.</span>
          ) : (
            <span className="text-amber-400">● Sin backend — registro solo local en este dispositivo.</span>
          )}
        </p>
      </div>

      {/* Acciones del log */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Registro de activaciones ({log.length})</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!log.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-40"
          >
            <IconDownload className="h-4 w-4" /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!log.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
          >
            <IconTrash className="h-4 w-4" /> Vaciar
          </button>
        </div>
      </div>

      {log.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-gray-400">Aún no hay activaciones registradas en este dispositivo.</p>
          <p className="mt-1 text-xs text-gray-500">
            Cada vez que alguien ingrese con un serial (o como admin) aparecerá aquí: dispositivo, hora y
            ubicación.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="bg-white/5 text-[11px] tracking-wide text-gray-400 uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Fecha / hora</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Serial</th>
                <th className="px-3 py-2 font-semibold">Dispositivo</th>
                <th className="px-3 py-2 font-semibold">IP</th>
                <th className="px-3 py-2 font-semibold">Ubicación (IP)</th>
                <th className="px-3 py-2 font-semibold">GPS</th>
                <th className="px-3 py-2 font-semibold">Zona horaria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((e) => (
                <tr key={e.id} className="text-gray-200">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.ts)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        e.type === 'admin'
                          ? 'bg-amber-400/15 text-amber-300'
                          : 'bg-cyan-400/15 text-cyan-300'
                      }`}
                    >
                      {e.type === 'admin' ? 'Admin' : 'Serial'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.serial || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {[e.browser, e.os, e.deviceType].filter(Boolean).join(' · ') || '—'}
                    <span className="block font-mono text-[10px] text-gray-500">{e.deviceId}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{e.ip || '—'}</td>
                  <td className="px-3 py-2">{ipLocation(e)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.gpsLat != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${e.gpsLat},${e.gpsLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-300 underline"
                      >
                        {e.gpsLat.toFixed(4)}, {e.gpsLng.toFixed(4)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-400">{e.tz || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-500">
        Nota: la ubicación por IP es aproximada (ciudad/país). El GPS exacto solo se registra si el usuario
        acepta el permiso del navegador. Esta telemetría es de activación de licencias (anti-piratería); al
        ser una app estática, la vista centralizada real requiere el endpoint configurado arriba.
      </p>
    </div>
  )
}
