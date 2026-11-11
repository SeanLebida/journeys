import { DurableObject } from "cloudflare:workers";
import type { RateLimitResult } from "./types.ts";
import {
  windowHasExpired,
  type WindowState,
} from "./rate-limit-window.ts";

export { windowHasExpired, type WindowState } from "./rate-limit-window.ts";

export class RateLimiter extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
  }

  async take(limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const stored = await this.ctx.storage.get<WindowState>("w");
    const state: WindowState =
      stored && !windowHasExpired(stored, now)
        ? stored
        : { windowStart: now, count: 0, windowMs };
    state.windowMs = windowMs;
    if (state.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.windowStart + windowMs - now) / 1000),
      );
      await this.ctx.storage.setAlarm(state.windowStart + windowMs);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    state.count += 1;
    await this.ctx.storage.put("w", state);
    await this.ctx.storage.setAlarm(state.windowStart + windowMs);
    return {
      allowed: true,
      remaining: Math.max(0, limit - state.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.windowStart + windowMs - now) / 1000),
      ),
    };
  }

  async alarm(): Promise<void> {
    const state = await this.ctx.storage.get<WindowState>("w");
    const now = Date.now();
    if (!state || windowHasExpired(state, now)) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(state.windowStart + state.windowMs);
  }
}
