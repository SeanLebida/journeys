import { describe, expect, it } from 'vitest';
import { openRoutePlace, stopToPersist } from './routeResume';

describe('route resume', () => {
  it('opens at the saved stop and that stop’s fraction', () => {
    expect(openRoutePlace(4, 6, [0, 0.2, 0.4, 0.6, 0.8, 1])).toEqual({ stop: 4, progress: 0.8 });
  });

  it('does not persist the stop still on screen before the restore commits', () => {
    expect(stopToPersist(false, false, 0)).toBeNull();
  });

  it('persists the stop once the restore has committed and the route is still', () => {
    expect(stopToPersist(true, false, 4)).toBe(4);
  });

  it('does not persist while a leg is in flight', () => {
    expect(stopToPersist(true, true, 4)).toBeNull();
  });
});
