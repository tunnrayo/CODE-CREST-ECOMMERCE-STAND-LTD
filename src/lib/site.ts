export function siteUrl(): string {
  const u = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
  return u.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
