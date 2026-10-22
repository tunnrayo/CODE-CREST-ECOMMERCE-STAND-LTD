import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { uploadDir } from "@/server/services/images";

/** Serves uploaded product images from UPLOAD_DIR (path-traversal safe, webp only). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!parts.every((p) => /^[a-zA-Z0-9._-]+$/.test(p) && p !== ".." && p !== ".")) return new NextResponse("Not found", { status: 404 });
  const rel = parts.join("/");
  if (!rel.endsWith(".webp")) return new NextResponse("Not found", { status: 404 });
  const root = path.resolve(uploadDir());
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) return new NextResponse("Not found", { status: 404 });
  try {
    const data = await fs.readFile(abs);
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
