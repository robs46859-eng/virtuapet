import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  signSpatialAssetManifest,
  validateSpatialAssetManifest,
  type UnsignedSpatialAssetManifest,
  spatialAssetManifestSchema
} from "./spatial.js";

const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function createValidUnsignedManifest(): UnsignedSpatialAssetManifest {
  const now = new Date("2026-09-15T12:00:00.000Z");
  const future = new Date(now.getTime() + 86400000).toISOString();
  return {
    manifestVersion: "2.0.0",
    assetId: randomUUID(),
    version: 2,
    ownerId: randomUUID(),
    tenantId: randomUUID(),
    source: "pawsome3d",
    provenance: {
      generator: "Pawsome3D Engine v2.4.1",
      generatedAt: "2026-09-15T10:00:00.000Z",
      sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      sourceReference: "paw-job-98421",
      lineage: ["scan_capture", "mesh_simplification", "texture_baking"]
    },
    glbUri: "https://cdn.virtuapet.com/assets/spatial/dog_canine_01.glb",
    sha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    units: "mm",
    scale: 1.0,
    upAxis: "Y_UP",
    forwardAxis: "NEGATIVE_Z_FORWARD",
    laterality: "bilateral",
    bounds: {
      min: [-250, 0, -400],
      max: [250, 600, 400]
    },
    origin: [0, 0, 0],
    supportedAnimationClips: ["idle", "walk", "sit", "lie_down"],
    entitlementRequirements: ["spatial.asset.view", "spatial.pet.interact"],
    expiresAt: future,
    revokedAt: null,
    isRevoked: false,
    minClientVersion: "1.2.0",
    rollbackVersion: 1
  };
}

describe("VirtuaPet Phase 4 Spatial Manifest Contract", () => {
  it("signs and validates a correct spatial manifest", () => {
    const unsigned = createValidUnsignedManifest();
    const signed = signSpatialAssetManifest(unsigned, testKey);

    expect(spatialAssetManifestSchema.safeParse(signed).success).toBe(true);
    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z",
      clientVersion: "1.3.0",
      grantedEntitlements: ["spatial.asset.view", "spatial.pet.interact", "extra.scope"],
      supportedUnits: ["mm", "m"],
      supportedUpAxes: ["Y_UP"],
      supportedForwardAxes: ["NEGATIVE_Z_FORWARD", "Z_FORWARD"],
      expectedLaterality: "bilateral",
      actualSha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0"
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest?.assetId).toBe(unsigned.assetId);
  });

  it("rejects altered signatures", () => {
    const unsigned = createValidUnsignedManifest();
    const signed = signSpatialAssetManifest(unsigned, testKey);
    // Tamper with signature
    const tampered = { ...signed, signature: signed.signature.replace(/[0-9a-f]/, "x") };

    const result = validateSpatialAssetManifest(tampered, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("signature"))).toBe(true);
  });

  it("rejects altered asset checksums", () => {
    const unsigned = createValidUnsignedManifest();
    const signed = signSpatialAssetManifest(unsigned, testKey);

    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z",
      actualSha256: "0000000000000000000000000000000000000000000000000000000000000000"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Asset hash mismatch"))).toBe(true);
  });

  it("rejects expired manifests", () => {
    const unsigned = createValidUnsignedManifest();
    unsigned.expiresAt = "2026-09-10T00:00:00.000Z"; // Past date
    const signed = signSpatialAssetManifest(unsigned, testKey);

    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("expired"))).toBe(true);
  });

  it("rejects revoked entitlements", () => {
    const unsigned = createValidUnsignedManifest();
    const signed = signSpatialAssetManifest(unsigned, testKey);

    // Client only has spatial.asset.view, but manifest also requires spatial.pet.interact
    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z",
      grantedEntitlements: ["spatial.asset.view"]
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Missing required entitlement: spatial.pet.interact"))).toBe(true);
  });

  it("rejects revoked manifests", () => {
    const unsigned = createValidUnsignedManifest();
    unsigned.isRevoked = true;
    unsigned.revokedAt = "2026-09-15T11:00:00.000Z";
    const signed = signSpatialAssetManifest(unsigned, testKey);

    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("revoked"))).toBe(true);
  });

  it("rejects unsupported client versions", () => {
    const unsigned = createValidUnsignedManifest();
    unsigned.minClientVersion = "2.5.0";
    const signed = signSpatialAssetManifest(unsigned, testKey);

    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z",
      clientVersion: "1.4.0"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("below manifest minimum required"))).toBe(true);
  });

  it("rejects incorrect units", () => {
    const unsigned = createValidUnsignedManifest();
    unsigned.units = "cm";
    const signed = signSpatialAssetManifest(unsigned, testKey);

    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z",
      supportedUnits: ["m", "mm"] // client does not accept cm
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Unsupported spatial units: cm"))).toBe(true);
  });

  it("rejects incorrect axes orientation", () => {
    const unsigned = createValidUnsignedManifest();
    unsigned.upAxis = "Z_UP";
    const signed = signSpatialAssetManifest(unsigned, testKey);

    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z",
      supportedUpAxes: ["Y_UP"]
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Unsupported upAxis: Z_UP"))).toBe(true);
  });

  it("rejects incorrect laterality", () => {
    const unsigned = createValidUnsignedManifest();
    unsigned.laterality = "L";
    const signed = signSpatialAssetManifest(unsigned, testKey);

    const result = validateSpatialAssetManifest(signed, {
      verificationKey: testKey,
      now: "2026-09-15T12:00:00.000Z",
      expectedLaterality: "R"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Laterality mismatch"))).toBe(true);
  });

  it("validates rollback target version semantics", () => {
    const unsigned = createValidUnsignedManifest();
    // Valid rollback: version 2 rolling back to version 1
    unsigned.version = 2;
    unsigned.rollbackVersion = 1;
    const signed = signSpatialAssetManifest(unsigned, testKey);
    expect(spatialAssetManifestSchema.safeParse(signed).success).toBe(true);

    // Invalid rollback: version 2 rolling back to version 2 or 3
    const invalid = { ...unsigned, rollbackVersion: 2 };
    expect(spatialAssetManifestSchema.safeParse(invalid).success).toBe(false);
  });
});
