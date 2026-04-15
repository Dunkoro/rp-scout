export const scrapeBarbermonger = async (forumIds) => {
    if (!forumIds) return [];
    const ids = forumIds.split('+');
    
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const targetUrl = `https://barbermonger.me/index.php?showforum=${cleanId}`;
        
        // CodeTabs is currently the most reliable "stealth" proxy for Cloudflare
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const links = doc.querySelectorAll('a[href*="showtopic="]'); 
            const results = [];

            links.forEach(link => {
                const title = link.textContent.trim();
                if (title && title.length > 5 && !title.includes('Pinned:')) {
                    const fullUrl = link.href.includes('http') ? link.href : `https://barbermonger.me/${link.getAttribute('href')}`;
                    results.push({
                        id: fullUrl,
                        title: title,
                        author: 'BM User',
                        url: fullUrl,
                        source: `BM:${cleanId}`,
                        content: '',
                        isStub: true 
                    });
                }
            });
            return results;
        } catch (e) {
            console.warn(`[BM] Scrape failed for forum ${cleanId}`);
            return [];
        }
    });

    const final = await Promise.all(fetchPromises);
    return final.flat().slice(0, 15);
};
