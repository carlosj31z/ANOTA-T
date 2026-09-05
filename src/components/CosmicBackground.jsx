// Puramente decorativo: fondo espacial con profundidad (luces difusas +
// "asteroides" rotando) detrás del formulario. No participa en el layout
// (fixed + pointer-events-none) ni en la lógica de la app.
export default function CosmicBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#241a3d_0%,_#0a0817_45%,_#030308_100%)]" />

      <div className="cosmic-stars absolute inset-0 opacity-60" />

      <div
        className="cosmic-orb absolute -left-20 top-[-10%] h-72 w-72 rounded-full bg-amber-500/30 blur-3xl"
        style={{ animation: 'drift1 22s ease-in-out infinite' }}
      />
      <div
        className="cosmic-orb absolute right-[-15%] top-[15%] h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl"
        style={{ animation: 'drift3 19s ease-in-out infinite' }}
      />
      <div
        className="cosmic-orb absolute bottom-[-10%] right-[-10%] h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
        style={{ animation: 'drift2 26s ease-in-out infinite' }}
      />
      <div
        className="cosmic-orb absolute bottom-[10%] left-[-10%] h-56 w-56 rounded-full bg-orange-500/20 blur-3xl"
        style={{ animation: 'drift1 30s ease-in-out infinite reverse' }}
      />

      <div
        className="cosmic-asteroid absolute left-[12%] top-[22%] h-9 w-9 bg-gradient-to-br from-stone-400 to-stone-700 opacity-70 shadow-[0_0_18px_2px_rgba(251,191,36,0.35)] [clip-path:polygon(22%_0%,_78%_8%,_100%_42%,_82%_100%,_28%_92%,_0%_48%)]"
        style={{ animation: 'spin-slow 46s linear infinite' }}
      />
      <div
        className="cosmic-asteroid absolute right-[18%] top-[55%] h-6 w-6 bg-gradient-to-br from-stone-400 to-stone-700 opacity-60 shadow-[0_0_14px_2px_rgba(34,211,238,0.35)] [clip-path:polygon(15%_5%,_70%_0%,_100%_35%,_90%_85%,_40%_100%,_0%_60%)]"
        style={{ animation: 'spin-slow 34s linear infinite reverse' }}
      />
      <div
        className="cosmic-asteroid absolute bottom-[18%] left-[24%] h-5 w-5 bg-gradient-to-br from-stone-400 to-stone-700 opacity-60 shadow-[0_0_12px_2px_rgba(217,70,239,0.3)] [clip-path:polygon(30%_0%,_100%_20%,_85%_80%,_45%_100%,_0%_55%)]"
        style={{ animation: 'spin-slow 58s linear infinite' }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_#030308_100%)]" />
    </div>
  )
}
