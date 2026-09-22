import { describe, expect, it } from 'vitest';
import { shouldShowQueryError, shouldShowQuerySpinner } from './query-state';

describe('query-state', () => {
  it('does not replace a loaded live view when a refetch errors', () => {
    expect(shouldShowQueryError({ isError: true, data: { match: { id: 'm1' } } })).toBe(false);
    expect(shouldShowQuerySpinner({ isPending: false, isLoading: false, data: { match: { id: 'm1' } } })).toBe(false);
  });

  it('shows retry only when there is no usable payload', () => {
    expect(shouldShowQueryError({ isError: true, data: undefined })).toBe(true);
    expect(shouldShowQuerySpinner({ isPending: true, data: undefined })).toBe(true);
  });
});
