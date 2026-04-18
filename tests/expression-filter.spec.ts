import { expect, test } from '@grafana/plugin-e2e';
import { dismissWhatsNewModal } from './utils';

test.describe.serial('Expression filter', () => {
  test('filters grouped table numeric values with expression operator', async ({
    gotoPanelEditPage,
    page,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    await gotoPanelEditPage({ dashboard, id: '5' });
    await dismissWhatsNewModal(page);
    await expect(page.getByRole('heading', { name: 'Expression Filter Repro', exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('grid').first()).toBeVisible({ timeout: 15000 });

    const sessionHeader = page.getByRole('columnheader', { name: /Session/i });
    await expect(sessionHeader).toBeVisible({ timeout: 15000 });

    await sessionHeader.getByTestId('table-filter-header-button').click();

    const popup = page.locator('[class*="filterContainer"]').last();
    await expect(popup).toBeVisible();

    await popup.getByRole('textbox', { name: 'Filter values' }).fill('$<=228556801');
    await popup.getByRole('combobox').click();
    await page.getByTestId('data-testid Select menu').getByText('Expression', { exact: true }).click();
    await expect(popup.getByText('Expression', { exact: true })).toBeVisible();
    await popup.getByRole('button', { name: 'Ok' }).click();

    await expect(page.getByRole('gridcell', { name: '228556801' })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: '228556802' })).toHaveCount(0);
  });
});
