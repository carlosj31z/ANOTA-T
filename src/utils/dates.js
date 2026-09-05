const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export function isPastCutoff(merchant, now = new Date()) {
  return now.getHours() >= merchant.cutoffHour
}

/** Next available shipping dates honoring the merchant's allowed weekdays and cutoff. */
export function generateAvailableDates(merchant, now = new Date()) {
  const weekdays = merchant.shippingWeekdays?.length ? merchant.shippingWeekdays : [1, 2, 3, 4, 5, 6]
  const totalDays = (merchant.weeksAhead ?? 2) * 7
  const past = isPastCutoff(merchant, now)
  const results = []

  for (let i = 0; i <= totalDays; i++) {
    if (i === 0 && past) continue
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + i)
    if (!weekdays.includes(d.getDay())) continue
    results.push({
      value: d.toISOString().slice(0, 10),
      label: `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`,
      shortLabel: `${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return results
}

export function formatCutoffHour(hour) {
  const h = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${h}:00 ${suffix}`
}
