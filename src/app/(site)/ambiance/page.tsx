import { permanentRedirect } from "next/navigation";

// The old Spaces page: its photos are now in "Our rooms" on About us. Keep old links working.
export default function AmbiancePage() {
  permanentRedirect("/about#rooms");
}
