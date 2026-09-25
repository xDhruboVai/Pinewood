// Small pure helpers used by the booking form and the staff screens.
import { describe, expect, it } from "vitest";
import { composeBookingNotes, parseBookingNotes } from "@/lib/booking-notes";
import { dhakaToIso, isoToDhakaDate, isoToDhakaTime, normalizePhone } from "@/lib/format";
import { readHour, readMinute } from "@/components/reserve/time-picker";

describe("normalizePhone (Bangladesh numbers)", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["+8801712345678", "+8801712345678"],
    ["017-1234 5678", "+8801712345678"],
    ["(017) 1234-5678", "+8801712345678"],
    ["01312345678", "+8801312345678"],
    ["+447911123456", "+447911123456"],
  ])("%s -> %s", (raw, expected) => expect(normalizePhone(raw)).toBe(expected));

  it.each(["0121234567", "01212345678", "0171234567", "017123456789", "1712345678", "+0171234", "phone", ""])("rejects %j", (raw) =>
    expect(normalizePhone(raw)).toBeNull(),
  );
});

describe("Dhaka time helpers (UTC+6, no daylight saving)", () => {
  it("converts a Dhaka wall-clock time to an instant and back", () => {
    const iso = dhakaToIso("2026-10-02", "19:30");
    expect(iso).toBe("2026-10-02T13:30:00.000Z");
    expect(isoToDhakaDate(iso)).toBe("2026-10-02");
    expect(isoToDhakaTime(iso)).toBe("19:30");
  });
  it("puts a late-night UTC instant on the next Dhaka day", () => {
    expect(isoToDhakaDate("2026-10-02T19:00:00Z")).toBe("2026-10-03");
  });
});

describe("booking notes (branch and seating for staff)", () => {
  it("round-trips branch, seating and the guest's note", () => {
    const text = composeBookingNotes({ branch: "Banani", seating: "outside", note: "  Birthday cake at 9  " });
    expect(text).toBe("Branch: Banani\nSeating: Outside (smoking)\nBirthday cake at 9");
    expect(parseBookingNotes(text)).toEqual({ branch: "Banani", seating: "Outside (smoking)", note: "Birthday cake at 9" });
  });
  it("leaves out the branch line when there is one branch, and an empty note", () => {
    expect(composeBookingNotes({ seating: "inside", note: "" })).toBe("Seating: Inside (non-smoking)");
  });
  it("only reads the leading lines, so a guest's own 'Branch:' text stays in the note", () => {
    expect(parseBookingNotes("Please call first\nBranch: nowhere")).toEqual({ branch: null, seating: null, note: "Please call first\nBranch: nowhere" });
    expect(parseBookingNotes(null)).toEqual({ branch: null, seating: null, note: null });
  });
});

describe("typed booking time", () => {
  it("reads the hour where the caret is, including over a pre-filled hour", () => {
    expect(readHour("7")).toEqual({ hour: "7" });
    expect(readHour("78", "7")).toEqual({ hour: "8" }); // typed 8 after 7: 78 is not an hour
    expect(readHour("11", "1")).toEqual({ hour: "11" });
    expect(readHour("19")).toEqual({ hour: "7", ampm: "pm" }); // 24-hour input
    expect(readHour("0")).toEqual({ hour: "" });
    expect(readHour("")).toEqual({ hour: "" });
  });
  it("keeps minutes to two digits between 00 and 59", () => {
    expect(readMinute("30")).toBe("30");
    expect(readMinute("3")).toBe("3");
    expect(readMinute("75")).toBe("5");
    expect(readMinute("ab")).toBe("");
  });
});
