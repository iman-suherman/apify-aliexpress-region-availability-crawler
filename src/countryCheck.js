const { Actor, log } = require('apify');
const { PlaywrightCrawler } = require('crawlee');
const { createProxyForCountry } = require('./proxyConfig');
const {
  dismissCookieConsent,
  waitForProductTitle,
  extractShippingAvailability,
} = require('./shippingExtractor');
const { randomDelay } = require('./utils');

const BASE_URL = 'https://www.aliexpress.com/item/';

/**
 * Build product page URL for a product ID.
 * @param {string} productId
 * @returns {string}
 */
function buildProductUrl(productId) {
  return `${BASE_URL}${productId}.html`;
}

/**
 * Run a single country check: one crawler run with country-specific proxy.
 * Returns { countryCode, available, estimatedDeliveryDays, shippingMethodsCount, reason, error }.
 * @param {object} params
 * @param {string} params.productId
 * @param {string} params.countryCode
 * @returns {Promise<object>}
 */
async function runCountryCheck({ productId, countryCode }) {
  const url = buildProductUrl(productId);
  const proxyConfiguration = await createProxyForCountry(countryCode);

  if (!proxyConfiguration) {
    return {
      countryCode,
      available: null,
      error: 'proxy_unavailable',
    };
  }

  /** Result from requestHandler; one crawl per country so single value is enough. */
  let handlerResult = null;

  const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl: 1,
    requestHandlerTimeoutSecs: 180,
    launchContext: {
      launchOptions: {
        args: ['--disable-web-security', '--no-sandbox'],
        headless: true,
      },
    },
    async requestHandler({ page, proxyInfo, request }) {
      if (!proxyInfo || !proxyInfo.url) {
        handlerResult = { countryCode, available: null, error: 'proxy_not_used' };
        return;
      }
      const detailUrl = request?.url || url;
      log.info(`Crawling ${countryCode} via proxy (country: ${proxyInfo.countryCode || 'n/a'}) | ${detailUrl}`);
      await randomDelay(1500, 3500);

      await dismissCookieConsent(page);

      const titleLoaded = await waitForProductTitle(page);
      if (!titleLoaded) {
        const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
        const is404 = bodyText.includes('404') || bodyText.includes('Page Not Found');
        const isCaptcha = bodyText.includes('captcha') || bodyText.includes('CAPTCHA') || page.url().includes('captcha');
        handlerResult = {
          countryCode,
          available: null,
          error: is404 ? 'product_not_found' : isCaptcha ? 'captcha_detected' : 'page_load_failed',
        };
        return;
      }

      await randomDelay(800, 2000);

      const extracted = await extractShippingAvailability(page);
      handlerResult = {
        countryCode,
        available: extracted.available,
        estimatedDeliveryDays: extracted.estimatedDeliveryDays,
        shippingMethodsCount: extracted.shippingMethodsCount,
        reason: extracted.reason,
        error: extracted.error,
      };
    },
  });

  return new Promise((resolve) => {
    const fallback = { countryCode, available: null, error: 'crawl_timeout' };
    const timeoutMs = 190000;
    const timeout = setTimeout(() => resolve(handlerResult || fallback), timeoutMs);

    crawler.run([url])
      .then(() => {
        clearTimeout(timeout);
        resolve(handlerResult || fallback);
      })
      .catch((err) => {
        clearTimeout(timeout);
        log.warning(`Country check failed for ${countryCode}: ${err.message}`);
        resolve({
          countryCode,
          available: null,
          error: err.message || 'crawl_error',
        });
      });
  });
}

/**
 * Run country check and return region entry for normalized output.
 * Handles errors (captcha, 404, proxy failure) with structured failure.
 * @param {string} productId
 * @param {string} countryCode
 * @returns {Promise<{ countryCode: string; available: boolean | null; estimatedDeliveryDays?: string; shippingMethodsCount?: number; reason?: string; error?: string }>}
 */
async function checkCountryForProduct(productId, countryCode) {
  const raw = await runCountryCheck({ productId, countryCode });
  return {
    countryCode: raw.countryCode,
    available: raw.available,
    estimatedDeliveryDays: raw.estimatedDeliveryDays,
    shippingMethodsCount: raw.shippingMethodsCount,
    reason: raw.reason,
    error: raw.error,
  };
}

module.exports = {
  buildProductUrl,
  runCountryCheck,
  checkCountryForProduct,
};
