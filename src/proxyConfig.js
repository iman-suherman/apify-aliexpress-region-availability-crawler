const { Actor } = require('apify');
const { getProxyCountryCode } = require('./utils');

/**
 * Create Apify proxy configuration for a given target country.
 * Uses residential proxies with country routing to simulate local storefront.
 * @param {string} countryCode - Target country (e.g. "AU", "UK")
 * @returns {Promise<import('apify').ProxyConfiguration | null>}
 */
async function createProxyForCountry(countryCode) {
  const proxyCountry = getProxyCountryCode(countryCode);
  try {
    const proxyConfiguration = await Actor.createProxyConfiguration({
      groups: ['RESIDENTIAL'],
      countryCode: proxyCountry,
    });
    return proxyConfiguration;
  } catch (err) {
    Actor.log.warning(`Proxy config failed for ${countryCode} (${proxyCountry}): ${err.message}`);
    return null;
  }
}

module.exports = {
  createProxyForCountry,
};
