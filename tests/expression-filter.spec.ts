import { expect, test } from '@grafana/plugin-e2e';

test.describe.serial('Expression filter', () => {
  test('filters grouped table numeric values with expression operator', async ({
    gotoPanelEditPage,
    page,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '5' });

    const panel = panelEditPage.panel.locator;
    const sessionHeader = panel.getByRole('columnheader', { name: /Session/i });
    await expect(sessionHeader).toBeVisible();

    await sessionHeader.getByTestId('table-filter-header-button').click();

    const popup = page.locator('[class*="filterContainer"]').last();
    await expect(popup).toBeVisible();

    await popup.getByRole('textbox', { name: 'Filter values' }).fill('$<=228556801');
    await popup.getByRole('combobox').click();
    await page.getByTestId('data-testid Select menu').getByText('Expression', { exact: true }).click();
    await expect(popup.getByText('Expression', { exact: true })).toBeVisible();
    await popup.getByRole('button', { name: 'Ok' }).click();

    await expect(panel.getByText('228556801', { exact: true })).toBeVisible();
    await expect(panel.getByText('228556802', { exact: true })).toHaveCount(0);
  });
});
