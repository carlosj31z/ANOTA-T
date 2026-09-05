import { formatCutoffHour } from '../utils/dates'

export default function CutoffBanner({ cutoffHour, passed }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-snug ${
        passed ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-100 bg-blue-50 text-blue-900'
      }`}
    >
      <span className="mt-0.5 text-base leading-none">⏰</span>
      <p>
        <span className="font-bold">Hora de corte: {formatCutoffHour(cutoffHour)}.</span>{' '}
        {passed
          ? 'Ya pasó la hora límite de hoy: tu pedido se agendará para la próxima fecha disponible.'
          : 'Asegura tu envío registrando tus datos antes de la hora límite.'}
      </p>
    </div>
  )
}
