import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from './icons'

const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Los `value` de las opciones son "YYYY-MM-DD" (ver utils/dates.js). Parsear
// forzando medianoche LOCAL — un `new Date('YYYY-MM-DD')` a secas se
// interpreta como medianoche UTC y puede mostrar el día anterior en husos
// horarios negativos (como Perú) al leer año/mes/día de vuelta.
function parseLocalDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function monthKey(year, month) {
  return year * 12 + month
}

export default function DatePicker({ value, onChange, options, placeholder, error, hint, required }) {
  const [open, setOpen] = useState(false)

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  const bounds = useMemo(() => {
    if (!options.length) return null
    const first = parseLocalDate(options[0].value)
    const last = parseLocalDate(options[options.length - 1].value)
    return { first, last }
  }, [options])

  const initialView = value
    ? parseLocalDate(value.value)
    : bounds
      ? bounds.first
      : new Date()
  const [view, setView] = useState({ year: initialView.getFullYear(), month: initialView.getMonth() })

  // Si cambia el set de opciones (otro merchant, otro día) y la vista quedó
  // fuera de rango, la reencuadra al primer mes disponible.
  useEffect(() => {
    if (!bounds) return
    const min = monthKey(bounds.first.getFullYear(), bounds.first.getMonth())
    const max = monthKey(bounds.last.getFullYear(), bounds.last.getMonth())
    const cur = monthKey(view.year, view.month)
    if (cur < min || cur > max) {
      setView({ year: bounds.first.getFullYear(), month: bounds.first.getMonth() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reencuadrar cuando cambian los límites, no en cada render
  }, [bounds])

  // Cerrar con Escape, como cualquier modal.
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function handleToggle() {
    if (value) {
      const d = parseLocalDate(value.value)
      setView({ year: d.getFullYear(), month: d.getMonth() })
    }
    setOpen(true)
  }

  function handlePick(dateValue) {
    const option = byValue.get(dateValue)
    if (!option) return
    onChange(option)
    setOpen(false)
  }

  const atMin = bounds && monthKey(view.year, view.month) <= monthKey(bounds.first.getFullYear(), bounds.first.getMonth())
  const atMax = bounds && monthKey(view.year, view.month) >= monthKey(bounds.last.getFullYear(), bounds.last.getMonth())

  function changeMonth(delta) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  // Grilla del mes: celdas vacías de relleno + un día por celda.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(view.year, view.month, 1)
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
    const leading = firstOfMonth.getDay()
    const out = Array.from({ length: leading }, () => null)
    for (let day = 1; day <= daysInMonth; day++) {
      const dateValue = `${view.year}-${pad2(view.month + 1)}-${pad2(day)}`
      out.push({ day, dateValue, available: byValue.has(dateValue) })
    }
    return out
  }, [view, byValue])

  return (
    <div className="relative">
      <label className="mb-1.5 block text-sm font-semibold text-gray-200">
        Fecha de Envío
        {required && <span className="text-red-400"> *</span>}
      </label>
      <button
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center gap-2.5 rounded-xl border bg-white/5 px-3.5 py-3 text-left backdrop-blur-sm transition ${
          error ? 'border-red-400/60' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <IconCalendar className="h-4.5 w-4.5 shrink-0 text-gray-500" />
        <span className={`min-w-0 flex-1 truncate text-[15px] ${value ? 'text-white' : 'text-gray-500'}`}>
          {value ? value.label : placeholder}
        </span>
      </button>
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {/* Modal emergente: no ocupa espacio en el formulario mientras está
          cerrado, y al abrirse aparece por encima de todo con fondo oscuro
          — nunca "quita visibilidad" del resto de la página. */}
      {open &&
        createPortal(
          <div
            className="animate-fade-in-up fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-4 shadow-2xl shadow-black/60"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">Elige una fecha</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  disabled={atMin}
                  aria-label="Mes anterior"
                  className="rounded-lg p-1.5 text-gray-300 transition hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <IconChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold text-gray-200">
                  {MONTH_NAMES[view.month]} {view.year}
                </p>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  disabled={atMax}
                  aria-label="Mes siguiente"
                  className="rounded-lg p-1.5 text-gray-300 transition hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <IconChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_SHORT.map((w, i) => (
                  <span key={i} className="py-1 text-[11px] font-semibold text-gray-500">
                    {w}
                  </span>
                ))}
                {cells.map((cell, i) =>
                  cell === null ? (
                    <span key={`empty-${i}`} />
                  ) : (
                    <button
                      key={cell.dateValue}
                      type="button"
                      disabled={!cell.available}
                      onClick={() => handlePick(cell.dateValue)}
                      className={`aspect-square rounded-lg text-[13px] font-semibold transition ${
                        value?.value === cell.dateValue
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-[0_0_12px_-2px_rgba(251,191,36,0.7)]'
                          : cell.available
                            ? 'text-white hover:bg-amber-400/15'
                            : 'text-gray-700 cursor-not-allowed'
                      }`}
                    >
                      {cell.day}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
