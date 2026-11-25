import "server-only";
import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "@/lib/auth";
import {
  MAX_UNRELEASED_TRACKS,
  UNRELEASED_TRACKS,
  buildTrackId,
  unreleasedPathname,
  unreleasedUploadTarget,
  type UnreleasedTrack,
} from "@/lib/unreleased-tracks";

/**
 * Additive catalog for unreleased songs. Created on first use.
 * Never DROP, rename, or delete rows except the one song an admin removes.
 * The seed marker is written in the same transaction as Listen and Still There,
 * so a later delete does not put those songs back.
 */
const SEED_NAME = "catalog-v1";
const SEED_LOCK = 20261125;

const CREATE_TRACKS = `CREATE TABLE IF NOT EXISTS unreleased_tracks (
  id text PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 48 AND id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  artist text NOT NULL DEFAULT '#Hero',
  duration text NOT NULL DEFAULT '' CHECK (
    duration = ''
    OR duration ~ '^[0-9]{1,3}:[0-5][0-9]$'
    OR duration ~ '^[0-9]:[0-5][0-9]:[0-5][0-9]$'
  ),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 240),
  pathname text NOT NULL UNIQUE CHECK (pathname = 'unreleased/' || id || '.mp3'),
  position integer NOT NULL CHECK (position >= 0 AND position < 10000),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
)`;

const CREATE_SEED = `CREATE TABLE IF NOT EXISTS unreleased_seed (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT NOW()
)`;

const COLUMNS = "id, title, artist, duration, note, pathname, position, hidden, created_at, updated_at";

export class UnreleasedInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreleasedInputError";
  }
}

export type StoredUnreleasedTrack = UnreleasedTrack & {
  position: number;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TrackRow = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  note: string;
  pathname: string;
  position: number;
  hidden: boolean;
  created_at: Date;
  updated_at: Date;
};

type Queryable = Pick<Pool | PoolClient, "query">;

let ready: Promise<void> | null = null;

export function resetUnreleasedReadyForTests(): void {
  ready = null;
}

export async function ensureUnreleasedTables(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (!ready) {
    ready = applyUnreleasedTables(pool).catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function applyUnreleasedTables(pool: Pool): Promise<void> {
  await pool.query(CREATE_TRACKS);
  await pool.query(CREATE_SEED);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS unreleased_tracks_order_idx ON unreleased_tracks (position ASC, created_at ASC, id ASC)`,
  );
  await seedUnreleasedCatalog(pool);
}

async function seedUnreleasedCatalog(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [SEED_LOCK]);
    const inserted = await client.query(
      `INSERT INTO unreleased_seed (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING name`,
      [SEED_NAME],
    );
    if ((inserted.rowCount ?? 0) > 0) {
      for (const [index, track] of UNRELEASED_TRACKS.entries()) {
        await client.query(
          `INSERT INTO unreleased_tracks (id, title, artist, duration, note, pathname, position, hidden)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false)
           ON CONFLICT (id) DO NOTHING`,
          [track.id, track.title, track.artist, track.duration, track.note, track.pathname, index],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may already be aborted.
    }
    throw error;
  } finally {
    client.release();
  }
}

function requirePool(): Pool {
  const pool = getPool();
  if (!pool) throw new UnreleasedInputError("Database is not configured.");
  return pool;
}

function mapTrack(row: TrackRow): StoredUnreleasedTrack {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    duration: row.duration,
    note: row.note,
    pathname: row.pathname,
    position: row.position,
    hidden: row.hidden,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "23505";
}

async function selectTrack(db: Queryable, id: string): Promise<StoredUnreleasedTrack | null> {
  const result = await db.query<TrackRow>(`SELECT ${COLUMNS} FROM unreleased_tracks WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapTrack(row) : null;
}

export async function listAdminUnreleasedTracks(): Promise<StoredUnreleasedTrack[]> {
  const pool = requirePool();
  await ensureUnreleasedTables();
  const result = await pool.query<TrackRow>(
    `SELECT ${COLUMNS} FROM unreleased_tracks ORDER BY position ASC, created_at ASC, id ASC`,
  );
  return result.rows.map(mapTrack);
}

/** Visible songs for Early access. Falls back to the seed list if the database cannot be read. */
export async function listMemberUnreleasedTracks(): Promise<UnreleasedTrack[]> {
  const pool = getPool();
  if (!pool) return [...UNRELEASED_TRACKS];
  try {
    await ensureUnreleasedTables();
    const result = await pool.query<TrackRow>(
      `SELECT ${COLUMNS} FROM unreleased_tracks WHERE hidden = false ORDER BY position ASC, created_at ASC, id ASC`,
    );
    return result.rows.map(mapTrack);
  } catch {
    console.error("Unreleased catalog lookup failed");
    return [...UNRELEASED_TRACKS];
  }
}

/**
 * Members do not receive hidden songs. Admins can preview them.
 * A database outage falls back to the two seeded songs only.
 */
export async function getPlayableUnreleasedTrack(
  id: string,
  options?: { admin?: boolean },
): Promise<UnreleasedTrack | null> {
  const pathname = unreleasedPathname(id);
  if (!pathname) return null;
  const pool = getPool();
  if (!pool) return getSeeded(id);
  try {
    await ensureUnreleasedTables();
    const track = await selectTrack(pool, id);
    if (!track || track.pathname !== pathname) return null;
    if (track.hidden && !options?.admin) return null;
    return track;
  } catch {
    console.error("Unreleased track lookup failed");
    return getSeeded(id);
  }
}

function getSeeded(id: string): UnreleasedTrack | null {
  return UNRELEASED_TRACKS.find((track) => track.id === id) ?? null;
}

/** Admin replace/upload. No seed fallback: a removed song cannot be written again at the old path. */
export async function findUnreleasedUpload(trackId: string | null, pathname: string): Promise<UnreleasedTrack | null> {
  const shape = unreleasedUploadTarget(trackId, pathname);
  if (!shape) return null;
  const pool = requirePool();
  await ensureUnreleasedTables();
  const track = await selectTrack(pool, shape.id);
  if (!track || track.pathname !== shape.pathname) return null;
  return track;
}

export async function getUnreleasedTrackById(id: string): Promise<StoredUnreleasedTrack | null> {
  if (!unreleasedPathname(id)) return null;
  const pool = requirePool();
  await ensureUnreleasedTables();
  return selectTrack(pool, id);
}

export async function createUnreleasedTrack(input: {
  title: string;
  note: string;
  duration: string;
}): Promise<{ id: string; pathname: string }> {
  const pool = requirePool();
  await ensureUnreleasedTables();
  const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM unreleased_tracks`);
  if (Number(count.rows[0]?.count || "0") >= MAX_UNRELEASED_TRACKS) {
    throw new UnreleasedInputError("The list is full. Remove a song before adding another.");
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = buildTrackId(input.title, randomBytes(3).toString("hex"));
    const pathname = id ? unreleasedPathname(id) : null;
    if (!id || !pathname) throw new UnreleasedInputError("Enter a title.");
    try {
      await pool.query(
        `INSERT INTO unreleased_tracks (id, title, artist, duration, note, pathname, position, hidden)
         VALUES ($1, $2, '#Hero', $3, $4, $5, COALESCE((SELECT MAX(position) + 1 FROM unreleased_tracks), 0), false)`,
        [id, input.title, input.duration, input.note, pathname],
      );
      return { id, pathname };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  throw new UnreleasedInputError("Could not add that song. Try again.");
}

export async function updateUnreleasedTrack(
  id: string,
  input: { title: string; note: string; duration: string },
): Promise<void> {
  if (!unreleasedPathname(id)) throw new UnreleasedInputError("That song was not found.");
  const pool = requirePool();
  await ensureUnreleasedTables();
  const result = await pool.query(
    `UPDATE unreleased_tracks
     SET title = $2, note = $3, duration = $4, updated_at = NOW()
     WHERE id = $1`,
    [id, input.title, input.note, input.duration],
  );
  if ((result.rowCount ?? 0) === 0) throw new UnreleasedInputError("That song was not found.");
}

export async function setUnreleasedTrackHidden(id: string, hidden: boolean): Promise<void> {
  if (!unreleasedPathname(id)) throw new UnreleasedInputError("That song was not found.");
  const pool = requirePool();
  await ensureUnreleasedTables();
  const result = await pool.query(
    `UPDATE unreleased_tracks SET hidden = $2, updated_at = NOW() WHERE id = $1`,
    [id, hidden],
  );
  if ((result.rowCount ?? 0) === 0) throw new UnreleasedInputError("That song was not found.");
}

export async function moveUnreleasedTrack(id: string, direction: "up" | "down"): Promise<void> {
  if (!unreleasedPathname(id)) throw new UnreleasedInputError("That song was not found.");
  const pool = requirePool();
  await ensureUnreleasedTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(
      `SELECT id FROM unreleased_tracks ORDER BY position ASC, created_at ASC, id ASC FOR UPDATE`,
    );
    const ids = result.rows.map((row) => row.id);
    const index = ids.indexOf(id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0) throw new UnreleasedInputError("That song was not found.");
    if (target < 0 || target >= ids.length) {
      await client.query("COMMIT");
      return;
    }
    const next = ids.slice();
    const current = next[index];
    const neighbor = next[target];
    if (!current || !neighbor) throw new UnreleasedInputError("That song was not found.");
    next[index] = neighbor;
    next[target] = current;
    for (let position = 0; position < next.length; position += 1) {
      await client.query(`UPDATE unreleased_tracks SET position = $2, updated_at = NOW() WHERE id = $1`, [
        next[position],
        position,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may already be aborted.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function removeUnreleasedTrack(id: string): Promise<{ pathname: string; title: string }> {
  if (!unreleasedPathname(id)) throw new UnreleasedInputError("That song was not found.");
  const pool = requirePool();
  await ensureUnreleasedTables();
  const result = await pool.query<{ pathname: string; title: string }>(
    `DELETE FROM unreleased_tracks WHERE id = $1 RETURNING pathname, title`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new UnreleasedInputError("That song was not found.");
  return row;
}
