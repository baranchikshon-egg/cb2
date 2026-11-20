interface CaseIconProps {
  name: string;
  accentColor: string;
  size?: number;
  className?: string;
}

export default function CaseIcon({ name, accentColor, size = 80, className = '' }: CaseIconProps) {
  const gradientId = `case-${name.replace(/[^a-z0-9]/gi, '')}`;
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ filter: `drop-shadow(0 0 12px ${accentColor}60)` }}
    >
      <defs>
        <linearGradient id={`${gradientId}-body`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
          <stop offset="50%" stopColor={accentColor} stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${gradientId}-top`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${gradientId}-side`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Case body - 3D box shape */}
      {/* Bottom face */}
      <path d="M20 70 L50 80 L80 70 L80 45 L50 55 L20 45 Z" fill="#1a1a1a" stroke={accentColor} strokeWidth="1" opacity="0.6" />
      {/* Left face */}
      <path d="M20 45 L50 55 L50 80 L20 70 Z" fill={`url(#${gradientId}-side)`} stroke={accentColor} strokeWidth="1" />
      {/* Top face */}
      <path d="M20 45 L50 35 L80 45 L50 55 Z" fill={`url(#${gradientId}-top)`} stroke={accentColor} strokeWidth="1.5" />
      {/* Right face */}
      <path d="M50 55 L80 45 L80 70 L50 80 Z" fill={`url(#${gradientId}-body)`} stroke={accentColor} strokeWidth="1" />

      {/* Highlight on top edge */}
      <line x1="20" y1="45" x2="50" y2="35" stroke={accentColor} strokeWidth="2" opacity="0.9" />
      <line x1="50" y1="35" x2="80" y2="45" stroke={accentColor} strokeWidth="2" opacity="0.6" />

      {/* Letter on top */}
      <text
        x="50"
        y="48"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill={accentColor}
        fontFamily="Oswald, sans-serif"
        opacity="0.9"
      >
        {initial}
      </text>

      {/* Corner accents */}
      <rect x="46" y="53" width="8" height="2" fill={accentColor} opacity="0.7" />
    </svg>
  );
}
