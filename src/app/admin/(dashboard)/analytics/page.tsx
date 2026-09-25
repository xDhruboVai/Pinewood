import { redirect } from "next/navigation";

// Not used for now: the admin is only Reservations and Menu (Saalim, September 2026).
// The screen's component is still in src/components/admin if it's wanted back.
export default function Page() {
  redirect("/admin/reservations");
}
