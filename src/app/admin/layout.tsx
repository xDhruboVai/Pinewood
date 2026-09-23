import type { Metadata } from "next";
import { ForceDayMode } from "@/components/site/ambiance";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Pine Wood Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-ambiance="day" lang="en" className="min-h-dvh bg-canvas text-ink">
      <ForceDayMode />
      {children}
    </div>
  );
}
