# apify-aliexpress-region-availability-crawler

Apify actor that checks **AliExpress product shipping availability** across multiple target countries (AU, DE, UK, US) using proxy rotation. Designed for **HugeShop** region enrichment and catalogue integrity validation.

## What it does

- **Input:** Per-country entries: each entry has a **country** code and the full **product page URL** (one country, one URL per entry).
- **Flow:** For each entry, runs a **Playwright** crawler with **Apify Proxy** (residential, country-routed), then extracts shipping availability. Logs include the detail URL for each crawl.
- **Output:** Normalized JSON with `regions[country]`: `productId`, `url`, `available`, `estimatedDeliveryDays`, `shippingMethodsCount`, or `error`/`reason` on failure.

This gives you **independent verification** of region availability outside Open API rate limits and supplier metadata.

## Input

Provide an **`entries`** array. Each entry is one country and one product URL to check (one country, one URL per entry).

| Field      | Type  | Required | Description |
|------------|-------|----------|-------------|
| `entries`  | array | Yes      | List of objects. Each object must have `country` and `url`. |

**Each entry object:**

| Property   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `country`  | string | Yes      | ISO 3166-1 alpha-2 country code (e.g. `AU`, `US`, `UK`, `DE`, `GB`). |
| `url`      | string | Yes      | Full AliExpress product page URL (`www.aliexpress.com` or country subdomain e.g. `de.aliexpress.com`). Must contain `/item/<id>.html`. |

- Use the **same URL** in multiple entries to check the same product in different countries.
- Use **different URLs** to check different products per country.
- In the Apify Console, use the **Input** tab and paste JSON into the `entries` field (editor is `json`).

**Example input:**

```json
{
  "entries": [
    {
      "country": "AU",
      "url": "https://www.aliexpress.com/item/1005008591932002.html"
    },
    {
      "country": "US",
      "url": "https://www.aliexpress.com/item/3256808405617250.html"
    },
    {
      "country": "DE",
      "url": "https://de.aliexpress.com/item/1005008591932002.html"
    },
    {
      "country": "UK",
      "url": "https://www.aliexpress.com/item/1005008591932002.html"
    }
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
Input: entries[] (each: country + product URL)
    → Extract product ID from URL per entry
    → For each entry: launch Playwright crawler (sequential)
    → Apify Proxy (RESIDENTIAL, country code from entry)
    → Simulate shipping destination, extract availability
    → Normalize → structured JSON (regions with productId, url, available, …)
```

- **One crawl per entry** (sequential) to avoid timeouts; logs include the detail URL for each crawl.
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

- **Trigger:** Ingestion service calls Apify actor (REST or client) with `entries` (array of `{ country, url }`).
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
