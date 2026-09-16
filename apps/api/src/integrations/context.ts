import { randomUUID } from "node:crypto";
import { membershipSchema, organizationRoleSchema, uuidSchema } from "@virtuapet/contracts";
import { z } from "zod";
import type { Principal } from "../auth.js";
import type { PetRepository } from "../repository.js";

export const integrationContextSchema = z.object({
  userId: uuidSchema,
  tenantId: uuidSchema,
  roles: z.array(organizationRoleSchema).min(1),
  correlationId: uuidSchema
}).strict();

export type IntegrationContext = z.infer<typeof integrationContextSchema>;

export class IntegrationContextError extends Error {
  constructor(readonly code: string, readonly statusCode: 400 | 401 | 403) {
    super(code);
    this.name = "IntegrationContextError";
  }
}

/** Call only with the principal produced by the configured token verifier. */
export async function requireIntegrationContext(
  repository: Pick<PetRepository, "findMembership">,
  principal: Principal | undefined,
  requestedOrganizationId?: string,
  requiredRoles: readonly string[] = []
): Promise<IntegrationContext> {
  if (!principal || !uuidSchema.safeParse(principal.userId).success) {
    throw new IntegrationContextError("unauthorized", 401);
  }
  if (!uuidSchema.safeParse(principal.organizationId).success) {
    throw new IntegrationContextError("tenant_context_required", 403);
  }
  const userId = principal.userId.toLowerCase();
  const tenantId = principal.organizationId!.toLowerCase();
  if (requestedOrganizationId !== undefined) {
    if (!uuidSchema.safeParse(requestedOrganizationId).success) {
      throw new IntegrationContextError("invalid_tenant_id", 400);
    }
    if (requestedOrganizationId.toLowerCase() !== tenantId) {
      throw new IntegrationContextError("tenant_context_mismatch", 403);
    }
  }

  const parsed = membershipSchema.safeParse(await repository.findMembership(tenantId, userId));
  if (!parsed.success || parsed.data.status !== "active" || parsed.data.revokedAt !== null ||
      parsed.data.userId.toLowerCase() !== userId || parsed.data.organizationId.toLowerCase() !== tenantId) {
    throw new IntegrationContextError("active_membership_required", 403);
  }
  if (requiredRoles.length > 0 && !requiredRoles.includes(parsed.data.role)) {
    throw new IntegrationContextError("integration_role_required", 403);
  }

  // JWT/header role claims are deliberately not used as membership authority.
  return { userId, tenantId, roles: [parsed.data.role], correlationId: randomUUID() };
}
