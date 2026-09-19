const allowedSpecies = new Set(["dog", "cat"]);
const allowedScenarios = new Set([
  "intake-consent-wellness",
  "inventory-estimate-sandbox-payment",
  "manual-fgs-review",
  "referral-record-share-follow-up",
  "reminder-reschedule",
  "sandbox-decline-retry-receipt",
  "consent-revocation-denial",
  "recall-regulation-review-cancel-refund"
]);

export function validateClinicConfig(config) {
  const problems = [];
  if (config?.simulationOnly !== true) problems.push("simulationOnly must be true");
  if (config?.visibility !== "private") problems.push("visibility must be private");
  if (config?.stripe?.livemode !== false) problems.push("Stripe must remain in sandbox mode");
  if (config?.outboundMail?.enabled !== false) problems.push("outbound mail must start disabled");
  if (config?.realClinicalCare !== false) problems.push("real clinical care must be disabled");
  if (config?.invasiveProcedures !== "referral-only") problems.push("invasive procedures must be referral-only");
  if (config?.clock?.initialState !== "paused") problems.push("simulation clock must start paused");
  if (!Number.isFinite(config?.clock?.multiplier) || config.clock.multiplier <= 0 || config.clock.multiplier > 1440) problems.push("clock multiplier must be between 0 and 1440");
  if (problems.length) throw new Error(problems.join("; "));
  return config;
}

export function validateCases(cases) {
  if (!Array.isArray(cases) || cases.length !== 8) throw new Error("exactly eight fictional cases are required");
  const ids = new Set();
  const pets = new Set();
  for (const item of cases) {
    if (!/^participant-0[1-8]$/.test(item.participantId)) throw new Error("participant IDs must be pseudonymous");
    if (ids.has(item.participantId)) throw new Error("participant IDs must be unique");
    if (pets.has(item.pet)) throw new Error("pet names must be unique");
    if (!allowedSpecies.has(item.species)) throw new Error("unsupported fictional species");
    if (!allowedScenarios.has(item.scenario)) throw new Error("unsupported workflow scenario");
    if (!Number.isInteger(item.offsetMinutes) || item.offsetMinutes < 0) throw new Error("offsetMinutes must be a nonnegative integer");
    if (Object.keys(item).some(key => /email|password|secret|token/i.test(key))) throw new Error("case files cannot contain credentials or contact data");
    ids.add(item.participantId);
    pets.add(item.pet);
  }
  return cases;
}

export function buildWorkflowPlan(config, cases, start = "2026-09-21T14:00:00.000Z") {
  validateClinicConfig(config);
  validateCases(cases);
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) throw new Error("invalid simulation start");
  return {
    simulationId: config.id,
    label: "SIMULATION — NOT VALID FOR CLINICAL OR LEGAL USE",
    generatedFor: "planning-only",
    externalSideEffects: false,
    stripeMode: "sandbox",
    mailMode: "disabled",
    cases: cases.map(item => ({
      ...item,
      scheduledAt: new Date(startMs + item.offsetMinutes * 60_000).toISOString(),
      requiredEvidence: ["authenticated-request", "returned-record-id", "authorization-result", "audit-event"],
      status: "planned"
    }))
  };
}
