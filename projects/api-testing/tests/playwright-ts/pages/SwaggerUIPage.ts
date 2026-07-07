import { expect, Locator, Page } from "@playwright/test";

export class SwaggerUiPage {
  readonly page: Page;
  readonly swaggerRoot: Locator;

  constructor(page: Page) {
    this.page = page;
    this.swaggerRoot = page.locator("section.swagger-container");
  }

  async open(path = "/api-docs"): Promise<void> {
    await this.page.goto(path);
    await expect(this.swaggerRoot).toBeVisible({ timeout: 15_000 });
  }

  async expectDocumentsItemsResource(): Promise<void> {
    const body = (await this.page.content()).toLowerCase();
    expect(body).toMatch(/\/api\/items|items/);
  }

  async expectShowsPostOperation(): Promise<void> {
    const body = (await this.page.content()).toLowerCase();
    expect(body).toContain("post");
  }

  async expectShowsGetOperation(): Promise<void> {
    const body = (await this.page.content()).toLowerCase();
    expect(body).toContain("get");
  }
}