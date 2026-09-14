import { randomUUID } from "node:crypto";
import { PostgresPetRepository } from "../apps/api/dist/postgres-repository.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const repository = PostgresPetRepository.fromConnectionString(process.env.DATABASE_URL);
const guardianId = randomUUID();
const petId = randomUUID();
const clinicId = randomUUID();
try {
  const now = new Date().toISOString();
  await repository.create({ petId, guardianId, name: "Migration Test", species: "cat", createdAt: now, updatedAt: now, recordVersion: 1 });
  const read = await repository.findById(petId);
  if (read?.guardianId !== guardianId) throw new Error("Pet repository round trip failed");
  const grantId = randomUUID();
  await repository.createGrant({ grantId, petId, grantorUserId: guardianId, granteeId: clinicId, scopes: ["pet.health.observation.write"], purpose: "Persistent repository verification", startsAt: now, expiresAt: new Date(Date.now() + 3600000).toISOString(), revokedAt: null });
  if ((await repository.listGrants(petId)).length !== 1) throw new Error("Consent repository round trip failed");
  await repository.revokeGrant(grantId, new Date().toISOString());
  if (!(await repository.listGrants(petId))[0]?.revokedAt) throw new Error("Consent revocation failed");
  await repository.createGrimaceAssessment({ assessmentId: randomUUID(), petId, assessorUserId: randomUUID(), clinicId, assessedAt: now, assessorTrainingConfirmed: true, actionUnits: { earPosition: 1, orbitalTightening: 1, muzzleTension: 1, whiskersPosition: 1, headPosition: 0 }, totalScore: 4, veterinaryReviewRequired: true, recordedAt: now });
  if ((await repository.listGrimaceAssessments(petId))[0]?.totalScore !== 4) throw new Error("FGS repository round trip failed");
  console.log("PostgreSQL Phase 2 repository verification passed");
} finally {
  await repository.close();
}
