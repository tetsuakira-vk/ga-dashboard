const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const fs = require('fs');
const path = require('path');

const SITES = [
  { id: 'japaneseunlocked', label: 'Japanese Unlocked', propertyId: '535428666' },
  { id: 'vkchronicle', label: 'VK Chronicle', propertyId: '535806391' },
];

const client = new BetaAnalyticsDataClient();

const TREND_METRICS = [
  { name: 'sessions' },
  { name: 'activeUsers' },
  { name: 'screenPageViews' },
  { name: 'averageSessionDuration' },
  { name: 'screenPageViewsPerSession' },
  { name: 'engagementRate' },
];

function mapTrendRow(row) {
  return {
    sessions: Number(row.metricValues[0].value),
    users: Number(row.metricValues[1].value),
    pageviews: Number(row.metricValues[2].value),
    avgSessionDuration: Number(row.metricValues[3].value), // seconds
    pagesPerSession: Number(row.metricValues[4].value),
    engagementRate: Number(row.metricValues[5].value), // 0-1
  };
}

async function fetchDaily(propertyId, days = 180) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: TREND_METRICS,
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  });

  return (response.rows || []).map((row) => ({
    date: row.dimensionValues[0].value, // YYYYMMDD
    ...mapTrendRow(row),
  }));
}

function monthsAgoDate(months) {
  const d = new Date();
  d.setDate(1); // avoid month-length rollover issues
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

async function fetchMonthly(propertyId, months = 24) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: monthsAgoDate(months), endDate: 'today' }],
    dimensions: [{ name: 'yearMonth' }],
    metrics: TREND_METRICS,
    orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
  });

  return (response.rows || []).map((row) => ({
    month: row.dimensionValues[0].value, // YYYYMM
    ...mapTrendRow(row),
  }));
}

async function fetchTopPages(propertyId, days = 30, limit = 10) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit,
  });

  return (response.rows || []).map((row) => ({
    path: row.dimensionValues[0].value,
    pageviews: Number(row.metricValues[0].value),
  }));
}

async function fetchBreakdown(propertyId, dimension, days = 30, limit = 20) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: dimension }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  });

  return (response.rows || [])
    .map((row) => ({
      label: row.dimensionValues[0].value,
      sessions: Number(row.metricValues[0].value),
      users: Number(row.metricValues[1].value),
    }))
    .filter((r) => r.label.trim() !== '');
}

async function main() {
  const result = { generatedAt: new Date().toISOString(), sites: {} };

  for (const site of SITES) {
    console.log(`Fetching ${site.label} (${site.propertyId})...`);
    const [daily, monthly, topPages, channels, newVsReturning, devices, countries] = await Promise.all([
      fetchDaily(site.propertyId),
      fetchMonthly(site.propertyId),
      fetchTopPages(site.propertyId),
      fetchBreakdown(site.propertyId, 'sessionDefaultChannelGroup'),
      fetchBreakdown(site.propertyId, 'newVsReturning'),
      fetchBreakdown(site.propertyId, 'deviceCategory'),
      fetchBreakdown(site.propertyId, 'country', 30, 10),
    ]);
    result.sites[site.id] = {
      label: site.label, daily, monthly, topPages,
      channels, newVsReturning, devices, countries,
    };
  }

  const outPath = path.join(__dirname, '..', 'docs', 'data.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
