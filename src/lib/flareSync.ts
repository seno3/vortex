/** Fired when tips in the area may have changed (create/delete). Map + feed listen and refetch. */
export const VIGIL_FLARES_CHANGED_EVENT = 'vigil-flares-changed';

export function dispatchFlaresChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(VIGIL_FLARES_CHANGED_EVENT));
}
