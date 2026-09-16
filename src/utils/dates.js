const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export function isPastCutoff(merchant, now = new Date()) {
  return now.getHours() >= merchant.cutoffHour
}

/**
 * Fechas de envío disponibles: TODOS los días (continuos, sin saltos),
 * contados desde la fecha del dispositivo (`now`) hasta `weeksAhead`
 * semanas adelante. Si ya pasó la hora de corte de hoy, arranca un día
 * más tarde.
 */
export function generateAvailableDates(merchant, now = new Date()) {
  const totalDays = (merchant.weeksAhead ?? 2) * 7
  const startOffset = 1 + (isPastCutoff(merchant, now) ? 1 : 0)
  const results = []

  for (let offset = startOffset; offset <= totalDays; offset += 1) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offset)
    results.push({
      value: d.toISOString().slice(0, 10),
      label: `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`,
      shortLabel: `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return results
}
