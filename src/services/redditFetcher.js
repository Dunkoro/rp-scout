// src/services/redditFetcher.js

const fetch = require('node-fetch');

/**
 * Fetch posts from multiple subreddits using Reddit's public JSON API.
 * @param {Array} subreddits - An array of subreddit names.
 * @returns {Promise<Array>} - A promise that resolves to an array of post data.
 */
const fetchPostsFromSubreddits = async (subreddits) => {
    const fetchedPosts = [];

    // Prepare the subreddits string for the API URL
    const subredditString = subreddits.join('+');
    const apiUrl = `https://www.reddit.com/r/${subredditString}/hot.json`;  

    try {
        const response = await fetch(apiUrl);

        // Handle HTTP errors
        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.statusText}`);
        }

        const data = await response.json();

        // Extracting relevant post data
        data.data.children.forEach((child) => {
            const post = child.data;
            fetchedPosts.push({
                title: post.title,
                content: post.selftext,
                author: post.author,
                created: new Date(post.created_utc * 1000), // Convert from UNIX time
                url: post.url,
                subreddit: post.subreddit,
                nsfw: post.over_18,
                score: post.score
            });
        });

    } catch (error) {
        console.error(`Failed to fetch posts: ${error.message}`);
        throw error;  // Rethrow the error after logging
    }

    return fetchedPosts;
};

module.exports = fetchPostsFromSubreddits;
