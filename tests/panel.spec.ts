import { test, expect } from '@grafana/plugin-e2e';

test.describe.serial('Table with Column Grouping', () => {
  test('should display "No data" in case panel data is empty', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '2' });
    await expect(panelEditPage.panel.locator.getByRole('columnheader')).toHaveCount(0);
    await expect(panelEditPage.panel.locator.getByRole('gridcell')).toHaveCount(0);
  });

  test('should render table headers and data when data is present', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });

    await expect(panelEditPage.panel.locator.getByRole('columnheader', { name: 'Time' })).toBeVisible();
    await expect(panelEditPage.panel.locator.getByRole('columnheader', { name: 'Label' })).toBeVisible();
    await expect(panelEditPage.panel.locator.getByRole('columnheader', { name: 'Value' })).toBeVisible();
    await expect(panelEditPage.panel.locator.getByRole('gridcell', { name: 'A' })).toBeVisible();
    await expect(panelEditPage.panel.locator.getByRole('gridcell', { name: '10' })).toBeVisible();
  });

  test('should hide header row when "Show table header" is disabled', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const options = panelEditPage.getCustomOptions('Table');
    await options.expand();
    const showHeader = options.getSwitch('Show table header');

    await showHeader.uncheck();
    // Table implementation may keep header DOM but hide it when disabled.
    const headers = panelEditPage.panel.locator.getByRole('columnheader');
    const headerCount = await headers.count();
    if (headerCount > 0) {
      await expect(headers.first()).toBeHidden();
    } else {
      await expect(headers).toHaveCount(0);
    }
  });
});
