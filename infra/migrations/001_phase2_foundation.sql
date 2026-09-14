BEGIN;

CREATE TABLE pet_profiles (
  pet_id uuid PRIMARY KEY,
  guardian_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  species text NOT NULL CHECK (species IN ('dog','cat','bird','reptile','small_mammal','other')),
  birth_date date,
  microchip_id text,
  record_version integer NOT NULL DEFAULT 1 CHECK (record_version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX pet_profiles_guardian_idx ON pet_profiles (guardian_id);

CREATE TABLE consent_grants (
  grant_id uuid PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES pet_profiles(pet_id),
  grantor_user_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  scopes jsonb NOT NULL CHECK (jsonb_typeof(scopes) = 'array'),
  purpose text NOT NULL,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > starts_at),
  revoked_at timestamptz
);
CREATE INDEX consent_grants_pet_idx ON consent_grants (pet_id);
CREATE INDEX consent_grants_active_idx ON consent_grants (pet_id, grantee_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE feline_grimace_assessments (
  assessment_id uuid PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES pet_profiles(pet_id),
  assessor_user_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  assessed_at timestamptz NOT NULL,
  assessor_training_confirmed boolean NOT NULL CHECK (assessor_training_confirmed),
  context text,
  action_units jsonb NOT NULL,
  total_score integer NOT NULL CHECK (total_score BETWEEN 0 AND 10),
  veterinary_review_required boolean NOT NULL,
  recorded_at timestamptz NOT NULL
);
CREATE INDEX feline_grimace_pet_time_idx ON feline_grimace_assessments (pet_id, assessed_at DESC);

CREATE TABLE regulation_evidence (
  evidence_id uuid PRIMARY KEY,
  country_code char(2) NOT NULL,
  region_code text,
  authority text NOT NULL,
  source_url text NOT NULL,
  title text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  effective_date date,
  evidence_excerpt text NOT NULL,
  status text NOT NULL CHECK (status IN ('current','unknown','conflict')),
  reviewer_user_id uuid NOT NULL,
  human_verified_at timestamptz,
  created_at timestamptz NOT NULL
);
CREATE INDEX regulation_evidence_jurisdiction_idx ON regulation_evidence (country_code, region_code, retrieved_at DESC);

CREATE TABLE event_outbox (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX event_outbox_pending_idx ON event_outbox (occurred_at) WHERE published_at IS NULL;

COMMIT;

