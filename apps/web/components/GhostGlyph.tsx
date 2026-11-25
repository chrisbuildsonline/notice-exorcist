/** Line-art ghost in a document (DESIGN.md 4, empty state and logo). Ink stroke, no fill colour. */
export function GhostGlyph({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5 * (96 / size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-ink"
    >
      <path d="M26 8h32l16 16v62a2 2 0 0 1-2 2H26a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      <path d="M58 8v14a2 2 0 0 0 2 2h14" />
      <path d="M32 22h16M32 30h24" />
      {/* The ghost bobs and blinks (DESIGN.md 3.1); still with reduced motion. */}
      <g className="ghost-body">
        <path d="M37 76V56a12 12 0 0 1 24 0v20l-4-3-4 3-4-3-4 3-4-3-4 3z" />
        <g className="ghost-eyes">
          <circle cx="44" cy="56" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="54" cy="56" r="1.5" fill="currentColor" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
