import Image from "next/image";
import { PHOTOS, type PhotoName } from "@/lib/site";
import { cn } from "@/lib/utils";

/** One of the real photos from PHOTOS, cropped to fill its box. */
export function Photo({
  name,
  alt,
  className,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  position,
  priority,
}: {
  name: PhotoName;
  alt: string;
  className?: string;
  sizes?: string;
  position?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("photo-zoom relative overflow-hidden rounded-[2px] bg-pine-900/10", className)}>
      <Image
        src={PHOTOS[name].src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        style={position ? { objectPosition: position } : undefined}
        className="object-cover"
      />
    </div>
  );
}
