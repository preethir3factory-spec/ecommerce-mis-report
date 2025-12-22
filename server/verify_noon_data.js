const cheerio = require('cheerio');

async function verifyNoon() {
    console.log("=== DIAGNOSTIC START (Using native fetch) ===");

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'dnt': '1',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
    };

    // 1. Google Sanity
    try {
        console.log("1. Testing Connectivity (Google)...");
        await fetch('https://www.google.com', { headers });
        console.log("   ✅ Internet OK.");
    } catch (e) {
        console.log("   ❌ Internet Check Failed:", e.message);
        return;
    }

    // 2. Noon Search
    try {
        const noonUrl = `https://www.noon.com/uae-en/search?q=renewed&sort[by]=popularity&limit=50&_t=${Date.now()}`;
        console.log(`2. Testing Search Query: ${noonUrl}`);

        const response = await fetch(noonUrl, {
            headers,
            signal: AbortSignal.timeout(15000)
        });

        console.log(`   ✅ Search Status: ${response.status} ${response.statusText}`);

        if (response.status !== 200) {
            console.log("   ❌ Non-200 Status.");
            return;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $('title').text().trim();
        console.log(`   📄 Page Title: "${title}"`);

        if (html.toLowerCase().includes('captcha') || html.toLowerCase().includes('challenge')) {
            console.log("   ⛔ Detected CAPTCHA/Challenge in HTML.");
            return;
        }

        const scriptContent = $('script[id="__NEXT_DATA__"]').html();

        if (scriptContent) {
            const jsonData = JSON.parse(scriptContent);
            const hits = jsonData?.props?.pageProps?.catalog?.hits || [];
            console.log(`   ✅ Found ${hits.length} items (JSON).`);
            hits.slice(0, 10).forEach((hit, i) => {
                console.log(`      #${i + 1}: ${hit.product_title || hit.name} [${hit.sku}]`);
            });
        } else {
            console.log("   ❌ __NEXT_DATA__ JSON not found.");
            // Try finding products via HTML classes
            const products = $('div[data-qa="product-grid"] a');
            if (products.length > 0) {
                console.log(`   ⚠️ Found ${products.length} products via HTML grid (Fallback).`);
            } else {
                console.log("   ❌ No products found in HTML grid either.");
                console.log("   HTML Snippet:", html.substring(0, 500));
            }
        }

    } catch (error) {
        console.error("   ❌ Search Request Failed:", error.message);
    }
    console.log("=== DIAGNOSTIC END ===");
}

verifyNoon();
