import { test, expect } from '@grafana/plugin-e2e';
import { dismissWhatsNewModal } from './utils';

test.describe.serial('Table with Column Grouping', () => {
  test('should display "No data" in case panel data is empty', async ({
    gotoPanelEditPage,
    page,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    await gotoPanelEditPage({ dashboard, id: '2' });
    await dismissWhatsNewModal(page);
    await expect(page.getByRole('columnheader')).toHaveCount(0);
    await expect(page.getByRole('gridcell')).toHaveCount(0);
  });

  test('should render table headers and data when data is present', async ({
    gotoPanelEditPage,
    page,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    await gotoPanelEditPage({ dashboard, id: '3' });
    await dismissWhatsNewModal(page);
    await expect(page.getByRole('grid', { name: 'Grouped table' })).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('columnheader', { name: 'Severity' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: 'DateTime' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: 'TransactionStatus' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('cell', { name: 'Info' }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('cell', { name: 'Test User A' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('should hide header row when "Show table header" is disabled', async ({
    gotoPanelEditPage,
    page,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    await dismissWhatsNewModal(page);
    const options = panelEditPage.getCustomOptions('Table');
    await options.expand();
    const showHeader = options.getSwitch('Show table header');

    await showHeader.uncheck();
    // Table implementation may keep header DOM but hide it when disabled.
    const headers = page.getByRole('columnheader');
    const headerCount = await headers.count();
    if (headerCount > 0) {
      await expect(headers.first()).toBeHidden();
    } else {
      await expect(headers).toHaveCount(0);
    }
  });
});
