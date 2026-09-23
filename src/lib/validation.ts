import { z } from "zod";
import { normalizePhone } from "@/lib/format";

const uuid = z.string().uuid();

export const slotSchema = z.object({
  areaId: uuid,
  start: z.string().datetime({ offset: true }),
  duration: z.coerce.number().int().refine((n) => [60, 90, 120, 180, 240].includes(n)),
  partySize: z.coerce.number().int().min(1).max(10),
});

export const guestSchema = z.object({
  name: z.string().trim().min(2, "invalidName").max(80, "invalidName"),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const normalized = normalizePhone(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "invalidPhone" });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z.string().trim().toLowerCase().max(254, "invalidEmail").email("invalidEmail"),
  requests: z.string().trim().max(500).optional().default(""),
  largeParty: z.boolean().default(false),
  consent: z.literal(true, { message: "consentRequired" }),
  locale: z.enum(["en", "bn"]).default("en"),
  // Honeypot: real users never fill this.
  website: z.string().max(0).optional().default(""),
});

export const reservationSchema = guestSchema.extend({
  holdId: uuid,
});

export const waitlistSchema = guestSchema.extend(slotSchema.shape);

export const preOrderSchema = z.object({
  token: z.string().min(10).max(2048),
  notes: z.string().trim().max(500).optional().default(""),
  items: z
    .array(
      z.object({
        item_id: uuid,
        variant_id: uuid.nullable().optional(),
        addon_ids: z.array(uuid).max(10).default([]),
        quantity: z.number().int().min(1).max(20),
        notes: z.string().trim().max(200).optional().default(""),
      }),
    )
    .max(40),
});

/** Map a Postgres "PW_*" exception (or zod issue key) to a dictionary key. */
export function errorKey(err: unknown): string {
  const msg =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  const match = msg.match(/PW_[A-Z_]+/);
  return match ? match[0] : "generic";
}
