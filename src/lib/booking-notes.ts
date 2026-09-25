/**
 * The booking system doesn't store branch or seating as their own fields yet, so the booking form
 * sends them to staff inside the booking's notes (reservations.special_requests):
 *
 *   Branch: Banani              (only when there's more than one branch to choose from)
 *   Seating: Outside (smoking)
 *   <the guest's own note>
 *
 * The form writes this with composeBookingNotes and the staff screens read it back with
 * parseBookingNotes, so the two always agree. Since the branches migration the booking's area also
 * records its branch and seating as data; the notes stay as the readable copy for staff.
 */
import type { Seating } from "@/lib/types";

const SEATING_TEXT: Record<Seating, string> = {
  inside: "Inside (non-smoking)",
  outside: "Outside (smoking)",
};

const BRANCH = "Branch: ";
const SEATING = "Seating: ";

export function composeBookingNotes({ branch, seating, note }: { branch?: string | null; seating: Seating; note: string }) {
  return [branch ? `${BRANCH}${branch}` : "", `${SEATING}${SEATING_TEXT[seating]}`, note.trim()].filter(Boolean).join("\n");
}

export interface BookingNotes {
  branch: string | null;
  seating: string | null;
  note: string | null;
}

/** Splits the notes back into branch, seating and the guest's note. Only the leading lines are read
 *  as branch and seating, so a guest's note that happens to start with "Branch:" stays in the note. */
export function parseBookingNotes(text: string | null | undefined): BookingNotes {
  const lines = (text ?? "").split(/\r?\n/);
  let i = 0;
  let branch: string | null = null;
  let seating: string | null = null;
  if (lines[i]?.startsWith(BRANCH)) branch = lines[i++].slice(BRANCH.length).trim() || null;
  if (lines[i]?.startsWith(SEATING)) seating = lines[i++].slice(SEATING.length).trim() || null;
  const note = lines.slice(i).join("\n").trim() || null;
  return { branch, seating, note };
}
