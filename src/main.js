const { Actor, log } = require('apify');
const { checkCountryForProduct } = require('./countryCheck');
const { extractProductIdFromUrl } = require('./utils');

async function main() {
  await Actor.init();

  const input = await Actor.getInput();
  const rawEntries = input?.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    await Actor.fail('Input required: provide "entries" — array of { "country": "AU", "url": "https://www.aliexpress.com/item/XXXX.html" } (one country, one product URL per entry).');
    return;
  }

  const entries = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const e = rawEntries[i];
    const country = e?.country ? String(e.country).toUpperCase().trim() : '';
    const url = e?.url ? String(e.url).trim() : '';
    const productId = extractProductIdFromUrl(url);
    if (!country || !url) {
      await Actor.fail(`Entry ${i + 1}: "country" and "url" are required.`);
      return;
    }
    if (!productId) {
      await Actor.fail(`Entry ${i + 1}: "url" must be an AliExpress product page (e.g. https://www.aliexpress.com/item/1234567890.html).`);
      return;
    }
    entries.push({ country, url, productId });
  }

  log.info(`Checking ${entries.length} country/URL pair(s) (sequential): ${entries.map((e) => `${e.country}: ${e.url}`).join(' | ')}`);

  const regionResults = [];
  for (const { country, url, productId } of entries) {
    const result = await checkCountryForProduct(productId, country);
    regionResults.push({ ...result, productId, url });
    log.info(`${country}: ${result.error || (result.available === true ? 'available' : 'unavailable')}`);
  }

  const regions = {};
  for (const r of regionResults) {
    const entry = { productId: r.productId, url: r.url };
    if (r.available !== undefined && r.available !== null) {
      entry.available = r.available;
    } else {
      entry.available = null;
    }
    if (r.estimatedDeliveryDays) entry.estimatedDeliveryDays = r.estimatedDeliveryDays;
    if (r.shippingMethodsCount != null) entry.shippingMethodsCount = r.shippingMethodsCount;
    if (r.reason) entry.reason = r.reason;
    if (r.error) entry.error = r.error;
    regions[r.countryCode] = entry;
  }

  const output = {
    checkedAt: new Date().toISOString(),
    regions,
  };

  await Actor.pushData(output);
  log.info('Region availability result:', JSON.stringify(output, null, 2));
  await Actor.exit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
