// Frontend preview only: stands in for src/lib/supabase/server.ts when the dev server runs with
// PW_PREVIEW=1 (see next.config.ts). Every client is "signed in" as the preview manager and reads
// sample data from ./fake-db. Writes are ignored.
import { fakeAuth, fakeFrom, fakeRpc } from "./fake-db";

function previewClient() {
  return {
    auth: fakeAuth,
    from: (table: string) => fakeFrom(table),
    rpc: (name: string, args?: Record<string, unknown>) => fakeRpc(name, args),
  };
}

export async function createClient() {
  return previewClient();
}

export function createPublicClient() {
  return previewClient();
}

export function createAdminClient() {
  return previewClient();
}
