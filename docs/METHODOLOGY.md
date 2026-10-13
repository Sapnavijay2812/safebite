# SafeBite methodology

This document is the specification. The implementation is `src/lib/scoring/transparency.ts`, and its tests are in `transparency.test.ts`. If the two disagree, the tests are the arbiter and this document should be corrected.

## 1. Purpose and limits

SafeBite answers a narrower question than "is this kitchen safe?": **how much verifiable food safety evidence is on record for this restaurant, how recent it is, where it came from, and whether the sources agree.**

- It is **not** a safety rating, a grade, or a certification.
- Missing evidence is **unknown**, not unsafe.
- Unresolved official violations are **reported separately** and are never averaged into the evidence number.
- AI output never sets or changes a score.

## 2. Evidence tiers

Every evidence record carries one of five tiers. The tier determines both the weight used for source quality and whether the record can count at all.

| Tier | Source examples in the demo | Weight | Counts for coverage? | Counts for source quality? |
| --- | --- | --- | --- | --- |
| `OFFICIAL_VERIFIED` | Authority inspection record (simulated in demo) | 1.0 | yes | yes |
| `INDEPENDENT_CHECK` | Third-party audit summary (simulated) | 0.8 | yes | yes |
| `SELF_REPORTED` | Restaurant food safety plan, logs, training records | 0.4 | yes | yes |
| `UNVERIFIED_ALLEGATION` | Community report (any status) | 0 | no | no |
| `AI_INFERRED` | Model interpretation | 0 | no | no |

Notes:
- Only **published** documents and inspection records become evidence items. Uploaded documents that are still in review do not count.
- A document of kind `INSPECTION_REPORT` is represented by its inspection record. It is not counted a second time.
- The demo marks authority-style records as *simulated*. They are not genuine authority records.

## 3. Components

The evidence confidence score `S` is an integer from 0 to 100:

```
S = round( 0.35 × Coverage + 0.25 × Freshness + 0.25 × SourceQuality + 0.15 × Consistency )
```

Each component is also in the range 0–100.

### 3.1 Coverage

There are six hygiene categories: food storage, temperature controls, cleanliness, pest management, staff hygiene, and cross-contamination prevention.

A category is **covered** when at least one scorable evidence item (tier weight > 0) that lists that category has a date within the last **540 days** of the as-of date. Items dated after the as-of date are ignored.

```
Coverage = round( covered categories / 6 × 100 )
```

### 3.2 Freshness

Freshness uses only the **latest official inspection** (tier `OFFICIAL_VERIFIED`, kind inspection). Its age in whole days, `d`, sets the score:

| Age `d` (days) | Freshness |
| --- | --- |
| `d ≤ 180` | 100 |
| `180 < d ≤ 365` | 75 |
| `365 < d ≤ 540` | 50 |
| `540 < d ≤ 730` | 25 |
| `d > 730`, or no official inspection | 0 |

An official inspection older than 730 days scores 0, the same as having no official inspection. The explanation text distinguishes the two cases. Both are shown as unknown, not unsafe.

### 3.3 Source quality

```
SourceQuality = round( mean over scorable items of TierWeight(item) × 100 )
```

If there are no scorable items, the value is 0.

### 3.4 Consistency

Consistency starts at 100 and loses **25 points for each hygiene category** where a *self-reported compliance claim* conflicts with an **unresolved official finding** in the same category.

```
Consistency = max(0, 100 − 25 × conflictingCategories)
```

If there are no scorable items at all, consistency is 0. This avoids rewarding an empty record.

## 4. Labels

| Score | Label |
| --- | --- |
| 80–100 | Strong evidence coverage |
| 60–79 | Good evidence coverage |
| 40–59 | Partial evidence coverage |
| 0–39 | Limited evidence coverage |

These labels describe coverage only. They are not safety bands. If no category has in-window evidence (coverage is 0), the label is always "Limited", even when source quality and consistency lift the number.

## 5. Separate indicators (never averaged)

Shown beside the score, with their own counts and visuals:

- **Unresolved official findings**, by severity (critical, major, minor, observation). Only `OFFICIAL_VERIFIED` findings with status `UNRESOLVED` count.
- **Missing information** list: uncovered categories, no official inspection, an old inspection, no documents, no location.
- **Community reports**: counts per status. Only `CORROBORATED` reports have text shown, labelled as unverified allegations.

A critical or major unresolved official finding also triggers an explicit alert on the profile. It is never hidden by high coverage.

## 6. Worked example

Restaurant A has:
- an official inspection 60 days old that covers all six categories,
- no unresolved findings,
- and no self-reported claims.

Coverage 100, Freshness 100, SourceQuality 100, Consistency 100, so **S = 100**.

Now add a published self-attestation (a restaurant-submitted document) that claims temperature control is compliant, and an unresolved official MINOR temperature finding:
- Items: the inspection (weight 1.0) and the self-attestation (weight 0.4). Both count as evidence items.
- Coverage 100 (all six categories are covered by the inspection), Freshness 100 (60 days old), SourceQuality 70 (mean of 1.0 and 0.4), Consistency 75 (one category, temperature control, has a compliance claim that conflicts with an unresolved official finding).
- **S = round(0.35 × 100 + 0.25 × 100 + 0.25 × 70 + 0.15 × 75) = round(88.75) = 89.**

The unresolved minor finding is listed under "Unresolved official violations" and is not part of the 89.

## 7. Determinism and testing

- Inputs are the stored records plus an as-of timestamp. The default as-of is "now". Set `SAFEBITE_AS_OF` to freeze it for a demonstration.
- The function is pure. The same inputs always produce the same output.
- Unit tests cover: determinism, empty records, full-marks cases, weight normalisation, unresolved versus resolved critical findings, unverified and AI-inferred exclusion, self-reported coverage, the coverage window, contradictions, freshness bands and label boundaries.

## 8. Why these choices

- **Freshness is based on official records only.** A self-reported plan is informative but cannot prove a recent inspection.
- **Coverage uses a 540-day window** so that a restaurant with a well-documented record isn't penalised for a short gap, while really old evidence stops counting.
- **Source weights are judgements, not measured accuracy.** They reflect how much independent verification each source has had. They should be reviewed with domain experts before any real-world use.
- **Contradictions cost 25 points each** to make a conflict visible without letting one conflict dominate.

## 9. Limitations

- The model has not been validated against health outcomes or inspection outcomes across a population.
- Inspections are snapshots. Conditions change between visits.
- SafeBite does not verify whether a document is authentic. "Official" means the record was labelled as official by its source tier. Real deployments need a provenance process.
- Coverage counts categories, not depth. A category with one thin record counts the same as one with a full audit.
- Weights and thresholds are configuration decisions, documented here, and should be governed as such.

## 10. Changing the method

1. Change the constants in `transparency.ts` (`COMPONENT_WEIGHTS`, `TIER_WEIGHTS`, `FRESHNESS_BANDS`, `COVERAGE_WINDOW_DAYS`, `CONTRADICTION_PENALTY`). The methodology page reads them, so the public description stays in sync.
2. Update the tests and the worked example in this document.
3. Record the reason in the commit message.
