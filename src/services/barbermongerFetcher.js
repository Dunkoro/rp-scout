export const fetchBarbermongerPosts = async (rssUrl) => {
    if (!rssUrl) return [];
    
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
    
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const text = await response.text();
        
        // Browser-native XML parsing
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const items = xmlDoc.querySelectorAll("item");

        return Array.from(items).map(item => {
            const title = item.querySelector("title")?.textContent || "No Title";
            const link = item.querySelector("link")?.textContent || "";
            const rawContent = item.querySelector("description")?.textContent || "";
            
            // Jcink RSS sometimes uses Dublin Core <dc:creator> for the author
            const author = item.getElementsByTagName("dc:creator")[0]?.textContent 
                        || item.querySelector("author")?.textContent 
                        || "Forum Member";

            return {
                id: link, // Use the URL as the unique ID
                title: title,
                content: rawContent.replace(/<[^>]*>?/gm, ''), // Strip HTML tags for the snippet
                author: author,
                url: link,
                source: 'Barbermonger' // Unifies the tag system
            };
        });
    } catch (error) {
        console.error(`Failed to fetch Barbermonger: ${error.message}`);
        return [];
    }
};
