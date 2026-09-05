const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export function isPastCutoff(merchant, now = new Date()) {
  return now.getHours() >= merchant.cutoffHour
}

/**
 * Next available shipping dates, cada N días (por defecto 2) contados desde
 * la fecha del dispositivo (`now`), no desde días de semana fijos. Si ya
 * pasó la hora de corte de hoy, todo el calendario se corre un día más.
 */
export function generateAvailableDates(merchant, now = new Date()) {
  const intervalDays = merchant.shippingIntervalDays ?? 2
  const totalDays = (merchant.weeksAhead ?? 2) * 7
  const startOffset = intervalDays + (isPastCutoff(merchant, now) ? 1 : 0)
  const results = []

  for (let offset = startOffset; offset <= totalDays; offset += intervalDays) {
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
