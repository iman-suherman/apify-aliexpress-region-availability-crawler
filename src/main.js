const { Actor, log } = require('apify');
const { checkCountryForProduct } = require('./countryCheck');
const { DEFAULT_COUNTRIES } = require('./utils');

async function main() {
  await Actor.init();

  const input = await Actor.getInput();
  const productId = (input && input.productId) ? String(input.productId).trim() : null;
  const rawCountries = input?.countries;
  const countries = Array.isArray(rawCountries) && rawCountries.length > 0
    ? rawCountries.map((c) => String(c).toUpperCase())
    : DEFAULT_COUNTRIES;

  if (!productId) {
    await Actor.fail('Input required: provide Product ID (AliExpress item ID from the product URL).');
    return;
  }
  if (!Array.isArray(rawCountries) || rawCountries.length === 0) {
    await Actor.fail('Input required: provide Destination countries (region list), e.g. AU, DE, UK, US.');
    return;
  }

  log.info(`Checking region availability for product ${productId} in: ${countries.join(', ')}`);

  // Parallel per-country checks (separate crawl session per country)
  const regionResults = await Promise.all(
    countries.map((countryCode) => checkCountryForProduct(productId, countryCode)),
  );

  const regions = {};
  for (const r of regionResults) {
    const entry = {};
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
    productId,
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
