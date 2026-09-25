// Starts a throwaway local PostgreSQL 17 (embedded-postgres, no Docker) and builds a template
// database from the project's real migrations + seed.sql. Each test file then gets its own copy
// (tests/db/helpers.ts), so files never see each other's data. Nothing here talks to Supabase.
//
// The few Supabase-only pieces the migrations use are stood in for (see STUBS): the auth schema and
// auth.uid(), Vault, pg_net's net.http_post (records calls instead of sending them), pg_cron,
// Realtime and the API roles with Supabase's default grants. pgcrypto is the real extension.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import type { TestProject } from "vitest/node";

const REPO = join(import.meta.dirname, "..", "..");
export const TEMPLATE_DB = "pinewood_template";

export const STUBS = String.raw`
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create schema net;
create table net.calls (id bigserial primary key, url text, body jsonb, headers jsonb, at timestamptz default clock_timestamp());
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $f$ insert into net.calls (url, body, headers) values (url, body, headers) returning id $f$;
create schema realtime;
create table realtime.sent (id bigserial primary key, topic text, event text, at timestamptz default clock_timestamp());
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as
  $f$ insert into realtime.sent (topic, event) values (topic, event) $f$;
create schema cron;
create function cron.schedule(n text, s text, c text) returns bigint language sql as $f$ select 1::bigint $f$;
create publication supabase_realtime;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

/** A migration as Supabase would run it, minus the extensions that only exist on Supabase (stubbed above). */
function migrationSql(file: string) {
  return readFileSync(file, "utf8").replace(/^\s*create extension[^;]*\b(pg_net|pg_cron)\b[^;]*;/gim, "-- (stubbed in tests: $1)");
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

declare module "vitest" {
  export interface ProvidedContext {
    pgPort: number;
  }
}

export default async function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), "pinewood-pg-"));
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  const stop = async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    await buildTemplate(port);
  } catch (e) {
    await stop();
    throw e;
  }
  project.provide("pgPort", port);
  return stop;
}

async function buildTemplate(port: number) {
  const admin = new pg.Client({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres" });
  await admin.connect();
  await admin.query(`create database ${TEMPLATE_DB}`);
  await admin.end();

  const db = new pg.Client({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: TEMPLATE_DB });
  await db.connect();
  await db.query("set client_min_messages = warning");
  await db.query(STUBS);
  const migrations = readdirSync(join(REPO, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of migrations) {
    try {
      await db.query(migrationSql(join(REPO, "supabase", "migrations", f)));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  await db.query(readFileSync(join(REPO, "supabase", "seed.sql"), "utf8"));
  await db.end();
}
