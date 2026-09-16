import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../utils/supabaseClient'
import {
  adminAddClient,
  adminDeleteClient,
  adminListClients,
  adminSetClientActive,
  getAdminSecret,
  setAdminSecret,
} from '../utils/supabaseClients'
import { VALID_SERIALS } from '../data/serials'
import { IconCheck, IconKey, IconRefresh, IconTrash, IconUsers } from './icons'

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function ClientManager() {
  const configured = isSupabaseConfigured()
  const [secretDraft, setSecretDraft] = useState(() => getAdminSecret())
  const [secretSaved, setSecretSaved] = useState(false)

  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState(null)

  const [form, setForm] = useState({ serial: '', name: '', notes: '' })
  const [addMsg, setAddMsg] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function refresh() {
    if (!configured || !getAdminSecret()) return
    setLoading(true)
    setListError(null)
    const res = await adminListClients()
    setLoading(false)
    if (res.ok) setClients(res.clients)
    else setListError(res.error)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; refresh() lee la clave más reciente por su cuenta
  }, [])

  function handleSaveSecret() {
    setAdminSecret(secretDraft)
    setSecretSaved(true)
    setTimeout(() => setSecretSaved(false), 2000)
    refresh()
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.serial.trim()) {
      setAddMsg({ ok: false, text: 'El código serial es obligatorio.' })
      return
    }
    const res = await adminAddClient(form)
    if (res.ok) {
      setForm({ serial: '', name: '', notes: '' })
      setAddMsg({ ok: true, text: 'Cliente agregado.' })
      refresh()
    } else {
      setAddMsg({ ok: false, text: res.error })
    }
  }

  async function handleToggleActive(client) {
    setBusyId(client.id)
    const res = await adminSetClientActive(client.id, !client.active)
    setBusyId(null)
    if (res.ok) refresh()
    else setListError(res.error)
  }

  async function handleDelete(client) {
    if (!window.confirm(`¿Eliminar el cliente "${client.name || client.serial}"? Su serial dejará de funcionar de inmediato.`)) return
    setBusyId(client.id)
    const res = await adminDeleteClient(client.id)
    setBusyId(null)
    if (res.ok) refresh()
    else setListError(res.error)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <IconUsers className="h-5 w-5 text-amber-300" />
          Clientes y seriales
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
          Cada cliente (negociante) entra al link normal con su serial. Agrégalos o retíralos aquí — el cambio
          aplica de inmediato, incluso si ya habían desbloqueado el formulario en su dispositivo.
        </p>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-xs leading-relaxed text-amber-200">
          Supabase no está configurado (pestaña "Base de datos" → "Base de datos compartida"). Mientras tanto,
          los <b>{VALID_SERIALS.size} seriales de respaldo</b> del código siguen funcionando, pero no puedes
          agregar ni retirar clientes desde acá — hace falta Supabase para eso.
        </div>
      )}

      {configured && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold text-white">Clave de administrador</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Protege quién puede agregar/retirar clientes: se guarda SOLO en la base de datos (nunca en el
            código del sitio) y se compara ahí — ver README para configurarla la primera vez.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={secretDraft}
              onChange={(e) => setSecretDraft(e.target.value)}
              placeholder="Clave de administrador"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveSecret}
              className="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:from-amber-400 hover:to-orange-500"
            >
              Guardar y probar
            </button>
          </div>
          {secretSaved && <p className="mt-1.5 text-xs font-semibold text-emerald-400">Guardada.</p>}
        </div>
      )}

      {configured && (
        <form onSubmit={handleAdd} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold text-white">Agregar cliente</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-300">
                Serial<span className="text-red-400"> *</span>
              </span>
              <input
                value={form.serial}
                onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))}
                placeholder="SN-01-XXXXXXXX"
                spellCheck={false}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-300">Nombre del cliente</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Tienda de Juan"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-300">Notas (opcional)</span>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Plan mensual, contacto, etc."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
              />
            </label>
          </div>
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
      )}

      {configured && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Clientes ({clients.length})</p>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              <IconRefresh className="h-3.5 w-3.5" /> {loading ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>

          {listError && (
            <p className="mt-2 text-xs font-semibold text-red-400">
              <IconKey className="mr-1 inline h-3.5 w-3.5" /> {listError}
            </p>
          )}

          {!listError && clients.length === 0 && !loading && (
            <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-gray-400">
                {getAdminSecret() ? 'Aún no hay clientes cargados en Supabase.' : 'Ingresa la clave de administrador arriba para ver la lista.'}
              </p>
            </div>
          )}

          {clients.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="bg-white/5 text-[11px] tracking-wide text-gray-400 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Serial</th>
                    <th className="px-3 py-2 font-semibold">Nombre</th>
                    <th className="px-3 py-2 font-semibold">Estado</th>
                    <th className="px-3 py-2 font-semibold">Desde</th>
                    <th className="px-3 py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clients.map((c) => (
                    <tr key={c.id} className="text-gray-200">
                      <td className="px-3 py-2 font-mono text-xs">{c.serial}</td>
                      <td className="px-3 py-2">{c.name || '—'}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(c)}
                          disabled={busyId === c.id}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                            c.active ? 'bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25' : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                          }`}
                        >
                          {c.active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{fmtDate(c.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          disabled={busyId === c.id}
                          aria-label="Eliminar cliente"
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
