<template>
  <div id="app-container">
    <aside id="sidebar">
      <h2>RP Scout</h2>
      
      <div class="input-group">
        <label>Gemini API Key</label>
        <input v-model="apiKey" type="password" placeholder="AIzaSy...">
        <small class="helper-text">Saved to your browser's local storage.</small>
      </div>

      <div class="input-group">
        <label>Subreddits (separated by +)</label>
        <input v-model="subs" type="text" placeholder="RoleplayPartnerSearch+Roleplay">
      </div>
      
      <button @click="fetchAndAnalyze" :disabled="isLoading">
        {{ isLoading ? buttonText : 'Scout Posts' }}
      </button>
      
      <p class="status" :class="{ error: isError }">{{ statusMessage }}</p>
    </aside>

    <main id="feed">
      <div v-if="activeFilters.length > 0" id="filter-bar">
        <span class="filter-label">Active Filters:</span>
        <span v-for="filter in activeFilters" :key="filter" class="tag active-filter" @click="toggleFilter(filter)">
          {{ filter }} &times;
        </span>
        <button class="clear-btn" @click="clearFilters">Clear All</button>
      </div>

      <div id="results-count">{{ filteredPosts.length }} posts found</div>
      
      <div id="posts-container">
        <div v-for="post in filteredPosts" :key="post.id" class="rp-card">
          <h3><a :href="post.url" target="_blank">{{ post.title }}</a></h3>
          
          <div v-if="post.ai" class="ai-box">
            <p class="ai-summary"><strong>AI Note:</strong> {{ post.ai.summary }}</p>
            <div class="tag-container">
              <span class="tag pairing" @click="toggleFilter(post.ai.pairing)">{{ post.ai.pairing }}</span>
              <span class="tag platform" @click="toggleFilter(post.ai.platform)">{{ post.ai.platform }}</span>
              <span class="tag type" @click="toggleFilter(post.ai.type)">{{ post.ai.type }}</span>
              
              <span class="tag fandom" :class="{
                'is-original': post.ai.fandom === 'Original',
                'is-fandom-oc': post.ai.fandom === 'Fandom (OCs)',
                'is-fandom-canon': post.ai.fandom === 'Fandom (Canon)'
              }" @click="toggleFilter(post.ai.fandom)">
                {{ post.ai.fandom }}
              </span>
              
              <span v-for="tag in post.ai.tags" :key="tag" class="tag genre" @click="toggleFilter(tag)">
                {{ tag }}
              </span>
            </div>
          </div>
          
          <div class="tag-container bottom-tags">
            <span class="tag author" @click="toggleFilter(post.author)">u/{{ post.author }}</span>
            <span class="tag source" @click="toggleFilter(post.source)">{{ post.source }}</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { fetchPostsFromSubreddits } from './services/redditFetcher.js';
import { analyzePostsWithGemini } from './services/geminiService.js';

const apiKey = ref('');
const subs = ref('RoleplayPartnerSearch+Roleplay');
const posts = ref([]);
const isLoading = ref(false);
const statusMessage = ref('');
const buttonText = ref('');
const isError = ref(false);

// NEW: Filtering State
const activeFilters = ref([]);

onMounted(() => {
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) apiKey.value = savedKey;
});

watch(apiKey, (newVal) => localStorage.setItem('gemini_api_key', newVal));

// NEW: Toggle function for clicking tags
const toggleFilter = (tagValue) => {
  if (!tagValue) return;
  const index = activeFilters.value.indexOf(tagValue);
  if (index === -1) {
    activeFilters.value.push(tagValue); // Add it
  } else {
    activeFilters.value.splice(index, 1); // Remove it if already active
  }
};

const clearFilters = () => {
  activeFilters.value = [];
};

// NEW: The Computed Property that actually filters the UI
const filteredPosts = computed(() => {
  // If no filters are clicked, show everything
  if (activeFilters.value.length === 0) return posts.value;

  // Otherwise, only show posts that match ALL active filters
  return posts.value.filter(post => {
    // Gather all text values from the post into one big array to check against
    const postTags = [
      post.author,
      post.source,
      ...(post.ai ? [
        post.ai.pairing,
        post.ai.platform,
        post.ai.type,
        post.ai.fandom,
        ...(post.ai.tags || [])
      ] : [])
    ];

    // .every() ensures the post has EVERY tag you clicked
    return activeFilters.value.every(filter => postTags.includes(filter));
  });
});

const fetchAndAnalyze = async () => {
  if (!subs.value) return;
  if (!apiKey.value) {
    statusMessage.value = 'API Key required.';
    isError.value = true;
    return;
  }
  
  isLoading.value = true;
  isError.value = false;
  posts.value = [];
  activeFilters.value = []; // Clear filters when fetching new batch
  
  try {
    buttonText.value = 'Fetching Reddit...';
    statusMessage.value = 'Pulling recent ads...';
    const rawPosts = await fetchPostsFromSubreddits(subs.value);
    
    buttonText.value = 'AI is reading...';
    statusMessage.value = `Analyzing ${rawPosts.length} posts...`;
    
    await analyzePostsWithGemini(rawPosts, apiKey.value, (newlyAnalyzedChunk) => {
        posts.value = [...posts.value, ...newlyAnalyzedChunk];
    });
    
    statusMessage.value = 'Done!';
  } catch (error) {
    statusMessage.value = error.message;
    isError.value = true;
  } finally {
    isLoading.value = false;
    buttonText.value = 'Scout Posts';
  }
};
</script>

<style>
:root { --bg: #121212; --card: #1e1e1e; --accent: #0084ff; --text: #e0e0e0; }
body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; }
#app-container { display: flex; height: 100vh; text-align: left; }
#sidebar { width: 300px; padding: 20px; background: #181818; border-right: 1px solid #333; overflow-y: auto; }
.input-group { margin-bottom: 15px; }
label { display: block; font-size: 0.8rem; margin-bottom: 5px; color: #888; }
input { width: 100%; padding: 8px; background: #222; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
.helper-text { font-size: 0.7rem; color: #666; display: block; margin-top: 4px; }
button { width: 100%; padding: 12px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.status { font-size: 0.9rem; color: #aaa; margin-top: 10px; }
.status.error { color: #ff5252; }
#feed { flex-grow: 1; padding: 20px; overflow-y: auto; }
#results-count { margin-bottom: 20px; color: #888; font-weight: bold; }
.rp-card { background: var(--card); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid var(--accent); }
.rp-card h3 { margin-top: 0; font-size: 1.1rem; margin-bottom: 15px; }
.rp-card a { color: var(--text); text-decoration: none; }
.rp-card a:hover { text-decoration: underline; color: var(--accent); }
.ai-box { background: #2a2a2a; border-radius: 6px; padding: 12px; margin-bottom: 15px; border: 1px solid #444; }
.ai-summary { margin: 0 0 10px 0; font-size: 0.95rem; line-height: 1.4; color: #ddd; }
.tag-container { display: flex; gap: 6px; flex-wrap: wrap; }
.bottom-tags { border-top: 1px solid #333; padding-top: 12px; margin-top: 15px; }

/* Tag Styling - Added cursor & hover effects */
.tag { background: #333; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; transition: filter 0.2s; }
.tag:hover { filter: brightness(1.3); }
.tag.author { background: #5c2d91; }
.tag.source { background: #555; }
.tag.pairing { background: #d32f2f; }
.tag.platform { background: #1976d2; }
.tag.type { background: #388e3c; }
.tag.genre { background: #f57c00; }
.tag.fandom.is-original { background: #424242; } 
.tag.fandom.is-fandom-oc { background: #f57f17; color: white; } 
.tag.fandom.is-fandom-canon { background: #b71c1c; border: 1px solid #ff5252; } 

/* Active Filter Bar Styling */
#filter-bar { background: #222; padding: 12px; border-radius: 6px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border: 1px solid #444; }
.filter-label { font-size: 0.8rem; color: #888; font-weight: bold; margin-right: 5px; }
.active-filter { background: var(--accent); border: 1px solid #005bb5; }
.clear-btn { width: auto; padding: 4px 10px; margin-top: 0; margin-left: auto; background: transparent; border: 1px solid #888; color: #888; font-size: 0.75rem; }
.clear-btn:hover { border-color: white; color: white; }
</style>
