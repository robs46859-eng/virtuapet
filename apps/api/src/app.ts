import { randomUUID, timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyRequest } from "fastify";
import { capabilities, createPetSchema, type PetProfile, uuidSchema } from "@virtuapet/contracts";
import { MemoryPetRepository, type PetRepository } from "./repository.js";

export interface AppOptions {
  apiToken?: string;
  environment?: string;
  repository?: PetRepository;
}

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

function tokenMatches(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function buildApp(options: AppOptions = {}) {
  const environment = options.environment ?? process.env.VIRTUAPET_ENV ?? "development";
  const apiToken = options.apiToken ?? process.env.DEV_API_TOKEN;
  const repository = options.repository ?? new MemoryPetRepository();
  const app = Fastify({ logger: environment !== "test", genReqId: () => randomUUID() });

  await app.register(helmet);
  await app.register(cors, { origin: environment === "development" ? true : false });

  app.get("/healthz", async () => ({ status: "ok", service: "virtuapet-api", version: "0.1.0" }));
  app.get("/readyz", async (_request, reply) => {
    if (!apiToken) return reply.code(503).send({ status: "not_ready", missing: ["DEV_API_TOKEN"] });
    return { status: "ready", dependencies: { phase1MemoryStore: "ready" } };
  });
  app.get("/v1/platform/capabilities", async () => ({ generatedAt: new Date().toISOString(), capabilities }));

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/pets")) return;
    if (!apiToken || !tokenMatches(bearerToken(request), apiToken)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!uuidSchema.safeParse(request.headers["x-virtuapet-user-id"]).success) {
      return reply.code(400).send({ error: "valid x-virtuapet-user-id required" });
    }
  });

  app.post("/v1/pets", async (request, reply) => {
    const parsed = createPetSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_pet", issues: parsed.error.issues });
    const now = new Date().toISOString();
    const profile: PetProfile = {
      ...parsed.data,
      petId: randomUUID(),
      guardianId: request.headers["x-virtuapet-user-id"] as string,
      createdAt: now,
      updatedAt: now,
      recordVersion: 1
    };
    return reply.code(201).send(await repository.create(profile));
  });

  app.get<{ Params: { petId: string } }>("/v1/pets/:petId", async (request, reply) => {
    if (!uuidSchema.safeParse(request.params.petId).success) return reply.code(400).send({ error: "invalid_pet_id" });
    const pet = await repository.findById(request.params.petId);
    if (!pet) return reply.code(404).send({ error: "not_found" });
    if (pet.guardianId !== request.headers["x-virtuapet-user-id"]) return reply.code(404).send({ error: "not_found" });
    return pet;
  });

  return app;
}

