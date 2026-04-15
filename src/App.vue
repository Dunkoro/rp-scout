<template>
  <div id="app-container">
    <aside id="sidebar">
      <h2>RP Scout</h2>
      
      <div class="input-group">
        <label>Subreddits (separated by +)</label>
        <input v-model="subs" type="text" placeholder="RoleplayPartnerSearch+Roleplay">
      </div>
      
      <button @click="fetchPosts" :disabled="isLoading">
        {{ isLoading ? 'Fetching...' : 'Find Posts' }}
      </button>
      
      <p class="status">{{ statusMessage }}</p>
    </aside>

    <main id="feed">
      <div id="results-count">{{ posts.length }} matches found</div>
      
      <div id="posts-container">
        <div v-for="post in posts" :key="post.id" class="rp-card">
          <h3><a :href="post.url" target="_blank">{{ post.title }}</a></h3>
          
          <p class="post-summary">{{ post.content.substring(0, 150) }}...</p>
          
          <div class="tag-container">
            <span class="tag author">u/{{ post.author }}</span>
            <span class="tag subreddit">r/{{ post.subreddit }}</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { fetchPostsFromSubreddits } from './services/redditFetcher.js';

// Reactive State Variables
const subs = ref('RoleplayPartnerSearch+Roleplay');
const posts = ref([]);
const isLoading = ref(false);
const statusMessage = ref('');

// The Fetch Action
const fetchPosts = async () => {
  if (!subs.value) return;
  
  isLoading.value = true;
  statusMessage.value = 'Fetching Reddit...';
  
  try {
    posts.value = await fetchPostsFromSubreddits(subs.value);
    statusMessage.value = 'Done!';
  } catch (error) {
    statusMessage.value = 'Error fetching posts. Check console.';
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style>
/* Base Theme */
:root { --bg: #121212; --card: #1e1e1e; --accent: #0084ff; --text: #e0e0e0; }
body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; }
#app-container { display: flex; height: 100vh; text-align: left; }

/* Sidebar */
#sidebar { width: 300px; padding: 20px; background: #181818; border-right: 1px solid #333; overflow-y: auto; }
.input-group { margin-bottom: 15px; }
label { display: block; font-size: 0.8rem; margin-bottom: 5px; color: #888; }
input { width: 90%; padding: 8px; background: #222; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
button { width: 100%; padding: 12px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.status { font-size: 0.9rem; color: #aaa; margin-top: 10px; }

/* Main Feed */
#feed { flex-grow: 1; padding: 20px; overflow-y: auto; }
#results-count { margin-bottom: 20px; color: #888; font-weight: bold; }

/* RP Cards */
.rp-card { background: var(--card); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid var(--accent); }
.rp-card h3 { margin-top: 0; font-size: 1.1rem; }
.rp-card a { color: var(--text); text-decoration: none; }
.rp-card a:hover { text-decoration: underline; color: var(--accent); }
.post-summary { color: #aaa; font-size: 0.9rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }

/* Tags */
.tag-container { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 15px; }
.tag { background: #333; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.tag.author { background: #5c2d91; }
.tag.subreddit { background: #7289da; }
</style>
