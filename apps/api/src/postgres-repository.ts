import { Pool } from "pg";
import {
  felineGrimaceAssessmentSchema, regulationEvidenceSchema,
  imagingStudySchema, imagingSeriesSchema, imagingVolumeSchema,
  imagingSegmentationSchema, imagingMeshSchema, clinicalModelSchema,
  surgicalPlanSchema, rehearsalSessionSchema, clinicalQualityResultSchema,
  clinicalCorrectionSchema, imagingAuditEventSchema,
  type Appointment, type ClinicMessage, type ConsentGrant, type FelineGrimaceAssessment,
  type InventoryItem, type Membership, type Organization, type PetProfile, type Recall,
  type RegulationEvidence, type ImagingStudy, type ImagingSeries, type ImagingVolume,
  type ImagingSegmentation, type ImagingMesh, type ClinicalModel, type SurgicalPlan,
  type RehearsalSession, type ClinicalQualityResult, type ClinicalCorrection, type ImagingAuditEvent
} from "@virtuapet/contracts";
import type { PetRepository } from "./repository.js";

const petFromRow = (row: Record<string, unknown>): PetProfile => ({
  petId: String(row.pet_id), guardianId: String(row.guardian_id), name: String(row.name), species: row.species as PetProfile["species"],
  ...(row.birth_date ? { birthDate: dateOnlyFromRow(row.birth_date) } : {}), ...(row.microchip_id ? { microchipId: String(row.microchip_id) } : {}),
  recordVersion: Number(row.record_version), createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString()
});
const dateOnlyFromRow = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
};
const grantFromRow = (row: Record<string, unknown>): ConsentGrant => ({ grantId: String(row.grant_id), petId: String(row.pet_id), grantorUserId: String(row.grantor_user_id), granteeId: String(row.grantee_id), scopes: row.scopes as ConsentGrant["scopes"], purpose: String(row.purpose), startsAt: new Date(String(row.starts_at)).toISOString(), expiresAt: new Date(String(row.expires_at)).toISOString(), revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null });

export class PostgresPetRepository implements PetRepository {
  constructor(private readonly pool: Pool) {}
  async checkHealth() { await this.pool.query("SELECT 1"); }
  static fromConnectionString(connectionString: string) { const config = process.env.VIRTUAPET_ENV === "production" ? { connectionString, max: 10, ssl: { rejectUnauthorized: true } } : { connectionString, max: 10 }; return new PostgresPetRepository(new Pool(config)); }
  async create(pet: PetProfile) { const result = await this.pool.query("INSERT INTO pet_profiles (pet_id,guardian_id,name,species,birth_date,microchip_id,record_version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *", [pet.petId, pet.guardianId, pet.name, pet.species, pet.birthDate ?? null, pet.microchipId ?? null, pet.recordVersion, pet.createdAt, pet.updatedAt]); return petFromRow(result.rows[0]); }
  async findById(petId: string) { const result = await this.pool.query("SELECT * FROM pet_profiles WHERE pet_id=$1", [petId]); return result.rows[0] ? petFromRow(result.rows[0]) : undefined; }
  async createGrant(grant: ConsentGrant) { const result = await this.pool.query("INSERT INTO consent_grants (grant_id,pet_id,grantor_user_id,grantee_id,scopes,purpose,starts_at,expires_at,revoked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *", [grant.grantId, grant.petId, grant.grantorUserId, grant.granteeId, JSON.stringify(grant.scopes), grant.purpose, grant.startsAt, grant.expiresAt, grant.revokedAt]); return grantFromRow(result.rows[0]); }
  async listGrants(petId: string) { const result = await this.pool.query("SELECT * FROM consent_grants WHERE pet_id=$1 ORDER BY starts_at DESC", [petId]); return result.rows.map(grantFromRow); }
  async revokeGrant(grantId: string, revokedAt: string) { const result = await this.pool.query("UPDATE consent_grants SET revoked_at=$2 WHERE grant_id=$1 AND revoked_at IS NULL RETURNING *", [grantId, revokedAt]); return result.rows[0] ? grantFromRow(result.rows[0]) : undefined; }
  async createGrimaceAssessment(item: FelineGrimaceAssessment) { await this.pool.query("INSERT INTO feline_grimace_assessments (assessment_id,pet_id,assessor_user_id,clinic_id,assessed_at,assessor_training_confirmed,context,action_units,total_score,veterinary_review_required,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [item.assessmentId,item.petId,item.assessorUserId,item.clinicId,item.assessedAt,item.assessorTrainingConfirmed,item.context ?? null,JSON.stringify(item.actionUnits),item.totalScore,item.veterinaryReviewRequired,item.recordedAt]); return item; }
  async listGrimaceAssessments(petId: string): Promise<FelineGrimaceAssessment[]> { const result = await this.pool.query("SELECT * FROM feline_grimace_assessments WHERE pet_id=$1 ORDER BY assessed_at DESC", [petId]); return result.rows.map(row => felineGrimaceAssessmentSchema.parse({ assessmentId:String(row.assessment_id),petId:String(row.pet_id),assessorUserId:String(row.assessor_user_id),clinicId:String(row.clinic_id),assessedAt:new Date(row.assessed_at).toISOString(),assessorTrainingConfirmed:row.assessor_training_confirmed,...(row.context ? {context:String(row.context)} : {}),actionUnits:row.action_units,totalScore:Number(row.total_score),veterinaryReviewRequired:Boolean(row.veterinary_review_required),recordedAt:new Date(row.recorded_at).toISOString() })); }
  async createRegulationEvidence(item: RegulationEvidence) { await this.pool.query("INSERT INTO regulation_evidence (evidence_id,country_code,region_code,authority,source_url,title,retrieved_at,effective_date,evidence_excerpt,status,reviewer_user_id,human_verified_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)", [item.evidenceId,item.countryCode,item.regionCode ?? null,item.authority,item.sourceUrl,item.title,item.retrievedAt,item.effectiveDate ?? null,item.evidenceExcerpt,item.status,item.reviewerUserId,item.humanVerifiedAt,item.createdAt]); return item; }
  async listRegulationEvidence(countryCode: string, regionCode?: string): Promise<RegulationEvidence[]> { const result = await this.pool.query("SELECT * FROM regulation_evidence WHERE country_code=$1 AND ($2::text IS NULL OR region_code=$2) ORDER BY retrieved_at DESC", [countryCode, regionCode ?? null]); return result.rows.map(row => regulationEvidenceSchema.parse({ evidenceId:String(row.evidence_id),countryCode:String(row.country_code).trim(),...(row.region_code ? {regionCode:String(row.region_code)} : {}),authority:String(row.authority),sourceUrl:String(row.source_url),title:String(row.title),retrievedAt:new Date(row.retrieved_at).toISOString(),...(row.effective_date ? {effectiveDate:String(row.effective_date).slice(0,10)} : {}),evidenceExcerpt:String(row.evidence_excerpt),status:row.status,reviewerUserId:String(row.reviewer_user_id),humanVerifiedAt:row.human_verified_at ? new Date(row.human_verified_at).toISOString() : null,createdAt:new Date(row.created_at).toISOString() })); }
  async verifyRegulationEvidence(evidenceId: string, verifiedAt: string) { const result = await this.pool.query("UPDATE regulation_evidence SET human_verified_at=$2 WHERE evidence_id=$1 RETURNING *",[evidenceId,verifiedAt]); const row=result.rows[0]; return row ? regulationEvidenceSchema.parse({evidenceId:String(row.evidence_id),countryCode:String(row.country_code).trim(),...(row.region_code?{regionCode:String(row.region_code)}:{}),authority:String(row.authority),sourceUrl:String(row.source_url),title:String(row.title),retrievedAt:new Date(row.retrieved_at).toISOString(),...(row.effective_date?{effectiveDate:String(row.effective_date).slice(0,10)}:{}),evidenceExcerpt:String(row.evidence_excerpt),status:row.status,reviewerUserId:String(row.reviewer_user_id),humanVerifiedAt:new Date(row.human_verified_at).toISOString(),createdAt:new Date(row.created_at).toISOString()}):undefined; }
  async createOrganization(item: Organization) { await this.pool.query("INSERT INTO organizations(organization_id,name,kind,created_at) VALUES($1,$2,$3,$4)",[item.organizationId,item.name,item.kind,item.createdAt]); return item; }
  async createMembership(item: Membership) { await this.pool.query("INSERT INTO organization_memberships(membership_id,organization_id,user_id,role,status,created_at,revoked_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[item.membershipId,item.organizationId,item.userId,item.role,item.status,item.createdAt,item.revokedAt]); return item; }
  async findMembership(organizationId: string,userId: string): Promise<Membership|undefined> { const result=await this.pool.query("SELECT * FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='active'",[organizationId,userId]); const row=result.rows[0]; return row?{membershipId:String(row.membership_id),organizationId:String(row.organization_id),userId:String(row.user_id),role:row.role,status:row.status,createdAt:new Date(row.created_at).toISOString(),revokedAt:row.revoked_at?new Date(row.revoked_at).toISOString():null}:undefined; }
  async createAppointment(item: Appointment) { await this.pool.query("INSERT INTO appointments(appointment_id,clinic_id,pet_id,starts_at,duration_minutes,reason,assigned_user_id,status,created_by_user_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[item.appointmentId,item.clinicId,item.petId,item.startsAt,item.durationMinutes,item.reason,item.assignedUserId??null,item.status,item.createdByUserId,item.createdAt]); return item; }
  async listAppointments(clinicId: string): Promise<Appointment[]> { const result=await this.pool.query("SELECT * FROM appointments WHERE clinic_id=$1 ORDER BY starts_at",[clinicId]); return result.rows.map(row=>({appointmentId:String(row.appointment_id),clinicId:String(row.clinic_id),petId:String(row.pet_id),startsAt:new Date(row.starts_at).toISOString(),durationMinutes:Number(row.duration_minutes),reason:String(row.reason),...(row.assigned_user_id?{assignedUserId:String(row.assigned_user_id)}:{}),status:row.status,createdByUserId:String(row.created_by_user_id),createdAt:new Date(row.created_at).toISOString()})); }
  async createRecall(item: Recall) { await this.pool.query("INSERT INTO recalls(recall_id,clinic_id,pet_id,due_at,reason,status,created_by_user_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[item.recallId,item.clinicId,item.petId,item.dueAt,item.reason,item.status,item.createdByUserId,item.createdAt]); return item; }
  async createInventoryItem(item: InventoryItem) { await this.pool.query("INSERT INTO inventory_items(inventory_item_id,clinic_id,sku,name,quantity_on_hand,reorder_point,updated_by_user_id,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[item.inventoryItemId,item.clinicId,item.sku,item.name,item.quantityOnHand,item.reorderPoint,item.updatedByUserId,item.updatedAt]); return item; }
  async createClinicMessage(item: ClinicMessage) { await this.pool.query("INSERT INTO clinic_messages(message_id,clinic_id,pet_id,subject,body,author_user_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[item.messageId,item.clinicId,item.petId,item.subject,item.body,item.authorUserId,item.createdAt]); return item; }

  // Phase 3 Clinical Imaging
  async createImagingStudy(study: ImagingStudy): Promise<ImagingStudy> {
    await this.pool.query(
      "INSERT INTO imaging_studies (study_id, pet_id, clinic_id, study_instance_uid, accession_number, study_description, study_date, patient_name_anonymized, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [study.studyId, study.petId, study.clinicId, study.studyInstanceUid, study.accessionNumber ?? null, study.studyDescription ?? null, study.studyDate ?? null, study.patientNameAnonymized, study.status, study.createdAt]
    );
    return study;
  }
  async findImagingStudyById(studyId: string): Promise<ImagingStudy | undefined> {
    const res = await this.pool.query("SELECT * FROM imaging_studies WHERE study_id=$1", [studyId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return imagingStudySchema.parse({
      studyId: String(row.study_id), petId: String(row.pet_id), clinicId: String(row.clinic_id),
      studyInstanceUid: String(row.study_instance_uid), ...(row.accession_number ? { accessionNumber: String(row.accession_number) } : {}),
      ...(row.study_description ? { studyDescription: String(row.study_description) } : {}),
      ...(row.study_date ? { studyDate: dateOnlyFromRow(row.study_date) } : {}),
      patientNameAnonymized: String(row.patient_name_anonymized), status: row.status, createdAt: new Date(row.created_at).toISOString()
    });
  }
  async findImagingStudyByUid(studyInstanceUid: string): Promise<ImagingStudy | undefined> {
    const res = await this.pool.query("SELECT * FROM imaging_studies WHERE study_instance_uid=$1", [studyInstanceUid]);
    const row = res.rows[0];
    if (!row) return undefined;
    return imagingStudySchema.parse({
      studyId: String(row.study_id), petId: String(row.pet_id), clinicId: String(row.clinic_id),
      studyInstanceUid: String(row.study_instance_uid), ...(row.accession_number ? { accessionNumber: String(row.accession_number) } : {}),
      ...(row.study_description ? { studyDescription: String(row.study_description) } : {}),
      ...(row.study_date ? { studyDate: dateOnlyFromRow(row.study_date) } : {}),
      patientNameAnonymized: String(row.patient_name_anonymized), status: row.status, createdAt: new Date(row.created_at).toISOString()
    });
  }
  async listImagingStudiesByPet(petId: string): Promise<ImagingStudy[]> {
    const res = await this.pool.query("SELECT * FROM imaging_studies WHERE pet_id=$1 ORDER BY created_at DESC", [petId]);
    return res.rows.map(row => imagingStudySchema.parse({
      studyId: String(row.study_id), petId: String(row.pet_id), clinicId: String(row.clinic_id),
      studyInstanceUid: String(row.study_instance_uid), ...(row.accession_number ? { accessionNumber: String(row.accession_number) } : {}),
      ...(row.study_description ? { studyDescription: String(row.study_description) } : {}),
      ...(row.study_date ? { studyDate: dateOnlyFromRow(row.study_date) } : {}),
      patientNameAnonymized: String(row.patient_name_anonymized), status: row.status, createdAt: new Date(row.created_at).toISOString()
    }));
  }
  async createImagingSeries(series: ImagingSeries): Promise<ImagingSeries> {
    await this.pool.query(
      "INSERT INTO imaging_series (series_id, study_id, series_instance_uid, modality, laterality, body_part_examined, slice_thickness, pixel_spacing, image_orientation_patient, rows, columns, slice_count, status, quarantine_reason, source_hash, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
      [series.seriesId, series.studyId, series.seriesInstanceUid, series.modality, series.laterality, series.bodyPartExamined, series.sliceThickness, JSON.stringify(series.pixelSpacing), JSON.stringify(series.imageOrientationPatient), series.rows, series.columns, series.sliceCount, series.status, series.quarantineReason, series.sourceHash, series.createdAt, series.updatedAt]
    );
    return series;
  }
  async findImagingSeriesById(seriesId: string): Promise<ImagingSeries | undefined> {
    const res = await this.pool.query("SELECT * FROM imaging_series WHERE series_id=$1", [seriesId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return imagingSeriesSchema.parse({
      seriesId: String(row.series_id), studyId: String(row.study_id), seriesInstanceUid: String(row.series_instance_uid),
      modality: row.modality, laterality: row.laterality, bodyPartExamined: String(row.body_part_examined),
      sliceThickness: Number(row.slice_thickness), pixelSpacing: row.pixel_spacing, imageOrientationPatient: row.image_orientation_patient,
      rows: Number(row.rows), columns: Number(row.columns), sliceCount: Number(row.slice_count), status: row.status,
      quarantineReason: row.quarantine_reason ? String(row.quarantine_reason) : null, sourceHash: String(row.source_hash),
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString()
    });
  }
  async listImagingSeriesByStudy(studyId: string): Promise<ImagingSeries[]> {
    const res = await this.pool.query("SELECT * FROM imaging_series WHERE study_id=$1 ORDER BY created_at", [studyId]);
    return res.rows.map(row => imagingSeriesSchema.parse({
      seriesId: String(row.series_id), studyId: String(row.study_id), seriesInstanceUid: String(row.series_instance_uid),
      modality: row.modality, laterality: row.laterality, bodyPartExamined: String(row.body_part_examined),
      sliceThickness: Number(row.slice_thickness), pixelSpacing: row.pixel_spacing, imageOrientationPatient: row.image_orientation_patient,
      rows: Number(row.rows), columns: Number(row.columns), sliceCount: Number(row.slice_count), status: row.status,
      quarantineReason: row.quarantine_reason ? String(row.quarantine_reason) : null, sourceHash: String(row.source_hash),
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString()
    }));
  }
  async updateImagingSeriesStatus(seriesId: string, status: ImagingSeries["status"], quarantineReason?: string | null): Promise<ImagingSeries | undefined> {
    const now = new Date().toISOString();
    const res = await this.pool.query(
      "UPDATE imaging_series SET status=$2, quarantine_reason=$3, updated_at=$4 WHERE series_id=$1 RETURNING *",
      [seriesId, status, quarantineReason ?? null, now]
    );
    const row = res.rows[0];
    if (!row) return undefined;
    return this.findImagingSeriesById(seriesId);
  }
  async createImagingVolume(volume: ImagingVolume): Promise<ImagingVolume> {
    await this.pool.query(
      "INSERT INTO imaging_volumes (volume_id, series_id, dimensions, spacing, origin, coordinate_frame, units, volume_hash, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [volume.volumeId, volume.seriesId, JSON.stringify(volume.dimensions), JSON.stringify(volume.spacing), JSON.stringify(volume.origin), volume.coordinateFrame, volume.units, volume.volumeHash, volume.createdAt]
    );
    return volume;
  }
  async findImagingVolumeById(volumeId: string): Promise<ImagingVolume | undefined> {
    const res = await this.pool.query("SELECT * FROM imaging_volumes WHERE volume_id=$1", [volumeId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return imagingVolumeSchema.parse({
      volumeId: String(row.volume_id), seriesId: String(row.series_id), dimensions: row.dimensions, spacing: row.spacing,
      origin: row.origin, coordinateFrame: row.coordinate_frame, units: row.units, volumeHash: String(row.volume_hash),
      createdAt: new Date(row.created_at).toISOString()
    });
  }
  async findImagingVolumeBySeriesId(seriesId: string): Promise<ImagingVolume | undefined> {
    const res = await this.pool.query("SELECT * FROM imaging_volumes WHERE series_id=$1", [seriesId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return imagingVolumeSchema.parse({
      volumeId: String(row.volume_id), seriesId: String(row.series_id), dimensions: row.dimensions, spacing: row.spacing,
      origin: row.origin, coordinateFrame: row.coordinate_frame, units: row.units, volumeHash: String(row.volume_hash),
      createdAt: new Date(row.created_at).toISOString()
    });
  }
  async createImagingSegmentation(segmentation: ImagingSegmentation): Promise<ImagingSegmentation> {
    await this.pool.query(
      "INSERT INTO imaging_segmentations (segmentation_id, volume_id, parent_segmentation_id, version, status, structures, algorithm_version, operator_id, uncertainty_score, segmentation_hash, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [segmentation.segmentationId, segmentation.volumeId, segmentation.parentSegmentationId ?? null, segmentation.version, segmentation.status, JSON.stringify(segmentation.structures), segmentation.algorithmVersion, segmentation.operatorId, segmentation.uncertaintyScore, segmentation.segmentationHash, segmentation.createdAt]
    );
    return segmentation;
  }
  async findImagingSegmentationById(segmentationId: string): Promise<ImagingSegmentation | undefined> {
    const res = await this.pool.query("SELECT * FROM imaging_segmentations WHERE segmentation_id=$1", [segmentationId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return imagingSegmentationSchema.parse({
      segmentationId: String(row.segmentation_id), volumeId: String(row.volume_id), parentSegmentationId: row.parent_segmentation_id ? String(row.parent_segmentation_id) : null,
      version: Number(row.version), status: row.status, structures: row.structures, algorithmVersion: String(row.algorithm_version),
      operatorId: String(row.operator_id), uncertaintyScore: Number(row.uncertainty_score), segmentationHash: String(row.segmentation_hash),
      createdAt: new Date(row.created_at).toISOString()
    });
  }
  async listImagingSegmentationsByVolumeId(volumeId: string): Promise<ImagingSegmentation[]> {
    const res = await this.pool.query("SELECT * FROM imaging_segmentations WHERE volume_id=$1 ORDER BY version DESC", [volumeId]);
    return res.rows.map(row => imagingSegmentationSchema.parse({
      segmentationId: String(row.segmentation_id), volumeId: String(row.volume_id), parentSegmentationId: row.parent_segmentation_id ? String(row.parent_segmentation_id) : null,
      version: Number(row.version), status: row.status, structures: row.structures, algorithmVersion: String(row.algorithm_version),
      operatorId: String(row.operator_id), uncertaintyScore: Number(row.uncertainty_score), segmentationHash: String(row.segmentation_hash),
      createdAt: new Date(row.created_at).toISOString()
    }));
  }
  async createImagingMesh(mesh: ImagingMesh): Promise<ImagingMesh> {
    await this.pool.query(
      "INSERT INTO imaging_meshes (mesh_id, segmentation_id, structure_name, vertex_count, triangle_count, is_watertight, topology_repaired, surface_hash, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [mesh.meshId, mesh.segmentationId, mesh.structureName, mesh.vertexCount, mesh.triangleCount, mesh.isWatertight, mesh.topologyRepaired, mesh.surfaceHash, mesh.createdAt]
    );
    return mesh;
  }
  async listImagingMeshesBySegmentationId(segmentationId: string): Promise<ImagingMesh[]> {
    const res = await this.pool.query("SELECT * FROM imaging_meshes WHERE segmentation_id=$1", [segmentationId]);
    return res.rows.map(row => imagingMeshSchema.parse({
      meshId: String(row.mesh_id), segmentationId: String(row.segmentation_id), structureName: String(row.structure_name),
      vertexCount: Number(row.vertex_count), triangleCount: Number(row.triangle_count), isWatertight: Boolean(row.is_watertight),
      topologyRepaired: Boolean(row.topology_repaired), surfaceHash: String(row.surface_hash), createdAt: new Date(row.created_at).toISOString()
    }));
  }
  async createClinicalModel(model: ClinicalModel): Promise<ClinicalModel> {
    await this.pool.query(
      "INSERT INTO clinical_models (model_id, series_id, version, status, structures, laterality, scale_factor, scale_units, coordinate_system, signature, entitlement_scope, rollback_target_id, approved_by_user_id, approved_at, rejection_reason, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
      [model.modelId, model.seriesId, model.version, model.status, JSON.stringify(model.structures), model.laterality, model.scaleFactor, model.scaleUnits, model.coordinateSystem, model.signature, model.entitlementScope, model.rollbackTargetId ?? null, model.approvedByUserId ?? null, model.approvedAt ?? null, model.rejectionReason ?? null, model.createdAt, model.updatedAt]
    );
    return model;
  }
  async findClinicalModelById(modelId: string): Promise<ClinicalModel | undefined> {
    const res = await this.pool.query("SELECT * FROM clinical_models WHERE model_id=$1", [modelId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return clinicalModelSchema.parse({
      modelId: String(row.model_id), seriesId: String(row.series_id), version: Number(row.version), status: row.status,
      structures: row.structures, laterality: row.laterality, scaleFactor: Number(row.scale_factor), scaleUnits: row.scale_units,
      coordinateSystem: row.coordinate_system, signature: String(row.signature), entitlementScope: String(row.entitlement_scope),
      rollbackTargetId: row.rollback_target_id ? String(row.rollback_target_id) : null,
      approvedByUserId: row.approved_by_user_id ? String(row.approved_by_user_id) : null,
      approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
      rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString()
    });
  }
  async findClinicalModelBySeriesId(seriesId: string): Promise<ClinicalModel | undefined> {
    const res = await this.pool.query("SELECT * FROM clinical_models WHERE series_id=$1 ORDER BY version DESC LIMIT 1", [seriesId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return clinicalModelSchema.parse({
      modelId: String(row.model_id), seriesId: String(row.series_id), version: Number(row.version), status: row.status,
      structures: row.structures, laterality: row.laterality, scaleFactor: Number(row.scale_factor), scaleUnits: row.scale_units,
      coordinateSystem: row.coordinate_system, signature: String(row.signature), entitlementScope: String(row.entitlement_scope),
      rollbackTargetId: row.rollback_target_id ? String(row.rollback_target_id) : null,
      approvedByUserId: row.approved_by_user_id ? String(row.approved_by_user_id) : null,
      approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
      rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
      createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString()
    });
  }
  async updateClinicalModel(modelId: string, updates: Partial<ClinicalModel>): Promise<ClinicalModel | undefined> {
    const current = await this.findClinicalModelById(modelId);
    if (!current) return undefined;
    const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
    await this.pool.query(
      "UPDATE clinical_models SET status=$2, structures=$3, scale_factor=$4, signature=$5, rollback_target_id=$6, approved_by_user_id=$7, approved_at=$8, rejection_reason=$9, updated_at=$10 WHERE model_id=$1",
      [modelId, merged.status, JSON.stringify(merged.structures), merged.scaleFactor, merged.signature, merged.rollbackTargetId ?? null, merged.approvedByUserId ?? null, merged.approvedAt ?? null, merged.rejectionReason ?? null, merged.updatedAt]
    );
    return this.findClinicalModelById(modelId);
  }
  async createSurgicalPlan(plan: SurgicalPlan): Promise<SurgicalPlan> {
    await this.pool.query(
      "INSERT INTO surgical_plans (plan_id, model_id, pet_id, clinic_id, surgeon_id, target_tpa_degrees, measured_tpa_degrees, blade_radius_mm, rotation_distance_mm, safe_margin_mm, notes, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [plan.planId, plan.modelId, plan.petId, plan.clinicId, plan.surgeonId, plan.targetTpaDegrees, plan.measuredTpaDegrees, plan.bladeRadiusMm, plan.rotationDistanceMm, plan.safeMarginMm, plan.notes ?? null, plan.status, plan.createdAt]
    );
    return plan;
  }
  async findSurgicalPlanById(planId: string): Promise<SurgicalPlan | undefined> {
    const res = await this.pool.query("SELECT * FROM surgical_plans WHERE plan_id=$1", [planId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return surgicalPlanSchema.parse({
      planId: String(row.plan_id), modelId: String(row.model_id), petId: String(row.pet_id), clinicId: String(row.clinic_id),
      surgeonId: String(row.surgeon_id), targetTpaDegrees: Number(row.target_tpa_degrees), measuredTpaDegrees: Number(row.measured_tpa_degrees),
      bladeRadiusMm: Number(row.blade_radius_mm), rotationDistanceMm: Number(row.rotation_distance_mm), safeMarginMm: Number(row.safe_margin_mm),
      ...(row.notes ? { notes: String(row.notes) } : {}), status: row.status, createdAt: new Date(row.created_at).toISOString()
    });
  }
  async listSurgicalPlansByModelId(modelId: string): Promise<SurgicalPlan[]> {
    const res = await this.pool.query("SELECT * FROM surgical_plans WHERE model_id=$1 ORDER BY created_at DESC", [modelId]);
    return res.rows.map(row => surgicalPlanSchema.parse({
      planId: String(row.plan_id), modelId: String(row.model_id), petId: String(row.pet_id), clinicId: String(row.clinic_id),
      surgeonId: String(row.surgeon_id), targetTpaDegrees: Number(row.target_tpa_degrees), measuredTpaDegrees: Number(row.measured_tpa_degrees),
      bladeRadiusMm: Number(row.blade_radius_mm), rotationDistanceMm: Number(row.rotation_distance_mm), safeMarginMm: Number(row.safe_margin_mm),
      ...(row.notes ? { notes: String(row.notes) } : {}), status: row.status, createdAt: new Date(row.created_at).toISOString()
    }));
  }
  async createRehearsalSession(session: RehearsalSession): Promise<RehearsalSession> {
    await this.pool.query(
      "INSERT INTO rehearsal_sessions (session_id, plan_id, model_id, clinic_id, surgeon_id, device_profile, status, tasks_completed, total_tasks, unassisted_completion, duration_seconds, notes, started_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      [session.sessionId, session.planId, session.modelId, session.clinicId, session.surgeonId, session.deviceProfile, session.status, JSON.stringify(session.tasksCompleted), session.totalTasks, session.unassistedCompletion, session.durationSeconds, session.notes ?? null, session.startedAt, session.completedAt ?? null]
    );
    return session;
  }
  async findRehearsalSessionById(sessionId: string): Promise<RehearsalSession | undefined> {
    const res = await this.pool.query("SELECT * FROM rehearsal_sessions WHERE session_id=$1", [sessionId]);
    const row = res.rows[0];
    if (!row) return undefined;
    return rehearsalSessionSchema.parse({
      sessionId: String(row.session_id), planId: String(row.plan_id), modelId: String(row.model_id), clinicId: String(row.clinic_id),
      surgeonId: String(row.surgeon_id), deviceProfile: row.device_profile, status: row.status, tasksCompleted: row.tasks_completed,
      totalTasks: Number(row.total_tasks), unassistedCompletion: Boolean(row.unassisted_completion), durationSeconds: Number(row.duration_seconds),
      ...(row.notes ? { notes: String(row.notes) } : {}), startedAt: new Date(row.started_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
    });
  }
  async updateRehearsalSession(sessionId: string, updates: Partial<RehearsalSession>): Promise<RehearsalSession | undefined> {
    const current = await this.findRehearsalSessionById(sessionId);
    if (!current) return undefined;
    const merged = { ...current, ...updates };
    await this.pool.query(
      "UPDATE rehearsal_sessions SET status=$2, tasks_completed=$3, unassisted_completion=$4, duration_seconds=$5, notes=$6, completed_at=$7 WHERE session_id=$1",
      [sessionId, merged.status, JSON.stringify(merged.tasksCompleted), merged.unassistedCompletion, merged.durationSeconds, merged.notes ?? null, merged.completedAt ?? null]
    );
    return this.findRehearsalSessionById(sessionId);
  }
  async listRehearsalSessionsByPlanId(planId: string): Promise<RehearsalSession[]> {
    const res = await this.pool.query("SELECT * FROM rehearsal_sessions WHERE plan_id=$1 ORDER BY started_at DESC", [planId]);
    return res.rows.map(row => rehearsalSessionSchema.parse({
      sessionId: String(row.session_id), planId: String(row.plan_id), modelId: String(row.model_id), clinicId: String(row.clinic_id),
      surgeonId: String(row.surgeon_id), deviceProfile: row.device_profile, status: row.status, tasksCompleted: row.tasks_completed,
      totalTasks: Number(row.total_tasks), unassistedCompletion: Boolean(row.unassisted_completion), durationSeconds: Number(row.duration_seconds),
      ...(row.notes ? { notes: String(row.notes) } : {}), startedAt: new Date(row.started_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
    }));
  }
  async createClinicalQualityResult(result: ClinicalQualityResult): Promise<ClinicalQualityResult> {
    await this.pool.query(
      "INSERT INTO clinical_quality_results (result_id, target_id, target_type, metrics, passed_gates, gate_details, checked_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [result.resultId, result.targetId, result.targetType, JSON.stringify(result.metrics), result.passedGates, JSON.stringify(result.gateDetails), result.checkedAt]
    );
    return result;
  }
  async listClinicalQualityResultsByTarget(targetId: string): Promise<ClinicalQualityResult[]> {
    const res = await this.pool.query("SELECT * FROM clinical_quality_results WHERE target_id=$1 ORDER BY checked_at DESC", [targetId]);
    return res.rows.map(row => clinicalQualityResultSchema.parse({
      resultId: String(row.result_id), targetId: String(row.target_id), targetType: row.target_type,
      metrics: row.metrics, passedGates: Boolean(row.passed_gates), gateDetails: row.gate_details, checkedAt: new Date(row.checked_at).toISOString()
    }));
  }
  async createClinicalCorrection(correction: ClinicalCorrection): Promise<ClinicalCorrection> {
    await this.pool.query(
      "INSERT INTO clinical_corrections (correction_id, target_id, target_type, clinician_id, notes, diff_summary, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [correction.correctionId, correction.targetId, correction.targetType, correction.clinicianId, correction.notes, correction.diffSummary, correction.createdAt]
    );
    return correction;
  }
  async listClinicalCorrectionsByTarget(targetId: string): Promise<ClinicalCorrection[]> {
    const res = await this.pool.query("SELECT * FROM clinical_corrections WHERE target_id=$1 ORDER BY created_at DESC", [targetId]);
    return res.rows.map(row => clinicalCorrectionSchema.parse({
      correctionId: String(row.correction_id), targetId: String(row.target_id), targetType: row.target_type,
      clinicianId: String(row.clinician_id), notes: String(row.notes), diffSummary: String(row.diff_summary),
      createdAt: new Date(row.created_at).toISOString()
    }));
  }
  async createImagingAuditEvent(event: ImagingAuditEvent): Promise<ImagingAuditEvent> {
    await this.pool.query(
      "INSERT INTO imaging_audit_events (audit_id, event_type, actor_id, entity_type, entity_id, correlation_id, details, occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [event.auditId, event.eventType, event.actorId, event.entityType, event.entityId, event.correlationId, JSON.stringify(event.details), event.occurredAt]
    );
    return event;
  }
  async listImagingAuditEvents(entityId: string): Promise<ImagingAuditEvent[]> {
    const res = await this.pool.query("SELECT * FROM imaging_audit_events WHERE entity_id=$1 ORDER BY occurred_at", [entityId]);
    return res.rows.map(row => imagingAuditEventSchema.parse({
      auditId: String(row.audit_id), eventType: String(row.event_type), actorId: String(row.actor_id),
      entityType: String(row.entity_type), entityId: String(row.entity_id), correlationId: String(row.correlation_id),
      details: row.details, occurredAt: new Date(row.occurred_at).toISOString()
    }));
  }

  async clear() { throw new Error("clear is unavailable for persistent repositories"); }
  async close() { await this.pool.end(); }
}
