const ceil1 = (n: number) => (Math.ceil(n * 10) / 10).toFixed(1);

/**
 * A file size for people: "12.4 MB", "512.0 KB", "900 bytes". Rounds up, so a file just over a limit never
 * reads as equal to it. File-size facts only; money is drawn by Figure.
 */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${ceil1(n / (1024 * 1024))} MB`;
  if (n >= 1024) return `${ceil1(n / 1024)} KB`;
  return `${n} ${n === 1 ? 'byte' : 'bytes'}`;
}
