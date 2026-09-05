import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAgenciesForCourier } from '../data/agencies'
import { formatDistance, getCurrentPosition, sortByDistance } from '../utils/geo'
import { IconPin, IconSearch, IconX } from './icons'

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function AgencySearch({ courierId, value, onChange, error }) {
  const [query, setQuery] = useState(value?.label ?? '')
  const [open, setOpen] = useState(false)
  const [nearMe, setNearMe] = useState(false)
  const [userLoc, setUserLoc] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [rect, setRect] = useState(null)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      const inContainer = containerRef.current && containerRef.current.contains(e.target)
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target)
      if (!inContainer && !inDropdown) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    function updateRect() {
      if (containerRef.current) setRect(containerRef.current.getBoundingClientRect())
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [open])

  const results = useMemo(() => {
    const all = getAgenciesForCourier(courierId)
    const q = query.trim()
    let list = nearMe && userLoc ? sortByDistance(all, userLoc) : all

    if (q.length >= 2) {
      const nq = normalize(q)
      list = list.filter((a) => normalize(`${a.label} ${a.address}`).includes(nq))
    } else if (!nearMe) {
      list = []
    } else {
      list = list.slice(0, 6)
    }
    return list.slice(0, 8)
  }, [courierId, query, nearMe, userLoc])

  async function handleUseLocation() {
    setGeoLoading(true)
    setGeoError(null)
    try {
      const pos = await getCurrentPosition()
      setUserLoc(pos)
      setNearMe(true)
      setOpen(true)
    } catch {
      setGeoError('No pudimos acceder a tu ubicación. Escribe tu distrito para buscar.')
    } finally {
      setGeoLoading(false)
    }
  }

  function handleSelect(agency) {
    onChange(agency)
    setQuery(agency.label)
    setOpen(false)
  }

  function handleClear() {
    onChange(null)
    setQuery('')
    setNearMe(false)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        Busca tu Agencia <span className="text-red-500">*</span>
      </label>

      <div
        className={`flex items-center gap-2 rounded-xl border bg-gray-50 px-3.5 py-3 transition ${
          open ? 'border-blue-400 ring-2 ring-blue-100' : error ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        <IconSearch className="h-4.5 w-4.5 shrink-0 text-gray-400" />
        {value ? (
          <span className="min-w-0 flex-1 truncate text-[15px] text-gray-900">{value.label}</span>
        ) : (
          <input
            type="text"
            value={query}
            placeholder="Escribe tu distrito o zona…"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setNearMe(false)
              setOpen(true)
            }}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        )}
        {(value || query) && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Limpiar"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      {!value && (
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={geoLoading}
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-60"
        >
          <IconPin className="h-3.5 w-3.5" />
          {geoLoading ? 'Buscando tu ubicación…' : 'Usar mi ubicación para ver las más cercanas'}
        </button>
      )}
      {geoError && <p className="mt-1 text-xs text-amber-600">{geoError}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open &&
        !value &&
        rect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width }}
            className="z-50 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          >
            {nearMe && results.length > 0 && (
              <p className="px-3.5 pt-1.5 pb-1 text-[11px] font-bold tracking-wide text-gray-400 uppercase">
                Más cercanas a ti
              </p>
            )}
            {results.length === 0 && (
              <p className="px-3.5 py-3 text-sm text-gray-400">
                {query.trim().length >= 2
                  ? `Sin resultados para "${query.trim()}".`
                  : 'Escribe al menos 2 letras o usa tu ubicación.'}
              </p>
            )}
            {results.map((agency) => (
              <button
                key={agency.id}
                type="button"
                onClick={() => handleSelect(agency)}
                className="flex w-full items-start justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{agency.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {agency.address}
                    {agency.reference ? `, Ref: ${agency.reference}` : ''}
                  </span>
                </span>
                {typeof agency.distanceKm === 'number' && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    ~{formatDistance(agency.distanceKm)}
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
