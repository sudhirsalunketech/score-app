import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { isNonRetryableQueueError } from './offline-queue';

describe('offline queue fatal errors', () => {
  it('does not retry 409 / completed-innings rejections', () => {
    expect(isNonRetryableQueueError(new ApiError('The target has been reached. No additional balls can be added.', 'INVALID_MATCH_STATE', 409))).toBe(true);
    expect(isNonRetryableQueueError(new ApiError('Duplicate delivery', 'DUPLICATE_DELIVERY', 409))).toBe(true);
    expect(isNonRetryableQueueError(new ApiError('Invalid wicket', 'INVALID_WICKET', 400))).toBe(true);
  });

  it('retries ordinary network failures', () => {
    expect(isNonRetryableQueueError(new ApiError('Something went wrong', 'INTERNAL_ERROR', 500))).toBe(false);
    expect(isNonRetryableQueueError(new Error('Failed to fetch'))).toBe(false);
  });
});
