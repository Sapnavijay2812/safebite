// FICTIONAL demo dataset. Every restaurant, authority, auditor and inspection
// record below is invented for the demo. "OFFICIAL_SAMPLE" records are simulated
// and are never genuine authority records. Do not replace these names with real
// businesses or real inspection results.

export const ALL_CATEGORIES = [
  "FOOD_STORAGE",
  "TEMPERATURE_CONTROL",
  "CLEANLINESS",
  "PEST_MANAGEMENT",
  "STAFF_HYGIENE",
  "CROSS_CONTAMINATION",
] as const;

export const SEED_CATEGORIES = [
  { key: "FOOD_STORAGE", label: "Food storage", description: "Labelling, date marking, separation and off-floor storage of ingredients.", sortOrder: 1 },
  { key: "TEMPERATURE_CONTROL", label: "Temperature controls", description: "Hot and cold holding, cooling logs and refrigeration performance.", sortOrder: 2 },
  { key: "CLEANLINESS", label: "Cleanliness", description: "Cleaning schedules, sanitiser concentration and surface condition.", sortOrder: 3 },
  { key: "PEST_MANAGEMENT", label: "Pest management", description: "Pest control contracts, sightings records and exclusion measures.", sortOrder: 4 },
  { key: "STAFF_HYGIENE", label: "Staff hygiene", description: "Handwashing facilities, illness reporting and protective clothing.", sortOrder: 5 },
  { key: "CROSS_CONTAMINATION", label: "Cross-contamination prevention", description: "Allergen and raw/ready-to-eat separation, colour-coded equipment and utensils.", sortOrder: 6 },
] as const;

export const SEED_SOURCES = [
  { key: "OFFICIAL_SAMPLE", label: "Official record (simulated sample)", tier: "OFFICIAL_VERIFIED", description: "Simulated authority-style record for the demo. Not a genuine authority record." },
  { key: "INDEPENDENT_AUDIT", label: "Independent audit (simulated)", tier: "INDEPENDENT_CHECK", description: "Simulated third-party check, performed by a party other than the restaurant or authority." },
  { key: "RESTAURANT_SUBMITTED", label: "Restaurant-submitted", tier: "SELF_REPORTED", description: "Documents submitted by the restaurant. Not independently verified." },
  { key: "COMMUNITY_REPORT", label: "Community report (unverified)", tier: "UNVERIFIED_ALLEGATION", description: "Customer report that has not been verified. Never scored." },
  { key: "AI_INFERENCE", label: "AI-inferred signal", tier: "AI_INFERRED", description: "Machine interpretation. Never scored and never a certification." },
] as const;

export interface SeedFinding {
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "OBSERVATION";
  categoryKey: string;
  description: string;
  status: "UNRESOLVED" | "RESOLVED";
  remediation?: string;
  // Key of the later inspection that verified the resolution.
  resolvedByKey?: string;
  resolvedAt?: string;
}

export interface SeedInspection {
  key: string;
  date: string;
  authority: string;
  sourceKey: string;
  outcome: "PASS" | "PASS_WITH_CONDITIONS" | "FAIL";
  summary: string;
  categories: readonly string[];
  findings: SeedFinding[];
}

export interface SeedDocument {
  title: string;
  kind: "INSPECTION_REPORT" | "SELF_ATTESTATION" | "AUDIT_CERTIFICATE";
  sourceKey: string;
  file: string;
  issuedAt: string;
  // Only the sample inspection report is linked to an inspection record.
  linkedInspectionKey?: string;
  claims: Array<{ categoryKey: string; claimsCompliant: boolean }>;
}

export interface SeedReport {
  category: string;
  status: "PENDING" | "UNDER_REVIEW" | "CORROBORATED" | "REJECTED";
  incidentDate: string;
  description: string;
  moderationNote?: string;
}

export interface SeedRestaurant {
  slug: string;
  name: string;
  cuisine: string;
  priceTier: number;
  accentColor: string;
  description: string;
  location: { addressLine: string; neighborhood: string; latitude: number; longitude: number };
  inspections: SeedInspection[];
  documents: SeedDocument[];
  reports: SeedReport[];
}

const ALL = ALL_CATEGORIES;

export const SEED_RESTAURANTS: SeedRestaurant[] = [
  {
    slug: "copperleaf-kitchen",
    name: "Copperleaf Kitchen",
    cuisine: "Modern American",
    priceTier: 3,
    accentColor: "#2F6B4F",
    description: "Seasonal small plates and a wood-fired grill, built around an open kitchen. Fictional demo restaurant with a recent simulated inspection that has one open temperature finding.",
    location: { addressLine: "14 Foundry Lane", neighborhood: "Old Mill", latitude: 0.62, longitude: 0.38 },
    inspections: [
      {
        key: "copperleaf-2026-07",
        date: "2026-07-08",
        authority: "Harbor Bay Demo Health Department (simulated)",
        sourceKey: "OFFICIAL_SAMPLE",
        outcome: "PASS_WITH_CONDITIONS",
        summary: "Cooler temperature needs service. Other areas were recorded as acceptable.",
        categories: ALL,
        findings: [
          { severity: "MAJOR", categoryKey: "TEMPERATURE_CONTROL", description: "Reach-in cooler on the pass recorded 8.5 C at inspection", status: "UNRESOLVED", remediation: "Unit to be serviced; probe log to be provided at re-inspection." },
          { severity: "MINOR", categoryKey: "CLEANLINESS", description: "Hood filters due for cleaning", status: "RESOLVED", remediation: "Filters cleaned on site during the inspection.", resolvedAt: "2026-07-08" },
          { severity: "OBSERVATION", categoryKey: "STAFF_HYGIENE", description: "Handwash sink signage faded", status: "RESOLVED", remediation: "Replacement signage fitted.", resolvedAt: "2026-07-08" },
        ],
      },
      {
        key: "copperleaf-2025-12",
        date: "2025-12-03",
        authority: "Harbor Bay Demo Health Department (simulated)",
        sourceKey: "OFFICIAL_SAMPLE",
        outcome: "PASS",
        summary: "No findings recorded in any assessed area.",
        categories: ALL,
        findings: [],
      },
    ],
    documents: [
      { title: "Inspection report — 2026-07-08 (simulated)", kind: "INSPECTION_REPORT", sourceKey: "OFFICIAL_SAMPLE", file: "samples/sample-inspection-report.pdf", issuedAt: "2026-07-08", linkedInspectionKey: "copperleaf-2026-07", claims: [] },
      { title: "Restaurant food safety plan (self-attestation)", kind: "SELF_ATTESTATION", sourceKey: "RESTAURANT_SUBMITTED", file: "samples/copperleaf-food-safety-plan.pdf", issuedAt: "2026-08-01", claims: [
        { categoryKey: "FOOD_STORAGE", claimsCompliant: true },
        { categoryKey: "TEMPERATURE_CONTROL", claimsCompliant: true },
      ] },
    ],
    reports: [],
  },
  {
    slug: "saffron-and-stone",
    name: "Saffron & Stone",
    cuisine: "Indian",
    priceTier: 2,
    accentColor: "#C2703D",
    description: "Regional curries, tandoor breads and a shared thali menu. Fictional demo restaurant with consistently clean simulated records.",
    location: { addressLine: "52 Cardamom Row", neighborhood: "Market Quarter", latitude: 0.25, longitude: 0.7 },
    inspections: [
      { key: "saffron-2026-08", date: "2026-08-19", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS", summary: "All assessed areas were recorded as acceptable.", categories: ALL, findings: [] },
      { key: "saffron-2026-02", date: "2026-02-11", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS", summary: "One minor storage finding, corrected during the visit.", categories: ALL, findings: [
        { severity: "MINOR", categoryKey: "FOOD_STORAGE", description: "Dal container missing open-date label", status: "RESOLVED", remediation: "Label added during inspection.", resolvedAt: "2026-02-11" },
      ] },
    ],
    documents: [
      { title: "Independent hygiene check summary (simulated)", kind: "AUDIT_CERTIFICATE", sourceKey: "INDEPENDENT_AUDIT", file: "samples/saffron-audit-summary.pdf", issuedAt: "2026-05-20", claims: [
        { categoryKey: "CLEANLINESS", claimsCompliant: true },
        { categoryKey: "PEST_MANAGEMENT", claimsCompliant: true },
      ] },
    ],
    reports: [],
  },
  {
    slug: "tidewater-taqueria",
    name: "Tidewater Taqueria",
    cuisine: "Mexican",
    priceTier: 1,
    accentColor: "#B5532E",
    description: "Street-style tacos and aguas frescas from a counter-service kitchen. Fictional demo restaurant with an old simulated inspection that recorded a critical cross-contamination finding.",
    location: { addressLine: "7 Pier Street", neighborhood: "Harbor Row", latitude: 0.82, longitude: 0.66 },
    inspections: [
      { key: "tidewater-2025-11", date: "2025-11-02", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "FAIL", summary: "Critical cross-contamination risk observed at the reach-in. Re-inspection not yet on record.", categories: ALL, findings: [
        { severity: "CRITICAL", categoryKey: "CROSS_CONTAMINATION", description: "Raw chicken stored above ready-to-eat produce in the reach-in cooler", status: "UNRESOLVED", remediation: "Storage reorganised on site; re-inspection required." },
        { severity: "MAJOR", categoryKey: "CLEANLINESS", description: "Prep surfaces not sanitised between tasks", status: "UNRESOLVED" },
        { severity: "MINOR", categoryKey: "STAFF_HYGIENE", description: "Glove change log incomplete", status: "RESOLVED", remediation: "Log introduced; checked at follow-up.", resolvedAt: "2025-11-02" },
      ] },
    ],
    documents: [],
    reports: [
      { category: "CROSS_CONTAMINATION", status: "CORROBORATED", incidentDate: "2026-03-14", description: "Demo report: a second independent report describes raw and cooked items stored together at the same counter. The moderator matched the description to the published demo record.", moderationNote: "Second independent report matched the official record date and category." },
      { category: "CLEANLINESS", status: "UNDER_REVIEW", incidentDate: "2026-08-02", description: "Demo report: prep boards looked unwashed at the lunch rush. Awaiting a second report before any conclusion." },
    ],
  },
  {
    slug: "lantern-noodle-bar",
    name: "Lantern Noodle Bar",
    cuisine: "Pan-Asian",
    priceTier: 2,
    accentColor: "#7A5C99",
    description: "Hand-pulled noodles and small dumplings in a canal-side room. Fictional demo restaurant with no official inspection on record: an example of missing evidence.",
    location: { addressLine: "3 Lantern Wharf", neighborhood: "Canal Side", latitude: 0.45, longitude: 0.88 },
    inspections: [],
    documents: [
      { title: "Storage and cleaning self-attestation", kind: "SELF_ATTESTATION", sourceKey: "RESTAURANT_SUBMITTED", file: "samples/lantern-self-attestation.pdf", issuedAt: "2026-09-01", claims: [
        { categoryKey: "FOOD_STORAGE", claimsCompliant: true },
        { categoryKey: "CLEANLINESS", claimsCompliant: true },
      ] },
    ],
    reports: [
      { category: "STAFF_HYGIENE", status: "PENDING", incidentDate: "2026-09-20", description: "Demo report: a server appeared to handle money and then food without changing gloves." },
      { category: "CLEANLINESS", status: "UNDER_REVIEW", incidentDate: "2026-08-28", description: "Demo report: restroom supplies were empty during a weekday lunch service." },
    ],
  },
  {
    slug: "maple-and-mortar",
    name: "Maple & Mortar Bakery",
    cuisine: "Bakery café",
    priceTier: 2,
    accentColor: "#9C6B3E",
    description: "Sourdough, pastries and all-day coffee. Fictional demo bakery whose critical pest finding was resolved and then verified on re-inspection.",
    location: { addressLine: "120 Millstone Avenue", neighborhood: "Market Quarter", latitude: 0.31, longitude: 0.46 },
    inspections: [
      { key: "maple-2026-02", date: "2026-02-20", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS_WITH_CONDITIONS", summary: "Re-inspection confirmed pest entry points were sealed. One minor storage item remains open.", categories: ALL, findings: [
        { severity: "MINOR", categoryKey: "FOOD_STORAGE", description: "Flour bins not fully sealed", status: "UNRESOLVED", remediation: "To be checked at next routine inspection." },
        { severity: "OBSERVATION", categoryKey: "STAFF_HYGIENE", description: "Apron laundry schedule not posted", status: "RESOLVED", remediation: "Schedule posted.", resolvedAt: "2026-02-20" },
      ] },
      { key: "maple-2025-12", date: "2025-12-15", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "FAIL", summary: "Critical pest activity observed in the dry store. Follow-up inspection required.", categories: ALL, findings: [
        { severity: "CRITICAL", categoryKey: "PEST_MANAGEMENT", description: "Droppings observed in the dry store behind shelving", status: "RESOLVED", remediation: "Pest contractor visit logged; entry gaps sealed.", resolvedByKey: "maple-2026-02", resolvedAt: "2026-02-20" },
      ] },
    ],
    documents: [],
    reports: [],
  },
  {
    slug: "oakline-pizzeria",
    name: "Oakline Pizzeria",
    cuisine: "Italian",
    priceTier: 2,
    accentColor: "#8C3B2E",
    description: "Wood-fired pizzas and a neighbourhood wine list. Fictional demo pizzeria with a complete simulated inspection and a rejected spam report.",
    location: { addressLine: "88 Orchard Avenue", neighborhood: "Old Mill", latitude: 0.7, longitude: 0.3 },
    inspections: [
      { key: "oakline-2026-02", date: "2026-02-03", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS", summary: "All assessed areas were acceptable. One minor cleaning item was corrected on the day.", categories: ALL, findings: [
        { severity: "MINOR", categoryKey: "CLEANLINESS", description: "Oven vent filter overdue for cleaning", status: "RESOLVED", remediation: "Filter cleaned during the visit.", resolvedAt: "2026-02-03" },
      ] },
    ],
    documents: [],
    reports: [
      { category: "OTHER", status: "REJECTED", incidentDate: "2026-06-01", description: "Demo report: repeated promotional text unrelated to food safety.", moderationNote: "Promotional content unrelated to food safety. Rejected as spam." },
    ],
  },
  {
    slug: "harvest-table",
    name: "Harvest Table",
    cuisine: "Vegan",
    priceTier: 2,
    accentColor: "#4E7D3A",
    description: "Plant-based bowls and fermented sides from a garden-district kitchen. Fictional demo restaurant with an independent audit and no official inspection on record.",
    location: { addressLine: "3 Linden Court", neighborhood: "Garden District", latitude: 0.12, longitude: 0.22 },
    inspections: [
      { key: "harvest-2026-05", date: "2026-05-14", authority: "Fictional Independent Audit Co. (simulated)", sourceKey: "INDEPENDENT_AUDIT", outcome: "PASS", summary: "Independent check found no issues in the assessed areas.", categories: ALL, findings: [] },
    ],
    documents: [
      { title: "Allergen and cross-contact matrix (self-reported)", kind: "SELF_ATTESTATION", sourceKey: "RESTAURANT_SUBMITTED", file: "samples/harvest-allergen-matrix.pdf", issuedAt: "2026-06-01", claims: [
        { categoryKey: "CROSS_CONTAMINATION", claimsCompliant: true },
      ] },
    ],
    reports: [],
  },
  {
    slug: "juniper-grill",
    name: "Juniper Grill",
    cuisine: "Grill",
    priceTier: 3,
    accentColor: "#3F5F4B",
    description: "Dry-aged cuts and seasonal vegetables over open flame. Fictional demo restaurant whose only simulated inspection is now more than 18 months old.",
    location: { addressLine: "27 Harbor Steps", neighborhood: "Harbor Row", latitude: 0.9, longitude: 0.55 },
    inspections: [
      { key: "juniper-2024-06", date: "2024-06-18", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS", summary: "All assessed areas were acceptable at the time of this visit.", categories: ALL, findings: [] },
    ],
    documents: [],
    reports: [],
  },
  {
    slug: "bluefin-sushi-house",
    name: "Bluefin Sushi House",
    cuisine: "Japanese",
    priceTier: 3,
    accentColor: "#1F4E6B",
    description: "Omakase counter and a small izakaya menu. Fictional demo restaurant with an open major pest finding that conflicts with a self-reported service log.",
    location: { addressLine: "19 Anchor Street", neighborhood: "Harbor Row", latitude: 0.78, longitude: 0.74 },
    inspections: [
      { key: "bluefin-2026-06", date: "2026-06-30", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS_WITH_CONDITIONS", summary: "Evidence of rodent droppings behind dry-store shelving. Contractor visit pending.", categories: ALL, findings: [
        { severity: "MAJOR", categoryKey: "PEST_MANAGEMENT", description: "Rodent droppings behind dry-store shelving", status: "UNRESOLVED", remediation: "Pest contractor visit to be booked; re-inspection required." },
        { severity: "MINOR", categoryKey: "STAFF_HYGIENE", description: "Handwash sink soap dispenser empty", status: "RESOLVED", remediation: "Dispenser refilled on site.", resolvedAt: "2026-06-30" },
      ] },
      { key: "bluefin-2026-01", date: "2026-01-15", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS", summary: "All assessed areas were acceptable.", categories: ALL, findings: [] },
    ],
    documents: [
      { title: "Pest control service log (self-reported)", kind: "SELF_ATTESTATION", sourceKey: "RESTAURANT_SUBMITTED", file: "samples/bluefin-pest-service-log.pdf", issuedAt: "2026-07-02", claims: [
        { categoryKey: "PEST_MANAGEMENT", claimsCompliant: true },
      ] },
    ],
    reports: [
      { category: "PEST_MANAGEMENT", status: "CORROBORATED", incidentDate: "2026-06-12", description: "Demo report: a second independent report describes droppings near the dry store. Both reports were matched to the simulated inspection finding.", moderationNote: "Second independent report corroborated the category and time window." },
      { category: "CLEANLINESS", status: "PENDING", incidentDate: "2026-09-05", description: "Demo report: floor by the sushi bar looked sticky during dinner service." },
    ],
  },
  {
    slug: "ember-and-oak",
    name: "Ember & Oak BBQ",
    cuisine: "BBQ",
    priceTier: 2,
    accentColor: "#8E3E1F",
    description: "Post-oak smoked brisket and ribs with a long-run smoker. Fictional demo restaurant whose self-reported temperature summary conflicts with an open minor finding.",
    location: { addressLine: "41 Smokehouse Lane", neighborhood: "Canal Side", latitude: 0.52, longitude: 0.93 },
    inspections: [
      { key: "ember-2026-01", date: "2026-01-27", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS_WITH_CONDITIONS", summary: "Smoker log gaps on two weekday shifts. Other areas acceptable.", categories: ALL, findings: [
        { severity: "MINOR", categoryKey: "TEMPERATURE_CONTROL", description: "Smoker log gaps on two weekday shifts", status: "UNRESOLVED", remediation: "Log completion to be checked at next visit." },
        { severity: "OBSERVATION", categoryKey: "CLEANLINESS", description: "Grease trap cleaning date not visible", status: "RESOLVED", remediation: "Date sticker added.", resolvedAt: "2026-01-27" },
      ] },
    ],
    documents: [
      { title: "Smoker and cooler temperature summary (self-reported)", kind: "SELF_ATTESTATION", sourceKey: "RESTAURANT_SUBMITTED", file: "samples/ember-temperature-summary.pdf", issuedAt: "2026-02-10", claims: [
        { categoryKey: "TEMPERATURE_CONTROL", claimsCompliant: true },
      ] },
    ],
    reports: [],
  },
  {
    slug: "padma-dosa-corner",
    name: "Padma Dosa Corner",
    cuisine: "South Indian",
    priceTier: 1,
    accentColor: "#B08A2E",
    description: "Crisp dosas, filter coffee and sambar from a counter near the market. Fictional demo stall with no inspection or document on record and two pending community reports.",
    location: { addressLine: "9 Spice Lane", neighborhood: "Market Quarter", latitude: 0.36, longitude: 0.58 },
    inspections: [],
    documents: [],
    reports: [
      { category: "CLEANLINESS", status: "PENDING", incidentDate: "2026-10-01", description: "Demo report: the serving counter looked wet and unwiped at opening time." },
      { category: "OTHER", status: "PENDING", incidentDate: "2026-09-15", description: "Demo report: queue was long and staff seemed rushed. No specific food safety concern described." },
    ],
  },
  {
    slug: "crumb-and-cask",
    name: "Crumb & Cask Brewpub",
    cuisine: "Gastropub",
    priceTier: 2,
    accentColor: "#5B4636",
    description: "House-brewed ales with bar snacks and a weekend brunch menu. Fictional demo brewpub with a clean simulated inspection and an independent check.",
    location: { addressLine: "66 Hops Way", neighborhood: "Garden District", latitude: 0.18, longitude: 0.3 },
    inspections: [
      { key: "crumb-2026-04", date: "2026-04-09", authority: "Harbor Bay Demo Health Department (simulated)", sourceKey: "OFFICIAL_SAMPLE", outcome: "PASS", summary: "All assessed areas were acceptable.", categories: ALL, findings: [] },
      { key: "crumb-2026-07", date: "2026-07-22", authority: "Fictional Independent Audit Co. (simulated)", sourceKey: "INDEPENDENT_AUDIT", outcome: "PASS", summary: "Independent check of storage and cleaning areas found no issues.", categories: ["FOOD_STORAGE", "CLEANLINESS"], findings: [] },
    ],
    documents: [
      { title: "Staff hygiene training record (self-reported)", kind: "SELF_ATTESTATION", sourceKey: "RESTAURANT_SUBMITTED", file: "samples/crumb-staff-training.pdf", issuedAt: "2026-07-30", claims: [
        { categoryKey: "STAFF_HYGIENE", claimsCompliant: true },
      ] },
    ],
    reports: [],
  },
];

export const DEMO_QUESTIONS = [
  { slug: "copperleaf-kitchen", question: "Why is this restaurant's evidence confidence lower?" },
  { slug: "copperleaf-kitchen", question: "What does its latest inspection report actually say?" },
  { slug: "tidewater-taqueria", question: "Are there unresolved violations?" },
  { slug: "lantern-noodle-bar", question: "What information is missing?" },
  { slug: "harvest-table", question: "How does this restaurant compare with another?" },
  { slug: "saffron-and-stone", question: "What should I look for when evaluating food safety?" },
] as const;
