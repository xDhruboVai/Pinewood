import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

export default async function AdminHome() {
  await requireStaff();
  redirect("/admin/reservations");
}
