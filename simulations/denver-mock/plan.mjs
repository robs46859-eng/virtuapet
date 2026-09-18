import { readFile } from "node:fs/promises";
import { buildWorkflowPlan } from "./workflow.mjs";

const root = new URL("./", import.meta.url);
const config = JSON.parse(await readFile(new URL("config.json", root), "utf8"));
const cases = JSON.parse(await readFile(new URL("cases.json", root), "utf8"));
process.stdout.write(`${JSON.stringify(buildWorkflowPlan(config, cases), null, 2)}\n`);
