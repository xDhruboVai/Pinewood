import { Flame, Leaf, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n/en";
import type { MenuTag } from "@/lib/types";

const TONE: Record<MenuTag, "forest" | "gold" | "timber" | "neutral" | "danger"> = {
  halal: "forest",
  vegetarian: "forest",
  chef_special: "gold",
  spicy: "danger",
  seafood: "timber",
  contains_nuts: "neutral",
};

const ORDER: MenuTag[] = ["chef_special", "halal", "vegetarian", "spicy", "seafood", "contains_nuts"];

export function TagBadges({ tags, t, className }: { tags: MenuTag[]; t: Dictionary; className?: string }) {
  if (!tags.length) return null;
  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      {ORDER.filter((tag) => tags.includes(tag)).map((tag) => (
        <Badge key={tag} tone={TONE[tag]}>
          {tag === "chef_special" ? <Star className="size-2.5" aria-hidden /> : null}
          {tag === "vegetarian" ? <Leaf className="size-2.5" aria-hidden /> : null}
          {tag === "spicy" ? <Flame className="size-2.5" aria-hidden /> : null}
          {t.menu.tags[tag]}
        </Badge>
      ))}
    </div>
  );
}
