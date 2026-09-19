import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStripeRestClient, runStripeSandboxAcceptance, StripeSandboxError } from "./stripe-sandbox.mjs";

const config = JSON.parse(await readFile(new URL("config.json", import.meta.url), "utf8"));
const TEST_SECRET = ["sk", "test", "fixture", "never", "record", "123"].join("_");
const FIXTURE_METADATA = {
  virtuapet_fixture: "denver-mock-stripe-acceptance-v1",
  simulation_id: "denver-mock",
  simulation_only: "true"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function bodyParams(options) {
  return new URLSearchParams(options.body?.toString() ?? "");
}

function metadataFrom(params) {
  const metadata = {};
  for (const [key, value] of params) {
    const match = /^metadata\[([^\]]+)\]$/.exec(key);
    if (match) metadata[match[1]] = value;
  }
  return metadata;
}

function createStripeMock({ accountId = config.stripe.accountId, preseed = false, replayChangesId = false } = {}) {
  const state = {
    calls: [],
    customers: preseed ? [{ id: "cus_fixture", object: "customer", livemode: false, metadata: FIXTURE_METADATA }] : [],
    products: preseed ? [{ id: "prod_fixture", object: "product", livemode: false, active: true, metadata: FIXTURE_METADATA }] : [],
    prices: preseed ? [{
      id: "price_fixture",
      object: "price",
      livemode: false,
      active: true,
      product: "prod_fixture",
      unit_amount: 0,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: FIXTURE_METADATA
    }] : [],
    subscriptionByKey: new Map(),
    nextSubscription: 1,
    nextPaymentIntent: 1
  };

  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    const path = url.pathname.replace(/^\/v1/, "");
    const method = options.method ?? "GET";
    const params = bodyParams(options);
    const idempotencyKey = options.headers?.["Idempotency-Key"];
    state.calls.push({ method, path, query: url.searchParams.toString(), body: params.toString(), idempotencyKey });
    assert.equal(options.headers?.Authorization, `Bearer ${TEST_SECRET}`);

    if (method === "GET" && path === "/account") return jsonResponse({ id: accountId, object: "account" });
    if (method === "GET" && path === "/customers") return jsonResponse({ object: "list", data: state.customers, has_more: false });
    if (method === "POST" && path === "/customers") {
      const object = { id: "cus_fixture", object: "customer", livemode: false, metadata: metadataFrom(params) };
      state.customers.push(object);
      return jsonResponse(object);
    }
    if (method === "GET" && path === "/products") return jsonResponse({ object: "list", data: state.products, has_more: false });
    if (method === "POST" && path === "/products") {
      const object = { id: "prod_fixture", object: "product", livemode: false, active: true, metadata: metadataFrom(params) };
      state.products.push(object);
      return jsonResponse(object);
    }
    if (method === "GET" && path === "/prices") {
      const prices = state.prices.filter(item => !url.searchParams.get("product") || item.product === url.searchParams.get("product"));
      return jsonResponse({ object: "list", data: prices, has_more: false });
    }
    if (method === "POST" && path === "/prices") {
      const object = {
        id: "price_fixture",
        object: "price",
        livemode: false,
        active: true,
        product: params.get("product"),
        unit_amount: Number(params.get("unit_amount")),
        currency: params.get("currency"),
        recurring: { interval: params.get("recurring[interval]") },
        metadata: metadataFrom(params)
      };
      state.prices.push(object);
      return jsonResponse(object);
    }
    if (method === "POST" && path === "/subscriptions") {
      const existing = state.subscriptionByKey.get(idempotencyKey);
      if (existing) {
        if (replayChangesId) return jsonResponse({ ...existing, id: `${existing.id}_changed` });
        return jsonResponse(existing);
      }
      const object = {
        id: `sub_test_${state.nextSubscription++}`,
        object: "subscription",
        livemode: false,
        status: "active",
        customer: params.get("customer"),
        metadata: metadataFrom(params)
      };
      state.subscriptionByKey.set(idempotencyKey, object);
      return jsonResponse(object);
    }
    if (method === "DELETE" && path.startsWith("/subscriptions/")) {
      return jsonResponse({ id: path.split("/").at(-1), object: "subscription", livemode: false, status: "canceled" });
    }
    if (method === "POST" && path === "/payment_intents") {
      const object = {
        id: `pi_test_${state.nextPaymentIntent++}`,
        object: "payment_intent",
        livemode: false,
        status: "requires_payment_method",
        amount: Number(params.get("amount")),
        amount_received: 0,
        currency: params.get("currency"),
        metadata: metadataFrom(params)
      };
      state.paymentIntent = object;
      return jsonResponse(object);
    }
    if (method === "POST" && /\/payment_intents\/[^/]+\/confirm$/.test(path)) {
      assert.equal(params.get("payment_method"), "pm_card_visa_chargeDeclined");
      return jsonResponse({
        error: {
          type: "card_error",
          code: "card_declined",
          decline_code: "generic_decline",
          message: `deliberately unsafe echo ${TEST_SECRET}`,
          payment_intent: state.paymentIntent
        }
      }, 402);
    }
    if (method === "GET" && path === `/payment_intents/${state.paymentIntent?.id}`) return jsonResponse(state.paymentIntent);
    if (method === "GET" && path === "/charges") {
      return jsonResponse({
        object: "list",
        has_more: false,
        data: [{ id: "ch_failed", object: "charge", livemode: false, paid: false, status: "failed" }]
      });
    }
    if (method === "POST" && path === `/payment_intents/${state.paymentIntent?.id}/cancel`) {
      return jsonResponse({ ...state.paymentIntent, status: "canceled" });
    }
    return jsonResponse({ error: { type: "invalid_request_error", code: "unmocked_route" } }, 400);
  };

  return { fetchImpl, state };
}

function fixedNow(value = "2026-09-18T20:00:00.000Z") {
  return () => new Date(value);
}

async function withTemporaryDirectory(callback) {
  const directory = await mkdtemp(join(tmpdir(), "vp-denver-stripe-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("dry run performs no external calls and writes an explicitly unverified plan", async () => {
  await withTemporaryDirectory(async outputDir => {
    let calls = 0;
    const { result, resultPath } = await runStripeSandboxAcceptance({
      config,
      outputDir,
      dryRun: true,
      runId: "dry-run-0001",
      now: fixedNow(),
      fetchImpl: async () => { calls += 1; throw new Error("must not be called"); }
    });
    assert.equal(calls, 0);
    assert.equal(result.outcome, "planned");
    assert.equal(result.verifiedAccount, false);
    assert.equal(result.externalCalls, 0);
    const artifact = await readFile(resultPath, "utf8");
    assert.doesNotMatch(artifact, /sk_(?:test|live)_/);
  });
});

test("REST client pins the Stripe API and refuses POST requests without idempotency", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonResponse({}); };
  assert.throws(
    () => createStripeRestClient({ secretKey: TEST_SECRET, fetchImpl, apiBase: "https://example.invalid/v1" }),
    error => error instanceof StripeSandboxError && error.code === "UNSAFE_API_BASE"
  );
  const client = createStripeRestClient({ secretKey: TEST_SECRET, fetchImpl });
  await assert.rejects(
    client.request("POST", "/customers", { params: { name: "unsafe retry" } }),
    error => error instanceof StripeSandboxError && error.code === "IDEMPOTENCY_KEY_REQUIRED"
  );
  assert.equal(calls, 0);
});

test("sandbox run creates tagged fixtures, replays and cancels a zero-dollar subscription, and records only a declined charge", async () => {
  await withTemporaryDirectory(async outputDir => {
    const stripe = createStripeMock();
    const { result, resultPath } = await runStripeSandboxAcceptance({
      config,
      secretKey: TEST_SECRET,
      fetchImpl: stripe.fetchImpl,
      outputDir,
      runId: "acceptance-0001",
      now: fixedNow()
    });

    assert.equal(result.outcome, "passed");
    assert.equal(result.accountId, config.stripe.accountId);
    assert.equal(result.fixtures.price.unitAmount, 0);
    assert.equal(result.subscription.id, result.subscription.replayId);
    assert.equal(result.subscription.finalStatus, "canceled");
    assert.equal(result.decline.errorCode, "card_declined");
    assert.equal(result.decline.successfulCharges, 0);
    assert.equal(result.decline.amountReceived, 0);
    assert.equal(result.decline.finalStatus, "canceled");

    const subscriptionCalls = stripe.state.calls.filter(call => call.method === "POST" && call.path === "/subscriptions");
    assert.equal(subscriptionCalls.length, 2);
    assert.equal(subscriptionCalls[0].idempotencyKey, subscriptionCalls[1].idempotencyKey);
    assert.equal(subscriptionCalls[0].body, subscriptionCalls[1].body);
    assert.ok(stripe.state.calls.filter(call => call.method === "POST").every(call => call.idempotencyKey));

    const artifact = await readFile(resultPath, "utf8");
    assert.doesNotMatch(artifact, new RegExp(TEST_SECRET));
    assert.doesNotMatch(artifact, /Authorization|deliberately unsafe echo/i);
    assert.equal(JSON.parse(artifact).secretRecorded, false);
  });
});

test("simulation-tagged customer, product, and price are reused on subsequent runs", async () => {
  await withTemporaryDirectory(async outputDir => {
    const stripe = createStripeMock();
    await runStripeSandboxAcceptance({
      config,
      secretKey: TEST_SECRET,
      fetchImpl: stripe.fetchImpl,
      outputDir,
      runId: "reuse-run-0001",
      now: fixedNow("2026-09-18T20:01:00.000Z")
    });
    const second = await runStripeSandboxAcceptance({
      config,
      secretKey: TEST_SECRET,
      fetchImpl: stripe.fetchImpl,
      outputDir,
      runId: "reuse-run-0002",
      now: fixedNow("2026-09-18T20:02:00.000Z")
    });

    assert.equal(second.result.fixtures.customer.reused, true);
    assert.equal(second.result.fixtures.product.reused, true);
    assert.equal(second.result.fixtures.price.reused, true);
    assert.equal(stripe.state.calls.filter(call => call.method === "POST" && call.path === "/customers").length, 1);
    assert.equal(stripe.state.calls.filter(call => call.method === "POST" && call.path === "/products").length, 1);
    assert.equal(stripe.state.calls.filter(call => call.method === "POST" && call.path === "/prices").length, 1);
  });
});

test("live keys fail before fetch and are absent from the sanitized failure artifact", async () => {
  await withTemporaryDirectory(async outputDir => {
    const liveSecret = ["sk", "live", "must", "never", "leave", "this", "test"].join("_");
    let calls = 0;
    let caught;
    try {
      await runStripeSandboxAcceptance({
        config,
        secretKey: liveSecret,
        outputDir,
        runId: "live-key-0001",
        now: fixedNow(),
        fetchImpl: async () => { calls += 1; }
      });
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof StripeSandboxError);
    assert.equal(caught.code, "TEST_KEY_REQUIRED");
    assert.equal(calls, 0);
    const artifact = await readFile(caught.resultPath, "utf8");
    assert.doesNotMatch(artifact, new RegExp(liveSecret));
  });
});

test("a key for a different Stripe account fails before any mutation", async () => {
  await withTemporaryDirectory(async outputDir => {
    const stripe = createStripeMock({ accountId: "acct_DifferentSandboxAccount" });
    await assert.rejects(
      runStripeSandboxAcceptance({
        config,
        secretKey: TEST_SECRET,
        fetchImpl: stripe.fetchImpl,
        outputDir,
        runId: "wrong-acct-0001",
        now: fixedNow()
      }),
      error => error instanceof StripeSandboxError && error.code === "ACCOUNT_MISMATCH"
    );
    assert.deepEqual(stripe.state.calls.map(call => `${call.method} ${call.path}`), ["GET /account"]);
  });
});

test("a changed object on idempotent replay fails closed before cancellation", async () => {
  await withTemporaryDirectory(async outputDir => {
    const stripe = createStripeMock({ replayChangesId: true });
    await assert.rejects(
      runStripeSandboxAcceptance({
        config,
        secretKey: TEST_SECRET,
        fetchImpl: stripe.fetchImpl,
        outputDir,
        runId: "bad-replay-0001",
        now: fixedNow()
      }),
      error => error instanceof StripeSandboxError && error.code === "IDEMPOTENCY_FAILED"
    );
    assert.equal(stripe.state.calls.some(call => call.method === "DELETE"), false);
  });
});
