import { clampIndex } from '../../state/usePlaceStore';

export function lessonStart(saved: number | undefined, stepCount: number): number {
  return clampIndex(saved ?? 0, stepCount) ?? 0;
}
