# apify-aliexpress-region-availability-crawler

Apify actor that checks **AliExpress product shipping availability** across multiple target countries (AU, DE, UK, US) using proxy rotation. Designed for **HugeShop** region enrichment and catalogue integrity validation.

## What it does

- **Input:** Per-country entries: each entry has a **country** code and the full **product page URL** (one country, one URL per entry).
- **Flow:** For each entry, runs a **Playwright** crawler with **Apify Proxy** (residential, country-routed), then extracts shipping availability. Logs include the detail URL for each crawl.
- **Output:** Normalized JSON with `regions[country]`: `productId`, `url`, `available`, `estimatedDeliveryDays`, `shippingMethodsCount`, or `error`/`reason` on failure.

This gives you **independent verification** of region availability outside Open API rate limits and supplier metadata.

## Input

| Field     | Type  | Required | Description |
|-----------|-------|----------|-------------|
| `entries` | array | Yes      | List of `{ "country": "AU", "url": "https://www.aliexpress.com/item/XXXX.html" }`. One country, one product URL per entry. |

Example (same product for multiple countries):

```json
{
  "entries": [
    { "country": "AU", "url": "https://www.aliexpress.com/item/3256808405617250.html" },
    { "country": "US", "url": "https://www.aliexpress.com/item/3256808405617250.html" },
    { "country": "DE", "url": "https://www.aliexpress.com/item/3256808405617250.html" }
  ]
}
```

## Output

```json
{
  "checkedAt": "2026-02-17T08:22:12Z",
  "regions": {
    "AU": {
      "productId": "3256808405617250",
      "url": "https://www.aliexpress.com/item/3256808405617250.html",
      "available": true,
      "estimatedDeliveryDays": "10-18",
      "shippingMethodsCount": 3
    },
    "DE": {
      "productId": "3256808405617250",
      "url": "https://www.aliexpress.com/item/3256808405617250.html",
      "available": false,
      "reason": "No shipping option"
    }
  }
}
```

- Each region includes `productId` and `url` that were checked.
- `available`: `true` / `false` / `null` (unknown or error).
- `estimatedDeliveryDays`, `shippingMethodsCount`: set when available.
- `reason`: short explanation when not available.
- `error`: e.g. `captcha_detected`, `product_not_found`, `page_load_failed`, `crawl_timeout`.

## Architecture (high level)

```
Input: productId (+ countries)
    → Build country-specific AliExpress URL
    → Launch Playwright crawler per country (parallel)
    → Apify Proxy (RESIDENTIAL, country code: AU/DE/GB/US)
    → Simulate shipping destination, extract availability
    → Normalize → structured JSON
```

- **One crawl session per country** to avoid state bleed and improve reliability.
- **Proxy:** Apify Proxy with `countryCode` (UK → GB) so each run sees the storefront as in that region.

## Tech stack

| Layer      | Choice              |
|-----------|---------------------|
| Runtime   | Node.js 18+        |
| Actor SDK | Apify SDK v3       |
| Crawler   | Crawlee PlaywrightCrawler |
| Proxy     | Apify Residential  |
| Deployment| Apify Platform     |

## Integration with HugeShop region pipeline

- **Trigger:** Ingestion service calls Apify actor (REST or client) with `productId` (and optional `countries`).
- **Completion:** Use webhook or poll default dataset for the run result.
- **Storage:** Update Firestore (or your store) with:
  - `regionAvailability` (from `regions`)
  - `regionVerifiedAt` (e.g. `checkedAt`)
  - `regionSource: "apify-crawl"`

This provides deterministic shipping validation, API-independent fallback, and real storefront verification for launch-safe region integrity.

## Anti-block and robustness

- Residential proxy with country routing.
- Human-like random delays (e.g. 1.5–3.5 s after load, 0.8–2 s before extraction).
- Cookie consent dismissal where possible.
- Structured error reporting (captcha, 404, timeout, proxy failure) so you can retry or back off.

## License

Apache-2.0
