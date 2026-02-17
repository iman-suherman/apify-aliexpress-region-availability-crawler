/**
 * Selectors and patterns for AliExpress shipping availability.
 * AliExpress is JS-heavy; these target common patterns. Adjust if DOM changes.
 */
const SELECTORS = {
  // Cookie / consent – often blocks interaction
  cookieAccept: '[data-role="accept-cookie"]',
  cookieClose: '.rax-view button',
  // Region / ship-to selector
  shipToTrigger: '[class*="ShipTo"]',
  shipToDropdown: '[class*="shipping-destination"]',
  // Delivery estimate area
  deliveryEstimate: '[class*="delivery"], [class*="Delivery"], [data-spm*="delivery"]',
  // Shipping methods list
  shippingMethods: '[class*="shipping-method"], [class*="ShippingMethod"]',
  // Negative signals
  notAvailableMessage: [
    "can't be shipped",
    "cannot be shipped",
    "can not be shipped",
    "no shipping",
    "not available for your",
    "not deliver",
    "doesn't ship",
    "does not ship",
    "unavailable in your",
  ],
  // Product title – ensures page loaded
  productTitle: 'h1[data-pl="product-title"], [class*="ProductTitle"]',
};

/**
 * Normalize and detect "not available" from visible text.
 * @param {string} text
 * @returns {boolean} - true if text indicates shipping NOT available
 */
function textIndicatesUnavailable(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return SELECTORS.notAvailableMessage.some((phrase) => lower.includes(phrase));
}

/**
 * Try to dismiss cookie/consent so it doesn’t block shipping UI.
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 */
async function dismissCookieConsent(page, timeoutMs = 3000) {
  try {
    const accept = await page.$(SELECTORS.cookieAccept);
    if (accept) {
      await accept.click({ timeout: timeoutMs }).catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch {
    // ignore
  }
}

/**
 * Wait for product title to be visible (page loaded).
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForProductTitle(page, timeoutMs = 15000) {
  try {
    await page.waitForSelector(SELECTORS.productTitle, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract shipping availability from the current page.
 * Returns structured result: { available, estimatedDeliveryDays, shippingMethodsCount, reason, error }.
 * @param {import('playwright').Page} page
 * @returns {Promise<{ available: boolean | null; estimatedDeliveryDays?: string; shippingMethodsCount?: number; reason?: string; error?: string }>}
 */
async function extractShippingAvailability(page) {
  const result = {
    available: null,
    estimatedDeliveryDays: undefined,
    shippingMethodsCount: undefined,
    reason: undefined,
    error: undefined,
  };

  try {
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    if (textIndicatesUnavailable(bodyText)) {
      result.available = false;
      result.reason = 'No shipping option';
      return result;
    }

    // Look for delivery estimate (positive signal)
    const deliveryEl = await page.$(SELECTORS.deliveryEstimate);
    let deliveryText = '';
    if (deliveryEl) {
      deliveryText = await deliveryEl.innerText().catch(() => '');
    }

    // Simple pattern: "X-Y days" or "X days"
    const daysMatch = deliveryText.match(/(\d+)\s*-\s*(\d+)\s*days?/i) || deliveryText.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      result.estimatedDeliveryDays = daysMatch[2] ? `${daysMatch[1]}-${daysMatch[2]}` : daysMatch[1];
    }

    // Count shipping method options
    const methodNodes = await page.$$(SELECTORS.shippingMethods);
    const count = methodNodes.length;
    if (count > 0) {
      result.shippingMethodsCount = count;
    }

    // Decide availability
    if (result.available === false) {
      // already set by "not available" text
    } else if (result.shippingMethodsCount > 0 || result.estimatedDeliveryDays) {
      result.available = true;
    } else if (textIndicatesUnavailable(bodyText)) {
      result.available = false;
      result.reason = 'No shipping option';
    } else {
      result.available = null;
      result.reason = 'Could not determine';
    }

    return result;
  } catch (err) {
    result.error = err.message || 'extract_error';
    result.available = null;
    return result;
  }
}

module.exports = {
  SELECTORS,
  textIndicatesUnavailable,
  dismissCookieConsent,
  waitForProductTitle,
  extractShippingAvailability,
};
