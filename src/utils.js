/**
 * Random integer between min and max (inclusive).
 * Used for human-like delays to reduce block risk.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Delay for a random number of ms in range [min, max].
 * @param {number} minMs
 * @param {number} maxMs
 * @returns {Promise<void>}
 */
function randomDelay(minMs, maxMs) {
  const ms = randomBetween(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ISO 3166-1 alpha-2 country code to Apify proxy country code.
 * UK is represented as GB in proxy providers.
 */
const COUNTRY_TO_PROXY_CODE = {
  AU: 'AU',
  DE: 'DE',
  UK: 'GB',
  US: 'US',
};

/**
 * Resolve proxy country code for a given input country.
 * @param {string} countryCode - e.g. "UK", "AU"
 * @returns {string} - e.g. "GB", "AU"
 */
function getProxyCountryCode(countryCode) {
  return COUNTRY_TO_PROXY_CODE[countryCode] || countryCode;
}

/**
 * Default target countries when not provided in input.
 */
const DEFAULT_COUNTRIES = ['AU', 'DE', 'UK', 'US'];

module.exports = {
  randomBetween,
  randomDelay,
  getProxyCountryCode,
  DEFAULT_COUNTRIES,
};
