import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new ApiError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required") => new ApiError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "You do not have permission to perform this action") => new ApiError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found") => new ApiError(404, "NOT_FOUND", msg);
export const conflict = (msg: string, details?: unknown) => new ApiError(409, "CONFLICT", msg, details);
export const tooMany = (msg = "Too many requests. Please wait and try again.") => new ApiError(429, "RATE_LIMITED", msg);

/** Consistent JSON envelope: { data } on success, { error: { code, message, details } } on failure. */
export function ok<T>(data: T, init?: ResponseInit & { meta?: unknown }) {
  const body: Record<string, unknown> = { data };
  if (init?.meta) body.meta = init.meta;
  return NextResponse.json(body, { status: init?.status ?? 200, headers: init?.headers });
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details ?? null } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Some fields are invalid.", details: e.flatten() } },
      { status: 422 },
    );
  }
  if (e instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Malformed JSON body.", details: null } }, { status: 400 });
  }
  console.error("[api] unexpected error", e);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", details: null } }, { status: 500 });
}

type Ctx<P> = { params: Promise<P> };

/**
 * Wrap a route handler with error handling and same-origin protection for
 * unsafe methods (CSRF defence for cookie-authenticated requests).
 */
export function route<P = Record<string, string>>(
  fn: (req: NextRequest, ctx: { params: P }) => Promise<Response>,
  opts: { skipOriginCheck?: boolean } = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!opts.skipOriginCheck && !["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await fn(req, { params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const allowed = new Set<string>();
  if (host) allowed.add(host.toLowerCase());
  if (process.env.APP_URL) {
    try {
      allowed.add(new URL(process.env.APP_URL).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  if (!origin) {
    // Non-browser clients (no Origin) must not carry cookies cross-site; allow only if no session cookie is present.
    const cookie = req.headers.get("cookie") ?? "";
    if (/cc_session=/.test(cookie)) {
      const referer = req.headers.get("referer");
      if (referer && allowed.has(new URL(referer).host.toLowerCase())) return;
      throw forbidden("Cross-site request blocked");
    }
    return;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw forbidden("Invalid origin");
  }
  if (!allowed.has(originHost)) throw forbidden("Cross-site request blocked");
}

export async function readJson(req: Request, maxBytes = 100_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  if (!text) return {};
  return JSON.parse(text);
}

export function clientIp(req: Request | Headers): string {
  const h = req instanceof Headers ? req : req.headers;
  // X-Forwarded-For is appended to by each proxy, so the left-most entries are client-supplied and spoofable.
  // Count TRUSTED_PROXY_HOPS entries from the right (default 1 = a single platform proxy such as Railway).
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length) return parts[Math.max(0, parts.length - hops)]!;
  return (h.get("x-real-ip") ?? "unknown").trim();
}
