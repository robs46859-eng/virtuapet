import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { validateCases } from "./workflow.mjs";

export const DENVER_ORGANIZATION_ID = "a8d2aeaa-8aaa-4fb8-9180-5e7591dd6b99";
export const DENVER_ORGANIZATION_NAME = "MyPets Denver Veterinary Clinic (Simulation)";

const CASE_FIELDS = ["offsetMinutes", "participantId", "pet", "scenario", "species"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_GUARDIAN_ROLES = new Set(["guardian", "clinic_admin"]);
const CONSENT_PURPOSE = "[SIMULATION] Denver Mock workflow rehearsal";
const PROFILE_SCOPE = "pet.profile.read";
const FGS_SCOPES = [PROFILE_SCOPE, "pet.health.summary.read", "pet.health.observation.write"];
const DEFAULT_CONSENT_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAX_CONSENT_DURATION_MS = 72 * 60 * 60 * 1_000;

function deterministicUuid(label) {
  const bytes = Buffer.from(createHash("sha256").update(label).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function isoTimestamp(value, label) {
  const milliseconds = typeof value === "string" || value instanceof Date ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(milliseconds)) throw new Error(`invalid ${label}`);
  return new Date(milliseconds).toISOString();
}

function expectedScopes(scenario) {
  return scenario === "manual-fgs-review" ? [...FGS_SCOPES] : [PROFILE_SCOPE];
}

function canonicalScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== "string")) return undefined;
  return [...scopes].sort();
}

function sameScopes(left, right) {
  const normalizedLeft = canonicalScopes(left);
  const normalizedRight = canonicalScopes(right);
  return Boolean(normalizedLeft && normalizedRight && JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight));
}

function assertStrictCases(cases) {
  validateCases(cases);
  for (const item of cases) {
    if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(CASE_FIELDS)) {
      throw new Error(`case ${item.participantId} must contain only the approved simulation fields`);
    }
    if (typeof item.pet !== "string" || item.pet.trim() !== item.pet || item.pet.length < 1 || item.pet.length > 80) {
      throw new Error(`invalid pet name for ${item.participantId}`);
    }
  }
}

function validateConsentWindow(now, expiresAt) {
  const nowMs = Date.parse(now);
  const expiresMs = Date.parse(expiresAt);
  if (expiresMs <= nowMs) throw new Error("consent expiry must be in the future");
  if (expiresMs - nowMs > MAX_CONSENT_DURATION_MS) throw new Error("consent expiry cannot exceed 72 hours");
}

export function buildSeedRecords(cases, identityMap, options = {}) {
  assertStrictCases(cases);
  if (!identityMap || typeof identityMap !== "object" || Array.isArray(identityMap)) {
    throw new Error("identity map must be an object");
  }

  const expected = cases.map(item => item.participantId).sort();
  const supplied = Object.keys(identityMap).sort();
  if (JSON.stringify(expected) !== JSON.stringify(supplied)) {
    throw new Error("identity map must contain exactly participant-01 through participant-08");
  }

  const now = isoTimestamp(options.now ?? new Date(), "seed time");
  const expiresAt = isoTimestamp(options.expiresAt ?? new Date(Date.parse(now) + DEFAULT_CONSENT_DURATION_MS), "consent expiry");
  validateConsentWindow(now, expiresAt);

  const identities = new Set();
  return cases.map(item => {
    const suppliedGuardianId = identityMap[item.participantId];
    if (typeof suppliedGuardianId !== "string" || !UUID_PATTERN.test(suppliedGuardianId)) {
      throw new Error(`invalid identity for ${item.participantId}`);
    }
    const guardianId = suppliedGuardianId.toLowerCase();
    if (identities.has(guardianId)) throw new Error("each fictional participant requires a distinct guardian identity");
    identities.add(guardianId);
    return {
      participantId: item.participantId,
      scenario: item.scenario,
      petId: deterministicUuid(`virtuapet:denver-mock:pet:${item.participantId}`),
      grantId: deterministicUuid(`virtuapet:denver-mock:grant:${item.participantId}`),
      guardianId,
      name: item.pet,
      species: item.species,
      microchipId: `SIM-DENVER-${item.participantId.slice(-2)}`,
      scopes: expectedScopes(item.scenario),
      expiresAt
    };
  });
}

function validateSeedRecords(records, now) {
  if (!Array.isArray(records) || records.length !== 8) throw new Error("exactly eight seed records are required");
  const seenParticipants = new Set();
  const seenGuardians = new Set();
  const seenPets = new Set();
  const seenGrants = new Set();

  for (const record of records) {
    if (!record || typeof record !== "object" || !/^participant-0[1-8]$/.test(record.participantId)) {
      throw new Error("invalid seed participant");
    }
    if (seenParticipants.has(record.participantId)) throw new Error("seed participants must be unique");
    if (typeof record.guardianId !== "string" || !UUID_PATTERN.test(record.guardianId) || record.guardianId !== record.guardianId.toLowerCase()) {
      throw new Error(`invalid identity for ${record.participantId}`);
    }
    if (seenGuardians.has(record.guardianId)) throw new Error("each fictional participant requires a distinct guardian identity");
    if (record.petId !== deterministicUuid(`virtuapet:denver-mock:pet:${record.participantId}`)) {
      throw new Error(`invalid pet fixture id for ${record.participantId}`);
    }
    if (record.grantId !== deterministicUuid(`virtuapet:denver-mock:grant:${record.participantId}`)) {
      throw new Error(`invalid consent fixture id for ${record.participantId}`);
    }
    if (seenPets.has(record.petId) || seenGrants.has(record.grantId)) throw new Error("seed fixture ids must be unique");
    if (record.microchipId !== `SIM-DENVER-${record.participantId.slice(-2)}`) {
      throw new Error(`invalid simulation microchip for ${record.participantId}`);
    }
    if (typeof record.name !== "string" || record.name.trim() !== record.name || record.name.length < 1 || record.name.length > 80) {
      throw new Error(`invalid pet name for ${record.participantId}`);
    }
    if (record.species !== "dog" && record.species !== "cat") throw new Error(`invalid species for ${record.participantId}`);
    if (!sameScopes(record.scopes, expectedScopes(record.scenario))) throw new Error(`invalid consent scopes for ${record.participantId}`);
    const expiresAt = isoTimestamp(record.expiresAt, "consent expiry");
    if (expiresAt !== record.expiresAt) throw new Error(`consent expiry must be normalized for ${record.participantId}`);
    validateConsentWindow(now, expiresAt);

    seenParticipants.add(record.participantId);
    seenGuardians.add(record.guardianId);
    seenPets.add(record.petId);
    seenGrants.add(record.grantId);
  }
}

export async function seedDenverSimulation(pool, records, now = new Date().toISOString()) {
  const seededAt = isoTimestamp(now, "seed time");
  validateSeedRecords(records, seededAt);
  if (!pool || typeof pool.connect !== "function") throw new Error("a PostgreSQL pool is required");

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["virtuapet:denver-mock:seed"]);
    const organization = await client.query(
      "SELECT name, kind FROM organizations WHERE organization_id=$1",
      [DENVER_ORGANIZATION_ID]
    );
    if (organization.rowCount !== 1 || organization.rows[0].name !== DENVER_ORGANIZATION_NAME || organization.rows[0].kind !== "clinic") {
      throw new Error("Denver simulation organization does not match the required fixture");
    }

    for (const record of records) {
      const membership = await client.query(
        "SELECT role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='active' AND revoked_at IS NULL",
        [DENVER_ORGANIZATION_ID, record.guardianId]
      );
      if (membership.rowCount !== 1 || !ALLOWED_GUARDIAN_ROLES.has(membership.rows[0].role)) {
        throw new Error(`active guardian membership required for ${record.participantId}`);
      }

      await client.query(
        `INSERT INTO pet_profiles
          (pet_id, guardian_id, name, species, microchip_id, record_version, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,1,$6,$6)
         ON CONFLICT (pet_id) DO NOTHING`,
        [record.petId, record.guardianId, record.name, record.species, record.microchipId, seededAt]
      );
      const pet = await client.query(
        "SELECT guardian_id, name, species, microchip_id, record_version FROM pet_profiles WHERE pet_id=$1",
        [record.petId]
      );
      const stored = pet.rows[0];
      if (!stored || stored.guardian_id !== record.guardianId || stored.name !== record.name || stored.species !== record.species || stored.microchip_id !== record.microchipId || Number(stored.record_version) !== 1) {
        throw new Error(`existing pet fixture mismatch for ${record.participantId}`);
      }

      await client.query(
        `INSERT INTO consent_grants
          (grant_id, pet_id, grantor_user_id, grantee_id, scopes, purpose, starts_at, expires_at, revoked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)
         ON CONFLICT (grant_id) DO NOTHING`,
        [record.grantId, record.petId, record.guardianId, DENVER_ORGANIZATION_ID, JSON.stringify(record.scopes), CONSENT_PURPOSE, seededAt, record.expiresAt]
      );
      const grant = await client.query(
        "SELECT pet_id, grantor_user_id, grantee_id, scopes, purpose, starts_at, expires_at, revoked_at FROM consent_grants WHERE grant_id=$1",
        [record.grantId]
      );
      const saved = grant.rows[0];
      const savedStartsAt = saved ? isoTimestamp(saved.starts_at, "stored consent start") : undefined;
      const savedExpiresAt = saved ? isoTimestamp(saved.expires_at, "stored consent expiry") : undefined;
      const savedDuration = saved ? Date.parse(savedExpiresAt) - Date.parse(savedStartsAt) : Number.NaN;
      if (!saved || saved.pet_id !== record.petId || saved.grantor_user_id !== record.guardianId || saved.grantee_id !== DENVER_ORGANIZATION_ID || !sameScopes(saved.scopes, record.scopes) || saved.purpose !== CONSENT_PURPOSE || savedStartsAt > seededAt || savedExpiresAt !== record.expiresAt || savedExpiresAt <= seededAt || !Number.isFinite(savedDuration) || savedDuration <= 0 || savedDuration > MAX_CONSENT_DURATION_MS || saved.revoked_at !== null) {
        throw new Error(`existing consent fixture mismatch for ${record.participantId}`);
      }
    }
    await client.query("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "Denver simulation seed and rollback both failed");
      }
    }
    throw error;
  } finally {
    client.release();
  }

  return {
    simulationId: "denver-mock",
    organizationId: DENVER_ORGANIZATION_ID,
    seededAt,
    pets: records.map(({ participantId, petId, grantId, name, species }) => ({ participantId, petId, grantId, name, species })),
    clinicalUse: false
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const identityJson = process.env.DENVER_IDENTITY_MAP_JSON;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!identityJson) throw new Error("DENVER_IDENTITY_MAP_JSON is required");
  if (process.env.DENVER_SIMULATION_CONFIRM !== "fictional-only") throw new Error("DENVER_SIMULATION_CONFIRM=fictional-only is required");
  const root = new URL("./", import.meta.url);
  const cases = JSON.parse(await readFile(new URL("cases.json", root), "utf8"));
  const seededAt = new Date().toISOString();
  const records = buildSeedRecords(cases, JSON.parse(identityJson), {
    now: seededAt,
    ...(process.env.DENVER_CONSENT_EXPIRES_AT ? { expiresAt: process.env.DENVER_CONSENT_EXPIRES_AT } : {})
  });
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: true }, max: 1 });
  try {
    const result = await seedDenverSimulation(pool, records, seededAt);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`Denver simulation seed failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
