import type { Appointment, ClinicMessage, ConsentGrant, FelineGrimaceAssessment, InventoryItem, Membership, Organization, PetProfile, Recall, RegulationEvidence } from "@virtuapet/contracts";

export interface PetRepository {
  create(profile: PetProfile): Promise<PetProfile>;
  findById(petId: string): Promise<PetProfile | undefined>;
  createGrant(grant: ConsentGrant): Promise<ConsentGrant>;
  listGrants(petId: string): Promise<ConsentGrant[]>;
  revokeGrant(grantId: string, revokedAt: string): Promise<ConsentGrant | undefined>;
  createGrimaceAssessment(assessment: FelineGrimaceAssessment): Promise<FelineGrimaceAssessment>;
  listGrimaceAssessments(petId: string): Promise<FelineGrimaceAssessment[]>;
  createRegulationEvidence(evidence: RegulationEvidence): Promise<RegulationEvidence>;
  listRegulationEvidence(countryCode: string, regionCode?: string): Promise<RegulationEvidence[]>;
  verifyRegulationEvidence(evidenceId: string, verifiedAt: string): Promise<RegulationEvidence | undefined>;
  createOrganization(organization: Organization): Promise<Organization>;
  createMembership(membership: Membership): Promise<Membership>;
  findMembership(organizationId: string, userId: string): Promise<Membership | undefined>;
  createAppointment(appointment: Appointment): Promise<Appointment>;
  listAppointments(clinicId: string): Promise<Appointment[]>;
  createRecall(recall: Recall): Promise<Recall>;
  createInventoryItem(item: InventoryItem): Promise<InventoryItem>;
  createClinicMessage(message: ClinicMessage): Promise<ClinicMessage>;
  clear(): Promise<void>;
}

export class MemoryPetRepository implements PetRepository {
  private readonly pets = new Map<string, PetProfile>();
  private readonly grants = new Map<string, ConsentGrant>();
  private readonly grimaceAssessments = new Map<string, FelineGrimaceAssessment>();
  private readonly regulationEvidence = new Map<string, RegulationEvidence>();
  private readonly organizations = new Map<string, Organization>();
  private readonly memberships = new Map<string, Membership>();
  private readonly appointments = new Map<string, Appointment>();
  private readonly recalls = new Map<string, Recall>();
  private readonly inventory = new Map<string, InventoryItem>();
  private readonly messages = new Map<string, ClinicMessage>();

  async create(profile: PetProfile): Promise<PetProfile> {
    this.pets.set(profile.petId, structuredClone(profile));
    return structuredClone(profile);
  }

  async findById(petId: string): Promise<PetProfile | undefined> {
    const profile = this.pets.get(petId);
    return profile ? structuredClone(profile) : undefined;
  }

  async createGrant(grant: ConsentGrant): Promise<ConsentGrant> { this.grants.set(grant.grantId, structuredClone(grant)); return structuredClone(grant); }
  async listGrants(petId: string): Promise<ConsentGrant[]> { return [...this.grants.values()].filter(grant => grant.petId === petId).map(grant => structuredClone(grant)); }
  async revokeGrant(grantId: string, revokedAt: string) {
    const grant = this.grants.get(grantId);
    if (!grant) return undefined;
    const revoked = { ...grant, revokedAt };
    this.grants.set(grantId, revoked);
    return structuredClone(revoked);
  }
  async createGrimaceAssessment(assessment: FelineGrimaceAssessment): Promise<FelineGrimaceAssessment> { this.grimaceAssessments.set(assessment.assessmentId, structuredClone(assessment)); return structuredClone(assessment); }
  async listGrimaceAssessments(petId: string): Promise<FelineGrimaceAssessment[]> { return [...this.grimaceAssessments.values()].filter(item => item.petId === petId).map(item => structuredClone(item)); }
  async createRegulationEvidence(evidence: RegulationEvidence): Promise<RegulationEvidence> { this.regulationEvidence.set(evidence.evidenceId, structuredClone(evidence)); return structuredClone(evidence); }
  async listRegulationEvidence(countryCode: string, regionCode?: string): Promise<RegulationEvidence[]> {
    return [...this.regulationEvidence.values()].filter(item => item.countryCode === countryCode && (!regionCode || item.regionCode === regionCode)).map(item => structuredClone(item));
  }
  async verifyRegulationEvidence(evidenceId: string, verifiedAt: string) { const item = this.regulationEvidence.get(evidenceId); if (!item) return undefined; const verified = { ...item, humanVerifiedAt: verifiedAt }; this.regulationEvidence.set(evidenceId, verified); return structuredClone(verified); }
  async createOrganization(item: Organization) { this.organizations.set(item.organizationId, structuredClone(item)); return structuredClone(item); }
  async createMembership(item: Membership) { this.memberships.set(item.membershipId, structuredClone(item)); return structuredClone(item); }
  async findMembership(organizationId: string, userId: string) { const item = [...this.memberships.values()].find(value => value.organizationId === organizationId && value.userId === userId && value.status === "active"); return item ? structuredClone(item) : undefined; }
  async createAppointment(item: Appointment) { this.appointments.set(item.appointmentId, structuredClone(item)); return structuredClone(item); }
  async listAppointments(clinicId: string) { return [...this.appointments.values()].filter(item => item.clinicId === clinicId).map(item => structuredClone(item)); }
  async createRecall(item: Recall) { this.recalls.set(item.recallId, structuredClone(item)); return structuredClone(item); }
  async createInventoryItem(item: InventoryItem) { this.inventory.set(item.inventoryItemId, structuredClone(item)); return structuredClone(item); }
  async createClinicMessage(item: ClinicMessage) { this.messages.set(item.messageId, structuredClone(item)); return structuredClone(item); }

  async clear(): Promise<void> {
    this.pets.clear();
    this.grants.clear();
    this.grimaceAssessments.clear();
    this.regulationEvidence.clear();
    this.organizations.clear(); this.memberships.clear(); this.appointments.clear(); this.recalls.clear(); this.inventory.clear(); this.messages.clear();
  }
}
