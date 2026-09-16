BEGIN;

-- These tables are private to VirtuaPet. They never join another service's DB.
CREATE TABLE integration_identity_link_challenges (
  challenge_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES organizations(organization_id),
  user_id uuid NOT NULL,
  nonce uuid NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + interval '5 minutes'),
  consumed_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX integration_link_challenge_scope_idx ON integration_identity_link_challenges (tenant_id,user_id);

CREATE TABLE integration_identity_links (
  link_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES organizations(organization_id),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = 'layer8'),
  provider_subject text NOT NULL CHECK (char_length(provider_subject) BETWEEN 1 AND 255),
  provider_tenant_id text NOT NULL CHECK (char_length(provider_tenant_id) BETWEEN 1 AND 255),
  provider_organization_id text NOT NULL CHECK (char_length(provider_organization_id) BETWEEN 1 AND 255),
  proof_id uuid NOT NULL UNIQUE,
  encrypted_proof text NOT NULL CHECK (char_length(encrypted_proof) BETWEEN 1 AND 24000),
  created_at timestamptz NOT NULL,
  consented_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + interval '5 minutes'),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX integration_link_active_scope_idx ON integration_identity_links (tenant_id,user_id,provider) WHERE revoked_at IS NULL;
CREATE INDEX integration_link_scope_idx ON integration_identity_links (tenant_id,user_id,created_at DESC);

-- Only safe identifiers and event names belong in this audit table, never proofs.
CREATE TABLE integration_identity_link_audit (
  event_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES organizations(organization_id),
  user_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('challenge_created','link_completed','links_revoked')),
  target_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL
);
CREATE INDEX integration_link_audit_scope_idx ON integration_identity_link_audit (tenant_id,user_id,occurred_at DESC);

-- Fail closed for missing/reset transaction settings. FORCE also covers owners
-- without SUPERUSER/BYPASSRLS. Runtime credentials must not have those privileges.
ALTER TABLE integration_identity_link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_identity_link_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY integration_challenges_scope ON integration_identity_link_challenges
  USING (tenant_id::text = nullif(current_setting('app.tenant_id',true),'') AND user_id::text = nullif(current_setting('app.user_id',true),''))
  WITH CHECK (tenant_id::text = nullif(current_setting('app.tenant_id',true),'') AND user_id::text = nullif(current_setting('app.user_id',true),''));
ALTER TABLE integration_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_identity_links FORCE ROW LEVEL SECURITY;
CREATE POLICY integration_links_scope ON integration_identity_links
  USING (tenant_id::text = nullif(current_setting('app.tenant_id',true),'') AND user_id::text = nullif(current_setting('app.user_id',true),''))
  WITH CHECK (tenant_id::text = nullif(current_setting('app.tenant_id',true),'') AND user_id::text = nullif(current_setting('app.user_id',true),''));
ALTER TABLE integration_identity_link_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_identity_link_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY integration_link_audit_scope ON integration_identity_link_audit
  USING (tenant_id::text = nullif(current_setting('app.tenant_id',true),'') AND user_id::text = nullif(current_setting('app.user_id',true),''))
  WITH CHECK (tenant_id::text = nullif(current_setting('app.tenant_id',true),'') AND user_id::text = nullif(current_setting('app.user_id',true),''));

COMMIT;
