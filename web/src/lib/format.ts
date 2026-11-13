/** 75_000 -> "01:15" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Wall clock "14:03:27" for log lines. */
export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('en-GB', { hour12: false });
}

/** "+37061234412" -> "+370 6•• •• 412" so the caller is recognisable but not exposed. */
export function maskNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.length < 7) return raw;
  const tail = digits.slice(-3);
  const country = digits.startsWith('+') ? digits.slice(0, 4) : digits.slice(0, 3);
  const firstLocal = digits.charAt(country.length);
  return `${country} ${firstLocal}•• •• ${tail}`;
}
