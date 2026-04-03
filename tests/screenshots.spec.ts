import { expect, test } from '@grafana/plugin-e2e';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(process.cwd(), 'src/img/screenshots');

test.describe.serial('Catalog screenshots', () => {
  test.beforeAll(async () => {
    mkdirSync(outputDir, { recursive: true });
  });

  test('capture panel screenshots', async ({ gotoPanelEditPage, page, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });

    await page.setViewportSize({ width: 1600, height: 1000 });

    const groupedPanel = await gotoPanelEditPage({ dashboard, id: '3' });
    await expect(groupedPanel.panel.locator.getByRole('columnheader', { name: 'Severity' })).toBeVisible();
    await expect(groupedPanel.panel.locator.getByRole('columnheader', { name: 'User' })).toBeVisible();
    await expect(groupedPanel.panel.locator.getByRole('columnheader', { name: 'TransactionStatus' })).toBeVisible();
    await expect(groupedPanel.panel.locator.getByRole('cell', { name: 'Test User A' }).first()).toBeVisible();
    await groupedPanel.panel.locator.screenshot({
      path: path.join(outputDir, 'table-main.png'),
    });

    const tableOptions = groupedPanel.getCustomOptions('Table');
    await tableOptions.expand();
    await page.screenshot({
      path: path.join(outputDir, 'table-edit-options.png'),
      fullPage: false,
    });

    const panel2 = await gotoPanelEditPage({ dashboard, id: '2' });
    await expect(panel2.panel.locator).toBeVisible();
    await panel2.panel.locator.screenshot({
      path: path.join(outputDir, 'table-no-data.png'),
    });
  });
});
