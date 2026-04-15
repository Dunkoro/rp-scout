export const scrapeBarbermonger = async (forumIds) => {
    if (!forumIds) return [];
    const ids = forumIds.split('+');
    
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const targetUrl = `https://barbermonger.me/index.php?showforum=${cleanId}`;
        
        // Switching to a different proxy provider
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Targeted selection for Barbermonger's thread rows
            const rows = doc.querySelectorAll('tr'); 
            const posts = [];

            rows.forEach(row => {
                const link = row.querySelector('a[href*="showtopic="]');
                const author = row.querySelector('span.desc a') || row.querySelector('td:nth-child(3)');
                
                if (link && !link.textContent.includes('Pinned:') && link.textContent.trim().length > 0) {
                    // Check if it's a real thread and not a subforum link
                    const href = link.href;
                    if (href.includes('showtopic=')) {
                        posts.push({
                            id: href,
                            title: link.textContent.trim(),
                            author: author ? author.textContent.trim() : 'Guest',
                            url: href,
                            source: `BM:${cleanId}`,
                            content: '',
                            isStub: true 
                        });
                    }
                }
            });
            return posts;
        } catch (e) {
            console.error(`[BM] Scrape failed for ID ${cleanId}:`, e.message);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    // Flatten and remove duplicates by URL
    const uniquePosts = Array.from(new Map(results.flat().map(p => [p.url, p])).values());
    return uniquePosts.slice(0, 15); 
};
