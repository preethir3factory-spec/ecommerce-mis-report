const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://www.noon.com/uae-en/search?limit=50&q=renewed%20mobile%20laptop%20tablet%20gaming&sort%5Bby%5D=popularity&sort%5Bdir%5D=desc';

(async () => {
    try {
        console.log(`Fetching ${url}...`);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        console.log(`Status: ${res.status}`);
        const $ = cheerio.load(res.data);

        // Check for NEXT_DATA
        const nextDataScript = $('#__NEXT_DATA__').html();
        if (nextDataScript) {
            console.log("✅ Found __NEXT_DATA__ JSON blob!");
            const data = JSON.parse(nextDataScript);

            // Navigate to hits?
            // Usually found in data.props.pageProps.catalog.hits or similar
            const pageProps = data.props?.pageProps;
            if (pageProps) {
                // Try scanning for hits in common locations
                const catalog = pageProps.catalog || pageProps.initialState?.catalog;
                const hits = catalog?.hits;

                if (hits && Array.isArray(hits)) {
                    console.log(`Found ${hits.length} hits via Next.js hydration data.`);
                    console.log("Sample Item:", hits[0].name);
                } else {
                    console.log("⚠️ Could not find hits in standard location within __NEXT_DATA__.");
                    console.log("Keys in pageProps:", Object.keys(pageProps));
                    if (pageProps.catalog) console.log("Keys in catalog:", Object.keys(pageProps.catalog));
                }
            }
        } else {
            console.log("❌ No __NEXT_DATA__ found. Parsing HTML directly...");
            const items = [];
            // Try standard product selectors
            $('div[data-qa^="product-"]').each((i, el) => {
                items.push($(el).text().substring(0, 50));
            });
            console.log(`Found ${items.length} items via Selectors.`);
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
})();
