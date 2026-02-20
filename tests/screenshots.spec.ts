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

    const panel1 = await gotoPanelEditPage({ dashboard, id: '1' });
    await expect(panel1.panel.locator.getByRole('columnheader', { name: 'Sales' })).toBeVisible();
    await expect(panel1.panel.locator.getByRole('columnheader', { name: 'Plan' })).toBeVisible();
    await expect(panel1.panel.locator.getByRole('columnheader', { name: 'Profit' })).toBeVisible();
    await panel1.panel.locator.screenshot({
      path: path.join(outputDir, 'table-main.png'),
    });

    const tableOptions = panel1.getCustomOptions('Table');
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
