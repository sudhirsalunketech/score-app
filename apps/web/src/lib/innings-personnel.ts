export function shouldResetInningsPersonnel(previousId: string | null, nextId: string | null | undefined) {
  return Boolean(previousId && nextId && previousId !== nextId);
}

export { isWicketControlEnabled, shouldResetMatchPersonnel } from './wicket-control';
