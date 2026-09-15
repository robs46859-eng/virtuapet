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

fetch(`${apiBaseUrl.replace(/\/$/, "")}/v1/platform/capabilities`)
  .then(response => response.ok ? response.json() : Promise.reject(new Error("API unavailable")))
  .then(data => render(data.capabilities))
  .catch(() => render(fallback));
