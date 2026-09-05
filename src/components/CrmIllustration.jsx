// Ilustración isométrica decorativa para el portal de acceso: un escáner
// proyectando sobre fichas de contacto, una laptop con dashboard y
// carpetas archivándose. Recreada con la paleta ámbar/cian/fucsia del
// tema cósmico de la app (no es la imagen original del usuario, ver
// AccessGate.jsx).
export default function CrmIllustration({ className }) {
  return (
    <svg viewBox="0 0 520 380" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="beam" x1="90" y1="80" x2="260" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbbf24" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="folderFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e2340" />
          <stop offset="1" stopColor="#0b0d1c" />
        </linearGradient>
      </defs>

      {/* halo de fondo */}
      <ellipse cx="260" cy="200" rx="230" ry="170" fill="#fbbf24" opacity="0.05" />

      {/* haz del escáner */}
      <polygon points="96,78 260,150 260,230 96,102" fill="url(#beam)" />

      {/* cabeza escáner */}
      <g>
        <ellipse cx="66" cy="70" rx="34" ry="30" fill="#e2e8f0" opacity="0.12" stroke="#fcd34d" strokeWidth="1.5" />
        <circle cx="86" cy="72" r="9" fill="#22d3ee" opacity="0.85" />
        <circle cx="86" cy="72" r="4" fill="#0b0d1c" />
        <path d="M40 88 Q30 105 42 118" stroke="#fcd34d" strokeWidth="2" fill="none" opacity="0.6" />
      </g>

      {/* fichas de contacto en abanico */}
      {[
        { x: 150, y: 205, rot: -10, color: '#fbbf24' },
        { x: 182, y: 188, rot: -4, color: '#22d3ee' },
        { x: 214, y: 172, rot: 3, color: '#e879f9' },
        { x: 246, y: 156, rot: 9, color: '#fbbf24' },
      ].map((card, i) => (
        <g key={i} transform={`translate(${card.x} ${card.y}) rotate(${card.rot})`}>
          <rect
            x="-32"
            y="-42"
            width="64"
            height="84"
            rx="8"
            fill="#0f1225"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
          />
          <circle cx="0" cy="-22" r="10" fill={card.color} opacity="0.9" />
          <path d="M-5 -19 a5 5 0 0 1 10 0" stroke="#0f1225" strokeWidth="2" fill="none" />
          <rect x="-18" y="-2" width="36" height="4" rx="2" fill="rgba(255,255,255,0.35)" />
          <rect x="-18" y="8" width="26" height="4" rx="2" fill="rgba(255,255,255,0.2)" />
          <rect x="-18" y="18" width="30" height="4" rx="2" fill="rgba(255,255,255,0.2)" />
          <rect x="-18" y="28" width="20" height="4" rx="2" fill="rgba(255,255,255,0.2)" />
        </g>
      ))}

      {/* laptop */}
      <g transform="translate(300 210)">
        <polygon points="-110,90 110,90 150,120 -150,120" fill="#1a1c33" stroke="rgba(255,255,255,0.1)" />
        <rect x="-110" y="-90" width="220" height="180" rx="10" fill="#12142a" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        <rect x="-92" y="-72" width="184" height="144" rx="4" fill="url(#screenGlow)" />

        {/* mini gráfico de líneas */}
        <polyline
          points="-80,20 -55,0 -30,28 -5,-10 20,10 45,-30 70,-15"
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="-80,40 -55,45 -30,20 -5,32 20,15 45,-2 70,-35"
          fill="none"
          stroke="#e879f9"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="-80,55 -55,58 -30,50 -5,55 20,42 45,44 70,10"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* anillos de progreso */}
        <g transform="translate(-70 -45)">
          <circle r="14" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <circle r="14" fill="none" stroke="#22d3ee" strokeWidth="4" strokeDasharray="62 88" strokeLinecap="round" />
        </g>
        <g transform="translate(-40 -45)">
          <circle r="14" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <circle r="14" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray="44 88" strokeLinecap="round" />
        </g>
      </g>

      {/* pila de carpetas */}
      <g transform="translate(430 190)">
        <rect x="-46" y="10" width="92" height="66" rx="6" fill="url(#folderFill)" opacity="0.55" transform="rotate(-8)" />
        <rect x="-46" y="0" width="92" height="66" rx="6" fill="url(#folderFill)" opacity="0.8" transform="rotate(-3)" />
        <path
          d="M-46 -10 h34 l8 10 h50 v58 h-92 Z"
          fill="url(#folderFill)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  )
}
