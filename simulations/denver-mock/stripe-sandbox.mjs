import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const FIXTURE_MARKER = "denver-mock-stripe-acceptance-v1";
const DECLINED_TEST_PAYMENT_METHOD = "pm_card_visa_chargeDeclined";
const DEFAULT_CONFIG_URL = new URL("config.json", import.meta.url);
const DEFAULT_OUTPUT_DIR_URL = new URL("results/", import.meta.url);
const MAX_LIST_PAGES = 25;

export class StripeSandboxError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "StripeSandboxError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new StripeSandboxError(code, message, details);
}

function validateConfig(config) {
  if (config?.id !== "denver-mock") fail("UNSAFE_CONFIG", "The harness only accepts the Denver Mock simulation configuration");
  if (config?.simulationOnly !== true) fail("UNSAFE_CONFIG", "simulationOnly must be true");
  if (config?.stripe?.livemode !== false) fail("LIVE_MODE_BLOCKED", "Stripe livemode must be false");
  if (!/^acct_[A-Za-z0-9]+$/.test(config?.stripe?.accountId ?? "")) fail("UNSAFE_CONFIG", "A configured Stripe account id is required");
  return config;
}

function validateTestSecret(secretKey) {
  if (typeof secretKey !== "string" || !secretKey.startsWith("sk_test_") || secretKey.length < 12 || /\s/.test(secretKey)) {
    fail("TEST_KEY_REQUIRED", "A Stripe test-mode secret key is required");
  }
}

function validateRunId(runId) {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(runId)) fail("INVALID_RUN_ID", "run id must use 8-80 safe characters");
  return runId;
}

function assertTestObject(label, object) {
  if (!object || object.livemode !== false) fail("LIVE_OBJECT_BLOCKED", `${label} was not verified as a test-mode object`);
  return object;
}

function fixtureMetadata(config) {
  return {
    virtuapet_fixture: FIXTURE_MARKER,
    simulation_id: config.id,
    simulation_only: "true"
  };
}

function hasFixtureMetadata(object, config) {
  const expected = fixtureMetadata(config);
  return Object.entries(expected).every(([key, value]) => object?.metadata?.[key] === value);
}

function assertFixtureObject(label, object, config) {
  assertTestObject(label, object);
  if (!object.id || !hasFixtureMetadata(object, config)) {
    fail("FIXTURE_TAG_MISSING", `${label} did not return the required simulation metadata`);
  }
  return object;
}

function appendParams(target, params = {}) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) target.append(`${key}[]`, String(item));
    } else {
      target.append(key, typeof value === "boolean" ? String(value) : String(value));
    }
  }
}

function safeProviderToken(value) {
  return typeof value === "string" && /^[a-z0-9_]{1,64}$/.test(value) ? value : undefined;
}

function safeApiError(response, data) {
  const providerError = data?.error ?? {};
  return new StripeSandboxError("STRIPE_API_ERROR", "Stripe rejected a sandbox request", {
    httpStatus: response.status,
    type: safeProviderToken(providerError.type),
    code: safeProviderToken(providerError.code),
    declineCode: safeProviderToken(providerError.decline_code),
    paymentIntentId: typeof providerError.payment_intent?.id === "string" ? providerError.payment_intent.id : undefined
  });
}

export function createStripeRestClient({ secretKey, fetchImpl = globalThis.fetch, apiBase = STRIPE_API_BASE }) {
  validateTestSecret(secretKey);
  if (typeof fetchImpl !== "function") fail("FETCH_UNAVAILABLE", "A fetch implementation is required");
  if (apiBase !== STRIPE_API_BASE) fail("UNSAFE_API_BASE", "Stripe requests must use the pinned HTTPS API endpoint");

  return {
    async request(method, path, { params, idempotencyKey, expectedStatuses = [200] } = {}) {
      if (method === "POST" && !idempotencyKey) {
        fail("IDEMPOTENCY_KEY_REQUIRED", "Every Stripe POST must include an idempotency key");
      }
      const url = new URL(`${apiBase}${path}`);
      const headers = {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json"
      };
      const options = { method, headers, redirect: "error", signal: AbortSignal.timeout(15_000) };

      if (method === "GET") {
        appendParams(url.searchParams, params);
      } else if (params) {
        const body = new URLSearchParams();
        appendParams(body, params);
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        options.body = body;
      }
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

      let response;
      try {
        response = await fetchImpl(url, options);
      } catch {
        fail("STRIPE_NETWORK_ERROR", "Stripe sandbox could not be reached");
      }

      let data;
      try {
        data = await response.json();
      } catch {
        fail("INVALID_STRIPE_RESPONSE", "Stripe returned a non-JSON response", { httpStatus: response.status });
      }
      if (!expectedStatuses.includes(response.status)) throw safeApiError(response, data);
      return { status: response.status, data };
    }
  };
}

async function listAll(client, path, params = {}) {
  const items = [];
  let startingAfter;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const { data } = await client.request("GET", path, {
      params: { ...params, limit: 100, starting_after: startingAfter }
    });
    if (!Array.isArray(data?.data)) fail("INVALID_STRIPE_RESPONSE", "Stripe returned an invalid list response");
    items.push(...data.data);
    if (!data.has_more) return items;
    startingAfter = data.data.at(-1)?.id;
    if (!startingAfter) fail("INVALID_STRIPE_RESPONSE", "Stripe pagination did not include a continuation id");
  }
  fail("STRIPE_LIST_LIMIT", "Stripe fixture lookup exceeded the safe page limit");
}

function metadataParams(config, extra = {}) {
  return Object.fromEntries(
    Object.entries({ ...fixtureMetadata(config), ...extra }).map(([key, value]) => [`metadata[${key}]`, value])
  );
}

async function findOrCreateCustomer(client, config) {
  const customers = await listAll(client, "/customers");
  const existing = customers.find(item => !item.deleted && hasFixtureMetadata(item, config));
  if (existing) return { object: assertFixtureObject("customer", existing, config), reused: true };

  const { data } = await client.request("POST", "/customers", {
    idempotencyKey: `vp-${FIXTURE_MARKER}-customer`,
    params: {
      name: "MyPets Denver Simulation",
      description: "VirtuaPet Denver Mock Stripe acceptance fixture",
      ...metadataParams(config)
    }
  });
  return { object: assertFixtureObject("customer", data, config), reused: false };
}

async function findOrCreateProduct(client, config) {
  const products = await listAll(client, "/products", { active: true });
  const existing = products.find(item => item.active !== false && hasFixtureMetadata(item, config));
  if (existing) return { object: assertFixtureObject("product", existing, config), reused: true };

  const { data } = await client.request("POST", "/products", {
    idempotencyKey: `vp-${FIXTURE_MARKER}-product`,
    params: {
      name: "VirtuaPet Denver Mock Simulation",
      description: "Zero-dollar recurring acceptance fixture; no clinical services",
      ...metadataParams(config)
    }
  });
  return { object: assertFixtureObject("product", data, config), reused: false };
}

async function findOrCreatePrice(client, config, productId) {
  const prices = await listAll(client, "/prices", { active: true, product: productId, type: "recurring" });
  const existing = prices.find(item =>
    hasFixtureMetadata(item, config) &&
    item.active !== false &&
    item.product === productId &&
    item.currency === "usd" &&
    item.unit_amount === 0 &&
    item.recurring?.interval === "month"
  );
  if (existing) return { object: assertFixtureObject("price", existing, config), reused: true };

  const { data } = await client.request("POST", "/prices", {
    idempotencyKey: `vp-${FIXTURE_MARKER}-${productId}-price`,
    params: {
      product: productId,
      currency: "usd",
      unit_amount: 0,
      "recurring[interval]": "month",
      nickname: "Denver Mock $0 monthly acceptance",
      ...metadataParams(config)
    }
  });
  const price = assertFixtureObject("price", data, config);
  if (price.product !== productId || price.currency !== "usd" || price.unit_amount !== 0 || price.recurring?.interval !== "month") {
    fail("INVALID_PRICE_FIXTURE", "Stripe did not return the required zero-dollar monthly price");
  }
  return { object: price, reused: false };
}

async function exerciseSubscription(client, config, customerId, priceId, runId) {
  const params = {
    customer: customerId,
    "items[0][price]": priceId,
    collection_method: "charge_automatically",
    ...metadataParams(config, { acceptance_run_id: runId, purpose: "zero_dollar_subscription_replay" })
  };
  const idempotencyKey = `vp-denver-${runId}-subscription`;
  const first = assertTestObject("subscription", (await client.request("POST", "/subscriptions", { params, idempotencyKey })).data);
  const replay = assertTestObject("subscription replay", (await client.request("POST", "/subscriptions", { params, idempotencyKey })).data);
  if (!first.id || replay.id !== first.id) fail("IDEMPOTENCY_FAILED", "Stripe did not return the same subscription for an idempotent replay");
  if (first.status === "canceled") fail("INVALID_SUBSCRIPTION_STATE", "The new subscription was already canceled");

  const canceled = assertTestObject(
    "canceled subscription",
    (await client.request("DELETE", `/subscriptions/${encodeURIComponent(first.id)}`)).data
  );
  if (canceled.id !== first.id || canceled.status !== "canceled") fail("CANCELLATION_FAILED", "The zero-dollar subscription was not canceled");

  return {
    id: first.id,
    initialStatus: first.status,
    replayId: replay.id,
    idempotentReplay: true,
    finalStatus: canceled.status
  };
}

async function exerciseDecline(client, config, customerId, runId) {
  const created = assertTestObject(
    "payment intent",
    (await client.request("POST", "/payment_intents", {
      params: {
        amount: 100,
        currency: "usd",
        customer: customerId,
        description: "Denver Mock expected-decline rehearsal",
        "payment_method_types[0]": "card",
        ...metadataParams(config, { acceptance_run_id: runId, purpose: "expected_decline_no_charge" })
      },
      idempotencyKey: `vp-denver-${runId}-decline-intent`
    })).data
  );
  if (!created.id || created.amount !== 100 || created.currency !== "usd" || !hasFixtureMetadata(created, config)) {
    fail("INVALID_PAYMENT_INTENT", "Stripe did not return the expected simulation-tagged decline PaymentIntent");
  }

  const confirmation = await client.request("POST", `/payment_intents/${encodeURIComponent(created.id)}/confirm`, {
    params: { payment_method: DECLINED_TEST_PAYMENT_METHOD },
    idempotencyKey: `vp-denver-${runId}-decline-confirm`,
    expectedStatuses: [402]
  });
  const providerError = confirmation.data?.error;
  if (providerError?.code !== "card_declined" || providerError?.payment_intent?.id !== created.id) {
    fail("DECLINE_NOT_OBSERVED", "The supported Stripe test payment did not produce the expected decline");
  }

  const paymentIntent = assertTestObject(
    "declined payment intent",
    (await client.request("GET", `/payment_intents/${encodeURIComponent(created.id)}`)).data
  );
  const charges = (await client.request("GET", "/charges", { params: { payment_intent: created.id, limit: 100 } })).data;
  if (!Array.isArray(charges?.data)) fail("INVALID_STRIPE_RESPONSE", "Stripe returned an invalid charge list");
  for (const charge of charges.data) assertTestObject("declined charge", charge);
  const successfulCharges = charges.data.filter(charge => charge.paid === true || charge.status === "succeeded");
  if (paymentIntent.status === "succeeded" || paymentIntent.amount_received !== 0 || successfulCharges.length !== 0) {
    fail("UNEXPECTED_SUCCESSFUL_CHARGE", "The expected-decline rehearsal produced a successful charge");
  }

  const canceled = assertTestObject(
    "canceled payment intent",
    (await client.request("POST", `/payment_intents/${encodeURIComponent(created.id)}/cancel`, {
      idempotencyKey: `vp-denver-${runId}-decline-cancel`
    })).data
  );
  if (canceled.id !== created.id || canceled.status !== "canceled") fail("PAYMENT_INTENT_CLEANUP_FAILED", "The declined payment intent was not canceled");

  return {
    paymentIntentId: created.id,
    expectedDeclineObserved: true,
    errorCode: providerError.code,
    declineCode: typeof providerError.decline_code === "string" ? providerError.decline_code : null,
    amount: created.amount,
    currency: created.currency,
    amountReceived: paymentIntent.amount_received,
    successfulCharges: 0,
    finalStatus: canceled.status
  };
}

function sanitizeFailure(error) {
  if (error instanceof StripeSandboxError) {
    return {
      code: error.code,
      message: error.message,
      ...(Number.isInteger(error.details?.httpStatus) ? { httpStatus: error.details.httpStatus } : {}),
      ...(typeof error.details?.type === "string" ? { providerType: error.details.type } : {}),
      ...(typeof error.details?.code === "string" ? { providerCode: error.details.code } : {}),
      ...(typeof error.details?.declineCode === "string" ? { declineCode: error.details.declineCode } : {})
    };
  }
  return { code: "UNEXPECTED_HARNESS_ERROR", message: "The sandbox acceptance harness failed unexpectedly" };
}

async function writeResult(result, outputDir) {
  const absoluteOutputDir = resolve(outputDir);
  await mkdir(absoluteOutputDir, { recursive: true, mode: 0o700 });
  const safeTimestamp = result.finishedAt.replaceAll(":", "-");
  const finalPath = resolve(absoluteOutputDir, `stripe-sandbox-${safeTimestamp}-${result.runId}.json`);
  if (dirname(finalPath) !== absoluteOutputDir) fail("INVALID_OUTPUT_PATH", "The result path escaped its output directory");
  const temporaryPath = `${finalPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, finalPath);
  return finalPath;
}

function baseResult(config, runId, startedAt, dryRun) {
  return {
    schemaVersion: 1,
    label: "SIMULATION — STRIPE TEST MODE — NO CLINICAL OR LEGAL USE",
    simulationId: config?.id === "denver-mock" ? config.id : "denver-mock",
    runId,
    dryRun,
    startedAt,
    expectedAccountId: /^acct_[A-Za-z0-9]+$/.test(config?.stripe?.accountId ?? "") ? config.stripe.accountId : null,
    secretRecorded: false,
    rawProviderResponsesRecorded: false
  };
}

export async function runStripeSandboxAcceptance({
  config,
  secretKey,
  fetchImpl = globalThis.fetch,
  outputDir = fileURLToPath(DEFAULT_OUTPUT_DIR_URL),
  dryRun = false,
  runId = randomUUID(),
  now = () => new Date()
}) {
  validateRunId(runId);
  const startedAt = now().toISOString();
  const resultBase = baseResult(config, runId, startedAt, dryRun);

  try {
    validateConfig(config);
    if (dryRun) {
      const result = {
        ...resultBase,
        outcome: "planned",
        externalCalls: 0,
        verifiedAccount: false,
        plannedOperations: [
          "verify configured Stripe account using a test-mode key",
          "create or reuse simulation-tagged customer, product, and zero-dollar recurring price",
          "create and replay one zero-dollar subscription with the same idempotency key",
          "cancel the zero-dollar subscription",
          "create an expected-decline PaymentIntent, verify zero successful charges, and cancel it"
        ],
        finishedAt: now().toISOString()
      };
      return { result, resultPath: await writeResult(result, outputDir) };
    }

    validateTestSecret(secretKey);
    const client = createStripeRestClient({ secretKey, fetchImpl });
    const account = (await client.request("GET", "/account")).data;
    if (account?.object !== "account" || account?.id !== config.stripe.accountId) {
      fail("ACCOUNT_MISMATCH", "The Stripe test key does not belong to the configured Denver Mock account");
    }

    const customer = await findOrCreateCustomer(client, config);
    const product = await findOrCreateProduct(client, config);
    const price = await findOrCreatePrice(client, config, product.object.id);
    const subscription = await exerciseSubscription(client, config, customer.object.id, price.object.id, runId);
    const decline = await exerciseDecline(client, config, customer.object.id, runId);

    const result = {
      ...resultBase,
      outcome: "passed",
      mode: "test",
      verifiedAccount: true,
      accountId: account.id,
      fixtures: {
        customer: { id: customer.object.id, reused: customer.reused },
        product: { id: product.object.id, reused: product.reused },
        price: { id: price.object.id, reused: price.reused, unitAmount: price.object.unit_amount, currency: price.object.currency }
      },
      subscription,
      decline,
      checks: {
        testKeyPrefix: true,
        configuredAccountMatched: true,
        allReturnedObjectsTestMode: true,
        zeroDollarRecurringPrice: price.object.unit_amount === 0 && price.object.recurring?.interval === "month",
        subscriptionReplayReturnedSameObject: subscription.idempotentReplay,
        subscriptionCanceled: subscription.finalStatus === "canceled",
        declineObserved: decline.expectedDeclineObserved,
        successfulCharges: decline.successfulCharges,
        declinedPaymentIntentCanceled: decline.finalStatus === "canceled"
      },
      finishedAt: now().toISOString()
    };
    return { result, resultPath: await writeResult(result, outputDir) };
  } catch (error) {
    const result = {
      ...resultBase,
      outcome: "failed",
      failure: sanitizeFailure(error),
      finishedAt: now().toISOString()
    };
    let resultPath;
    try {
      resultPath = await writeResult(result, outputDir);
    } catch {
      // Preserve the original safe error if the audit artifact cannot be written.
    }
    if (error instanceof StripeSandboxError) {
      error.resultPath = resultPath;
      throw error;
    }
    const wrapped = new StripeSandboxError("UNEXPECTED_HARNESS_ERROR", "The sandbox acceptance harness failed unexpectedly");
    wrapped.resultPath = resultPath;
    throw wrapped;
  }
}

function parseArguments(argv) {
  const parsed = {
    dryRun: false,
    configPath: fileURLToPath(DEFAULT_CONFIG_URL),
    outputDir: fileURLToPath(DEFAULT_OUTPUT_DIR_URL),
    runId: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") parsed.dryRun = true;
    else if (argument === "--config") parsed.configPath = resolve(argv[++index] ?? "");
    else if (argument === "--output-dir") parsed.outputDir = resolve(argv[++index] ?? "");
    else if (argument === "--run-id") parsed.runId = argv[++index];
    else fail("INVALID_ARGUMENT", "Unknown or malformed command-line argument");
  }
  return parsed;
}

async function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    const config = JSON.parse(await readFile(args.configPath, "utf8"));
    const { result, resultPath } = await runStripeSandboxAcceptance({
      config,
      secretKey: process.env.DENVER_MOCK_STRIPE_SECRET_KEY,
      outputDir: args.outputDir,
      dryRun: args.dryRun,
      ...(args.runId ? { runId: args.runId } : {})
    });
    process.stdout.write(`Stripe sandbox ${result.outcome}; sanitized result: ${resultPath}\n`);
  } catch (error) {
    const safeError = error instanceof StripeSandboxError
      ? error
      : new StripeSandboxError("HARNESS_STARTUP_FAILED", "The Stripe sandbox harness could not start");
    process.stderr.write(`Stripe sandbox failed [${safeError.code}]: ${safeError.message}\n`);
    if (safeError.resultPath) process.stderr.write(`Sanitized failure result: ${safeError.resultPath}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) await main();
