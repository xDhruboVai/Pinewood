import { redirect } from "next/navigation";

// The admin opens on Reservations (the overview page was dropped, September 2026).
export default function AdminHome() {
  redirect("/admin/reservations");
}
