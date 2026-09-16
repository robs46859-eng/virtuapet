import type { Pool, PoolClient } from "pg";
import { integrationContextSchema, type IntegrationContext } from "./context.js";

/** All work must use the supplied client; pool.query() would escape this transaction. */
export async function withIntegrationTransaction<T>(
  pool: Pick<Pool, "connect">,
  context: IntegrationContext,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const checked = integrationContextSchema.parse(context);
  const client = await pool.connect();
  let discard: Error | undefined;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.correlation_id', $3, true)",
      [checked.tenantId, checked.userId, checked.correlationId]
    );
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Never return a connection with unknown transaction state to the pool.
      discard = new Error("Integration transaction rollback failed");
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
