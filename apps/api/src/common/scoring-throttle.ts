/** Live scoring polls and ball writes must not share the global HTTP rate bucket. */
export function isHighFrequencyScoringPath(url: string): boolean {
  const path = (url.split('?')[0] ?? '').replace(/^\/api\/v1/, '');
  return (
    /\/matches\/[^/]+\/(live|scorecard)$/.test(path) ||
    /\/innings\/[^/]+\/(events|undo)$/.test(path)
  );
}
