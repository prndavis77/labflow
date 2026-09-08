import process from "node:process";
import { test, expect } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("authentication", () => {
  test("seeded admin can log in and reach the dashboard", async ({ page }) => {
    if (!adminEmail || !adminPassword) {
      throw new Error(
        "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set before running E2E tests.",
      );
    }

    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Log In to LabFlow" }),
    ).toBeVisible();

    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(adminPassword);

    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    await expect(
      page.getByRole("menuitem", { name: "Dashboard" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  });

  test("invalid login shows an error", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("invalid@example.com");
    await page.getByLabel("Password").fill("incorrect-password");

    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unauthenticated user is redirected from a protected route", async ({
    page,
  }) => {
    await page.goto("/projects");

    await expect(page).toHaveURL(/\/login$/);

    await expect(
      page.getByRole("heading", { name: "Log In to LabFlow" }),
    ).toBeVisible();
  });
});
