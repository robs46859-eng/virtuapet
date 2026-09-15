BEGIN;

-- Phase 4 stores signed spatial manifests. Cross-tenant access remains enforced
-- by the authenticated API until request identity is transaction-bound in SQL.
-- Do not enable broad RLS policies that depend only on client-set custom GUCs:
-- the runtime role can set those values and could impersonate another tenant.
CREATE TABLE spatial_asset_manifests (
  asset_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  owner_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES organizations(organization_id),
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 1 AND 120),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  glb_uri text NOT NULL CHECK (glb_uri ~ '^https://'),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
  units text NOT NULL CHECK (units IN ('mm', 'cm', 'm')),
  scale double precision NOT NULL CHECK (scale > 0 AND scale NOT IN ('Infinity'::double precision, '-Infinity'::double precision)),
  up_axis text NOT NULL CHECK (up_axis IN ('Y_UP', 'Z_UP')),
  forward_axis text NOT NULL CHECK (forward_axis IN ('Z_FORWARD', 'NEGATIVE_Z_FORWARD', 'X_FORWARD', 'Y_FORWARD')),
  laterality text NOT NULL CHECK (laterality IN ('L', 'R', 'bilateral', 'not_applicable')),
  bounds jsonb NOT NULL CHECK (jsonb_typeof(bounds) = 'object'),
  origin jsonb NOT NULL CHECK (jsonb_typeof(origin) = 'array' AND jsonb_array_length(origin) = 3),
  supported_animation_clips jsonb NOT NULL CHECK (jsonb_typeof(supported_animation_clips) = 'array'),
  entitlement_requirements jsonb NOT NULL CHECK (jsonb_typeof(entitlement_requirements) = 'array'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  is_revoked boolean NOT NULL DEFAULT false,
  min_client_version text NOT NULL CHECK (min_client_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  rollback_version integer CHECK (rollback_version IS NULL OR rollback_version < version),
  signature text NOT NULL CHECK (signature ~ '^[0-9a-f]{64}$'),
  manifest_version text NOT NULL CHECK (manifest_version = '2.0.0'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_revoked AND revoked_at IS NOT NULL) OR (NOT is_revoked AND revoked_at IS NULL)),
  PRIMARY KEY (asset_id, version)
);

CREATE INDEX spatial_asset_manifests_owner_idx ON spatial_asset_manifests (owner_id);
CREATE INDEX spatial_asset_manifests_tenant_idx ON spatial_asset_manifests (tenant_id, created_at DESC);

COMMIT;
