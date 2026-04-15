export const scrapeBarbermonger = async (forumIds) => {
    if (!forumIds) return [];
    const ids = forumIds.split('+');
    
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const targetUrl = `https://barbermonger.me/index.php?showforum=${cleanId}`;
        
        // Switching to a different proxy provider to sneak past Cloudflare
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Look specifically for Jcink thread links
            const links = doc.querySelectorAll('a[href*="showtopic="]'); 
            const results = [];

            links.forEach(link => {
                const title = link.textContent.trim();
                // Filter out navigation links and pinned threads
                if (title && title.length > 5 && !title.includes('Pinned:')) {
                    results.push({
                        id: link.href,
                        title: title,
                        author: 'BM User',
                        url: link.href.includes('http') ? link.href : `https://barbermonger.me/${link.getAttribute('href')}`,
                        source: `BM:${cleanId}`,
                        content: '',
                        isStub: true 
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
