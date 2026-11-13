import { handleRequest } from "./worker.ts";

export { DownloadStats } from "./stats.ts";
export { RateLimiter } from "./rate-limit.ts";

export default {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
