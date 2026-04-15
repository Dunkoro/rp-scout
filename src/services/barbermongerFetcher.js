const rssParser = require('rss-parser');

class BarbermongerFetcher {
  constructor() {
    this.feeds = [];
    this.parser = new rssParser();
  }

  // Fetch and parse a single RSS feed
  async fetchFeed(url) {
    const feed = await this.parser.parseURL(url);
    return this.parseFeedData(feed);
  }

  // Fetch and parse multiple RSS feeds
  async fetchMultipleFeeds(urls) {
    const feedPromises = urls.map(url => this.fetchFeed(url));
    return Promise.all(feedPromises);
  }

  // Add a new RSS feed
  addFeed(url) {
    if (!this.feeds.includes(url)) {
      this.feeds.push(url);
    }
  }

  // Remove an RSS feed
  removeFeed(url) {
    this.feeds = this.feeds.filter(feed => feed !== url);
  }

  // Get all configured feeds
  getAllFeeds() {
    return this.feeds;
  }

  // Parse feed data to extract required information
  parseFeedData(feed) {
    return feed.items.map(item => ({
      title: item.title,
      content: item.content,
      author: item.author,
      date: item.pubDate,
      url: item.link,
      source: feed.title,
      category: item.categories,
      tags: item.tags,
    }));
  }
}

module.exports = BarbermongerFetcher;