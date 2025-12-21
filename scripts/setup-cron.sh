#!/bin/bash

# Define the cron schedule (11 AM GST = 7 AM UTC)
# We assume the server acts on UTC or user handles conversion, but 07:00 UTC is safe for "Morning GST".

echo "---------------------------------------------------------"
echo "     Telegram Miner Scraper - Cron Setup Instruction"
echo "---------------------------------------------------------"
echo ""
echo "To schedule the scraper to run automatically at 11:00 AM GST (07:00 UTC) every day:"
echo ""
echo "1. Open your terminal and type:"
echo "   crontab -e"
echo ""
echo "2. Paste the following line at the bottom:"
echo "   0 7 * * * cd \"$(pwd)\" && npm run scrape >> cron.log 2>&1 && npm run parse >> cron.log 2>&1"
echo ""
echo "3. Save and exit (:wq for vim)."
echo ""
echo "This will run both the scraper and the parser every morning."
