/** Keep the last successful payload on screen when a background refetch fails (e.g. 429). */
export function shouldShowQuerySpinner(query: { isPending?: boolean; isLoading?: boolean; data?: unknown }) {
  return Boolean((query.isPending || query.isLoading) && !query.data);
}

export function shouldShowQueryError(query: { isError?: boolean; data?: unknown }) {
  return Boolean(query.isError && !query.data);
}
