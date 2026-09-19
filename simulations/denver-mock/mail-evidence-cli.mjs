#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateMailPlan, loadMailRoster, MailEvidenceError, verifyMailRoundTrip } from "./mail-evidence.mjs";

const defaultRosterPath = fileURLToPath(new URL(".env.participants.json", import.meta.url));

function usage() {
  return [
    "Prepare a message without sending:",
    "  node simulations/denver-mock/mail-evidence-cli.mjs generate --participant 1",
    "",
    "Verify two exported messages:",
    "  node simulations/denver-mock/mail-evidence-cli.mjs verify --participant 1 --run-id <id> --original <sent.eml> --reply <reply.eml>",
    "",
    "Optional: --roster <ignored-roster.json>"
  ].join("\n");
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) throw new MailEvidenceError("invalid_cli_arguments");
    if (Object.hasOwn(options, flag)) throw new MailEvidenceError("duplicate_cli_argument");
    options[flag] = value;
  }
  return options;
}

async function main(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const command = argv[0];
  const options = parseOptions(argv.slice(1));
  const participantNumber = Number(options["--participant"]);
  const roster = await loadMailRoster(resolve(options["--roster"] ?? defaultRosterPath));

  if (command === "generate") {
    const plan = generateMailPlan(roster, participantNumber, options["--run-id"] ? { runId: options["--run-id"] } : {});
    process.stdout.write(`${JSON.stringify({
      runId: plan.runId,
      participantNumber: plan.participantNumber,
      sender: "designated sender from ignored roster",
      recipient: `authorized recipient ${plan.participantNumber}`,
      subject: plan.subject,
      body: plan.body,
      sendsMail: false
    }, null, 2)}\n`);
    return;
  }

  if (command === "verify") {
    const runId = options["--run-id"];
    const originalPath = options["--original"];
    const replyPath = options["--reply"];
    if (!runId || !originalPath || !replyPath) throw new MailEvidenceError("missing_verification_argument");
    const result = verifyMailRoundTrip({
      roster,
      participantNumber,
      runId,
      originalEml: await readFile(resolve(originalPath), "utf8"),
      replyEml: await readFile(resolve(replyPath), "utf8")
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  throw new MailEvidenceError("unknown_mail_evidence_command");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    const code = error instanceof MailEvidenceError ? error.code : "mail_evidence_failed";
    process.stderr.write(`Mail evidence failed: ${code}\n`);
    process.exitCode = 1;
  });
}
