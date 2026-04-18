import { Locator, Page } from '@playwright/test';

export function getPanelWithGridContainer(page: Page, title: string): Locator {
  return page
    .getByRole('heading', { name: title, exact: true })
    .locator('xpath=ancestor::*[descendant::*[@role="grid"]][1]');
}

export function getPanelWithTextContainer(page: Page, title: string, text: string): Locator {
  return page
    .getByRole('heading', { name: title, exact: true })
    .locator(`xpath=ancestor::*[descendant::*[contains(normalize-space(.), "${text}")]][1]`);
}

export async function dismissWhatsNewModal(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const dialog = page
      .getByRole('dialog')
      .filter({
        has: page.getByRole('heading', {
          name: /Grafana Assistant is now available to OSS users|What's new in Grafana/i,
        }),
      })
      .first();

    const isVisible = await dialog.isVisible().catch(() => false);
    if (isVisible) {
      await dialog.getByRole('button', { name: /close/i }).click({ force: true });
      await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
      return;
    }

    await page.waitForTimeout(500);
  }
}
