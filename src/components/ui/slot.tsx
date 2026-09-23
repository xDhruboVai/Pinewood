import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

/** Minimal Radix-style Slot: merges props/className onto its single child. */
export function Slot({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const child = Children.only(children);
  if (!isValidElement<{ className?: string }>(child)) return null;
  return cloneElement(child, { ...props, className: cn(className, child.props.className) } as { className?: string });
}
