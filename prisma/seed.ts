// Seeds the local database with FICTIONAL demo data.
//   npm run db:seed
// Idempotent: clears the demo tables first, so re-running gives the same state.

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { SEED_CATEGORIES, SEED_RESTAURANTS, SEED_SOURCES } from "../src/lib/demo/seed-data";

const prisma = new PrismaClient();
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function fileFacts(storageKey: string) {
  const absolute = path.join(PUBLIC_DIR, storageKey);
  let bytes: Buffer;
  try {
    bytes = readFileSync(absolute);
  } catch {
    throw new Error(`Missing sample file public/${storageKey}. Run: npm run fixtures:pdf`);
  }
  return {
    sizeBytes: statSync(absolute).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function main() {
  await prisma.$transaction(
    async (tx) => {
      await tx.auditEvent.deleteMany();
      await tx.moderationAction.deleteMany();
      await tx.communityReport.deleteMany();
      await tx.documentExtraction.deleteMany();
      await tx.documentCategoryClaim.deleteMany();
      await tx.inspectionFinding.deleteMany();
      await tx.inspectionCategory.deleteMany();
      await tx.inspection.deleteMany();
      await tx.evidenceDocument.deleteMany();
      await tx.location.deleteMany();
      await tx.restaurant.deleteMany();
      await tx.evidenceSource.deleteMany();
      await tx.hygieneCategory.deleteMany();

      await tx.hygieneCategory.createMany({ data: SEED_CATEGORIES.map((c) => ({ ...c })) });
      await tx.evidenceSource.createMany({ data: SEED_SOURCES.map((s) => ({ ...s })) });

      for (const restaurant of SEED_RESTAURANTS) {
        const created = await tx.restaurant.create({
          data: {
            slug: restaurant.slug,
            name: restaurant.name,
            cuisine: restaurant.cuisine,
            priceTier: restaurant.priceTier,
            description: restaurant.description,
            accentColor: restaurant.accentColor,
            isFictional: true,
            location: {
              create: {
                addressLine: restaurant.location.addressLine,
                neighborhood: restaurant.location.neighborhood,
                city: "Harbor Bay",
                latitude: restaurant.location.latitude,
                longitude: restaurant.location.longitude,
              },
            },
          },
        });

        // Pass 1: inspections (so findings can reference later inspections).
        const inspectionIds = new Map<string, string>();
        for (const insp of restaurant.inspections) {
          const row = await tx.inspection.create({
            data: {
              restaurantId: created.id,
              inspectedAt: day(insp.date),
              authorityName: insp.authority,
              sourceKey: insp.sourceKey,
              outcome: insp.outcome,
              summary: insp.summary,
              isSimulated: insp.sourceKey === "OFFICIAL_SAMPLE",
              categories: { create: insp.categories.map((categoryKey) => ({ categoryKey })) },
            },
          });
          inspectionIds.set(insp.key, row.id);
        }

        // Pass 2: findings.
        for (const insp of restaurant.inspections) {
          for (const finding of insp.findings) {
            await tx.inspectionFinding.create({
              data: {
                inspectionId: inspectionIds.get(insp.key)!,
                categoryKey: finding.categoryKey,
                severity: finding.severity,
                description: finding.description,
                status: finding.status,
                remediation: finding.remediation ?? null,
                resolvedAt: finding.resolvedAt ? day(finding.resolvedAt) : null,
                resolvedByInspectionId: finding.resolvedByKey ? inspectionIds.get(finding.resolvedByKey) ?? null : null,
              },
            });
          }
        }

        // Documents, their category claims, and links to inspections.
        for (const doc of restaurant.documents) {
          const facts = fileFacts(doc.file);
          const row = await tx.evidenceDocument.create({
            data: {
              restaurantId: created.id,
              title: doc.title,
              kind: doc.kind,
              sourceKey: doc.sourceKey,
              storageKey: doc.file,
              originalFilename: path.basename(doc.file),
              mimeType: "application/pdf",
              sizeBytes: facts.sizeBytes,
              sha256: facts.sha256,
              isSample: true,
              issuedAt: day(doc.issuedAt),
              processingStatus: "PUBLISHED",
              claims: {
                create: doc.claims.map((c) => ({ categoryKey: c.categoryKey, claimsCompliant: c.claimsCompliant })),
              },
            },
          });
          if (doc.linkedInspectionKey) {
            await tx.inspection.update({
              where: { id: inspectionIds.get(doc.linkedInspectionKey)! },
              data: { documentId: row.id },
            });
          }
        }

        // Community reports, with the moderation trail implied by their status.
        let n = 0;
        for (const report of restaurant.reports) {
          n += 1;
          const row = await tx.communityReport.create({
            data: {
              restaurantId: created.id,
              category: report.category,
              description: report.description,
              incidentDate: day(report.incidentDate),
              status: report.status,
              submitterHash: createHash("sha256").update(`seed:${restaurant.slug}:${n}`).digest("hex").slice(0, 32),
            },
          });
          const trail: Array<{ from: string; to: string; note: string }> = [];
          if (report.status === "UNDER_REVIEW" || report.status === "CORROBORATED") {
            trail.push({ from: "PENDING", to: "UNDER_REVIEW", note: "Picked up for review (demo seed)." });
          }
          if (report.status === "CORROBORATED") {
            trail.push({ from: "UNDER_REVIEW", to: "CORROBORATED", note: report.moderationNote ?? "Corroborated (demo seed)." });
          }
          if (report.status === "REJECTED") {
            trail.push({ from: "PENDING", to: "REJECTED", note: report.moderationNote ?? "Rejected (demo seed)." });
          }
          for (const step of trail) {
            await tx.moderationAction.create({
              data: { reportId: row.id, fromStatus: step.from, toStatus: step.to, note: step.note, actor: "demo-seed" },
            });
          }
        }
      }

      await tx.auditEvent.create({
        data: {
          eventType: "DEMO_DATA_SEEDED",
          entityType: "System",
          entityId: "seed",
          actor: "demo-seed",
          metadata: JSON.stringify({ restaurants: SEED_RESTAURANTS.length, fictional: true }),
        },
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  console.log(`Seeded ${SEED_RESTAURANTS.length} fictional restaurants with simulated records.`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
