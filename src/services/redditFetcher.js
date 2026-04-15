export const fetchPostsFromSubreddits = async (subreddits) => {
    // If subreddits is an array, join it. If it's a string from an input, clean it.
    const subredditString = Array.isArray(subreddits) ? subreddits.join('+') : subreddits;
    
    // Construct target URL and wrap in proxy
    const targetUrl = `https://www.reddit.com/r/${subredditString}/new.json?limit=25`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const json = await response.json();
        
        return json.data.children.map(child => {
            const post = child.data;
            return {
                id: post.id,
                title: post.title,
                content: post.selftext,
                author: post.author,
                url: post.url,
                source: 'r/' + post.subreddit
            };
        });
    } catch (error) {
        console.error(`Failed to fetch posts: ${error.message}`);
        return [];
    }
};
