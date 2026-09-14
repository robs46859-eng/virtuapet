import { buildApp } from "./app.js";
import { PostgresPetRepository } from "./postgres-repository.js";

const repository = process.env.DATABASE_URL ? PostgresPetRepository.fromConnectionString(process.env.DATABASE_URL) : undefined;
const app = await buildApp(repository ? { repository } : {});
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
