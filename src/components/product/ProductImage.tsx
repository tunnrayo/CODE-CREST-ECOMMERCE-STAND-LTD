"use client";

import Image from "next/image";
import { useState } from "react";

const FALLBACK = "/brand/product-fallback.svg";

/** Square product image with graceful fallback when the image fails to load. */
export function ProductImage({ src, alt, sizes = "(max-width: 640px) 50vw, 25vw", priority = false, className }: { src: string; alt: string; sizes?: string; priority?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = failed || !src ? FALLBACK : src;
  const isSvg = url.endsWith(".svg");
  return (
    <span className="relative block aspect-square h-full w-full">
      <Image
        src={url}
        alt={failed ? `${alt} (image unavailable)` : alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={isSvg}
        className={className ?? "object-cover"}
        onError={() => setFailed(true)}
        data-fallback={failed ? "true" : undefined}
      />
    </span>
  );
}
