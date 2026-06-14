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

  test('should resize a leaf independently and a parent group proportionally', async ({
    gotoPanelEditPage,
    page,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
    await gotoPanelEditPage({ dashboard, id: '1' });
    await dismissWhatsNewModal(page);

    const salesHeader = page.getByRole('columnheader', { name: 'Sales', exact: true });
    const planHeader = page.getByRole('columnheader', { name: 'Plan', exact: true });
    const actualHeader = page.getByRole('columnheader', { name: 'Actual', exact: true });
    await expect(salesHeader).toBeVisible({ timeout: 15000 });
    await expect(planHeader).toBeVisible();
    await expect(actualHeader).toBeVisible();

    const groupedGrid = page.getByRole('grid', { name: 'Grouped table' });
    const hasHorizontalOverflow = await groupedGrid.evaluate(
      (element) => element.scrollWidth > element.clientWidth
    );
    expect(hasHorizontalOverflow).toBe(true);

    const initialPlanWidth = (await planHeader.boundingBox())!.width;
    const initialActualWidth = (await actualHeader.boundingBox())!.width;
    expect(initialPlanWidth).toBeCloseTo(120, 0);
    expect(initialActualWidth).toBeCloseTo(240, 0);
    const planHandle = planHeader.getByTestId('grouped-resize-1-1-1');
    const planHandleBox = await planHandle.boundingBox();
    if (!planHandleBox) {
      throw new Error('Plan resize handle is not visible');
    }
    await page.mouse.move(planHandleBox.x + planHandleBox.width / 2, planHandleBox.y + planHandleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(planHandleBox.x + planHandleBox.width / 2 + 40, planHandleBox.y + planHandleBox.height / 2);
    await page.mouse.up();

    const leafResizedPlanWidth = (await planHeader.boundingBox())!.width;
    const leafResizedActualWidth = (await actualHeader.boundingBox())!.width;
    expect(leafResizedPlanWidth).toBeGreaterThan(initialPlanWidth + 35);
    expect(Math.abs(leafResizedActualWidth - initialActualWidth)).toBeLessThan(2);

    const salesHandle = salesHeader.getByTestId('grouped-resize-0-1-2');
    const salesHandleBox = await salesHandle.boundingBox();
    if (!salesHandleBox) {
      throw new Error('Sales resize handle is not visible');
    }
    await page.mouse.move(salesHandleBox.x + salesHandleBox.width / 2, salesHandleBox.y + salesHandleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(salesHandleBox.x + salesHandleBox.width / 2 + 100, salesHandleBox.y + salesHandleBox.height / 2);
    await page.mouse.up();

    const groupedPlanWidth = (await planHeader.boundingBox())!.width;
    const groupedActualWidth = (await actualHeader.boundingBox())!.width;
    expect(groupedPlanWidth).toBeGreaterThan(leafResizedPlanWidth);
    expect(groupedActualWidth).toBeGreaterThan(leafResizedActualWidth);
    expect(groupedPlanWidth / groupedActualWidth).toBeCloseTo(
      leafResizedPlanWidth / leafResizedActualWidth,
      1
    );
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
    const showHeader = page.getByRole('switch', { name: /show table header/i }).first();
    await expect(showHeader).toBeVisible({ timeout: 15000 });
    if (await showHeader.isChecked()) {
      await showHeader.uncheck({ force: true });
    }
    await expect(showHeader).not.toBeChecked();
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
