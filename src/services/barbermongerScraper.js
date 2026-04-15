export const scrapeBarbermonger = async (forumIds) => {
    if (!forumIds) return [];
    const ids = forumIds.split('+');
    
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const targetUrl = `https://barbermonger.me/index.php?showforum=${cleanId}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            const json = await response.json();
            const parser = new DOMParser();
            const doc = parser.parseFromString(json.contents, 'text/html');

            // Jcink Topic Rows usually sit in rows with class 'topic-row' or similar
            // This targets the specific link structure of Barbermonger
            const rows = doc.querySelectorAll('tr'); 
            const posts = [];

            rows.forEach(row => {
                const link = row.querySelector('a[href*="showtopic="]');
                const author = row.querySelector('span.desc a') || row.querySelector('td:nth-child(3)');
                
                if (link && !link.textContent.includes('Pinned:')) {
                    posts.push({
                        id: link.href,
                        title: link.textContent.trim(),
                        author: author ? author.textContent.trim() : 'Unknown',
                        url: link.href,
                        source: `BM: ${cleanId}`,
                        content: '', // Empty initially to save bandwidth
                        isStub: true // Flag to show "Scan with AI" button
                    });
                }
            });
            return posts;
        } catch (e) {
            console.error("BM Scrape Error:", e);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    return results.flat().slice(0, 20); // Keep it to top 20
};
