const ID_GLYPH = 'M86.3 186.2H70.9V79.1h15.4v107.1zm22.2 0h15.4V127c0-10.9 5.1-17.4 14.9-17.4 8.3 0 12.9 5.1 12.9 15v61.6h15.4V121.1c0-17.9-10.1-28.4-26.6-28.4-11.7 0-18.7 5.1-22.2 12.6h-.3V79.1H108v107.1h.5zM86.3 65.4c-5.1 0-9.1 4-9.1 9.1s4 9.1 9.1 9.1 9.1-4 9.1-9.1-4.1-9.1-9.1-9.1z';

/** ORCID iD mark: green roundel, or just the white glyph for use on a green button. */
export function OrcidIcon({ className = 'h-4 w-4', glyphOnly = false }: { className?: string; glyphOnly?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 256 256" aria-hidden="true">
      {!glyphOnly && <path fill="#A6CE39" d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z" />}
      <path fill="#fff" d={ID_GLYPH} />
    </svg>
  );
}
