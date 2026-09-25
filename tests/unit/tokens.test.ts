// The guest's signed booking link (src/lib/tokens.ts). Links are signed by the email Edge Function
// with the same secret, audience and HS256; the website only verifies them.
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyReservationToken } from "@/lib/tokens";

const SECRET = "test-reservation-secret-that-is-long-enough";
const ID = "3f1c2b4a-9d8e-4f7a-b6c5-1a2b3c4d5e6f";

// ver: null leaves the version claim out.
async function sign({ secret = SECRET, aud = "pinewood:reservation", ver = 1 as unknown, exp = "1h", sub = ID, alg = "HS256" } = {}) {
  const jwt = new SignJWT(ver === null ? {} : { ver }).setProtectedHeader({ alg }).setAudience(aud).setIssuedAt().setExpirationTime(exp);
  if (sub) jwt.setSubject(sub);
  return jwt.sign(new TextEncoder().encode(secret));
}

describe("verifyReservationToken", () => {
  beforeEach(() => {
    process.env.RESERVATION_TOKEN_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.RESERVATION_TOKEN_SECRET;
  });

  it("accepts a valid link and returns the booking id and token version", async () => {
    expect(await verifyReservationToken(await sign({ ver: 3 }))).toEqual({ reservationId: ID, version: 3 });
  });
  it("rejects a link signed with another secret", async () => {
    expect(await verifyReservationToken(await sign({ secret: "someone-elses-secret-value-xxxxxxxx" }))).toBeNull();
  });
  it("rejects an expired link", async () => {
    expect(await verifyReservationToken(await sign({ exp: "-1m" }))).toBeNull();
  });
  it("rejects a token made for another purpose (audience)", async () => {
    expect(await verifyReservationToken(await sign({ aud: "pinewood:staff" }))).toBeNull();
  });
  it("rejects a token without a version or a booking id", async () => {
    expect(await verifyReservationToken(await sign({ ver: null }))).toBeNull();
    expect(await verifyReservationToken(await sign({ ver: "1" }))).toBeNull();
    expect(await verifyReservationToken(await sign({ sub: "" }))).toBeNull();
  });
  it("rejects another signing algorithm, garbage, empty and oversized input", async () => {
    expect(await verifyReservationToken(await sign({ alg: "HS512" }))).toBeNull();
    expect(await verifyReservationToken("not.a.token")).toBeNull();
    expect(await verifyReservationToken("")).toBeNull();
    expect(await verifyReservationToken("x".repeat(2049))).toBeNull();
  });
  it("rejects every link when the secret is not configured", async () => {
    const token = await sign();
    delete process.env.RESERVATION_TOKEN_SECRET;
    expect(await verifyReservationToken(token)).toBeNull();
  });
});
