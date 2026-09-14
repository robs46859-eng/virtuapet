import type { ClinicalQualityResult, QualityGateDetail } from "@virtuapet/contracts";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function computeDice(maskA: boolean[], maskB: boolean[]): number {
  if (maskA.length !== maskB.length || maskA.length === 0) return 0;
  let intersection = 0;
  let countA = 0;
  let countB = 0;
  for (let i = 0; i < maskA.length; i++) {
    if (maskA[i]) countA++;
    if (maskB[i]) countB++;
    if (maskA[i] && maskB[i]) intersection++;
  }
  const total = countA + countB;
  if (total === 0) return 1.0;
  return (2 * intersection) / total;
}

export function computeHausdorff95(surfaceA: [number, number, number][], surfaceB: [number, number, number][]): number {
  if (surfaceA.length === 0 || surfaceB.length === 0) return 0;

  // Sample distances from A to B
  const sampleA = surfaceA.length > 500 ? surfaceA.filter((_, idx) => idx % Math.ceil(surfaceA.length / 500) === 0) : surfaceA;
  const sampleB = surfaceB.length > 500 ? surfaceB.filter((_, idx) => idx % Math.ceil(surfaceB.length / 500) === 0) : surfaceB;

  const distances: number[] = [];

  for (const ptA of sampleA) {
    let minDist = Infinity;
    for (const ptB of sampleB) {
      const d = Math.hypot(ptA[0] - ptB[0], ptA[1] - ptB[1], ptA[2] - ptB[2]);
      if (d < minDist) minDist = d;
    }
    distances.push(minDist);
  }

  distances.sort((a, b) => a - b);
  const index95 = Math.floor(distances.length * 0.95);
  return distances[index95] ?? 0;
}

export function computeLandmarkError(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function computeAngularError(degA: number, degB: number): number {
  return Math.abs(degA - degB);
}

export function computeLinearError(valA: number, valB: number): { absMm: number; pct: number } {
  const absMm = Math.abs(valA - valB);
  const pct = valB === 0 ? 0 : (absMm / valB) * 100;
  return { absMm, pct };
}

export interface QaEvaluationInput {
  patientPreserved: boolean;
  lateralityPreserved: boolean;
  unitsPreserved: boolean;
  orientationPreserved: boolean;
  vetApproved: boolean;
  linearErrorMm: number;
  linearErrorPct: number;
  tpaErrorDeg: number;
  hd95Mm: number;
  diceTibia: number;
  diceFemur: number;
  dicePatella: number;
  isWatertight: boolean;
  rehearsalCompletedUnassisted: boolean;
  susScore: number;
}

export function evaluateClinicalGates(input: QaEvaluationInput): { passedAll: boolean; gates: QualityGateDetail[] } {
  const gates: QualityGateDetail[] = [
    {
      gateId: "GATE-01",
      name: "Patient and Laterality Preservation",
      threshold: "100% preservation (0% mismatch)",
      actual: (input.patientPreserved && input.lateralityPreserved) ? 1.0 : 0.0,
      passed: input.patientPreserved && input.lateralityPreserved
    },
    {
      gateId: "GATE-02",
      name: "Units (HU) & Coordinate Frame (LPS) Preservation",
      threshold: "100% preservation",
      actual: (input.unitsPreserved && input.orientationPreserved) ? 1.0 : 0.0,
      passed: input.unitsPreserved && input.orientationPreserved
    },
    {
      gateId: "GATE-03",
      name: "Veterinarian Pre-Rehearsal Approval",
      threshold: "100% verified approval",
      actual: input.vetApproved ? 1.0 : 0.0,
      passed: input.vetApproved
    },
    {
      gateId: "GATE-04",
      name: "Linear Measurement Accuracy",
      threshold: "<= 1.5mm or <= 2.5%",
      actual: input.linearErrorMm,
      passed: input.linearErrorMm <= 1.5 || input.linearErrorPct <= 2.5
    },
    {
      gateId: "GATE-05",
      name: "Tibial Plateau Angle (TPA) Angular Accuracy",
      threshold: "<= 1.0 degree",
      actual: input.tpaErrorDeg,
      passed: input.tpaErrorDeg <= 1.0
    },
    {
      gateId: "GATE-06",
      name: "Critical Surface 95th-percentile Error (HD95)",
      threshold: "<= 1.5mm",
      actual: input.hd95Mm,
      passed: input.hd95Mm <= 1.5
    },
    {
      gateId: "GATE-07A",
      name: "Dice Similarity Coefficient - Tibia",
      threshold: ">= 0.92",
      actual: input.diceTibia,
      passed: input.diceTibia >= 0.92
    },
    {
      gateId: "GATE-07B",
      name: "Dice Similarity Coefficient - Femur",
      threshold: ">= 0.90",
      actual: input.diceFemur,
      passed: input.diceFemur >= 0.90
    },
    {
      gateId: "GATE-07C",
      name: "Dice Similarity Coefficient - Patella",
      threshold: ">= 0.88",
      actual: input.dicePatella,
      passed: input.dicePatella >= 0.88
    },
    {
      gateId: "GATE-08",
      name: "Watertight Manifold Topology",
      threshold: "100% watertight, 0 non-manifold edges",
      actual: input.isWatertight ? 1.0 : 0.0,
      passed: input.isWatertight
    },
    {
      gateId: "GATE-09",
      name: "Rehearsal Task Unassisted Completion",
      threshold: ">= 90% unassisted",
      actual: input.rehearsalCompletedUnassisted ? 1.0 : 0.0,
      passed: input.rehearsalCompletedUnassisted
    },
    {
      gateId: "GATE-10",
      name: "System Usability Scale (SUS)",
      threshold: "Score >= 80",
      actual: input.susScore,
      passed: input.susScore >= 80
    }
  ];

  const passedAll = gates.every(g => g.passed);
  return { passedAll, gates };
}
