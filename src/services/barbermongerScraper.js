export const scrapeBarbermonger = async (forumIds) => {
    if (!forumIds) return [];
    const ids = forumIds.split('+');
    
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const targetUrl = `https://barbermonger.me/index.php?showforum=${cleanId}`;
        
        // Using CodeTabs proxy (less likely to be blocked by BM Cloudflare)
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Targeted selection for Jcink forum topic titles
            const topicLinks = doc.querySelectorAll('a[href*="showtopic="]'); 
            const posts = [];

            topicLinks.forEach(link => {
                const title = link.textContent.trim();
                // Exclude pinned threads and navigation links
                if (title && !title.includes('Pinned:') && !title.includes('»')) {
                    const url = link.href.replace(window.location.origin, 'https://barbermonger.me');
                    posts.push({
                        id: url,
                        title: title,
                        author: 'Barbermonger User',
                        url: url,
                        source: `BM:${cleanId}`,
                        content: '',
                        isStub: true 
                    });
                }
            });
            return posts;
        } catch (e) {
            console.error(`[BM] Scrape failed for ID ${cleanId}:`, e);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    // Remove duplicates and limit to top 15
    const seen = new Set();
    return results.flat().filter(p => {
        const isDuplicate = seen.has(p.url);
        seen.add(p.url);
        return !isDuplicate;
    }).slice(0, 15); 
};
