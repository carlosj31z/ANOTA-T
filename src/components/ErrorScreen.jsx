import { IconAlert } from './icons'

export default function ErrorScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 animate-pop-in">
        <IconAlert className="h-8 w-8" />
      </div>
      <h1 className="text-lg font-bold text-gray-900">Enlace no válido</h1>
      <p className="max-w-xs text-sm leading-relaxed text-gray-500">
        No hemos podido identificar la tienda. Pídele a la tienda un nuevo enlace o verifica que lo copiaste
        completo.
      </p>
    </div>
  )
}
