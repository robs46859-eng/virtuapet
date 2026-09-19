import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  buildSeedRecords,
  DENVER_ORGANIZATION_ID,
  DENVER_ORGANIZATION_NAME,
  seedDenverSimulation
} from "./seed.mjs";

const cases = JSON.parse(await readFile(new URL("cases.json", import.meta.url), "utf8"));
const identities = Object.fromEntries(cases.map((item, index) => [item.participantId, `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`]));
const NOW = "2026-09-19T04:30:00.000Z";
const EXPIRES_AT = "2026-09-20T04:30:00.000Z";

function records() {
  return buildSeedRecords(cases, identities, { now: NOW, expiresAt: EXPIRES_AT });
}

function cloneMap(map) {
  return new Map([...map].map(([key, value]) => [key, structuredClone(value)]));
}

function fakePool(seedRecords = records()) {
  const state = {
    pets: new Map(),
    grants: new Map(),
    memberships: new Map(seedRecords.map((record, index) => [record.guardianId, index === 0 ? "clinic_admin" : "guardian"]))
  };
  const metrics = { connects: 0, releases: 0, commits: 0, rollbacks: 0 };
  let snapshot;

  const client = {
    async query(statement, parameters = []) {
      const sql = statement.replace(/\s+/g, " ").trim();
      if (sql === "BEGIN") {
        if (snapshot) throw new Error("transaction already active");
        snapshot = {
          pets: cloneMap(state.pets),
          grants: cloneMap(state.grants),
          memberships: cloneMap(state.memberships)
        };
        return { rowCount: null, rows: [] };
      }
      if (sql === "COMMIT") {
        if (!snapshot) throw new Error("no transaction active");
        snapshot = undefined;
        metrics.commits += 1;
        return { rowCount: null, rows: [] };
      }
      if (sql === "ROLLBACK") {
        if (!snapshot) throw new Error("no transaction active");
        state.pets = snapshot.pets;
        state.grants = snapshot.grants;
        state.memberships = snapshot.memberships;
        snapshot = undefined;
        metrics.rollbacks += 1;
        return { rowCount: null, rows: [] };
      }
      if (sql.startsWith("SELECT pg_advisory_xact_lock")) return { rowCount: 1, rows: [{}] };
      if (sql.startsWith("SELECT name, kind FROM organizations")) {
        return parameters[0] === DENVER_ORGANIZATION_ID
          ? { rowCount: 1, rows: [{ name: DENVER_ORGANIZATION_NAME, kind: "clinic" }] }
          : { rowCount: 0, rows: [] };
      }
      if (sql.startsWith("SELECT role FROM organization_memberships")) {
        const role = parameters[0] === DENVER_ORGANIZATION_ID ? state.memberships.get(parameters[1]) : undefined;
        return role ? { rowCount: 1, rows: [{ role }] } : { rowCount: 0, rows: [] };
      }
      if (sql.startsWith("INSERT INTO pet_profiles")) {
        const [petId, guardianId, name, species, microchipId, timestamp] = parameters;
        if (!state.pets.has(petId)) {
          state.pets.set(petId, {
            guardian_id: guardianId,
            name,
            species,
            microchip_id: microchipId,
            record_version: 1,
            created_at: new Date(timestamp),
            updated_at: new Date(timestamp)
          });
        }
        return { rowCount: state.pets.has(petId) ? 1 : 0, rows: [] };
      }
      if (sql.startsWith("SELECT guardian_id, name, species, microchip_id, record_version FROM pet_profiles")) {
        const row = state.pets.get(parameters[0]);
        return row ? { rowCount: 1, rows: [structuredClone(row)] } : { rowCount: 0, rows: [] };
      }
      if (sql.startsWith("INSERT INTO consent_grants")) {
        const [grantId, petId, grantorUserId, granteeId, scopesJson, purpose, startsAt, expiresAt] = parameters;
        if (!state.grants.has(grantId)) {
          state.grants.set(grantId, {
            pet_id: petId,
            grantor_user_id: grantorUserId,
            grantee_id: granteeId,
            scopes: JSON.parse(scopesJson),
            purpose,
            starts_at: new Date(startsAt),
            expires_at: new Date(expiresAt),
            revoked_at: null
          });
        }
        return { rowCount: state.grants.has(grantId) ? 1 : 0, rows: [] };
      }
      if (sql.startsWith("SELECT pet_id, grantor_user_id, grantee_id, scopes, purpose, starts_at, expires_at, revoked_at FROM consent_grants")) {
        const row = state.grants.get(parameters[0]);
        return row ? { rowCount: 1, rows: [structuredClone(row)] } : { rowCount: 0, rows: [] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    release() {
      metrics.releases += 1;
    }
  };

  return {
    state,
    metrics,
    async connect() {
      metrics.connects += 1;
      return client;
    },
    async query() {
      throw new Error("seed must not query through the pool outside the checked-out transaction client");
    }
  };
}

test("builds eight deterministic fictional pets with least-privilege short consent", () => {
  const first = records();
  const second = records();
  assert.deepEqual(first, second);
  assert.equal(first.length, 8);
  assert.equal(new Set(first.map(item => item.petId)).size, 8);
  assert.equal(new Set(first.map(item => item.grantId)).size, 8);
  assert.equal(new Set(first.map(item => item.guardianId)).size, 8);
  assert.ok(first.every(item => item.microchipId.startsWith("SIM-DENVER-")));

  const pixel = first.find(item => item.scenario === "manual-fgs-review");
  assert.deepEqual(pixel.scopes, ["pet.profile.read", "pet.health.summary.read", "pet.health.observation.write"]);
  assert.ok(first.filter(item => item !== pixel).every(item => JSON.stringify(item.scopes) === JSON.stringify(["pet.profile.read"])));
  assert.ok(first.every(item => Date.parse(item.expiresAt) - Date.parse(NOW) === 24 * 60 * 60 * 1_000));
  assert.equal(DENVER_ORGANIZATION_ID, "a8d2aeaa-8aaa-4fb8-9180-5e7591dd6b99");
});

test("rejects incomplete, malformed, duplicate, or case-mismatched identities", () => {
  assert.throws(() => buildSeedRecords(cases, {}, { now: NOW, expiresAt: EXPIRES_AT }), /identity map/);
  assert.throws(() => buildSeedRecords(cases, { ...identities, "participant-01": "not-a-uuid" }, { now: NOW, expiresAt: EXPIRES_AT }), /invalid identity/);
  assert.throws(() => buildSeedRecords(cases, { ...identities, "participant-02": identities["participant-01"] }, { now: NOW, expiresAt: EXPIRES_AT }), /distinct guardian identity/);
  assert.throws(
    () => buildSeedRecords(cases.map((item, index) => index === 0 ? { ...item, email: "fixture@example.invalid" } : item), identities, { now: NOW, expiresAt: EXPIRES_AT }),
    /credentials or contact data|approved simulation fields/
  );
  assert.throws(
    () => buildSeedRecords(cases.map((item, index) => index === 0 ? { ...item, pet: " Aspen" } : item), identities, { now: NOW, expiresAt: EXPIRES_AT }),
    /invalid pet name/
  );
});

test("rejects expired and excessively long consent windows", () => {
  assert.throws(() => buildSeedRecords(cases, identities, { now: NOW, expiresAt: NOW }), /future/);
  assert.throws(
    () => buildSeedRecords(cases, identities, { now: NOW, expiresAt: new Date(Date.parse(NOW) + 72 * 60 * 60 * 1_000 + 1).toISOString() }),
    /72 hours/
  );
});

test("uses one checked-out connection and safely replays an identical seed", async () => {
  const seedRecords = records();
  const pool = fakePool(seedRecords);

  const first = await seedDenverSimulation(pool, seedRecords, NOW);
  const second = await seedDenverSimulation(pool, seedRecords, NOW);

  assert.deepEqual(second, first);
  assert.equal(pool.state.pets.size, 8);
  assert.equal(pool.state.grants.size, 8);
  assert.equal(pool.metrics.connects, 2);
  assert.equal(pool.metrics.releases, 2);
  assert.equal(pool.metrics.commits, 2);
  assert.equal(pool.metrics.rollbacks, 0);
});

test("rolls back every pet and grant inserted before a late fixture conflict", async () => {
  const seedRecords = records();
  const pool = fakePool(seedRecords);
  const conflictingRecord = seedRecords.at(-1);
  pool.state.pets.set(conflictingRecord.petId, {
    guardian_id: seedRecords[0].guardianId,
    name: conflictingRecord.name,
    species: conflictingRecord.species,
    microchip_id: conflictingRecord.microchipId,
    record_version: 1
  });

  await assert.rejects(() => seedDenverSimulation(pool, seedRecords, NOW), /existing pet fixture mismatch/);

  assert.equal(pool.state.pets.size, 1);
  assert.equal(pool.state.pets.get(conflictingRecord.petId).guardian_id, seedRecords[0].guardianId);
  assert.equal(pool.state.grants.size, 0);
  assert.equal(pool.metrics.commits, 0);
  assert.equal(pool.metrics.rollbacks, 1);
  assert.equal(pool.metrics.releases, 1);
});

test("fails closed when a replay finds changed consent scopes", async () => {
  const seedRecords = records();
  const pool = fakePool(seedRecords);
  await seedDenverSimulation(pool, seedRecords, NOW);
  const stored = pool.state.grants.get(seedRecords[0].grantId);
  stored.scopes = ["pet.profile.read", "pet.health.summary.read"];

  await assert.rejects(() => seedDenverSimulation(pool, seedRecords, NOW), /existing consent fixture mismatch/);

  assert.deepEqual(pool.state.grants.get(seedRecords[0].grantId).scopes, ["pet.profile.read", "pet.health.summary.read"]);
  assert.equal(pool.metrics.commits, 1);
  assert.equal(pool.metrics.rollbacks, 1);
  assert.equal(pool.metrics.releases, 2);
});

test("fails closed when a replay finds a different consent expiry", async () => {
  const seedRecords = records();
  const pool = fakePool(seedRecords);
  await seedDenverSimulation(pool, seedRecords, NOW);
  const stored = pool.state.grants.get(seedRecords[0].grantId);
  stored.expires_at = new Date(Date.parse(EXPIRES_AT) - 60_000);

  await assert.rejects(() => seedDenverSimulation(pool, seedRecords, NOW), /existing consent fixture mismatch/);

  assert.equal(pool.state.grants.get(seedRecords[0].grantId).expires_at.toISOString(), new Date(Date.parse(EXPIRES_AT) - 60_000).toISOString());
  assert.equal(pool.metrics.commits, 1);
  assert.equal(pool.metrics.rollbacks, 1);
});

test("rejects an active membership with an unrelated clinic role", async () => {
  const seedRecords = records();
  const pool = fakePool(seedRecords);
  pool.state.memberships.set(seedRecords[0].guardianId, "vet_staff");

  await assert.rejects(() => seedDenverSimulation(pool, seedRecords, NOW), /active guardian membership required/);

  assert.equal(pool.state.pets.size, 0);
  assert.equal(pool.state.grants.size, 0);
  assert.equal(pool.metrics.rollbacks, 1);
  assert.equal(pool.metrics.releases, 1);
});
