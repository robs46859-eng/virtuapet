import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWorkflowPlan, validateCases, validateClinicConfig } from "./workflow.mjs";

const root = new URL("./", import.meta.url);
const config = JSON.parse(await readFile(new URL("config.json", root), "utf8"));
const cases = JSON.parse(await readFile(new URL("cases.json", root), "utf8"));

test("safe configuration and all eight pseudonymous cases produce a side-effect-free plan", () => {
  const plan = buildWorkflowPlan(config, cases);
  assert.equal(plan.cases.length, 8);
  assert.equal(plan.externalSideEffects, false);
  assert.equal(plan.stripeMode, "sandbox");
  assert.equal(plan.mailMode, "disabled");
  assert.ok(plan.cases.every(item => item.status === "planned"));
  assert.ok(plan.cases.every(item => !JSON.stringify(item).includes("@")));
});

test("unsafe payment, mail, clinical and visibility settings fail closed", () => {
  for (const mutation of [
    { stripe: { ...config.stripe, livemode: true } },
    { outboundMail: { ...config.outboundMail, enabled: true } },
    { realClinicalCare: true },
    { visibility: "public" },
    { invasiveProcedures: "onsite" }
  ]) assert.throws(() => validateClinicConfig({ ...config, ...mutation }));
});

test("contact fields, duplicate participants and unknown workflows are rejected", () => {
  assert.throws(() => validateCases(cases.map((item, index) => index ? item : { ...item, email: "not-allowed@example.test" })));
  assert.throws(() => validateCases(cases.map((item, index) => index === 1 ? { ...item, participantId: cases[0].participantId } : item)));
  assert.throws(() => validateCases(cases.map((item, index) => index ? item : { ...item, scenario: "real-surgery" })));
});
