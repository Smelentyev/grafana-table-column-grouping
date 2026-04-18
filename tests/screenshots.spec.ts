import { expect, test } from '@grafana/plugin-e2e';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { dismissWhatsNewModal, getPanelWithGridContainer, getPanelWithTextContainer } from './utils';

const outputDir = path.resolve(process.cwd(), 'src/img/screenshots');

test.describe.serial('Catalog screenshots', () => {
  test.beforeAll(async () => {
    mkdirSync(outputDir, { recursive: true });
  });

  test('capture panel screenshots', async ({ gotoPanelEditPage, page, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });

    await page.setViewportSize({ width: 1600, height: 1000 });

    const groupedPanel = await gotoPanelEditPage({ dashboard, id: '3' });
    await dismissWhatsNewModal(page);
    await expect(page.getByRole('grid', { name: 'Grouped table' })).toBeVisible({ timeout: 15000 });
    const groupedPanelRegion = getPanelWithGridContainer(page, 'README Demo - Grouped Audit Events');
    await expect(page.getByRole('columnheader', { name: 'Severity' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: 'TransactionStatus' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('cell', { name: 'Test User A' }).first()).toBeVisible({ timeout: 15000 });
    await groupedPanelRegion.screenshot({
      path: path.join(outputDir, 'table-main.png'),
    });

    const tableOptions = groupedPanel.getCustomOptions('Table');
    await tableOptions.expand();
    await page.screenshot({
      path: path.join(outputDir, 'table-edit-options.png'),
      fullPage: false,
    });

    await gotoPanelEditPage({ dashboard, id: '2' });
    await dismissWhatsNewModal(page);
    const panel2 = getPanelWithTextContainer(page, 'Sample Panel Title', 'No data');
    await expect(panel2).toBeVisible();
    await panel2.screenshot({
      path: path.join(outputDir, 'table-no-data.png'),
    });
  });
});
