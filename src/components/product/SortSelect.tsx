"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  ["featured", "Featured"],
  ["newest", "Newest"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["name_asc", "Name: A–Z"],
  ["name_desc", "Name: Z–A"],
] as const;

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-grey-600">Sort by</span>
      <select
        className="input w-auto py-2 pr-8"
        value={value}
        data-testid="sort-select"
        onChange={(e) => {
          const params = new URLSearchParams(sp.toString());
          if (e.target.value === "featured") params.delete("sort");
          else params.set("sort", e.target.value);
          params.delete("page");
          const s = params.toString();
          router.push(`${pathname}${s ? `?${s}` : ""}`);
        }}
      >
        {OPTIONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
