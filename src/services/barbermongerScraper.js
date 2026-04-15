export const scrapeBarbermonger = async (forumIds) => {
    if (!forumIds) return [];
    const ids = forumIds.split('+');
    
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const targetUrl = `https://barbermonger.me/index.php?showforum=${cleanId}`;
        
        // thingproxy is often slower but better at bypassing Jcink firewall stubs
        const proxyUrl = `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(targetUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            const html = await response.text();
            
            console.log(`[BM Debug] ID ${cleanId} HTML Length:`, html.length);
            
            // If length is still under 500, we are still blocked
            if (html.length < 500) {
                console.error(`[BM Debug] ID ${cleanId} is returning a stub. Proxy is blocked.`);
                return [];
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a[href*="showtopic="]'); 
            const results = [];

            links.forEach(link => {
                const title = link.textContent.trim();
                if (title && title.length > 5 && !title.includes('Pinned:')) {
                    const rawHref = link.getAttribute('href');
                    const fullUrl = rawHref.startsWith('http') ? rawHref : `https://barbermonger.me/${rawHref.replace(/^\//, '')}`;
                    results.push({
                        id: fullUrl, title: title, author: 'BM User', url: fullUrl,
                        source: `BM:${cleanId}`, content: '', isStub: true 
                    });
                }
            });
            return results;
        } catch (e) {
            return [];
        }
    });

    const final = await Promise.all(fetchPromises);
    return final.flat().slice(0, 15);
};
