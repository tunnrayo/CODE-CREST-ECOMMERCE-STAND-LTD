"use client";

import { useState } from "react";
import clsx from "clsx";
import { ProductImage } from "./ProductImage";

type Img = { id: string; url: string; altText: string; sourceType: string };

export function ProductGallery({ images, name }: { images: Img[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl border border-grey-200 bg-grey-100" data-testid="product-gallery">
        <ProductImage src={current.url} alt={current.altText} sizes="(max-width: 1024px) 100vw, 50vw" priority />
        {current.sourceType === "ORIGINAL_ILLUSTRATION" && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-grey-600 shadow-sm backdrop-blur">Illustration — product photo coming soon</span>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={`${name} images`}>
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setActive(i)}
              className={clsx("relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-grey-100", i === active ? "border-burgundy" : "border-transparent hover:border-grey-300")}
            >
              <ProductImage src={img.url} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
