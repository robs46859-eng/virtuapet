import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const spatialUuidSchema = z.string().uuid();

export const spatialUnitsSchema = z.enum(["mm", "cm", "m"]);
export type SpatialUnits = z.infer<typeof spatialUnitsSchema>;

export const spatialUpAxisSchema = z.enum(["Y_UP", "Z_UP"]);
export type SpatialUpAxis = z.infer<typeof spatialUpAxisSchema>;

export const spatialForwardAxisSchema = z.enum([
  "Z_FORWARD",
  "NEGATIVE_Z_FORWARD",
  "X_FORWARD",
  "Y_FORWARD"
]);
export type SpatialForwardAxis = z.infer<typeof spatialForwardAxisSchema>;

export const spatialLateralitySchema = z.enum(["L", "R", "bilateral", "not_applicable"]);
export type SpatialLaterality = z.infer<typeof spatialLateralitySchema>;

export const spatialVector3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type SpatialVector3 = z.infer<typeof spatialVector3Schema>;

export const spatialBoundsSchema = z.object({
  min: spatialVector3Schema,
  max: spatialVector3Schema
}).strict().superRefine((bounds, ctx) => {
  if (bounds.min[0] >= bounds.max[0] || bounds.min[1] >= bounds.max[1] || bounds.min[2] >= bounds.max[2]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "bounds.min must be strictly less than bounds.max in all 3 axes",
      path: ["min"]
    });
  }
});
export type SpatialBounds = z.infer<typeof spatialBoundsSchema>;

export const spatialProvenanceSchema = z.object({
  generator: z.string().trim().min(1).max(160),
  generatedAt: z.string().datetime(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/i),
  sourceReference: z.string().trim().min(1).max(256),
  lineage: z.array(z.string().trim().min(1)).default([])
}).strict();
export type SpatialProvenance = z.infer<typeof spatialProvenanceSchema>;

const spatialAssetManifestFields = {
  manifestVersion: z.literal("2.0.0"),
  assetId: spatialUuidSchema,
  version: z.number().int().positive(),
  ownerId: spatialUuidSchema,
  tenantId: spatialUuidSchema,
  source: z.string().trim().min(1).max(120),
  provenance: spatialProvenanceSchema,
  glbUri: z.string().url().refine(value => value.startsWith("https://"), "glbUri must use HTTPS"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  units: spatialUnitsSchema,
  scale: z.number().positive(),
  upAxis: spatialUpAxisSchema,
  forwardAxis: spatialForwardAxisSchema,
  laterality: spatialLateralitySchema,
  bounds: spatialBoundsSchema,
  origin: spatialVector3Schema,
  supportedAnimationClips: z.array(z.string().trim().min(1)),
  entitlementRequirements: z.array(z.string().trim().min(1)).min(1),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  isRevoked: z.boolean(),
  minClientVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
  rollbackVersion: z.number().int().positive().nullable()
};

function validateManifestState(
  manifest: { isRevoked: boolean; revokedAt: string | null; rollbackVersion: number | null; version: number },
  ctx: z.RefinementCtx
) {
  if (manifest.isRevoked && !manifest.revokedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "revokedAt timestamp is required when isRevoked is true",
      path: ["revokedAt"]
    });
  }
  if (manifest.rollbackVersion !== null && manifest.rollbackVersion >= manifest.version) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rollbackVersion must be strictly less than current version",
      path: ["rollbackVersion"]
    });
  }
}

export const unsignedSpatialAssetManifestSchema = z.object(spatialAssetManifestFields)
  .strict()
  .superRefine(validateManifestState);
export const spatialAssetManifestSchema = z.object({
  ...spatialAssetManifestFields,
  signature: z.string().regex(/^[0-9a-f]{64}$/)
}).strict().superRefine(validateManifestState);
export type SpatialAssetManifest = z.infer<typeof spatialAssetManifestSchema>;
export type UnsignedSpatialAssetManifest = z.infer<typeof unsignedSpatialAssetManifestSchema>;

export function canonicalizeManifestPayload(manifest: UnsignedSpatialAssetManifest): string {
  const normalized = {
    manifestVersion: manifest.manifestVersion,
    assetId: manifest.assetId,
    version: manifest.version,
    ownerId: manifest.ownerId,
    tenantId: manifest.tenantId,
    source: manifest.source,
    provenance: {
      generator: manifest.provenance.generator,
      generatedAt: manifest.provenance.generatedAt,
      sourceHash: manifest.provenance.sourceHash.toLowerCase(),
      sourceReference: manifest.provenance.sourceReference,
      lineage: [...manifest.provenance.lineage].sort()
    },
    glbUri: manifest.glbUri,
    sha256: manifest.sha256.toLowerCase(),
    units: manifest.units,
    scale: manifest.scale,
    upAxis: manifest.upAxis,
    forwardAxis: manifest.forwardAxis,
    laterality: manifest.laterality,
    bounds: manifest.bounds,
    origin: manifest.origin,
    supportedAnimationClips: [...manifest.supportedAnimationClips].sort(),
    entitlementRequirements: [...manifest.entitlementRequirements].sort(),
    expiresAt: manifest.expiresAt,
    revokedAt: manifest.revokedAt,
    isRevoked: manifest.isRevoked,
    minClientVersion: manifest.minClientVersion,
    rollbackVersion: manifest.rollbackVersion
  };
  return JSON.stringify(normalized);
}

export function signSpatialAssetManifest(
  manifest: UnsignedSpatialAssetManifest,
  secretKey: string
): SpatialAssetManifest {
  const validated = unsignedSpatialAssetManifestSchema.parse(manifest);
  const payload = canonicalizeManifestPayload(validated);
  const signature = createHmac("sha256", secretKey).update(payload).digest("hex");
  return {
    ...validated,
    signature
  };
}

export interface ManifestValidationOptions {
  verificationKey: string;
  now?: Date | string | number;
  clientVersion?: string;
  grantedEntitlements?: string[];
  supportedUnits?: SpatialUnits[];
  supportedUpAxes?: SpatialUpAxis[];
  supportedForwardAxes?: SpatialForwardAxis[];
  expectedLaterality?: SpatialLaterality;
  actualSha256?: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: SpatialAssetManifest | undefined;
}

function compareSemver(a: string, b: string): number {
  const [aMaj = 0, aMin = 0, aPat = 0] = a.split(".").map(Number);
  const [bMaj = 0, bMin = 0, bPat = 0] = b.split(".").map(Number);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPat - bPat;
}

export function validateSpatialAssetManifest(
  input: unknown,
  options: ManifestValidationOptions
): ManifestValidationResult {
  const errors: string[] = [];

  const parsed = spatialAssetManifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`)
    };
  }

  const manifest = parsed.data;
  const nowMs = typeof options.now === "number"
    ? options.now
    : options.now
      ? new Date(options.now).getTime()
      : Date.now();

  // 1. Signature verification
  const { signature, ...unsigned } = manifest;
  const expectedPayload = canonicalizeManifestPayload(unsigned);
  const expectedSignature = createHmac("sha256", options.verificationKey)
    .update(expectedPayload)
    .digest("hex");
  const providedBytes = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expectedSignature, "hex");
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
    errors.push("Invalid or altered manifest cryptographic signature");
  }

  // 2. Asset checksum verification (if provided)
  if (options.actualSha256) {
    if (manifest.sha256.toLowerCase() !== options.actualSha256.toLowerCase()) {
      errors.push(`Asset hash mismatch: manifest specifies ${manifest.sha256} but actual is ${options.actualSha256}`);
    }
  }

  // 3. Expiration check
  const expiresAtMs = Date.parse(manifest.expiresAt);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs) {
    errors.push(`Manifest expired at ${manifest.expiresAt}`);
  }

  // 4. Revocation check
  if (manifest.isRevoked || manifest.revokedAt !== null) {
    errors.push(`Manifest has been revoked (revokedAt: ${manifest.revokedAt ?? "unspecified"})`);
  }

  // 5. Entitlement verification
  if (options.grantedEntitlements) {
    const grantedSet = new Set(options.grantedEntitlements);
    for (const req of manifest.entitlementRequirements) {
      if (!grantedSet.has(req)) {
        errors.push(`Missing required entitlement: ${req}`);
      }
    }
  }

  // 6. Client version compatibility
  if (options.clientVersion) {
    if (compareSemver(options.clientVersion, manifest.minClientVersion) < 0) {
      errors.push(`Client version ${options.clientVersion} is below manifest minimum required ${manifest.minClientVersion}`);
    }
  }

  // 7. Units and scale check
  if (options.supportedUnits && !options.supportedUnits.includes(manifest.units)) {
    errors.push(`Unsupported spatial units: ${manifest.units}. Supported: ${options.supportedUnits.join(", ")}`);
  }

  // 8. Axes and orientation check
  if (options.supportedUpAxes && !options.supportedUpAxes.includes(manifest.upAxis)) {
    errors.push(`Unsupported upAxis: ${manifest.upAxis}. Supported: ${options.supportedUpAxes.join(", ")}`);
  }
  if (options.supportedForwardAxes && !options.supportedForwardAxes.includes(manifest.forwardAxis)) {
    errors.push(`Unsupported forwardAxis: ${manifest.forwardAxis}. Supported: ${options.supportedForwardAxes.join(", ")}`);
  }

  // 9. Laterality check
  if (options.expectedLaterality && manifest.laterality !== options.expectedLaterality) {
    errors.push(`Laterality mismatch: expected ${options.expectedLaterality} but manifest is ${manifest.laterality}`);
  }

  // 10. Rollback target check
  if (manifest.rollbackVersion !== null && manifest.rollbackVersion >= manifest.version) {
    errors.push(`Rollback version ${manifest.rollbackVersion} must precede current version ${manifest.version}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest: errors.length === 0 ? manifest : undefined
  };
}
