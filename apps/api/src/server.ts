import { buildApp } from "./app.js";
import { PostgresPetRepository } from "./postgres-repository.js";
import { Pool } from "pg";
import { PostgreSQLIdentityLinkStore } from "./integrations/identity-link-store.js";
import { identityLinksFromEnvironment } from "./integrations/bootstrap.js";

const repository = process.env.DATABASE_URL ? PostgresPetRepository.fromConnectionString(process.env.DATABASE_URL) : undefined;
// Separate pool, same least-privilege runtime account. Identity store operations
// always establish tenant/user context inside a single database transaction.
const identityPool = process.env.LAYER8_IDENTITY_LINKS_ENABLED === "true" && process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 }) : undefined;
const identityLinks = identityLinksFromEnvironment(identityPool ? new PostgreSQLIdentityLinkStore(identityPool) : undefined);
const app = await buildApp({ ...(repository ? { repository } : {}), ...(identityLinks ? { identityLinks } : {}) });
if (identityPool) app.addHook("onClose", async () => identityPool.end());
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
