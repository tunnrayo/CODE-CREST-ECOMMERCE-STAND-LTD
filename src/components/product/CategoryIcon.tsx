import { Baby, Briefcase, Dumbbell, Headphones, Shirt, Sparkles, UtensilsCrossed, Tag } from "lucide-react";

const MAP: Record<string, typeof Tag> = {
  "electronics-gadgets": Headphones,
  "home-kitchen": UtensilsCrossed,
  "fashion-accessories": Shirt,
  "beauty-personal-care": Sparkles,
  "office-study": Briefcase,
  "baby-kids": Baby,
  "sports-outdoor": Dumbbell,
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = MAP[slug] ?? Tag;
  return <Icon className={className} aria-hidden />;
}
