const https = require('https');
const fs = require('fs');

async function fetchAll() {
    let allItems = [];
    for (let i = 1; i <= 35; i++) {
        await new Promise(res => {
            https.get(`https://fal.ai/api/models?page=${i}&per_page=40`, { headers: { 'User-Agent': 'NSK-BibleScraper' } }, (response) => {
                let d = '';
                response.on('data', c => d += c);
                response.on('end', () => {
                    if (d.trim() !== '') {
                        try {
                            const parsed = JSON.parse(d);
                            if (parsed.items && parsed.items.length) {
                                allItems = allItems.concat(parsed.items);
                            }
                        } catch (e) {
                            console.error('Parse error on page', i);
                        }
                    }
                    res();
                });
            });
        });
    }
    fs.writeFileSync('FAL_AI_ALL_PRICING.json', JSON.stringify(allItems, null, 2));
    console.log('Saved', allItems.length, 'models to FAL_AI_ALL_PRICING.json');
}

fetchAll();
