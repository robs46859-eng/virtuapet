BEGIN;

CREATE TABLE imaging_studies (
  study_id uuid PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES pet_profiles(pet_id),
  clinic_id uuid NOT NULL REFERENCES organizations(organization_id),
  study_instance_uid text NOT NULL UNIQUE,
  accession_number text,
  study_description text,
  study_date date,
  patient_name_anonymized text NOT NULL,
  status text NOT NULL CHECK (status IN ('received', 'quarantined', 'validated', 'failed_validation')),
  created_at timestamptz NOT NULL
);
CREATE INDEX imaging_studies_pet_idx ON imaging_studies (pet_id);
CREATE INDEX imaging_studies_clinic_idx ON imaging_studies (clinic_id);

CREATE TABLE imaging_series (
  series_id uuid PRIMARY KEY,
  study_id uuid NOT NULL REFERENCES imaging_studies(study_id),
  series_instance_uid text NOT NULL UNIQUE,
  modality text NOT NULL CHECK (modality = 'CT'),
  laterality text NOT NULL CHECK (laterality IN ('L', 'R')),
  body_part_examined text NOT NULL,
  slice_thickness double precision NOT NULL CHECK (slice_thickness > 0),
  pixel_spacing jsonb NOT NULL,
  image_orientation_patient jsonb NOT NULL,
  rows integer NOT NULL CHECK (rows >= 128),
  columns integer NOT NULL CHECK (columns >= 128),
  slice_count integer NOT NULL CHECK (slice_count >= 1),
  status text NOT NULL CHECK (status IN ('received', 'quarantined', 'validated', 'failed_validation')),
  quarantine_reason text,
  source_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX imaging_series_study_idx ON imaging_series (study_id);

CREATE TABLE imaging_volumes (
  volume_id uuid PRIMARY KEY,
  series_id uuid NOT NULL REFERENCES imaging_series(series_id),
  dimensions jsonb NOT NULL,
  spacing jsonb NOT NULL,
  origin jsonb NOT NULL,
  coordinate_frame text NOT NULL CHECK (coordinate_frame = 'DICOM_LPS'),
  units text NOT NULL CHECK (units = 'HU'),
  volume_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX imaging_volumes_series_idx ON imaging_volumes (series_id);

CREATE TABLE imaging_segmentations (
  segmentation_id uuid PRIMARY KEY,
  volume_id uuid NOT NULL REFERENCES imaging_volumes(volume_id),
  parent_segmentation_id uuid REFERENCES imaging_segmentations(segmentation_id),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'clinician_reviewed', 'approved', 'superseded')),
  structures jsonb NOT NULL,
  algorithm_version text NOT NULL,
  operator_id uuid NOT NULL,
  uncertainty_score double precision NOT NULL CHECK (uncertainty_score BETWEEN 0.0 AND 1.0),
  segmentation_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX imaging_segmentations_volume_idx ON imaging_segmentations (volume_id);

CREATE TABLE imaging_meshes (
  mesh_id uuid PRIMARY KEY,
  segmentation_id uuid NOT NULL REFERENCES imaging_segmentations(segmentation_id),
  structure_name text NOT NULL,
  vertex_count integer NOT NULL CHECK (vertex_count > 0),
  triangle_count integer NOT NULL CHECK (triangle_count > 0),
  is_watertight boolean NOT NULL,
  topology_repaired boolean NOT NULL,
  surface_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX imaging_meshes_segmentation_idx ON imaging_meshes (segmentation_id);

CREATE TABLE clinical_models (
  model_id uuid PRIMARY KEY,
  series_id uuid NOT NULL REFERENCES imaging_series(series_id),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL,
  structures jsonb NOT NULL,
  laterality text NOT NULL CHECK (laterality IN ('L', 'R')),
  scale_factor double precision NOT NULL CHECK (scale_factor > 0),
  scale_units text NOT NULL CHECK (scale_units IN ('mm', 'm')),
  coordinate_system text NOT NULL CHECK (coordinate_system IN ('LPS', 'glTF_Y_UP')),
  signature text NOT NULL,
  entitlement_scope text NOT NULL,
  rollback_target_id uuid REFERENCES clinical_models(model_id),
  approved_by_user_id uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX clinical_models_series_idx ON clinical_models (series_id);

CREATE TABLE surgical_plans (
  plan_id uuid PRIMARY KEY,
  model_id uuid NOT NULL REFERENCES clinical_models(model_id),
  pet_id uuid NOT NULL REFERENCES pet_profiles(pet_id),
  clinic_id uuid NOT NULL REFERENCES organizations(organization_id),
  surgeon_id uuid NOT NULL,
  target_tpa_degrees double precision NOT NULL,
  measured_tpa_degrees double precision NOT NULL,
  blade_radius_mm integer NOT NULL CHECK (blade_radius_mm IN (18, 24, 27, 30, 33)),
  rotation_distance_mm double precision NOT NULL CHECK (rotation_distance_mm > 0),
  safe_margin_mm double precision NOT NULL CHECK (safe_margin_mm >= 0),
  notes text,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'superseded')),
  created_at timestamptz NOT NULL
);
CREATE INDEX surgical_plans_pet_idx ON surgical_plans (pet_id);
CREATE INDEX surgical_plans_clinic_idx ON surgical_plans (clinic_id);

CREATE TABLE rehearsal_sessions (
  session_id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES surgical_plans(plan_id),
  model_id uuid NOT NULL REFERENCES clinical_models(model_id),
  clinic_id uuid NOT NULL REFERENCES organizations(organization_id),
  surgeon_id uuid NOT NULL,
  device_profile text NOT NULL,
  status text NOT NULL CHECK (status IN ('initialized', 'in_progress', 'completed', 'aborted')),
  tasks_completed jsonb NOT NULL,
  total_tasks integer NOT NULL CHECK (total_tasks > 0),
  unassisted_completion boolean NOT NULL,
  duration_seconds double precision NOT NULL CHECK (duration_seconds >= 0),
  notes text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz
);
CREATE INDEX rehearsal_sessions_plan_idx ON rehearsal_sessions (plan_id);

CREATE TABLE clinical_quality_results (
  result_id uuid PRIMARY KEY,
  target_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('series', 'volume', 'segmentation', 'mesh', 'model')),
  metrics jsonb NOT NULL,
  passed_gates boolean NOT NULL,
  gate_details jsonb NOT NULL,
  checked_at timestamptz NOT NULL
);
CREATE INDEX clinical_quality_results_target_idx ON clinical_quality_results (target_id);

CREATE TABLE clinical_corrections (
  correction_id uuid PRIMARY KEY,
  target_id uuid NOT NULL,
  target_type text NOT NULL,
  clinician_id uuid NOT NULL,
  notes text NOT NULL,
  diff_summary text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX clinical_corrections_target_idx ON clinical_corrections (target_id);

CREATE TABLE imaging_audit_events (
  audit_id uuid PRIMARY KEY,
  event_type text NOT NULL,
  actor_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  details jsonb NOT NULL,
  occurred_at timestamptz NOT NULL
);
CREATE INDEX imaging_audit_events_entity_idx ON imaging_audit_events (entity_id, occurred_at);

COMMIT;
