import { formatCutoffHour } from '../utils/dates'

export default function CutoffBanner({ cutoffHour, passed }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-snug backdrop-blur-sm ${
        passed ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'
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
