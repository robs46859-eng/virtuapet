import type { ConsentGrant, FelineGrimaceAssessment, PetProfile, RegulationEvidence } from "@virtuapet/contracts";

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
  clear(): Promise<void>;
}

export class MemoryPetRepository implements PetRepository {
  private readonly pets = new Map<string, PetProfile>();
  private readonly grants = new Map<string, ConsentGrant>();
  private readonly grimaceAssessments = new Map<string, FelineGrimaceAssessment>();
  private readonly regulationEvidence = new Map<string, RegulationEvidence>();

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

  async clear(): Promise<void> {
    this.pets.clear();
    this.grants.clear();
    this.grimaceAssessments.clear();
    this.regulationEvidence.clear();
  }
}
