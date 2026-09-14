import { createRemoteJWKSet, jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";

export interface Principal {
  userId: string;
  organizationId?: string;
  roles: string[];
}

export type PrincipalVerifier = (request: FastifyRequest) => Promise<Principal | undefined>;

function bearer(request: FastifyRequest): string | undefined {
  const value = request.headers.authorization;
  return value?.startsWith("Bearer ") ? value.slice(7) : undefined;
}

export function createOidcVerifier(options: { issuer: string; audience: string; jwksUrl: string }): PrincipalVerifier {
  const jwks = createRemoteJWKSet(new URL(options.jwksUrl));
  return async request => {
    const token = bearer(request);
    if (!token) return undefined;
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: options.issuer, audience: options.audience });
      if (typeof payload.sub !== "string") return undefined;
      const organizationId = typeof payload.org_id === "string" ? payload.org_id : undefined;
      const roles = Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === "string") : [];
      return { userId: payload.sub, ...(organizationId ? { organizationId } : {}), roles };
    } catch {
      return undefined;
    }
  };
}

export function createDevelopmentVerifier(token: string): PrincipalVerifier {
  return async request => {
    if (process.env.VIRTUAPET_ENV !== "development" || bearer(request) !== token) return undefined;
    const userId = request.headers["x-virtuapet-user-id"];
    if (typeof userId !== "string") return undefined;
    const organizationId = typeof request.headers["x-virtuapet-organization-id"] === "string" ? request.headers["x-virtuapet-organization-id"] : undefined;
    const roles = typeof request.headers["x-virtuapet-roles"] === "string" ? request.headers["x-virtuapet-roles"].split(",").map(role => role.trim()) : [];
    return { userId, ...(organizationId ? { organizationId } : {}), roles };
  };
}

export function verifierFromEnvironment(): PrincipalVerifier {
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  const jwksUrl = process.env.OIDC_JWKS_URL;
  if (issuer && audience && jwksUrl) return createOidcVerifier({ issuer, audience, jwksUrl });
  const devToken = process.env.DEV_API_TOKEN;
  if (devToken) return createDevelopmentVerifier(devToken);
  return async () => undefined;
}

