export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDateInput(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toLocalTimeInput(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function nowLocalDate(): string {
  return toLocalDateInput(new Date());
}

export function nowLocalTime(): string {
  return toLocalTimeInput(new Date());
}

export function toIsoFromLocal(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatLocalDate(date: string): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
