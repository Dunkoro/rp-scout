export const scrapeBarbermonger = async (forumIds) => {
    if (!forumIds) return [];
    const ids = forumIds.split('+');
    
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const targetUrl = `https://barbermonger.me/index.php?showforum=${cleanId}`;
        
        // Switching to AllOrigins RAW which is less likely to trigger Cloudflare's "Proxy Detected" page
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Finding the topic links in a Jcink forum
            const topicLinks = doc.querySelectorAll('a[href*="showtopic="]'); 
            const posts = [];

            topicLinks.forEach(link => {
                const title = link.textContent.trim();
                // Avoid pinned threads or empty links
                if (title && !title.includes('Pinned:') && title.length > 5) {
                    const fullUrl = link.href.includes('http') ? link.href : `https://barbermonger.me/${link.getAttribute('href')}`;
                    posts.push({
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
            return posts;
        } catch (e) {
            console.warn(`[BM] Scrape failed for forum ${cleanId}`);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    return results.flat().slice(0, 20); 
};
