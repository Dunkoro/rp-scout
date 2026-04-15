export const fetchBarbermongerPosts = async (forumIds) => {
    if (!forumIds) return [];
    
    // Split the IDs and create a fetch request for each one
    const ids = forumIds.split('+');
    const fetchPromises = ids.map(async (id) => {
        const cleanId = id.trim();
        const rssUrl = `https://barbermonger.me/index.php?act=rssout&id=${cleanId}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
        
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) return []; // Silently fail this specific feed if down
            
            const text = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const items = xmlDoc.querySelectorAll("item");

            return Array.from(items).map(item => {
                const title = item.querySelector("title")?.textContent || "No Title";
                const link = item.querySelector("link")?.textContent || "";
                const rawContent = item.querySelector("description")?.textContent || "";
                
                const author = item.getElementsByTagName("dc:creator")[0]?.textContent 
                            || item.querySelector("author")?.textContent 
                            || "Forum Member";

                return {
                    id: link, 
                    title: title,
                    content: rawContent.replace(/<[^>]*>?/gm, ''), // Strip HTML tags
                    author: author,
                    url: link,
                    source: `BM: Forum ${cleanId}` // Tags it with the specific forum ID
                };
            });
        } catch (error) {
            console.error(`Failed to fetch Barbermonger ID ${cleanId}: ${error.message}`);
            return [];
        }
    });

    // Wait for all forum requests to finish, then flatten into a single array
    const results = await Promise.all(fetchPromises);
    return results.flat();
};
