import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import type * as StoreModule from "./unreleased-store.ts";

const databaseUrl = process.env.TEST_DATABASE_URL || "postgres://postgres@127.0.0.1:5432/hero_unreleased_test";

let store: typeof StoreModule | null = null;
let db: Pool | null = null;

before(async () => {
  const probe = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000, max: 1 });
  try {
    await probe.query("SELECT 1");
  } catch {
    await probe.end().catch(() => undefined);
    return;
  }
  await probe.end().catch(() => undefined);
  process.env.DATABASE_URL = databaseUrl;
  store = await import("./unreleased-store.ts");
  db = new Pool({ connectionString: databaseUrl, max: 4 });
});

after(async () => {
  if (db) {
    await db.query("DROP TABLE IF EXISTS unreleased_tracks");
    await db.query("DROP TABLE IF EXISTS unreleased_seed");
    await db.end();
  }
});

async function reset(): Promise<void> {
  await db?.query("DROP TABLE IF EXISTS unreleased_tracks");
  await db?.query("DROP TABLE IF EXISTS unreleased_seed");
  store?.resetUnreleasedReadyForTests();
}

test("seed runs once, and hide, reorder, add, and remove stick", async (t) => {
  if (!store || !db) {
    t.skip("Postgres is not available");
    return;
  }
  await reset();

  const seeded = await store.listAdminUnreleasedTracks();
  assert.deepEqual(
    seeded.map((track) => [track.id, track.title, track.pathname, track.hidden]),
    [
      ["listen", "Listen", "unreleased/listen.mp3", false],
      ["still-there", "Still There", "unreleased/still-there.mp3", false],
    ],
  );

  await store.updateUnreleasedTrack("listen", { title: "Listen Up", note: "for members", duration: "3:01" });
  store.resetUnreleasedReadyForTests();
  const renamed = await store.listAdminUnreleasedTracks();
  assert.equal(renamed.find((track) => track.id === "listen")?.title, "Listen Up");
  assert.equal(renamed.find((track) => track.id === "listen")?.note, "for members");
  assert.equal(renamed.length, 2);

  await store.setUnreleasedTrackHidden("listen", true);
  assert.equal((await store.listMemberUnreleasedTracks()).some((track) => track.id === "listen"), false);
  assert.equal(await store.getPlayableUnreleasedTrack("listen"), null);
  assert.equal((await store.getPlayableUnreleasedTrack("listen", { admin: true }))?.title, "Listen Up");
  assert.equal((await store.listMemberUnreleasedTracks()).map((track) => track.id).join(), "still-there");

  await store.moveUnreleasedTrack("still-there", "up");
  assert.deepEqual(
    (await store.listAdminUnreleasedTracks()).map((track) => track.id),
    ["still-there", "listen"],
  );

  const created = await store.createUnreleasedTrack({ title: "Night Drive", note: "demo", duration: "2:10" });
  assert.match(created.id, /^night-drive-[a-f0-9]{6}$/);
  assert.equal(created.pathname, `unreleased/${created.id}.mp3`);
  assert.equal((await store.findUnreleasedUpload(created.id, created.pathname))?.title, "Night Drive");
  assert.equal(await store.findUnreleasedUpload(created.id, "unreleased/listen.mp3"), null);
  assert.equal(await store.findUnreleasedUpload("listen", "unreleased/../secret.mp3"), null);
  assert.equal(await store.findUnreleasedUpload("nope", "unreleased/nope.mp3"), null);
  assert.deepEqual(
    (await store.listMemberUnreleasedTracks()).map((track) => track.id),
    ["still-there", created.id],
  );

  const removed = await store.removeUnreleasedTrack(created.id);
  assert.equal(removed.pathname, created.pathname);
  store.resetUnreleasedReadyForTests();
  const afterRemove = await store.listAdminUnreleasedTracks();
  assert.equal(afterRemove.some((track) => track.id === created.id), false);
  assert.equal(afterRemove.some((track) => track.id === "still-there"), true);
  assert.equal(await store.getUnreleasedTrackById("../secret"), null);
  await assert.rejects(() => store?.removeUnreleasedTrack("../secret"), store.UnreleasedInputError);
});
