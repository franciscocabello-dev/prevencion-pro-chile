/**
 * Logo de Firme: una "F" geométrica cuyo brazo central es un visto bueno.
 * Se lee como la inicial de la marca y como "cumple".
 */
export default function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Firme">
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <path d="M20 50V14h26" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 32l7 7 15-16" fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
