"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A sideways scrolling row. Touch screens use the browser's own swipe and snap; with a mouse the row
 * can be dragged. A drag doesn't count as a click on the card underneath.
 */
export function DragScroll({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
    suppressClick.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.dataset.dragging = "";
    }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const onPointerUp = () => {
    const el = ref.current;
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
    if (el) delete el.dataset.dragging;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        "no-scrollbar flex cursor-grab snap-x snap-mandatory overflow-x-auto overscroll-x-contain select-none data-[dragging]:cursor-grabbing data-[dragging]:snap-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mustard-400",
        className,
      )}
    >
      {children}
    </div>
  );
}
