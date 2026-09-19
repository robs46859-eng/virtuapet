# Denver Mock Stripe sandbox acceptance

This harness is limited to the Stripe account in `config.json`. It rejects live
keys before network access and verifies `GET /v1/account` matches the configured
account before it creates anything. It uses Node's built-in `fetch`; there is no
Stripe SDK or committed credential. Requests are pinned to Stripe's HTTPS API,
refuse redirects, use a bounded timeout, and require an idempotency key on every
POST.

Start with the side-effect-free plan:

```sh
npm run verify:denver-stripe:dry-run
```

For an authorized sandbox run, enter the Denver Mock **test-mode** secret into a
temporary shell variable without echoing it, run the harness, then clear it:

```sh
read -rs "DENVER_MOCK_STRIPE_SECRET_KEY?Denver Mock Stripe test secret: "
export DENVER_MOCK_STRIPE_SECRET_KEY
npm run verify:denver-stripe
unset DENVER_MOCK_STRIPE_SECRET_KEY
```

The harness creates or reuses one simulation-tagged customer, product, and
zero-dollar monthly price. Each run creates a zero-dollar subscription, repeats
the exact create request with the same idempotency key, verifies the same
subscription was returned, and cancels it. It also confirms Stripe's supported
declined test PaymentMethod against a $1.00 PaymentIntent, verifies the amount
received and successful-charge count are both zero, and cancels the declined
intent.

The command prints only the path to a sanitized JSON result under `results/`.
That ignored artifact contains provider object IDs and check outcomes. It does
not contain a secret key, authorization header, email address, or raw Stripe
response. A failed safety or provider check writes the same kind of sanitized
artifact when possible and exits nonzero.

If a request result is uncertain because of a timeout or connection failure,
read `runId` from that failure artifact and retry with the same operation id:

```sh
npm run verify:denver-stripe -- --run-id <runId-from-failure-artifact>
```

Reusing the run id preserves the subscription and PaymentIntent idempotency
keys. Starting a new run id after an uncertain mutation can create another test
object.

Run the isolated mocked tests with:

```sh
node --test simulations/denver-mock/stripe-sandbox.test.mjs
```

These tests inject a local fake `fetch` implementation. They do not contact
Stripe or any other external system.
