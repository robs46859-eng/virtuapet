import { PublicClientApplication } from "@azure/msal-browser";

type Capability = { id: string; name: string; status: string };

const fallback: Capability[] = [
  { id: "pet-profile", name: "Pet Profile", status: "phase_2_pilot" },
  { id: "vetos", name: "VetOS", status: "phase_2_pilot" },
  { id: "clinical-twins", name: "Clinical Digital Twins", status: "phase_3_validation" },
  { id: "surgical-rehearsal", name: "Virtual Surgical Rehearsal", status: "phase_3_validation" },
  { id: "smart-vet-link", name: "Smart Global Vet Link", status: "phase_2_pilot" },
  { id: "feline-grimace", name: "Feline Grimace Scale Workflow", status: "phase_2_pilot" },
  { id: "robot", name: "Pet Assistant Robot", status: "discovery" },
  { id: "travel", name: "Pet Travel and Fleet", status: "discovery" }
];

const descriptions: Record<string, string> = {
  "pet-profile": "A permission-controlled identity and record foundation for each pet.",
  vetos: "Clinic workflows, scheduling, communications, payments, and care coordination.",
  "clinical-twins": "Source-linked anatomy models for clinician-reviewed planning.",
  "feline-grimace": "A trained human scoring workflow with consent and veterinary review prompts.",
  "surgical-rehearsal": "A future clinician-reviewed rehearsal service that remains under validation.",
  "smart-vet-link": "Address-aware travel and pet-rule research with source evidence.",
  robot: "A safety-first indoor companion and remote-presence concept.",
  travel: "Partner fleet coordination, custody records, and welfare telemetry."
};

function readableStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function render(items: Capability[]) {
  const container = document.querySelector<HTMLDivElement>("#capabilities");
  if (!container) return;
  container.innerHTML = items.slice(0, 8).map(item => `
    <article class="module-card">
      <span class="module-icon" aria-hidden="true">${item.name.slice(0, 1)}</span>
      <p class="tag">${readableStatus(item.status)}</p>
      <h3>${item.name}</h3>
      <p>${descriptions[item.id] ?? "A planned part of the VirtuaPet care platform."}</p>
    </article>`).join("");
}

document.querySelectorAll<HTMLAnchorElement>("nav a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll("nav a").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  });
});

const apiBaseUrl = import.meta.env.VITE_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";
const entraClientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const entraTenantId = import.meta.env.VITE_ENTRA_TENANT_ID;
const entraScope = import.meta.env.VITE_ENTRA_API_SCOPE;

fetch(`${apiBaseUrl.replace(/\/$/, "")}/v1/platform/capabilities`)
  .then(response => response.ok ? response.json() : Promise.reject(new Error("API unavailable")))
  .then(data => render(data.capabilities))
  .catch(() => render(fallback));

if (entraClientId && entraTenantId && entraScope) {
  const auth = new PublicClientApplication({ auth: {
    clientId: entraClientId,
    authority: `https://login.microsoftonline.com/${entraTenantId}`,
    redirectUri: window.location.origin
  }, cache: { cacheLocation: "sessionStorage" } });
  const signIn = document.querySelector<HTMLButtonElement>("#sign-in")!;
  const tenantSession = document.querySelector<HTMLElement>("#tenant-session")!;
  const organization = document.querySelector<HTMLSelectElement>("#organization")!;
  const verify = document.querySelector<HTMLButtonElement>("#verify-session")!;
  const status = document.querySelector<HTMLSpanElement>("#session-status")!;
  const linkPanel = document.querySelector<HTMLElement>("#layer8-link")!;
  const createChallenge = document.querySelector<HTMLButtonElement>("#create-link-challenge")!;
  const challengeOutput = document.querySelector<HTMLTextAreaElement>("#link-challenge")!;
  const proofInput = document.querySelector<HTMLTextAreaElement>("#link-proof")!;
  const completeLink = document.querySelector<HTMLButtonElement>("#complete-link")!;
  const linkStatus = document.querySelector<HTMLSpanElement>("#link-status")!;
  let verifiedOrganization = "";
  let activeChallengeId = "";

  const authenticatedRequest = async (path: string, init: RequestInit = {}) => {
    const account = auth.getActiveAccount();
    if (!account) throw new Error("Sign in first.");
    const token = await auth.acquireTokenSilent({ account, scopes: [entraScope] });
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token.accessToken}`);
    headers.set("X-VirtuaPet-Organization-Id", organization.value);
    if (init.body) headers.set("Content-Type", "application/json");
    return fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, { ...init, headers, cache: "no-store" });
  };

  const showAccount = (username: string) => {
    signIn.textContent = `Sign out ${username}`;
    tenantSession.hidden = false;
  };

  void auth.initialize().then(async () => {
    const redirect = await auth.handleRedirectPromise();
    const account = redirect?.account ?? auth.getAllAccounts()[0];
    if (account) {
      auth.setActiveAccount(account);
      showAccount(account.username);
    }
  });

  signIn.addEventListener("click", () => {
    if (auth.getActiveAccount()) void auth.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
    else void auth.loginRedirect({ scopes: [entraScope], prompt: "select_account" });
  });

  verify.addEventListener("click", async () => {
    status.textContent = "Verifying organization membership…";
    try {
      const response = await authenticatedRequest("/v1/integrations");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
      verifiedOrganization = organization.value;
      activeChallengeId = "";
      challengeOutput.value = "";
      proofInput.value = "";
      linkPanel.hidden = false;
      status.textContent = `Authenticated for ${organization.selectedOptions[0]?.textContent ?? organization.value}.`;
    } catch (error) {
      verifiedOrganization = "";
      linkPanel.hidden = true;
      status.textContent = error instanceof Error ? `Verification failed: ${error.message}` : "Verification failed.";
    }
  });

  organization.addEventListener("change", () => {
    verifiedOrganization = "";
    activeChallengeId = "";
    linkPanel.hidden = true;
    status.textContent = "Verify the selected organization before linking.";
  });

  createChallenge.addEventListener("click", async () => {
    linkStatus.textContent = "Creating one-time challenge…";
    try {
      if (verifiedOrganization !== organization.value) throw new Error("Verify this organization first.");
      const response = await authenticatedRequest("/v1/integrations/layer8/links/challenges", {
        method: "POST", body: JSON.stringify({})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
      activeChallengeId = typeof body.challengeId === "string" ? body.challengeId : "";
      if (!activeChallengeId) throw new Error("Challenge response was incomplete.");
      challengeOutput.value = JSON.stringify(body, null, 2);
      proofInput.value = "";
      linkStatus.textContent = "Challenge ready. Create its proof in the matching SALTI8 organization.";
    } catch (error) {
      linkStatus.textContent = error instanceof Error ? `Challenge failed: ${error.message}` : "Challenge failed.";
    }
  });

  completeLink.addEventListener("click", async () => {
    linkStatus.textContent = "Verifying and storing the encrypted link…";
    try {
      if (!activeChallengeId) throw new Error("Create a challenge first.");
      const proofToken = proofInput.value.trim();
      if (!proofToken) throw new Error("Paste the matching Layer8 proof.");
      const response = await authenticatedRequest("/v1/integrations/layer8/links/complete", {
        method: "POST", body: JSON.stringify({ challengeId: activeChallengeId, proofToken, consent: true })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
      proofInput.value = "";
      activeChallengeId = "";
      linkStatus.textContent = "Layer8 account linked. The signed proof is encrypted server-side.";
    } catch (error) {
      linkStatus.textContent = error instanceof Error ? `Link failed: ${error.message}` : "Link failed.";
    }
  });
}
