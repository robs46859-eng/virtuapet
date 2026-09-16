import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Membership } from "@virtuapet/contracts";
import { requireIntegrationContext } from "./context.js";

const userId = randomUUID();
const tenantId = randomUUID();
const principal = { userId, organizationId: tenantId, roles: ["platform_admin"] };
const membership: Membership = {
  membershipId: randomUUID(), userId, organizationId: tenantId, role: "vet_staff",
  status: "active", createdAt: new Date().toISOString(), revokedAt: null
};
const repository = (value: Membership | undefined = membership) => ({ findMembership: vi.fn().mockResolvedValue(value) });

describe("integration tenant context", () => {
  it("derives role authority and fresh correlation from server-owned membership", async () => {
    const repo = repository();
    const context = await requireIntegrationContext(repo, principal, tenantId, ["vet_staff"]);
    expect(context).toMatchObject({ userId, tenantId, roles: ["vet_staff"] });
    expect(repo.findMembership).toHaveBeenCalledWith(tenantId, userId);
    expect(context.correlationId).not.toBe((await requireIntegrationContext(repo, principal)).correlationId);
  });

  it("rejects forged token roles and does not allow a platform-admin bypass", async () => {
    await expect(requireIntegrationContext(repository(), principal, tenantId, ["veterinarian"]))
      .rejects.toMatchObject({ statusCode: 403, code: "integration_role_required" });
    await expect(requireIntegrationContext({ findMembership: vi.fn().mockResolvedValue(undefined) }, principal))
      .rejects.toMatchObject({ statusCode: 403, code: "active_membership_required" });
  });

  it("rejects another requested tenant before querying membership", async () => {
    const repo = repository();
    await expect(requireIntegrationContext(repo, principal, randomUUID()))
      .rejects.toMatchObject({ code: "tenant_context_mismatch" });
    expect(repo.findMembership).not.toHaveBeenCalled();
  });

  it("rejects absent and malformed identity or tenant context", async () => {
    await expect(requireIntegrationContext(repository(), undefined)).rejects.toMatchObject({ statusCode: 401 });
    await expect(requireIntegrationContext(repository(), { ...principal, userId: "bad" })).rejects.toMatchObject({ statusCode: 401 });
    await expect(requireIntegrationContext(repository(), { userId, roles: [] })).rejects.toMatchObject({ code: "tenant_context_required" });
    await expect(requireIntegrationContext(repository(), { ...principal, organizationId: "bad" })).rejects.toMatchObject({ code: "tenant_context_required" });
    await expect(requireIntegrationContext(repository(), principal, "bad")).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([
    { ...membership, status: "revoked" as const },
    { ...membership, revokedAt: new Date().toISOString() },
    { ...membership, userId: randomUUID() },
    { ...membership, organizationId: randomUUID() }
  ])("rejects stale or mismatched membership %#", async candidate => {
    await expect(requireIntegrationContext(repository(candidate), principal))
      .rejects.toMatchObject({ code: "active_membership_required" });
  });

  it("normalizes UUID case without changing tenant selection", async () => {
    const context = await requireIntegrationContext(repository(), {
      ...principal, userId: userId.toUpperCase(), organizationId: tenantId.toUpperCase()
    }, tenantId.toUpperCase());
    expect(context.userId).toBe(userId);
    expect(context.tenantId).toBe(tenantId);
  });
});
