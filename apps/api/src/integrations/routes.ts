import type { FastifyInstance } from "fastify";
import { uuidSchema } from "@virtuapet/contracts";
import type { PetRepository } from "../repository.js";
import { IntegrationContextError, requireIntegrationContext } from "./context.js";
import { createLayer8PolicyClient, layer8ConfigFromEnvironment, Layer8IntegrationError } from "./layer8.js";
import { createPawsome3DPreviewAdapter, SpatialIntegrationError } from "./spatial.js";
import { createPawPathAdapter, nearbyRequestSchema, PawPathIntegrationError } from "./pawpath.js";
import type { IdentityLinkService } from "./identity-links.js";

export interface IntegrationServices {
  layer8: ReturnType<typeof createLayer8PolicyClient>;
  spatial: ReturnType<typeof createPawsome3DPreviewAdapter>;
  pawpath: ReturnType<typeof createPawPathAdapter>;
}
export function integrationServicesFromEnvironment(identityLinks?: IdentityLinkService): IntegrationServices {
  return {
    layer8: createLayer8PolicyClient(layer8ConfigFromEnvironment(), identityLinks ? {
      resolveIdentityProof: context => identityLinks.resolveProof(context)
    } : {}),
    // No blanket service token or unverified OIDC forwarding. The default
    // server intentionally has no identity-link resolver: enablement alone
    // cannot authorize private provider records.
    spatial: createPawsome3DPreviewAdapter({ enabled: process.env.PAWSOME3D_PREVIEW_ENABLED === "true",
      ...(process.env.PAWSOME3D_BASE_URL ? { baseUrl: process.env.PAWSOME3D_BASE_URL } : {}),
      allowedAssetOrigins: (process.env.PAWSOME3D_ASSET_ORIGINS ?? "").split(",").map(x => x.trim()).filter(Boolean) }),
    pawpath: createPawPathAdapter({ enabled: process.env.PAWPATH_ENABLED === "true",
      ...(process.env.PAWPATH_BASE_URL ? { baseUrl: process.env.PAWPATH_BASE_URL } : {}) })
  };
}

export async function registerIntegrationRoutes(app: FastifyInstance, repository: PetRepository, services: IntegrationServices) {
  await app.register(async scope => {
    scope.addHook("onRequest", async (_request, reply) => { reply.header("cache-control", "no-store"); });
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof IntegrationContextError || error instanceof SpatialIntegrationError || error instanceof PawPathIntegrationError) {
        return reply.code(error.statusCode).send({ error: error.code });
      }
      if (error instanceof Layer8IntegrationError) return reply.code(error.httpStatus).send({ error: error.code });
      // Never serialize upstream responses, delegated tokens or signed asset URLs.
      return reply.code(503).send({ error: "integration_unavailable" });
    });
    scope.get("/v1/integrations", async request => {
      await requireIntegrationContext(repository, request.principal);
      return { liveVerified: false, providers: {
        Layer8: services.layer8.status(), Pawsome3D: services.spatial.status(), PawPath: services.pawpath.status(),
        GibiWorld: { state: "server_preflight_only", blocker: "Signed transport and physical-device validation pending" },
        Judy: { state: "not_connected", blocker: "Provider contract and scoped account linking pending" },
        Stelar: { state: "not_connected", blocker: "Provider contract and health-data consent pending" },
        Shopify: { state: "not_connected", blocker: "Store configuration and commerce boundary review pending" }
      } };
    });

    scope.get<{ Params: { orderId: string } }>("/v1/integrations/pawsome3d/orders/:orderId/preview", async (request, reply) => {
      const context = await requireIntegrationContext(repository, request.principal);
      if (!uuidSchema.safeParse(request.params.orderId).success) return reply.code(400).send({ error: "invalid_order_id" });
      await services.layer8.authorize(context, { action: "spatial.preview.read", resource: `pawsome3d:order:${request.params.orderId}`,
        purpose: "owner_visual_preview", requiredEntitlements: ["spatial.preview"] });
      // The resolver must enforce ownership + consent for this exact linked
      // user/tenant/order. Layer8 entitlement is not a substitute for ownership.
      return services.spatial.getPreview(context, request.params.orderId);
    });

    scope.post("/v1/integrations/pawpath/nearby", async (request, reply) => {
      const context = await requireIntegrationContext(repository, request.principal);
      const parsed = nearbyRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "location_consent_and_valid_coordinates_required" });
      await services.layer8.authorize(context, { action: "pawpath.nearby.read", resource: `pawpath:user:${context.userId}`,
        purpose: "user_requested_nearby_search", requiredEntitlements: ["pawpath.community"] });
      // Coordinates in a POST body avoid putting precise location in API URL logs.
      return services.pawpath.nearby(context, parsed.data);
    });
  });
}
