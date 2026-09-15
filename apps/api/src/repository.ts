import type {
  Appointment, ClinicMessage, ConsentGrant, FelineGrimaceAssessment, InventoryItem,
  Membership, Organization, PetProfile, Recall, RegulationEvidence,
  ImagingStudy, ImagingSeries, ImagingVolume, ImagingSegmentation, ImagingMesh,
  ClinicalModel, SurgicalPlan, RehearsalSession, ClinicalQualityResult,
  ClinicalCorrection, ImagingAuditEvent, SpatialAssetManifest
} from "@virtuapet/contracts";

export interface PetRepository {
  checkHealth(): Promise<void>;
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

  // Phase 3 Clinical Imaging
  createImagingStudy(study: ImagingStudy): Promise<ImagingStudy>;
  findImagingStudyById(studyId: string): Promise<ImagingStudy | undefined>;
  findImagingStudyByUid(studyInstanceUid: string): Promise<ImagingStudy | undefined>;
  listImagingStudiesByPet(petId: string): Promise<ImagingStudy[]>;
  createImagingSeries(series: ImagingSeries): Promise<ImagingSeries>;
  findImagingSeriesById(seriesId: string): Promise<ImagingSeries | undefined>;
  listImagingSeriesByStudy(studyId: string): Promise<ImagingSeries[]>;
  updateImagingSeriesStatus(seriesId: string, status: ImagingSeries["status"], quarantineReason?: string | null): Promise<ImagingSeries | undefined>;
  createImagingVolume(volume: ImagingVolume): Promise<ImagingVolume>;
  findImagingVolumeById(volumeId: string): Promise<ImagingVolume | undefined>;
  findImagingVolumeBySeriesId(seriesId: string): Promise<ImagingVolume | undefined>;
  createImagingSegmentation(segmentation: ImagingSegmentation): Promise<ImagingSegmentation>;
  findImagingSegmentationById(segmentationId: string): Promise<ImagingSegmentation | undefined>;
  listImagingSegmentationsByVolumeId(volumeId: string): Promise<ImagingSegmentation[]>;
  createImagingMesh(mesh: ImagingMesh): Promise<ImagingMesh>;
  listImagingMeshesBySegmentationId(segmentationId: string): Promise<ImagingMesh[]>;
  createClinicalModel(model: ClinicalModel): Promise<ClinicalModel>;
  findClinicalModelById(modelId: string): Promise<ClinicalModel | undefined>;
  findClinicalModelBySeriesId(seriesId: string): Promise<ClinicalModel | undefined>;
  updateClinicalModel(modelId: string, updates: Partial<ClinicalModel>): Promise<ClinicalModel | undefined>;
  createSurgicalPlan(plan: SurgicalPlan): Promise<SurgicalPlan>;
  findSurgicalPlanById(planId: string): Promise<SurgicalPlan | undefined>;
  listSurgicalPlansByModelId(modelId: string): Promise<SurgicalPlan[]>;
  createRehearsalSession(session: RehearsalSession): Promise<RehearsalSession>;
  findRehearsalSessionById(sessionId: string): Promise<RehearsalSession | undefined>;
  updateRehearsalSession(sessionId: string, updates: Partial<RehearsalSession>): Promise<RehearsalSession | undefined>;
  listRehearsalSessionsByPlanId(planId: string): Promise<RehearsalSession[]>;
  createClinicalQualityResult(result: ClinicalQualityResult): Promise<ClinicalQualityResult>;
  listClinicalQualityResultsByTarget(targetId: string): Promise<ClinicalQualityResult[]>;
  createClinicalCorrection(correction: ClinicalCorrection): Promise<ClinicalCorrection>;
  listClinicalCorrectionsByTarget(targetId: string): Promise<ClinicalCorrection[]>;
  createImagingAuditEvent(event: ImagingAuditEvent): Promise<ImagingAuditEvent>;
  listImagingAuditEvents(entityId: string): Promise<ImagingAuditEvent[]>;

  // Phase 4 Spatial Assets
  createSpatialManifest(manifest: SpatialAssetManifest): Promise<SpatialAssetManifest>;
  findSpatialManifestById(assetId: string): Promise<SpatialAssetManifest | undefined>;
  revokeSpatialManifest(assetId: string, revokedAt: string): Promise<SpatialAssetManifest | undefined>;
  listSpatialManifestsByOwner(ownerId: string): Promise<SpatialAssetManifest[]>;
  listSpatialManifestsByTenant(tenantId: string): Promise<SpatialAssetManifest[]>;

  clear(): Promise<void>;
  close(): Promise<void>;
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

  private readonly studies = new Map<string, ImagingStudy>();
  private readonly series = new Map<string, ImagingSeries>();
  private readonly volumes = new Map<string, ImagingVolume>();
  private readonly segmentations = new Map<string, ImagingSegmentation>();
  private readonly meshes = new Map<string, ImagingMesh>();
  private readonly clinicalModels = new Map<string, ClinicalModel>();
  private readonly surgicalPlans = new Map<string, SurgicalPlan>();
  private readonly rehearsalSessions = new Map<string, RehearsalSession>();
  private readonly qualityResults = new Map<string, ClinicalQualityResult>();
  private readonly corrections = new Map<string, ClinicalCorrection>();
  private readonly auditEvents: ImagingAuditEvent[] = [];
  private readonly spatialManifests = new Map<string, SpatialAssetManifest>();

  constructor(private readonly environment: string = "development") {}

  async checkHealth(): Promise<void> {
    if (this.environment === "production" || this.environment === "staging") {
      throw new Error("Persistent PostgreSQL database required in production/staging");
    }
  }

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

  async createImagingStudy(study: ImagingStudy) { this.studies.set(study.studyId, structuredClone(study)); return structuredClone(study); }
  async findImagingStudyById(studyId: string) { const s = this.studies.get(studyId); return s ? structuredClone(s) : undefined; }
  async findImagingStudyByUid(studyInstanceUid: string) { const s = [...this.studies.values()].find(item => item.studyInstanceUid === studyInstanceUid); return s ? structuredClone(s) : undefined; }
  async listImagingStudiesByPet(petId: string) { return [...this.studies.values()].filter(item => item.petId === petId).map(item => structuredClone(item)); }

  async createImagingSeries(series: ImagingSeries) { this.series.set(series.seriesId, structuredClone(series)); return structuredClone(series); }
  async findImagingSeriesById(seriesId: string) { const s = this.series.get(seriesId); return s ? structuredClone(s) : undefined; }
  async listImagingSeriesByStudy(studyId: string) { return [...this.series.values()].filter(item => item.studyId === studyId).map(item => structuredClone(item)); }
  async updateImagingSeriesStatus(seriesId: string, status: ImagingSeries["status"], quarantineReason?: string | null) {
    const s = this.series.get(seriesId);
    if (!s) return undefined;
    const updated = { ...s, status, ...(quarantineReason !== undefined ? { quarantineReason } : {}), updatedAt: new Date().toISOString() };
    this.series.set(seriesId, updated);
    return structuredClone(updated);
  }

  async createImagingVolume(volume: ImagingVolume) { this.volumes.set(volume.volumeId, structuredClone(volume)); return structuredClone(volume); }
  async findImagingVolumeById(volumeId: string) { const v = this.volumes.get(volumeId); return v ? structuredClone(v) : undefined; }
  async findImagingVolumeBySeriesId(seriesId: string) { const v = [...this.volumes.values()].find(item => item.seriesId === seriesId); return v ? structuredClone(v) : undefined; }

  async createImagingSegmentation(seg: ImagingSegmentation) { this.segmentations.set(seg.segmentationId, structuredClone(seg)); return structuredClone(seg); }
  async findImagingSegmentationById(segId: string) { const s = this.segmentations.get(segId); return s ? structuredClone(s) : undefined; }
  async listImagingSegmentationsByVolumeId(volumeId: string) { return [...this.segmentations.values()].filter(item => item.volumeId === volumeId).sort((a, b) => b.version - a.version).map(item => structuredClone(item)); }

  async createImagingMesh(mesh: ImagingMesh) { this.meshes.set(mesh.meshId, structuredClone(mesh)); return structuredClone(mesh); }
  async listImagingMeshesBySegmentationId(segId: string) { return [...this.meshes.values()].filter(item => item.segmentationId === segId).map(item => structuredClone(item)); }

  async createClinicalModel(model: ClinicalModel) { this.clinicalModels.set(model.modelId, structuredClone(model)); return structuredClone(model); }
  async findClinicalModelById(modelId: string) { const m = this.clinicalModels.get(modelId); return m ? structuredClone(m) : undefined; }
  async findClinicalModelBySeriesId(seriesId: string) { const m = [...this.clinicalModels.values()].find(item => item.seriesId === seriesId); return m ? structuredClone(m) : undefined; }
  async updateClinicalModel(modelId: string, updates: Partial<ClinicalModel>) {
    const m = this.clinicalModels.get(modelId);
    if (!m) return undefined;
    const updated = { ...m, ...updates, updatedAt: new Date().toISOString() };
    this.clinicalModels.set(modelId, updated);
    return structuredClone(updated);
  }

  async createSurgicalPlan(plan: SurgicalPlan) { this.surgicalPlans.set(plan.planId, structuredClone(plan)); return structuredClone(plan); }
  async findSurgicalPlanById(planId: string) { const p = this.surgicalPlans.get(planId); return p ? structuredClone(p) : undefined; }
  async listSurgicalPlansByModelId(modelId: string) { return [...this.surgicalPlans.values()].filter(item => item.modelId === modelId).map(item => structuredClone(item)); }

  async createRehearsalSession(session: RehearsalSession) { this.rehearsalSessions.set(session.sessionId, structuredClone(session)); return structuredClone(session); }
  async findRehearsalSessionById(sessionId: string) { const s = this.rehearsalSessions.get(sessionId); return s ? structuredClone(s) : undefined; }
  async updateRehearsalSession(sessionId: string, updates: Partial<RehearsalSession>) {
    const s = this.rehearsalSessions.get(sessionId);
    if (!s) return undefined;
    const updated = { ...s, ...updates };
    this.rehearsalSessions.set(sessionId, updated);
    return structuredClone(updated);
  }
  async listRehearsalSessionsByPlanId(planId: string) { return [...this.rehearsalSessions.values()].filter(item => item.planId === planId).map(item => structuredClone(item)); }

  async createClinicalQualityResult(result: ClinicalQualityResult) { this.qualityResults.set(result.resultId, structuredClone(result)); return structuredClone(result); }
  async listClinicalQualityResultsByTarget(targetId: string) { return [...this.qualityResults.values()].filter(item => item.targetId === targetId).map(item => structuredClone(item)); }

  async createClinicalCorrection(correction: ClinicalCorrection) { this.corrections.set(correction.correctionId, structuredClone(correction)); return structuredClone(correction); }
  async listClinicalCorrectionsByTarget(targetId: string) { return [...this.corrections.values()].filter(item => item.targetId === targetId).map(item => structuredClone(item)); }

  async createImagingAuditEvent(event: ImagingAuditEvent) { this.auditEvents.push(structuredClone(event)); return structuredClone(event); }
  async listImagingAuditEvents(entityId: string) { return this.auditEvents.filter(e => e.entityId === entityId).map(e => structuredClone(e)); }

  // Phase 4 Spatial Assets
  async createSpatialManifest(manifest: SpatialAssetManifest): Promise<SpatialAssetManifest> {
    this.spatialManifests.set(manifest.assetId, structuredClone(manifest));
    return structuredClone(manifest);
  }

  async findSpatialManifestById(assetId: string): Promise<SpatialAssetManifest | undefined> {
    const manifest = this.spatialManifests.get(assetId);
    return manifest ? structuredClone(manifest) : undefined;
  }

  async revokeSpatialManifest(assetId: string, revokedAt: string): Promise<SpatialAssetManifest | undefined> {
    const manifest = this.spatialManifests.get(assetId);
    if (!manifest) return undefined;
    const updated: SpatialAssetManifest = {
      ...manifest,
      isRevoked: true,
      revokedAt
    };
    this.spatialManifests.set(assetId, updated);
    return structuredClone(updated);
  }

  async listSpatialManifestsByOwner(ownerId: string): Promise<SpatialAssetManifest[]> {
    return Array.from(this.spatialManifests.values())
      .filter(m => m.ownerId === ownerId)
      .map(m => structuredClone(m));
  }

  async listSpatialManifestsByTenant(tenantId: string): Promise<SpatialAssetManifest[]> {
    return Array.from(this.spatialManifests.values())
      .filter(m => m.tenantId === tenantId)
      .map(m => structuredClone(m));
  }

  async clear(): Promise<void> {
    this.pets.clear();
    this.grants.clear();
    this.grimaceAssessments.clear();
    this.regulationEvidence.clear();
    this.organizations.clear();
    this.memberships.clear();
    this.appointments.clear();
    this.recalls.clear();
    this.inventory.clear();
    this.messages.clear();
    this.studies.clear();
    this.series.clear();
    this.volumes.clear();
    this.segmentations.clear();
    this.meshes.clear();
    this.clinicalModels.clear();
    this.surgicalPlans.clear();
    this.rehearsalSessions.clear();
    this.qualityResults.clear();
    this.corrections.clear();
    this.auditEvents.length = 0;
    this.spatialManifests.clear();
  }
  async close(): Promise<void> {}
}
