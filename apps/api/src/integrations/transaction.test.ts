import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationContext } from "./context.js";
import { withIntegrationTransaction } from "./transaction.js";

const context: IntegrationContext = {
  userId: randomUUID(), tenantId: randomUUID(), correlationId: randomUUID(), roles: ["vet_staff"]
};
function connection() {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn().mockResolvedValue(client);
  return { pool: { connect } as unknown as Pick<Pool, "connect">, client, connect, query, release };
}

describe("integration transaction context", () => {
  it("sets bound transaction-local identity and commits using the same pooled client", async () => {
    const fixture = connection();
    await expect(withIntegrationTransaction(fixture.pool, context, async client => {
      expect(client).toBe(fixture.client);
      await client.query("SELECT controlled_work");
      return "done";
    })).resolves.toBe("done");
    expect(fixture.connect).toHaveBeenCalledTimes(1);
    expect(fixture.query.mock.calls).toEqual([
      ["BEGIN"],
      ["SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.correlation_id', $3, true)",
        [context.tenantId, context.userId, context.correlationId]],
      ["SELECT controlled_work"], ["COMMIT"]
    ]);
    expect(fixture.release).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("rolls back callback errors and releases the connection", async () => {
    const fixture = connection();
    const error = new Error("work failed");
    await expect(withIntegrationTransaction(fixture.pool, context, async () => { throw error; })).rejects.toBe(error);
    expect(fixture.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(fixture.release).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("discards a connection when rollback fails and preserves the original error", async () => {
    const fixture = connection();
    fixture.query.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("connection lost");
      return { rows: [] };
    });
    const original = new Error("work failed");
    await expect(withIntegrationTransaction(fixture.pool, context, async () => { throw original; })).rejects.toBe(original);
    expect(fixture.release).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  });

  it("rolls back a commit failure", async () => {
    const fixture = connection();
    fixture.query.mockImplementation(async (sql: string) => {
      if (sql === "COMMIT") throw new Error("commit failed");
      return { rows: [] };
    });
    await expect(withIntegrationTransaction(fixture.pool, context, async () => "done")).rejects.toThrow("commit failed");
    expect(fixture.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(fixture.release).toHaveBeenCalledOnce();
  });

  it.each([
    { ...context, tenantId: "bad" }, { ...context, userId: "bad" },
    { ...context, correlationId: "bad" }, { ...context, roles: [] },
    { ...context, bypassRls: true }
  ])("rejects invalid or extra context before connecting %#", async invalid => {
    const fixture = connection();
    await expect(withIntegrationTransaction(fixture.pool, invalid, async () => "unreachable")).rejects.toThrow();
    expect(fixture.connect).not.toHaveBeenCalled();
  });
});
