import { DurableObject } from "cloudflare:workers";
import type { RateLimitResult } from "./types.ts";

interface WindowState {
  windowStart: number;
  count: number;
}

export class RateLimiter extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
  }

  async take(limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const state = (await this.ctx.storage.get<WindowState>("w")) ?? {
      windowStart: now,
      count: 0,
    };
    if (now - state.windowStart >= windowMs) {
      state.windowStart = now;
      state.count = 0;
    }
    if (state.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.windowStart + windowMs - now) / 1000),
      );
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    state.count += 1;
    await this.ctx.storage.put("w", state);
    return {
      allowed: true,
      remaining: Math.max(0, limit - state.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.windowStart + windowMs - now) / 1000),
      ),
    };
  }
}
