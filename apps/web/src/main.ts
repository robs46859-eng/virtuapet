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
      const account = auth.getActiveAccount();
      if (!account) throw new Error("Sign in first.");
      const token = await auth.acquireTokenSilent({ account, scopes: [entraScope] });
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/v1/integrations`, { headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "X-VirtuaPet-Organization-Id": organization.value
      } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
      status.textContent = `Authenticated for ${organization.selectedOptions[0]?.textContent ?? organization.value}.`;
    } catch (error) {
      status.textContent = error instanceof Error ? `Verification failed: ${error.message}` : "Verification failed.";
    }
  });
}
