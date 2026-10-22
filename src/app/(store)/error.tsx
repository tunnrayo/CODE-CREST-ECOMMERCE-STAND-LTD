"use client";

import { EmptyState } from "@/components/ui";

export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-x py-16">
      <EmptyState title="Something went wrong" message="We couldn't load this page. Please try again." action={<button className="btn-burgundy" onClick={reset}>Try again</button>} />
    </div>
  );
}
