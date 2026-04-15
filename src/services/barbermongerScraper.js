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

           // Targeted but permissive: Find any link that looks like a thread
            const links = doc.querySelectorAll('a'); 
            const results = [];

            links.forEach(link => {
                const href = link.getAttribute('href') || '';
                const title = link.textContent.trim();
                
                // Jcink forums use 'showtopic=' for thread links
                if (href.includes('showtopic=') && title.length > 5 && !title.includes('Pinned:')) {
                    const fullUrl = href.startsWith('http') ? href : `https://barbermonger.me/${href.replace(/^\//, '')}`;
                    
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
