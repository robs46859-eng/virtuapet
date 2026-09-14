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
  await repository.createOrganization({organizationId:clinicId,name:"Persistent Test Clinic",kind:"clinic",createdAt:now});
  const clinicUserId=randomUUID(); await repository.createMembership({membershipId:randomUUID(),organizationId:clinicId,userId:clinicUserId,role:"veterinarian",status:"active",createdAt:now,revokedAt:null});
  if((await repository.findMembership(clinicId,clinicUserId))?.role!=="veterinarian") throw new Error("Membership repository round trip failed");
  await repository.createAppointment({appointmentId:randomUUID(),clinicId,petId,startsAt:new Date(Date.now()+3600000).toISOString(),durationMinutes:30,reason:"Persistence verification",status:"scheduled",createdByUserId:clinicUserId,createdAt:now});
  if((await repository.listAppointments(clinicId)).length!==1) throw new Error("Appointment repository round trip failed");
  await repository.createRecall({recallId:randomUUID(),clinicId,petId,dueAt:new Date(Date.now()+7200000).toISOString(),reason:"Persistence verification",status:"open",createdByUserId:clinicUserId,createdAt:now});
  await repository.createInventoryItem({inventoryItemId:randomUUID(),clinicId,sku:"VERIFY-1",name:"Verification item",quantityOnHand:1,reorderPoint:1,updatedByUserId:clinicUserId,updatedAt:now});
  await repository.createClinicMessage({messageId:randomUUID(),clinicId,petId,subject:"Verification",body:"Persistent message verification",authorUserId:clinicUserId,createdAt:now});
  console.log("PostgreSQL Phase 2 repository verification passed");
} finally {
  await repository.close();
}
