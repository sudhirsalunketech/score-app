export function tourDisplayId(name: string, id: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4);
  const tail = id.replace(/[^a-z0-9]/gi, '').slice(-4);
  return `${slug}${tail}`;
}

export function isSameLocalDay(iso: string | Date | null | undefined): boolean {
  if (!iso) return false;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
