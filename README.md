# MasbaratoDeals

Elite premium deal aggregator for USA markets. Automated system that finds, validates, and publishes high-quality deals with 20%+ discounts.

## Features

- 🤖 **Automated Deal Discovery**: Scrapes and validates deals from TechBargains RSS
- 🛡️ **Quality Filters**: Only products with 20%+ discount, in stock, and specific product pages
- 💰 **Price Protection**: Blocks inflated prices and currency errors
- 🖼️ **Triple-Engine Image System**: Proxy → Direct → Category fallback for 100% image reliability
- 🌐 **Multi-language**: Spanish/English support
- 📊 **Trust Scoring**: AI-powered confidence scoring for each deal
- 🎨 **Premium UI**: Apple-style glassmorphism design

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Scraping**: Puppeteer, Cheerio, Axios
- **AI**: OpenAI GPT-4 for editorial content
- **Monetization**: Amazon Associates integration

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```env
PORT=10000
ADMIN_PASSWORD=your_admin_password
OPENAI_API_KEY=your_openai_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHANNEL_ID=your_channel_id
AMAZON_TAG=your_amazon_tag
```

## Usage

```bash
# Start the server
node index.js

# The bot will automatically:
# - Scan for deals every 15 minutes
# - Validate stock and prices
# - Generate AI editorial content
# - Publish to website and Telegram
```

## API Endpoints

- `GET /api/deals` - Get all published deals
- `GET /go/:id` - Redirect to monetized product link
- `GET /api/proxy-image?url=` - Proxy images to bypass hotlinking
- `POST /api/vote` - Vote on deals
- `GET /api/comments/:id` - Get deal comments

## Project Structure

```
MasbaratoDeals/
├── public/
│   └── index.html          # Premium frontend
├── src/
│   ├── core/
│   │   ├── Bot1_Scraper.js      # Deal discovery
│   │   ├── Bot2_Explorer.js     # Validation
│   │   ├── Bot3_Auditor.js      # Quality control
│   │   ├── Bot4_Publisher.js    # Publishing
│   │   ├── AIProcessor.js       # Content generation
│   │   └── CoreProcessor.js     # Orchestration
│   ├── database/
│   │   └── db.js                # SQLite operations
│   ├── utils/
│   │   ├── DeepScraper.js       # Puppeteer scraping
│   │   ├── LinkResolver.js      # URL resolution
│   │   └── LinkTransformer.js   # Affiliate links
│   └── collectors/
│       └── SlickRSSCollector.js # RSS parsing
└── index.js                     # Main server
```

## Key Features

### Anti-Generic Filter
Automatically rejects:
- Category pages
- Search results
- Gold Box landings
- Non-specific product URLs

### Price Safety
- Blocks prices > $5,000 (prevents currency errors)
- Validates USD pricing
- Enforces 20% minimum discount

### Image Reliability
1. **Proxy Engine**: Server-side fetch with browser headers
2. **Direct Engine**: No-referrer direct load
3. **Fallback Engine**: Category-specific placeholders

## License

MIT

## Author

Built with ❤️ for deal hunters
