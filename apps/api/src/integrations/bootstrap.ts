import type { JSONWebKeySet } from "jose";
import { createIdentityLinkService } from "./identity-links.js";
import type { IdentityLinkStore } from "./identity-link-store.js";

/** Server-only configuration. No remote discovery, demo credentials, or memory fallback. */
export function identityLinksFromEnvironment(store?: IdentityLinkStore, env: NodeJS.ProcessEnv = process.env) {
  if (env.LAYER8_IDENTITY_LINKS_ENABLED !== "true" || !store) return undefined;
  let publicJwks: JSONWebKeySet;
  try { publicJwks = JSON.parse(env.LAYER8_LINK_JWKS_JSON ?? ""); }
  catch { return undefined; }
  return createIdentityLinkService({ enabled: true, store, publicJwks,
    ...(env.LAYER8_LINK_ISSUER ? { issuer: env.LAYER8_LINK_ISSUER } : {}),
    ...(env.LAYER8_LINK_AUDIENCE ? { audience: env.LAYER8_LINK_AUDIENCE } : {}),
    ...(env.LAYER8_LINK_KEY_ID ? { pinnedKid: env.LAYER8_LINK_KEY_ID } : {}),
    ...(env.INTEGRATION_LINK_ENCRYPTION_KEY_BASE64 ? { encryptionKeyBase64: env.INTEGRATION_LINK_ENCRYPTION_KEY_BASE64 } : {}) });
}
