import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMailRunId, generateMailPlan, loadMailRoster, MailEvidenceError,
  validateMailRoster, verifyMailRoundTrip
} from "./mail-evidence.mjs";

const domain = ["example", "invalid"].join(".");
const mailbox = name => `${name}@${domain}`;
const roster = () => ({
  sender: mailbox("sender"),
  authorizedRecipients: Array.from({ length: 8 }, (_value, index) => mailbox(`participant-${index + 1}`)),
  credentialsStored: false
});
const runId = "mail-20260918T120000Z-abcdef12";

function message({ from, to, subject, messageId, date, body, inReplyTo, references, cc }) {
  return [
    `From: ${from}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${date}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body
  ].join("\r\n");
}

function validPair() {
  const plan = generateMailPlan(roster(), 1, { runId });
  const originalId = "<original.abcdef@example.invalid>";
  const original = message({
    from: plan.from, to: plan.to, subject: plan.subject, messageId: originalId,
    date: "Fri, 18 Sep 2026 12:00:00 -0600", body: plan.body
  });
  const reply = message({
    from: plan.to, to: plan.from, subject: `Re: ${plan.subject}`, messageId: "<reply.abcdef@example.invalid>",
    date: "Fri, 18 Sep 2026 12:02:00 -0600", inReplyTo: originalId,
    references: `<older.thread@example.invalid>\r\n\t${originalId}`,
    body: `[SIMULATION RECEIVED] ${runId}`
  });
  return { plan, original, reply };
}

test("loads a strict credential-free roster and generates unique non-sending plans", async () => {
  const directory = await mkdtemp(join(tmpdir(), "virtuapet-mail-"));
  try {
    const path = join(directory, "roster.json");
    await writeFile(path, JSON.stringify(roster()), { mode: 0o600 });
    const loaded = await loadMailRoster(path);
    assert.equal(loaded.authorizedRecipients.length, 8);
    const first = generateMailPlan(loaded, 1);
    const second = generateMailPlan(loaded, 1);
    assert.notEqual(first.runId, second.runId);
    assert.match(first.subject, /^\[SIMULATION\]/);
    assert.match(first.body, new RegExp(first.runId));
    assert.equal(first.sendsMail, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("fails closed on unsafe roster data or a recipient outside its eight entries", () => {
  assert.throws(() => validateMailRoster({ ...roster(), credentialsStored: true }), error => error instanceof MailEvidenceError && error.code === "roster_must_not_store_credentials");
  assert.throws(() => validateMailRoster({ ...roster(), authorizedRecipients: roster().authorizedRecipients.slice(0, 7) }), error => error.code === "invalid_roster_recipient_count");
  const duplicate = roster(); duplicate.authorizedRecipients[7] = duplicate.authorizedRecipients[0];
  assert.throws(() => validateMailRoster(duplicate), error => error.code === "duplicate_roster_recipient");
  assert.throws(() => generateMailPlan(roster(), 9), error => error.code === "participant_not_allowlisted");
});

test("verifies the labeled allowlisted reply thread and produces content hashes", () => {
  const { original, reply } = validPair();
  const result = verifyMailRoundTrip({ roster: roster(), participantNumber: 1, runId, originalEml: original, replyEml: reply });
  assert.deepEqual(
    { status: result.status, threading: result.threadingVerified, endpoints: result.endpointsAllowlisted, safe: result.safeContentVerified },
    { status: "verified", threading: true, endpoints: true, safe: true }
  );
  assert.match(result.originalSha256, /^[a-f0-9]{64}$/);
  assert.match(result.replySha256, /^[a-f0-9]{64}$/);
  assert.notEqual(result.originalSha256, result.replySha256);
});

test("rejects broken threading, labels, dates, endpoints, and unsafe content", () => {
  const { original, reply, plan } = validPair();
  const foreign = mailbox("not-allowlisted");
  const otherRunId = "mail-20260918T120000Z-deadbeef";
  const cases = [
    ["message_ids_not_distinct", original, reply.replace("<reply.abcdef@example.invalid>", "<original.abcdef@example.invalid>")],
    ["reply_in_reply_to_missing", original, reply.replace(/^In-Reply-To:.*\r\n/m, "")],
    ["reply_references_missing", original, reply.replace(/^References:.*\r\n\t.*\r\n/m, "")],
    ["eml_subject_mismatch", original, reply.replace(plan.subject, `[SIMULATION] Different subject - ${runId}`)],
    ["eml_run_id_mismatch", original, reply.replace(`[SIMULATION RECEIVED] ${runId}`, `[SIMULATION RECEIVED] ${otherRunId}`)],
    ["eml_date_header_required_once", original, reply.replace(/^Date:.*\r\n/m, "")],
    ["reply_sender_not_allowlisted", original, reply.replace(plan.to, foreign)],
    ["eml_contains_credential_content", `${original}\npassword: unsafe`, reply],
    ["eml_contains_clinical_content", `${original}\nprescription dosage details`, reply]
  ];
  for (const [expected, originalEml, replyEml] of cases) {
    assert.throws(
      () => verifyMailRoundTrip({ roster: roster(), participantNumber: 1, runId, originalEml, replyEml }),
      error => error instanceof MailEvidenceError && error.code === expected,
      expected
    );
  }
});

test("creates only constrained opaque run identifiers", () => {
  assert.match(createMailRunId(new Date("2026-09-18T12:00:00.000Z")), /^mail-20260918T120000Z-[a-f0-9]{8}$/);
  assert.throws(() => generateMailPlan(roster(), 1, { runId: "../../unsafe" }), error => error.code === "invalid_run_id");
});
