import "server-only";
import { jwtVerify } from "jose";

const AUDIENCE = "pinewood:reservation";

export interface ReservationToken {
  reservationId: string;
  version: number;
}

export async function verifyReservationToken(token: string): Promise<ReservationToken | null> {
  const secret = process.env.RESERVATION_TOKEN_SECRET;
  if (!secret || !token || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null;
    return { reservationId: payload.sub, version: payload.ver };
  } catch {
    return null;
  }
}
