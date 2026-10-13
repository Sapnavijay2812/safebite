// Generates the fictional sample PDFs used by the demo (no dependencies).
//   node scripts/generate-sample-pdf.mjs
// Output: public/samples/*.pdf. Every document is clearly marked SIMULATED.
// The inspection report text must stay in sync with the Copperleaf Kitchen seed
// record in src/lib/demo/seed-data.ts (date, reference, findings).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "samples");

const DOCUMENTS = {
  "sample-inspection-report.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - NOT AN AUTHORITY RECORD",
    "Harbor Bay Food Safety Inspection Report",
    "Establishment: Copperleaf Kitchen",
    "Inspection Authority: Harbor Bay Demo Health Department (simulated)",
    "Inspection Date: 2026-07-08",
    "Reference: SIM-HB-2026-0142",
    "Overall Outcome: PASS WITH CONDITIONS",
    "Assessed Categories: FOOD_STORAGE, TEMPERATURE_CONTROL, CLEANLINESS, PEST_MANAGEMENT, STAFF_HYGIENE, CROSS_CONTAMINATION",
    "Finding 1 | MAJOR | TEMPERATURE_CONTROL | Reach-in cooler on the pass recorded 8.5 C at inspection | Status: OPEN",
    "Remediation 1: Unit to be serviced; probe log to be provided at re-inspection.",
    "Finding 2 | MINOR | CLEANLINESS | Hood filters due for cleaning | Status: CORRECTED",
    "Remediation 2: Filters cleaned on site during the inspection.",
    "Finding 3 | OBSERVATION | STAFF_HYGIENE | Handwash sink signage faded | Status: RESOLVED",
    "Remediation 3: Replacement signage fitted.",
    "Attachment: Probe calibration check (simulated, not provided)",
    "Prepared by the simulated demo authority for training and product testing only.",
  ],
  "copperleaf-food-safety-plan.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - RESTAURANT-SUBMITTED",
    "Restaurant Food Safety Plan (self-attestation)",
    "Establishment: Copperleaf Kitchen",
    "Submitted by: Restaurant management (simulated)",
    "Issued: 2026-08-01",
    "Claims: FOOD_STORAGE compliant; TEMPERATURE_CONTROL compliant",
    "The kitchen records cooler temperatures at each shift change and stores raw proteins on the lowest shelf.",
    "This is a self-reported statement. It is not verified by any authority.",
  ],
  "saffron-audit-summary.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - INDEPENDENT AUDIT SUMMARY",
    "Independent Hygiene Check Summary (simulated)",
    "Establishment: Saffron & Stone",
    "Checked by: Fictional Independent Audit Co. (simulated)",
    "Check Date: 2026-05-20",
    "Reference: SIM-IA-2026-0311",
    "Checked Categories: CLEANLINESS, PEST_MANAGEMENT",
    "Result: No issues observed in the checked areas on the day of the visit.",
    "This summary describes one visit. It is not an official inspection or a certification.",
  ],
  "lantern-self-attestation.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - RESTAURANT-SUBMITTED",
    "Self-attestation: Storage and cleaning routine (simulated)",
    "Establishment: Lantern Noodle Bar",
    "Issued: 2026-09-01",
    "Claims: FOOD_STORAGE compliant; CLEANLINESS compliant",
    "Dry goods are off the floor and labelled with open dates. Cleaning schedule is posted at the pass.",
    "This is a self-reported statement. It is not verified by any authority.",
  ],
  "harvest-allergen-matrix.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - RESTAURANT-SUBMITTED",
    "Allergen and Cross-Contact Matrix (simulated)",
    "Establishment: Harvest Table",
    "Issued: 2026-06-01",
    "Claims: CROSS_CONTAMINATION compliant",
    "Dedicated colour-coded boards are used for gluten-free preparation. Fryer oil is changed weekly.",
    "This is a self-reported statement. It is not verified by any authority.",
  ],
  "bluefin-pest-service-log.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - RESTAURANT-SUBMITTED",
    "Pest Control Service Log (simulated)",
    "Establishment: Bluefin Sushi House",
    "Issued: 2026-07-02",
    "Claims: PEST_MANAGEMENT compliant",
    "Monthly visits logged. Last visit recorded as completed with no active activity noted by the contractor.",
    "This is a self-reported statement. It is not verified by any authority.",
  ],
  "ember-temperature-summary.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - RESTAURANT-SUBMITTED",
    "Smoker and Cooler Temperature Summary (simulated)",
    "Establishment: Ember & Oak",
    "Issued: 2026-02-10",
    "Claims: TEMPERATURE_CONTROL compliant",
    "Summary states that all temperature logs were complete for the quarter.",
    "This is a self-reported statement. It is not verified by any authority.",
  ],
  "crumb-staff-training.pdf": [
    "SIMULATED RECORD - FICTIONAL DEMO DATA - RESTAURANT-SUBMITTED",
    "Staff Hygiene Training Record (simulated)",
    "Establishment: Crumb & Cask Brewpub",
    "Issued: 2026-07-30",
    "Claims: STAFF_HYGIENE compliant",
    "Handwashing and illness reporting refreshed for all staff in July. Attendance sheet available on request.",
    "This is a self-reported statement. It is not verified by any authority.",
  ],
};

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(lines, width = 92) {
  const out = [];
  for (const line of lines) {
    if (!/^[\x20-\x7e]*$/.test(line)) throw new Error(`Non-ASCII text in fixture: ${line}`);
    let rest = line;
    while (rest.length > width) {
      const cut = rest.lastIndexOf(" ", width);
      const at = cut > 0 ? cut : width;
      out.push(rest.slice(0, at));
      rest = rest.slice(at).trimStart();
    }
    out.push(rest);
  }
  return out;
}

function buildPdf(lines) {
  const wrapped = wrap(lines);
  if (wrapped.length > 48) throw new Error("Fixture too long for one page.");
  const stream =
    "BT /F1 11 Tf 14 TL 56 740 Td\n" +
    wrapped.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n") +
    "\nET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

mkdirSync(outDir, { recursive: true });
for (const [name, lines] of Object.entries(DOCUMENTS)) {
  const file = path.join(outDir, name);
  writeFileSync(file, buildPdf(lines));
  console.log(`wrote public/samples/${name}`);
}
