const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const {
    assignCalendarLanes,
    calendarPreviewLanes,
    daysUntil,
    expirationBucket,
    filterCalendarRecords,
    groupCalendarRecordsByCompanyAndBus,
    overlapsMonth,
  } = await import('../public/dashboard-monitoring.js');
  const { brandingPeriod, filterAdminPeriodGroups, groupAdminPeriods } = await import('../public/admin-period-grouping.js');
  const adminGrouping = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin-period-grouping.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const stickyLayout = fs.readFileSync(path.join(__dirname, '..', 'public', 'sticky-layout.js'), 'utf8');
  const features = fs.readFileSync(path.join(__dirname, '..', 'public', 'data-features.js'), 'utf8');
  const adminFeatures = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin-features.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.doesNotMatch(features, /companyColors|companyColorKey|assignCompanyColors|lightenColor|readableTextColor|booking-company-color|calendar-bar-color|calendar-company-color/);
  assert.doesNotMatch(html, /booking-company-color|company-color-field/);
  assert.doesNotMatch(css, /company-color-field|company-color-swatch|--company-color|--calendar-bar-color|--calendar-company-color/);
  assert.doesNotMatch(rules, /configId == 'companyColors'/);
  assert.equal(daysUntil('2026-10-05', new Date(2026, 9, 5, 14)), 0);
  assert.equal(daysUntil('2026-10-12', new Date(2026, 9, 5, 14)), 7);
  assert.equal(daysUntil('2026-11-04', new Date(2026, 9, 5, 14)), 30);
  assert.equal(daysUntil('2026-10-04', new Date(2026, 9, 5, 14)), -1);
  assert.equal(daysUntil('2026-02-30', new Date(2026, 9, 5)), null);
  assert.equal(expirationBucket(-1), 'expired');
  assert.equal(expirationBucket(0), 'seven');
  assert.equal(expirationBucket(7), 'seven');
  assert.equal(expirationBucket(8), 'thirty');
  assert.equal(expirationBucket(30), 'thirty');
  assert.equal(expirationBucket(31), '');
  assert.equal(overlapsMonth('2026-09-20', '2026-10-03', 2026, 9), true);
  assert.equal(overlapsMonth('2026-10-30', '2026-11-04', 2026, 9), true);
  assert.equal(overlapsMonth('2026-09-01', '2026-09-30', 2026, 9), false);
  assert.equal(overlapsMonth('2026-11-01', '2026-10-31', 2026, 9), false);
  const records = [
    { company: 'BFI Finance', type: 'Full Body', noPolisi: 'AB 1000 A', startDay: 1, endDay: 10, branding: { id: 'a' } },
    { company: 'BFI Finance', type: 'Back Body', noPolisi: 'AB 1000 A', startDay: 5, endDay: 12, branding: { id: 'b' } },
    { company: 'Sprite', type: 'Full Body', noPolisi: 'AB 2000 B', startDay: 2, endDay: 8, branding: { id: 'c' } },
    { company: 'Other', type: 'Full Body', noPolisi: 'AB 3000 C', startDay: 1, endDay: 3, branding: { id: 'd' } },
  ];
  assert.equal(filterCalendarRecords(records, { companies: new Set(), type: '', bus: '' }).length, 4, 'No selections means all companies.');
  assert.deepEqual(
    filterCalendarRecords(records, { companies: new Set(['BFI Finance', 'Sprite']), type: 'Full Body', bus: '' })
      .map((record) => record.branding.id),
    ['a', 'c'],
    'Multiple selected companies combine with the other filters.',
  );
  assert.deepEqual(
    filterCalendarRecords(records, { companies: new Set(['BFI Finance']), type: '', bus: 'AB 1000 A' })
      .map((record) => record.branding.id),
    ['a', 'b'],
  );
  const grouped = groupCalendarRecordsByCompanyAndBus(records);
  assert.equal(grouped.get('BFI Finance').size, 1);
  assert.equal(grouped.get('BFI Finance').get('AB 1000 A').records.length, 2, 'Multiple records for one bus are preserved.');
  assert.deepEqual(assignCalendarLanes(records.slice(0, 2)).map((record) => record.laneIndex), [0, 1]);
  const preview = calendarPreviewLanes([
    ...Array.from({ length: 5 }, (_, index) => ({
      startDay: 1,
      endDay: 10 + index,
      branding: { id: `preview-${index}` },
    })),
  ], 2);
  assert.equal(preview.visible.length, 2);
  assert.equal(preview.more, 3, 'Preview is capped while retaining a count of omitted overlapping bars.');
  assert.deepEqual(preview.visible.map((record) => record.laneIndex), [0, 1]);
  assert.equal(new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(8_669_614_000 / 1_000_000_000), '8,67');

  const dashboard = html.match(/<section id="dashboard"[\s\S]*?<\/section>\s*<!-- ==============================\s*REKAP BRANDING/)?.[0];
  assert.ok(dashboard, 'Dashboard section should exist.');
  assert.ok(dashboard.includes('id="kpi-estimated-revenue"'));
  assert.ok(dashboard.includes('id="dashboard-calendar-content"'));
  assert.ok(dashboard.includes('id="dashboard-expiration-body"'));
  assert.match(dashboard, /id="theme-toggle"[^>]*role="switch"/);
  assert.match(html, /storedTheme === 'dark' \|\| storedTheme === 'light' \? storedTheme : 'light'/);
  assert.match(html, /document\.documentElement\.dataset\.dashboardTheme = theme/);
  assert.match(app, /branding-dashboard-theme-v1/);
  assert.match(app, /document\.documentElement\.dataset\.dashboardTheme = normalizedTheme/);
  assert.match(app, /document\.body\.dataset\.dashboardTheme = normalizedTheme/);
  assert.match(app, /getDashboardTheme\(\) === 'dark' \? 'light' : 'dark'/);
  assert.doesNotMatch(app, /dashboardThemeSelect|\blet dashboardTheme\b/);
  assert.doesNotMatch(`${html}${app}${css}`, /vice-city|prefers-color-scheme/);
  assert.match(app, /dashboard-theme-change/);
  assert.match(app, /initialiseStickyLayout/);
  assert.match(stickyLayout, /view-sticky-header/);
  assert.match(stickyLayout, /window\.scrollY > STICKY_HEADER_SCROLL_THRESHOLD/);
  assert.match(stickyLayout, /requestAnimationFrame/);
  assert.equal((stickyLayout.match(/window\.addEventListener\('scroll',/g) || []).length, 1);
  assert.equal((stickyLayout.match(/document\.addEventListener\('scroll',/g) || []).length, 1);
  assert.match(stickyLayout, /const handleScroll = \(\) => scheduleUpdate\(\)/);
  assert.match(css, /\.app-shell > main\s*\{\s*min-width:\s*0;/);
  assert.match(css, /body\[data-dashboard-theme="dark"\]/);
  assert.match(css, /\.view-sticky-header\.is-compact/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(features, /dashboardVisualToken/);
  assert.match(features, /dashboard-theme-change/);
  const chartPosition = dashboard.indexOf('class="dashboard-charts dashboard-charts-overview"');
  const calendarPosition = dashboard.indexOf('id="dashboard-calendar-content"');
  const expiryPosition = dashboard.indexOf('id="dashboard-expiration-body"');
  const revenueChartPosition = dashboard.indexOf('id="dashboard-revenue-chart"');
  assert.ok(chartPosition < calendarPosition && calendarPosition < expiryPosition && expiryPosition < revenueChartPosition);
  assert.match(features, /renderDashboardRevenue\(scopedBrandings\)/);
  assert.match(features, /window\.calculateDashboardRevenue\(items, year\)/);
  assert.match(features, /item\.id === button\.dataset\.dashboardBrandingId/);
  const calendarRenderer = features.match(/function renderDashboardCalendar\(\) \{[\s\S]*?\n\}/)?.[0];
  const expirationRenderer = features.match(/function renderDashboardExpirations\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(calendarRenderer && expirationRenderer);
  assert.match(calendarRenderer, /overlapsMonth\(start, end, year, month\)/);
  assert.match(calendarRenderer, /brandings\.flatMap/);
  assert.doesNotMatch(`${calendarRenderer}${expirationRenderer}`, /getDocs|collection\(/);
  assert.match(features, /dashboard-calendar-previous/);
  assert.match(features, /dashboard-calendar-next/);
  assert.match(features, /dashboard-calendar-company/);
  assert.match(features, /dashboard-calendar-type/);
  assert.match(features, /dashboard-calendar-bus/);
  assert.match(features, /expandedCalendarCompanies\.has\(company\)/);
  assert.match(features, /expandedCalendarCompanies\.delete\(company\)/);
  assert.match(features, /expandedCalendarCompanies\.add\(company\)/);
  assert.match(features, /const expandedCalendarCompanies = new Set\(\)/);
  assert.match(features, /dashboardCalendarCompanies\.clear\(\)/);
  assert.match(features, /dashboardCalendarCompanies\.add\(checkbox\.dataset\.calendarCompany\)/);
  assert.match(features, /groupCalendarRecordsByCompanyAndBus\(items\)/);
  assert.match(features, /assignCalendarLanes\(bus\.records\)/);
  assert.match(features, /calendarPreviewLanes\(previewItems\)/);
  assert.match(features, /class="dashboard-calendar-company-header"/);
  assert.match(features, /class="dashboard-calendar-company-preview dashboard-calendar-track"/);
  assert.match(features, /class="dashboard-calendar-company-count"/);
  assert.match(features, /dashboard-calendar-preview-more/);
  assert.match(features, /formatDate\(start\).*formatDate\(end\)/);
  assert.match(features, /data-calendar-company-toggle/);
  assert.match(html, /dashboard-calendar-company-options/);
  assert.match(html, /dashboard-calendar-company-summary/);
  assert.match(css, /\.dashboard-calendar-scroll[\s\S]*?overflow-x: auto/);
  assert.match(css, /\.dashboard-calendar-panel,[\s\S]*?width: 100%/);
  assert.match(css, /\.dashboard-calendar-company-chevron\.is-expanded\s*\{\s*transform: rotate\(90deg\)/);
  assert.match(css, /\.dashboard-calendar-bar::before[\s\S]*?transform-origin: left center[\s\S]*?animation: calendar-bar-grow 560ms/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns: 210px minmax\(700px, 1fr\) 90px/);

  assert.deepEqual(brandingPeriod({ tanggalMulai: '2026-09-01' }), {
    key: '2026-09', year: 2026, month: 9, label: 'September 2026',
  });
  assert.equal(brandingPeriod({ 'Tanggal Mulai': '15/02/2027' }).key, '2027-02');
  assert.equal(brandingPeriod({ tanggalMulai: 'not a date' }).key, 'undated');
  const monthlyGroups = [
    { brandId: 'a', period: brandingPeriod({ tanggalMulai: '2026-10-01' }) },
    { brandId: 'b', period: brandingPeriod({ tanggalMulai: '2026-02-01' }) },
    { brandId: 'a', period: brandingPeriod({ tanggalMulai: '2026-09-01' }) },
    { brandId: 'c', period: brandingPeriod({ tanggalMulai: '2027-01-01' }) },
    { brandId: 'd', period: brandingPeriod({}) },
  ];
  const periods = groupAdminPeriods(monthlyGroups);
  assert.deepEqual(periods.years.map((year) => year.year), [2027, 2026]);
  assert.deepEqual(periods.years[1].months.map((month) => month.month), [2, 9, 10]);
  assert.deepEqual(periods.undated.map((group) => group.brandId), ['d']);
  const repeatedCompanyGroups = [
    { brandId: 'bfi-sep', namaBrand: 'BFI Finance', namaPT: 'Bintang Adv', busSet: new Set(['AB 1000 A']), period: brandingPeriod({ tanggalMulai: '2026-09-01' }) },
    { brandId: 'bfi-oct', namaBrand: 'BFI Finance', namaPT: 'Bintang Adv', busSet: new Set(['AB 1001 A']), period: brandingPeriod({ tanggalMulai: '2026-10-01' }) },
    { brandId: 'sprite', namaBrand: 'Sprite', namaPT: 'Morata', busSet: new Set(['AB 1002 A']), period: brandingPeriod({ tanggalMulai: '2026-10-01' }) },
  ];
  const searchResults = filterAdminPeriodGroups(repeatedCompanyGroups, 'BFI');
  const searchedPeriods = groupAdminPeriods(searchResults);
  assert.deepEqual(searchedPeriods.years[0].months.map((month) => month.key), ['2026-09', '2026-10']);
  assert.equal(searchedPeriods.years[0].months.every((month) => month.groups.length === 1), true);
  assert.equal(filterAdminPeriodGroups(repeatedCompanyGroups, 'not found').length, 0);
  assert.match(adminGrouping, /branding\.tanggalMulai \|\| branding\['Tanggal Mulai'\]/);
  assert.match(adminFeatures, /new Set\(groups\.map\(\(group\) => group\.brandId\)\)/);
  assert.match(adminFeatures, /expandedAdminYears = new Set\(\[currentDate\.getFullYear\(\)\]\)/);
  assert.match(adminFeatures, /expandedAdminMonths = new Set\(\[\`\$\{currentDate\.getFullYear\(\)\}-\$\{String\(currentDate\.getMonth\(\) \+ 1\)\.padStart\(2, '0'\)\}\`\]\)/);
  assert.match(adminFeatures, /data-admin-year-toggle/);
  assert.match(adminFeatures, /data-admin-month-toggle/);
  assert.match(adminFeatures, /group\.periodKey\)/);
  assert.match(adminFeatures, /data-period-key="\$\{escHtml\(group\.periodKey\)\}"/);
  assert.match(adminFeatures, /filterAdminGroups\(brandGroups\)/);
  assert.match(adminFeatures, /admin-search/);
  assert.match(html, /id="admin-period-groups"/);
  assert.match(html, /id="admin-search"/);
  assert.doesNotMatch(html, /id="admin-table-body"/);
  assert.match(adminFeatures, /data-admin-action="detail"/);

  console.log('Dashboard calendar, expiration and revenue KPI checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
