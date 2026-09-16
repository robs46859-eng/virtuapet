import type { FastifyInstance } from "fastify";
import { uuidSchema } from "@virtuapet/contracts";
import { z } from "zod";
import type { PetRepository } from "../repository.js";
import { IntegrationContextError, requireIntegrationContext } from "./context.js";
import { IdentityLinkError, type IdentityLinkService } from "./identity-links.js";

const completeSchema = z.object({ challengeId: uuidSchema, proofToken: z.string().min(20).max(16384), consent: z.literal(true) }).strict();

/** Parent app authenticates the /v1/integrations prefix; membership is checked again here. */
export async function registerIdentityLinkRoutes(app: FastifyInstance, repository: PetRepository, service?: IdentityLinkService) {
  await app.register(async scope => {
    scope.addHook("onRequest", async (_request, reply) => { reply.header("cache-control", "no-store"); });
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof IntegrationContextError || error instanceof IdentityLinkError) return reply.code(error.statusCode).send({ error: error.code });
      // Deliberately redact DB errors, raw proofs, provider IDs, and configuration.
      return reply.code(503).send({ error: "identity_links_unavailable" });
    });
    const available = () => {
      if (!service) throw new IdentityLinkError("identity_links_unavailable", 503);
      return service;
    };
    scope.post("/v1/integrations/layer8/links/challenges", { bodyLimit: 1024 }, async (request, reply) => {
      const context = await requireIntegrationContext(repository, request.principal);
      if (request.body !== undefined && request.body !== null && !z.object({}).strict().safeParse(request.body).success) return reply.code(400).send({ error: "identity_link_challenge_body_invalid" });
      return reply.code(201).send(await available().createChallenge(context));
    });
    scope.post("/v1/integrations/layer8/links/complete", { bodyLimit: 20_480 }, async (request, reply) => {
      const context = await requireIntegrationContext(repository, request.principal);
      const parsed = completeSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "identity_link_consent_and_challenge_required" });
      return reply.code(201).send(await available().complete(context, parsed.data));
    });
    scope.get("/v1/integrations/layer8/links", async request => {
      const context = await requireIntegrationContext(repository, request.principal);
      return { links: await available().list(context) };
    });
    scope.delete<{ Params: { linkId: string } }>("/v1/integrations/layer8/links/:linkId", async (request, reply) => {
      const context = await requireIntegrationContext(repository, request.principal);
      if (!await available().revoke(context, request.params.linkId)) return reply.code(404).send({ error: "identity_link_not_found" });
      return reply.code(204).send();
    });
  });
}
