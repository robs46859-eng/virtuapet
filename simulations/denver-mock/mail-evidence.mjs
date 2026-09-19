import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const MAX_EML_BYTES = 2 * 1024 * 1024;
const MAX_MIME_DEPTH = 8;
const EMAIL_PATTERN = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]{0,251}[A-Z0-9])?/gi;
const CREDENTIAL_PATTERN = /\b(?:password|passwd|passcode|credential|api[ _-]?key|secret|bearer|access[ _-]?token)\b/i;
const CLINICAL_PATTERN = /\b(?:diagnos(?:is|ed)|prescription|prescribed|dosage|medication|surgery|medical record|treatment plan|symptoms?|lab results?|patient history)\b/i;

export class MailEvidenceError extends Error {
  constructor(code) {
    super(code);
    this.name = "MailEvidenceError";
    this.code = code;
  }
}

function fail(code) {
  throw new MailEvidenceError(code);
}

function normalizeAddress(value) {
  return value.trim().toLowerCase();
}

function validAddress(value) {
  return typeof value === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export function validateMailRoster(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("invalid_roster");
  if (Object.keys(value).sort().join(",") !== "authorizedRecipients,credentialsStored,sender") fail("invalid_roster_shape");
  if (value.credentialsStored !== false) fail("roster_must_not_store_credentials");
  if (!validAddress(value.sender)) fail("invalid_roster_sender");
  if (!Array.isArray(value.authorizedRecipients) || value.authorizedRecipients.length !== 8) fail("invalid_roster_recipient_count");
  if (!value.authorizedRecipients.every(validAddress)) fail("invalid_roster_recipient");

  const sender = normalizeAddress(value.sender);
  const authorizedRecipients = value.authorizedRecipients.map(normalizeAddress);
  if (new Set(authorizedRecipients).size !== authorizedRecipients.length) fail("duplicate_roster_recipient");
  if (authorizedRecipients.includes(sender)) fail("sender_cannot_be_recipient");
  return Object.freeze({ sender, authorizedRecipients: Object.freeze(authorizedRecipients), credentialsStored: false });
}

export async function loadMailRoster(path) {
  try {
    return validateMailRoster(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error instanceof MailEvidenceError) throw error;
    fail("roster_unreadable");
  }
}

export function createMailRunId(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) fail("invalid_run_time");
  const stamp = now.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  return `mail-${stamp}-${randomUUID().slice(0, 8)}`;
}

function validateRunId(runId) {
  if (typeof runId !== "string" || !/^mail-\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(runId)) fail("invalid_run_id");
  return runId;
}

export function generateMailPlan(rosterValue, participantNumber, options = {}) {
  const roster = validateMailRoster(rosterValue);
  if (!Number.isInteger(participantNumber) || participantNumber < 1 || participantNumber > roster.authorizedRecipients.length) {
    fail("participant_not_allowlisted");
  }
  const runId = validateRunId(options.runId ?? createMailRunId(options.now));
  const subject = `[SIMULATION] MyPets Denver mail round trip - ${runId}`;
  const body = [
    "SIMULATION - TEST MESSAGE ONLY",
    "",
    "This message checks authorized mailbox delivery for the private MyPets Denver simulation.",
    `Run ID: ${runId}`,
    "",
    "Reply with exactly:",
    `[SIMULATION RECEIVED] ${runId}`,
    "",
    "No private information is included in this test."
  ].join("\n");
  return Object.freeze({
    runId,
    participantNumber,
    from: roster.sender,
    to: roster.authorizedRecipients[participantNumber - 1],
    subject,
    body,
    sendsMail: false
  });
}

function parseHeaderBlock(source) {
  const boundary = source.match(/\r?\n\r?\n/);
  if (!boundary || boundary.index === undefined) fail("eml_missing_header_boundary");
  const headerText = source.slice(0, boundary.index);
  const body = source.slice(boundary.index + boundary[0].length);
  const unfolded = [];
  for (const line of headerText.split(/\r?\n/)) {
    if (/^[ \t]/.test(line)) {
      if (unfolded.length === 0) fail("eml_invalid_header_folding");
      unfolded[unfolded.length - 1] += ` ${line.trim()}`;
    } else {
      unfolded.push(line);
    }
  }
  const headers = new Map();
  for (const line of unfolded) {
    const separator = line.indexOf(":");
    if (separator < 1) fail("eml_invalid_header");
    const name = line.slice(0, separator).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(name)) fail("eml_invalid_header_name");
    const values = headers.get(name) ?? [];
    values.push(line.slice(separator + 1).trim());
    headers.set(name, values);
  }
  return { headers, body };
}

function singleHeader(headers, name, required = true) {
  const values = headers.get(name.toLowerCase()) ?? [];
  if (values.length === 0 && !required) return "";
  if (values.length !== 1) fail(`eml_${name.toLowerCase()}_header_required_once`);
  return values[0];
}

function decodeEncodedWords(value) {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_whole, charset, encoding, encoded) => {
    if (!/^(?:utf-8|us-ascii)$/i.test(charset)) fail("eml_unsupported_header_encoding");
    try {
      if (encoding.toLowerCase() === "b") return Buffer.from(encoded, "base64").toString("utf8");
      const quoted = encoded.replaceAll("_", " ").replace(/=([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
      return Buffer.from(quoted, "binary").toString("utf8");
    } catch {
      fail("eml_invalid_header_encoding");
    }
  });
}

function extractAddresses(value, headerName) {
  const addresses = (value.match(EMAIL_PATTERN) ?? []).map(normalizeAddress);
  if (addresses.length === 0) fail(`eml_${headerName}_address_required`);
  if (new Set(addresses).size !== addresses.length) fail(`eml_${headerName}_duplicate_address`);
  return addresses;
}

function decodeQuotedPrintable(value) {
  return value.replace(/=\r?\n/g, "").replace(/=([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodeTransfer(value, encoding) {
  const normalized = encoding.trim().toLowerCase();
  if (!normalized || normalized === "7bit" || normalized === "8bit" || normalized === "binary") return value;
  if (normalized === "quoted-printable") return Buffer.from(decodeQuotedPrintable(value), "binary").toString("utf8");
  if (normalized === "base64") {
    const compact = value.replace(/\s/g, "");
    if (!/^[a-z0-9+/]*={0,2}$/i.test(compact) || compact.length % 4 !== 0) fail("eml_invalid_base64_body");
    return Buffer.from(compact, "base64").toString("utf8");
  }
  fail("eml_unsupported_transfer_encoding");
}

function boundaryParameter(contentType) {
  const match = contentType.match(/(?:^|;)\s*boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
  return match?.[1] ?? match?.[2] ?? "";
}

function splitMultipart(body, boundary) {
  if (!boundary || /[\r\n]/.test(boundary)) fail("eml_invalid_mime_boundary");
  const marker = `--${boundary}`;
  const closing = `${marker}--`;
  const parts = [];
  let current = null;
  for (const line of body.split(/\r?\n/)) {
    if (line === marker) {
      if (current !== null) parts.push(current.join("\n"));
      current = [];
      continue;
    }
    if (line === closing) {
      if (current !== null) parts.push(current.join("\n"));
      current = null;
      break;
    }
    if (current !== null) current.push(line);
  }
  if (parts.length === 0) fail("eml_multipart_body_missing");
  return parts;
}

function htmlToText(value) {
  const entities = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"' };
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&(?:nbsp|amp|lt|gt|quot);/gi, entity => entities[entity.toLowerCase()] ?? " ");
}

function extractTextFromEntity(source, depth = 0) {
  if (depth > MAX_MIME_DEPTH) fail("eml_mime_depth_exceeded");
  const { headers, body } = parseHeaderBlock(source);
  const disposition = singleHeader(headers, "content-disposition", false).toLowerCase();
  if (disposition.startsWith("attachment")) fail("eml_attachments_not_allowed");
  const contentTypeHeader = singleHeader(headers, "content-type", false) || "text/plain";
  const contentType = contentTypeHeader.split(";", 1)[0].trim().toLowerCase();
  if (contentType.startsWith("multipart/")) {
    return splitMultipart(body, boundaryParameter(contentTypeHeader)).map(part => extractTextFromEntity(part, depth + 1)).join("\n");
  }
  if (contentType !== "text/plain" && contentType !== "text/html") fail("eml_unsupported_mime_content");
  const decoded = decodeTransfer(body, singleHeader(headers, "content-transfer-encoding", false));
  return contentType === "text/html" ? htmlToText(decoded) : decoded;
}

function parseMessageId(value, code) {
  const matches = value.match(/<[^<>\s]+@[^<>\s]+>/g) ?? [];
  if (matches.length !== 1) fail(code);
  return matches[0];
}

function parseReferenceIds(value, code) {
  const matches = value.match(/<[^<>\s]+@[^<>\s]+>/g) ?? [];
  if (matches.length === 0) fail(code);
  return matches;
}

function canonicalReplySubject(value) {
  return decodeEncodedWords(value).trim().replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/i, "");
}

function parseMessage(source) {
  if (typeof source !== "string" || Buffer.byteLength(source) === 0 || Buffer.byteLength(source) > MAX_EML_BYTES) fail("eml_invalid_size");
  const { headers } = parseHeaderBlock(source);
  const from = extractAddresses(singleHeader(headers, "from"), "from");
  const to = extractAddresses(singleHeader(headers, "to"), "to");
  const ccValue = singleHeader(headers, "cc", false);
  const bccValue = singleHeader(headers, "bcc", false);
  const cc = ccValue ? extractAddresses(ccValue, "cc") : [];
  const bcc = bccValue ? extractAddresses(bccValue, "bcc") : [];
  const subject = decodeEncodedWords(singleHeader(headers, "subject"));
  const messageId = parseMessageId(singleHeader(headers, "message-id"), "eml_invalid_message_id");
  const dateMs = Date.parse(singleHeader(headers, "date"));
  if (!Number.isFinite(dateMs)) fail("eml_invalid_date");
  return { headers, from, to, cc, bcc, subject, messageId, dateMs, text: extractTextFromEntity(source) };
}

function requireSingleEndpoint(addresses, expected, code) {
  if (addresses.length !== 1 || addresses[0] !== expected) fail(code);
}

function checkSafeContent(subject, text) {
  const searchable = `${subject}\n${text}`;
  if (CREDENTIAL_PATTERN.test(searchable)) fail("eml_contains_credential_content");
  if (CLINICAL_PATTERN.test(searchable)) fail("eml_contains_clinical_content");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyMailRoundTrip({ roster: rosterValue, participantNumber, runId, originalEml, replyEml }) {
  const roster = validateMailRoster(rosterValue);
  const plan = generateMailPlan(roster, participantNumber, { runId });
  const original = parseMessage(originalEml);
  const reply = parseMessage(replyEml);

  requireSingleEndpoint(original.from, plan.from, "original_sender_not_allowlisted");
  requireSingleEndpoint(original.to, plan.to, "original_recipient_not_allowlisted");
  requireSingleEndpoint(reply.from, plan.to, "reply_sender_not_allowlisted");
  requireSingleEndpoint(reply.to, plan.from, "reply_recipient_not_allowlisted");
  if (original.cc.length > 0 || reply.cc.length > 0 || original.bcc.length > 0 || reply.bcc.length > 0) fail("additional_recipients_not_allowed");

  if (original.subject !== plan.subject || canonicalReplySubject(reply.subject) !== plan.subject) fail("eml_subject_mismatch");
  if (!original.subject.includes(runId) || !reply.subject.includes(runId) || !original.text.includes(runId) || !reply.text.includes(runId)) fail("eml_run_id_mismatch");
  if (!original.text.includes("SIMULATION - TEST MESSAGE ONLY")) fail("original_simulation_label_missing");
  if (!reply.text.includes(`[SIMULATION RECEIVED] ${runId}`)) fail("reply_confirmation_missing");

  if (reply.messageId === original.messageId) fail("message_ids_not_distinct");
  const inReplyToValue = singleHeader(reply.headers, "in-reply-to", false);
  const referencesValue = singleHeader(reply.headers, "references", false);
  if (!inReplyToValue) fail("reply_in_reply_to_missing");
  if (!referencesValue) fail("reply_references_missing");
  const inReplyTo = parseReferenceIds(inReplyToValue, "reply_in_reply_to_missing");
  const references = parseReferenceIds(referencesValue, "reply_references_missing");
  if (!inReplyTo.includes(original.messageId)) fail("reply_in_reply_to_mismatch");
  if (!references.includes(original.messageId)) fail("reply_references_mismatch");
  if (reply.dateMs + 5 * 60_000 < original.dateMs) fail("reply_date_before_original");

  checkSafeContent(original.subject, original.text);
  checkSafeContent(reply.subject, reply.text);

  return Object.freeze({
    status: "verified",
    runId,
    participantNumber,
    subject: plan.subject,
    originalSha256: sha256(originalEml),
    replySha256: sha256(replyEml),
    originalDate: new Date(original.dateMs).toISOString(),
    replyDate: new Date(reply.dateMs).toISOString(),
    messageIdsDistinct: true,
    threadingVerified: true,
    endpointsAllowlisted: true,
    safeContentVerified: true
  });
}
