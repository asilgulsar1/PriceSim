# Telegram Scraper for Daily Miner Prices

This script crawls the Telegram channels and groups you are subscribed to, looking for miner pricing updates (S21, L7, etc.) from the last 24 hours.

## Prerequisites
- Node.js installed.
- Dependencies installed:
  ```bash
  npm install telegram input
  ```

## Setup Credentials
1. Go to [https://my.telegram.org](https://my.telegram.org)
2. Log in and go to "API development tools".
3. Create a new app (can be any name) to get your `App api_id` and `App api_hash`.

## Running the Scraper

Run the script passing your credentials as environment variables:

```bash
export API_ID=YOUR_12345_ID
export API_HASH=YOUR_ABCDEF_HASH
node scripts/telegram-scraper.js
```

**First Run**:
- The script will ask for your **Phone Number** (formatted like +1234567890).
- It will ask for the **Code** sent to your Telegram app.
- It might ask for your **2FA Password** if you have one set.
- It saves a `session.txt` file so you don't need to log in again.

**Output**:
- The script saves matching messages from the last 24 hours to `scraped_prices.json`.
- It logs progress to the console.

## Customization
Edit `scripts/telegram-scraper.js` to change:
- `KEYWORDS`: The list of miners to search for (default: S21, L7, S19, Whatsminer, KS5, KS3, Antminer).
- `MAX_AGE_HOURS`: How far back to search (default: 24 hours).
