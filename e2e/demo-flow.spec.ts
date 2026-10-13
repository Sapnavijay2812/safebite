import { expect, test } from "@playwright/test";

// One complete browser journey through the local demo. Requires the database to be
// migrated and seeded (npm run db:migrate && npm run db:seed) and the app running.

test("guided demo: explore, read a profile, ask the explainer, compare, report, moderate", async ({ page }) => {
  // Landing page and demo labelling
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Know your kitchen before your next bite");
  await expect(page.getByText("Demo data — fictional restaurants and simulated inspection records").first()).toBeVisible();

  // Discovery: search, filter and sort
  await page.goto("/restaurants");
  await page.getByLabel("Search by name, cuisine or neighbourhood").fill("taqueria");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=taqueria/);
  await expect(page.getByRole("link", { name: "Tidewater Taqueria" }).first()).toBeVisible();
  await expect(page.getByText(/1 restaurant matches?/)).toBeVisible();

  // Restaurant profile: critical violation is visible and separated from the score
  await page.goto("/restaurants/tidewater-taqueria");
  await expect(page.getByRole("heading", { name: "Unresolved official violations" })).toBeVisible();
  await expect(page.getByText("Raw chicken stored above ready-to-eat produce")).toBeVisible();
  await expect(page.getByText(/not averaged into the confidence number/)).toBeVisible();

  // AI explainer: deterministic demo answer with a citation
  await page.getByLabel("Your question").fill("Are there unresolved violations?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("DEMO EXPLAINER (deterministic template, not Gemini)")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/unresolved official finding\(s\) are recorded/)).toBeVisible();

  // Comparison: two restaurants side by side, with no ranking
  await page.goto("/compare?slugs=copperleaf-kitchen,saffron-and-stone");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText(/does not rank restaurants|does not rank/)).toBeVisible();

  // Community report: validation then a successful unverified submission
  await page.goto("/community?restaurant=lantern-noodle-bar");
  await page.getByLabel("What did you observe?").fill("Short");
  await page.getByRole("button", { name: "Submit as unverified report" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("What did you observe?").fill("A server handled cash and then plated food without changing gloves.");
  await page.getByRole("button", { name: "Submit as unverified report" }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved as unverified" })).toBeVisible();

  // Analytics dashboard renders from stored data
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Evidence health across the platform" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Evidence confidence by restaurant" })).toBeVisible();
});

test("methodology and not-found pages render", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: /How SafeBite measures evidence/ })).toBeVisible();
  const response = await page.goto("/restaurants/does-not-exist");
  expect(response?.status()).toBe(404);
});
