"use client";

import { ErrorScreen } from "@/components/site/error-screen";

// Everything outside the public site (e.g. the staff admin), and errors in the site layout itself.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} standalone />;
}
