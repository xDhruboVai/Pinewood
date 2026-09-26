"use client";

import "./globals.css";

// Last resort when the root layout itself fails: it replaces <html>, so no fonts, dictionary or
// providers are available here. Kept plain, in the site's colours, with no error details.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error("Root layout failed", error.digest ? `(digest ${error.digest})` : error);
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="grain flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center text-ink">
        <h1 className="display text-4xl">Something went wrong.</h1>
        <p className="mt-4 max-w-md text-ink-muted">We&apos;re having trouble loading this page. Please try again.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
          <button type="button" onClick={() => reset()} className="rounded-[2px] bg-primary px-6 py-3 text-sm font-semibold text-primary-ink">
            Try again
          </button>
          {/* A full page load, since the app shell itself is broken. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a client-side Link can't recover a broken root layout */}
          <a href="/" className="text-sm font-medium text-primary underline underline-offset-4">
            Return home
          </a>
        </div>
      </body>
    </html>
  );
}
