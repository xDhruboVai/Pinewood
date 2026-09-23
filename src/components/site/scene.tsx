import Image from "next/image";
import { PHOTOS } from "@/lib/site";
import { scenes, type SceneName } from "./art";
import { cn } from "@/lib/utils";

/** Real photo when one is configured in PHOTOS, otherwise the illustrated scene. */
export function Scene({
  name,
  title,
  className,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority,
  uid,
}: {
  name: SceneName;
  title: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  uid?: string;
}) {
  const photo = PHOTOS[name];
  if (photo) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image src={photo} alt={title} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  const Art = scenes[name];
  return (
    <div className={cn("overflow-hidden", className)}>
      <Art title={title} uid={uid} />
    </div>
  );
}
