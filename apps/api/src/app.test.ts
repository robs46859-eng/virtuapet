import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const token = "a-development-token-that-is-long-enough";
const guardian = "04240ca7-5f6b-497b-89f8-dd4aad574a60";
const stranger = "27138277-7967-4059-b8ab-6041b2497e5d";
let app: Awaited<ReturnType<typeof buildApp>> | undefined;

afterEach(async () => { await app?.close(); app = undefined; });

describe("VirtuaPet Phase 1 API", () => {
  it("reports health and readiness separately", async () => {
    app = await buildApp({ apiToken: token, environment: "test" });
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(200);
  });

  it("fails readiness when configuration is absent", async () => {
    app = await buildApp({ apiToken: "", environment: "test" });
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(503);
  });

  it("protects pet creation", async () => {
    app = await buildApp({ apiToken: token, environment: "test" });
    expect((await app.inject({ method: "POST", url: "/v1/pets", payload: { name: "Milo", species: "cat" } })).statusCode).toBe(401);
  });

  it("creates and returns an owner-bound pet profile", async () => {
    app = await buildApp({ apiToken: token, environment: "test" });
    const created = await app.inject({
      method: "POST", url: "/v1/pets",
      headers: { authorization: `Bearer ${token}`, "x-virtuapet-user-id": guardian },
      payload: { name: "Milo", species: "cat" }
    });
    expect(created.statusCode).toBe(201);
    const pet = created.json();
    const ownRead = await app.inject({ method: "GET", url: `/v1/pets/${pet.petId}`, headers: { authorization: `Bearer ${token}`, "x-virtuapet-user-id": guardian } });
    const strangerRead = await app.inject({ method: "GET", url: `/v1/pets/${pet.petId}`, headers: { authorization: `Bearer ${token}`, "x-virtuapet-user-id": stranger } });
    expect(ownRead.statusCode).toBe(200);
    expect(strangerRead.statusCode).toBe(404);
  });

  it("publishes honest capability states", async () => {
    app = await buildApp({ apiToken: token, environment: "test" });
    const response = await app.inject({ method: "GET", url: "/v1/platform/capabilities" });
    expect(response.statusCode).toBe(200);
    expect(response.json().capabilities.some((item: { id: string; status: string }) => item.id === "surgical-rehearsal" && item.status === "research_and_validation")).toBe(true);
  });
});
