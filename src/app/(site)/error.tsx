"use client";

import { ErrorScreen } from "@/components/site/error-screen";

// Public pages: the error shows inside the site's header and footer.
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
