import process from "node:process";
import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function logInAsAdmin(page) {
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set before running E2E tests.",
    );
  }

  await page.goto("/login");

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);

  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("attachments", () => {
  test("admin can upload an attachment to a project", async ({ page }) => {
    const fileName = `playwright-attachment-${Date.now()}.txt`;
    const fileContent = "Labfluss Playwright attachment E2E test file.";

    await logInAsAdmin(page);

    await page.goto("/projects");

    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    const firstProjectLink = page.locator('a[href^="/projects/"]').first();

    await expect(firstProjectLink).toBeVisible();

    await firstProjectLink.click();

    await expect(page).toHaveURL(/\/projects\/\d+$/);

    await page.getByRole("button", { name: "Upload File" }).click();

    await expect(
      page.getByRole("dialog", { name: "Upload Attachment" }),
    ).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(fileContent),
    });

    await expect(page.getByTitle(fileName)).toBeVisible();

    await page
      .getByRole("dialog", { name: "Upload Attachment" })
      .getByRole("button", { name: "Upload Attachment" })
      .click();

    await expect(
      page.getByRole("dialog", { name: "Upload Attachment" }),
    ).toBeHidden({ timeout: 15_000 });

    const attachmentHeading = page.getByRole("heading", {
      name: fileName,
      level: 5,
    });

    await expect(attachmentHeading).toBeVisible({
      timeout: 10_000,
    });

    const attachmentCard = attachmentHeading.locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' ant-card ')][1]",
    );

    await expect(attachmentCard).toBeVisible();

    const downloadPromise = page.waitForEvent("download");

    await attachmentCard.getByRole("button", { name: "Download" }).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(fileName);

    const downloadedPath = await download.path();

    expect(downloadedPath).toBeTruthy();

    await attachmentCard.getByRole("button", { name: "Archive" }).click();

    await page
      .getByRole("button", { name: "Archive", exact: true })
      .last()
      .click();

    await expect(attachmentHeading).toBeHidden({
      timeout: 10_000,
    });
  });
});
