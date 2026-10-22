"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { useCart } from "../cart/CartProvider";

export function WishlistButton({ productId, initial, signedIn, withLabel }: { productId: string; initial: boolean; signedIn: boolean; withLabel?: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useCart();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove from wishlist" : "Save to wishlist"}
      disabled={busy}
      className={clsx(
        withLabel ? "btn-outline" : "flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white",
        on && "text-burgundy",
      )}
      onClick={async () => {
        if (!signedIn) {
          router.push(`/account/login?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        setBusy(true);
        const res = await fetch("/api/v1/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return toast("error", json?.error?.message ?? "Could not update wishlist");
        setOn(json.data.saved);
        toast("success", json.data.saved ? "Saved to your wishlist" : "Removed from your wishlist");
        router.refresh();
      }}
    >
      <Heart className={clsx("h-4 w-4", on ? "fill-burgundy text-burgundy" : "text-grey-600")} />
      {withLabel && (on ? "Saved" : "Save to wishlist")}
    </button>
  );
}
