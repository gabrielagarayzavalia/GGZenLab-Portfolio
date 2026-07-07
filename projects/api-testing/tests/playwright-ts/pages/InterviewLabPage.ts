import { expect, Page } from "@playwright/test";
import { INTERVIEW_UI_LAB_URL } from "../helpers/fixture-url";

export class InterviewLabPage {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto(INTERVIEW_UI_LAB_URL);
    await expect(this.page.getByRole("heading", { name: "Interview UI Lab" })).toBeVisible();
  }

  statusText(): ReturnType<Page["getByText"]> {
    return this.page.locator("#status");
  }
}
