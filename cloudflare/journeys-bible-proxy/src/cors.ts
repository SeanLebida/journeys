export const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
  "https://journeys.authentic.how",
]);

const ALLOW_HEADERS = [
  "Content-Type",
  "X-Journeys-Client",
  "X-Journeys-Download",
  "X-Admin-Token",
  "Authorization",
].join(", ");

export function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }
  return null;
}

export function withCors(response: Response, request: Request): Response {
  const origin = allowedOrigin(request);
  if (!origin) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", appendVary(headers.get("Vary"), "Origin"));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function preflightResponse(request: Request): Response {
  return withCors(new Response(null, { status: 204 }), request);
}

function appendVary(existing: string | null, value: string): string {
  if (!existing) {
    return value;
  }
  const parts = existing.split(",").map((part) => part.trim());
  if (!parts.includes(value)) {
    parts.push(value);
  }
  return parts.join(", ");
}
