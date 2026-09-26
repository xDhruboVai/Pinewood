import type { Metadata } from "next";
import StaffPage from "@/app/admin/(dashboard)/staff/page";

export const metadata: Metadata = {
  title: "Staff access",
  robots: { index: false, follow: false },
};

export default StaffPage;
