type Capability = { id: string; name: string; status: string };

const fallback: Capability[] = [
  { id: "pet-profile", name: "Pet Profile", status: "phase_1_foundation" },
  { id: "vetos", name: "VetOS", status: "in_development" },
  { id: "clinical-twins", name: "Clinical Digital Twins", status: "research_and_validation" },
  { id: "smart-vet-link", name: "Smart Global Vet Link", status: "in_development" },
  { id: "robot", name: "Pet Assistant Robot", status: "discovery" },
  { id: "travel", name: "Pet Travel and Fleet", status: "discovery" }
];

const descriptions: Record<string, string> = {
  "pet-profile": "A permission-controlled identity and record foundation for each pet.",
  vetos: "Clinic workflows, scheduling, communications, payments, and care coordination.",
  "clinical-twins": "Source-linked anatomy models for clinician-reviewed planning.",
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
  container.innerHTML = items.slice(0, 6).map(item => `
    <article class="module-card">
      <span class="module-icon" aria-hidden="true">${item.name.slice(0, 1)}</span>
      <p class="tag">${readableStatus(item.status)}</p>
      <h3>${item.name}</h3>
      <p>${descriptions[item.id] ?? "A planned part of the VirtuaPet care platform."}</p>
    </article>`).join("");
}

fetch("http://127.0.0.1:8080/v1/platform/capabilities")
  .then(response => response.ok ? response.json() : Promise.reject(new Error("API unavailable")))
  .then(data => render(data.capabilities))
  .catch(() => render(fallback));

