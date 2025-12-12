# Telegram Scraper for ASIC Pricing

This script allows you to scrape Telegram groups you are a member of for miner pricing.

## prerequisites
You need Node.js installed.

## Setup

1. **Install Dependencies**:
   Navigate to the `scripts` folder or root and run:
   ```bash
   npm install telegram input
   ```

2. **Get Credentials**:
   - Go to [https://my.telegram.org](https://my.telegram.org)
   - Log in and go to "API development tools"
   - Create a new app (can be anything) to get your `App api_id` and `App api_hash`.

## Running the Scraper

Run the script passing your credentials as environment variables:

```bash
export API_ID=YOUR_API_ID
export API_HASH=YOUR_API_HASH
node scripts/telegram-scraper.js
```

**First Run**: The script will ask for your Phone Number and the Code sent to your Telegram app to authenticate. It saves a `session.txt` file so you don't need to log in again.

**Output**: The script saves matching messages to `scraped_prices.json`.

## Customization
Edit `scripts/telegram-scraper.js` to change `KEYWORDS` (default: S21, L7, etc.) or the number of messages to check (`LIMIT`).
