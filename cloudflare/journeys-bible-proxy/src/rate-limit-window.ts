export interface WindowState {
  windowStart: number;
  count: number;
  windowMs: number;
}

export function windowHasExpired(state: WindowState, now: number): boolean {
  return now >= state.windowStart + state.windowMs;
}
