import type { AvatarChar, HairStyle } from "@/lib/avatars";

/**
 * Illustrated avatar rendered from an AvatarChar — a stylised face with skin,
 * hair (8 styles), optional glasses/beard, on a gradient disc. Ported 1:1 from
 * the website (Tea-Website/src/components/avatar/PresetAvatar.tsx) so the admin
 * preview matches what the app and website render for the same preset id.
 */
export function PresetAvatar({ char, size = 96, className = "" }: { char: AvatarChar; size?: number; className?: string }) {
  const { id, skin, hair, bg, bgEnd, clothing = "#2b3646", eye = "#40260f", hairStyle } = char;
  const g = `av-${id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Avatar">
      <defs>
        <linearGradient id={`${g}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={bgEnd || bg} />
        </linearGradient>
        <clipPath id={`${g}-clip`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="50" fill={`url(#${g}-bg)`} />

      <g clipPath={`url(#${g}-clip)`}>
        {hairBack(hairStyle, hair)}

        <path d="M14 100 Q14 76 50 76 Q86 76 86 100 Z" fill={clothing} />
        <rect x="44" y="58" width="12" height="14" rx="5" fill={skin} />
        <path d="M44 64 Q50 70 56 64 L56 60 L44 60 Z" fill="#00000018" />

        <circle cx="30" cy="46" r="4.5" fill={skin} />
        <circle cx="70" cy="46" r="4.5" fill={skin} />
        <ellipse cx="50" cy="45" rx="19" ry="21.5" fill={skin} />
        <ellipse cx="50" cy="58" rx="12" ry="6" fill="#00000010" />

        {hairFront(hairStyle, hair)}

        <rect x="38.5" y="40" width="8" height="2" rx="1" fill={hair} />
        <rect x="53.5" y="40" width="8" height="2" rx="1" fill={hair} />
        <Eye cx={42.5} eye={eye} />
        <Eye cx={57.5} eye={eye} />
        <path d="M50 46 Q52 51 49.5 52.5" fill="none" stroke="#00000022" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M44 57 Q50 62 56 57" fill="none" stroke="#8a3b3b" strokeWidth="2" strokeLinecap="round" />

        {char.beard && <path d="M31 46 Q32 66 50 69 Q68 66 69 46 Q64 58 50 58 Q36 58 31 46 Z" fill={hair} opacity="0.92" />}
        {char.glasses && (
          <g fill="none" stroke="#15181d" strokeWidth="2">
            <rect x="35" y="41" width="12" height="9" rx="4.5" />
            <rect x="53" y="41" width="12" height="9" rx="4.5" />
            <path d="M47 45 h6" />
            <path d="M35 45 l-5 -1M65 45 l5 -1" strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}

function Eye({ cx, eye }: { cx: number; eye: string }) {
  return (
    <g>
      <ellipse cx={cx} cy={45} rx={2.7} ry={3.1} fill="#fff" />
      <circle cx={cx} cy={45.5} r={1.7} fill={eye} />
      <circle cx={cx + 0.7} cy={44.6} r={0.6} fill="#fff" />
    </g>
  );
}

function hairBack(style: HairStyle, hair: string) {
  switch (style) {
    case "afro":
      return <circle cx="50" cy="38" r="26" fill={hair} />;
    case "long":
      return <path d="M24 40 Q24 20 50 20 Q76 20 76 40 L76 82 Q68 78 66 62 L66 44 L34 44 L34 62 Q32 78 24 82 Z" fill={hair} />;
    case "wavy":
      return <path d="M25 40 Q25 20 50 20 Q75 20 75 40 L75 72 Q70 66 72 60 Q66 74 64 58 L64 44 L36 44 L36 58 Q34 74 28 60 Q30 66 25 72 Z" fill={hair} />;
    case "ponytail":
      return <g fill={hair}><path d="M70 34 q14 6 12 26 q-1 12 -8 16 q6 -14 -2 -26 q-4 -8 -2 -16 Z" /></g>;
    case "bun":
      return <circle cx="50" cy="19" r="8" fill={hair} />;
    default:
      return null;
  }
}

function hairFront(style: HairStyle, hair: string) {
  switch (style) {
    case "buzz":
      return <path d="M32 42 Q31 26 50 25 Q69 26 68 42 Q66 33 50 32.5 Q34 33 32 42 Z" fill={hair} opacity="0.95" />;
    case "curly":
      return (
        <g fill={hair}>
          <path d="M30 42 Q30 24 50 23 Q70 24 70 42 Q66 34 60 35 Q60 28 50 28 Q40 28 40 35 Q34 34 30 42 Z" />
          {[34, 42, 50, 58, 66].map((x, i) => (
            <circle key={i} cx={x} cy={i % 2 ? 26 : 29} r={5} />
          ))}
        </g>
      );
    case "afro":
      return <path d="M31 40 Q31 26 50 26 Q69 26 69 40 Q62 33 50 33 Q38 33 31 40 Z" fill={hair} />;
    case "bun":
      return <path d="M32 42 Q32 27 50 27 Q68 27 68 42 Q62 34 50 34 Q38 34 32 42 Z" fill={hair} />;
    default:
      return <path d="M31 44 Q30 25 50 24 Q70 25 69 44 Q64 34 50 34 Q36 34 31 44 Z" fill={hair} />;
  }
}
