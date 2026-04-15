<template>
  <div id="app-container">
    <aside id="sidebar">
      <h2>RP Scout</h2>
      
      <div class="input-group">
        <label>Gemini API Key</label>
        <input v-model="apiKey" type="password" placeholder="AIzaSy...">
      </div>

      <div class="input-group">
        <label>Blacklist (Tags, Users, Fandoms)</label>
        <div class="flex-row">
          <input v-model="newBlacklistTag" @keyup.enter="addCustomFilter" type="text" placeholder="Add custom block...">
          <button class="add-btn" @click="addCustomFilter">+</button>
        </div>
        <div class="mini-tag-list">
          <span v-for="tag in activeFilters" :key="tag" class="mini-tag" @click="toggleFilter(tag)">
            {{ tag }} &times;
          </span>
        </div>
      </div>

      <div class="input-group">
        <label>Subreddits</label>
        <input v-model="subs" type="text">
      </div>
      
      <button @click="fetchAndAnalyze" :disabled="isLoading" class="main-action">
        {{ isLoading ? buttonText : 'Refresh Feed' }}
      </button>
      
      <p class="status" :class="{ error: isError }">{{ statusMessage }}</p>
    </aside>

    <main id="feed">
      <div id="results-count">
        {{ filteredPosts.length }} visible / {{ posts.length }} total
        <span v-if="posts.length > filteredPosts.length" class="hidden-count">
          ({{ posts.length - filteredPosts.length }} hidden)
        </span>
      </div>
      
      <div id="posts-container">
        <div v-for="post in filteredPosts" :key="post.id" class="rp-card">
          <h3><a :href="post.url" target="_blank">{{ post.title }}</a></h3>
          
          <div v-if="post.ai" class="ai-box">
            <p class="ai-summary"><strong>AI Note:</strong> {{ post.ai.summary }}</p>
            <div class="tag-container">
              <span class="tag pairing" @click="toggleFilter(post.ai.pairing)">{{ post.ai.pairing }}</span>
              <span class="tag platform" @click="toggleFilter(post.ai.platform)">{{ post.ai.platform }}</span>
              <span class="tag type" @click="toggleFilter(post.ai.type)">{{ post.ai.type }}</span>
              
              <span class="tag fandom" 
                    :class="{
                      'original': post.ai.fandom === 'Original',
                      'fandom-ocs': post.ai.fandom === 'Fandom (OCs)',
                      'fandom-canon': post.ai.fandom === 'Fandom (Canon)',
                      'is-celebrity': post.ai.fandom === 'Celebrity'
                    }" 
                    @click="toggleFilter(post.ai.fandom)">
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

const activeFilters = ref([]);
const newBlacklistTag = ref('');

onMounted(() => {
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) apiKey.value = savedKey;

  const savedSubs = localStorage.getItem('rp_scout_subs');
  if (savedSubs) subs.value = savedSubs;

  const savedFilters = localStorage.getItem('rp_scout_blacklist');
  if (savedFilters) activeFilters.value = JSON.parse(savedFilters);

  if (apiKey.value && subs.value) fetchAndAnalyze();
});

watch(apiKey, (val) => localStorage.setItem('gemini_api_key', val));
watch(subs, (val) => localStorage.setItem('rp_scout_subs', val));
watch(activeFilters, (val) => {
  localStorage.setItem('rp_scout_blacklist', JSON.stringify(val));
}, { deep: true });

const toggleFilter = (tag) => {
  if (!tag) return;
  const index = activeFilters.value.indexOf(tag);
  if (index === -1) activeFilters.value.push(tag);
  else activeFilters.value.splice(index, 1);
};

const addCustomFilter = () => {
  if (newBlacklistTag.value.trim()) {
    toggleFilter(newBlacklistTag.value.trim());
    newBlacklistTag.value = '';
  }
};

const filteredPosts = computed(() => {
  if (activeFilters.value.length === 0) return posts.value;
  return posts.value.filter(post => {
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
    // Hide post if ANY of its tags are in our unified blacklist
    return !activeFilters.value.some(f => postTags.includes(f));
  });
});

const fetchAndAnalyze = async () => {
  if (!subs.value || !apiKey.value) return;
  isLoading.value = true;
  posts.value = [];
  try {
    buttonText.value = 'Fetching...';
    const rawPosts = await fetchPostsFromSubreddits(subs.value);
    buttonText.value = 'AI Reading...';
    await analyzePostsWithGemini(rawPosts, apiKey.value, (chunk) => {
      posts.value = [...posts.value, ...chunk];
    });
    statusMessage.value = 'Analysis complete.';
  } catch (e) {
    statusMessage.value = e.message;
    isError.value = true;
  } finally {
    isLoading.value = false;
    buttonText.value = '';
  }
};
</script>

<style>
:root { --bg: #121212; --card: #1e1e1e; --accent: #0084ff; --text: #e0e0e0; --danger: #b71c1c; }
body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; }
#app-container { display: flex; height: 100vh; }

#sidebar { width: 320px; padding: 20px; background: #181818; border-right: 1px solid #333; overflow-y: auto; }
.input-group { margin-bottom: 20px; }
label { font-size: 0.75rem; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 8px; display: block; }
input { width: 100%; padding: 10px; background: #222; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }

.flex-row { display: flex; gap: 5px; }
.add-btn { background: #444; color: white; border: none; padding: 0 15px; border-radius: 4px; cursor: pointer; font-size: 1.2rem; }

.mini-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.mini-tag { font-size: 0.65rem; background: #2a2a2a; padding: 4px 10px; border-radius: 12px; border: 1px solid #444; cursor: pointer; color: #ff5252; font-weight: bold; }
.mini-tag:hover { background: var(--danger); color: white; }

.main-action { width: 100%; padding: 15px; background: var(--accent); color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }

#feed { flex-grow: 1; padding: 20px; overflow-y: auto; }
.hidden-count { color: var(--danger); font-size: 0.8rem; margin-left: 10px; }
.rp-card { background: var(--card); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid var(--accent); }

.tag { background: #333; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; }
.tag:hover { filter: brightness(1.2); }
.tag.author { background: #5c2d91; }
.tag.fandom.original { background: #424242; }
.tag.fandom.fandom-ocs { background: #f57f17; }
.tag.fandom.fandom-canon { background: var(--danger); border: 1px solid #ff5252; }
.tag.fandom.is-celebrity { background: #6a1b9a; border: 1px solid #9c27b0; }

.ai-box { background: #252525; padding: 15px; border-radius: 6px; border: 1px solid #333; margin-bottom: 10px; }
.tag-container { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
</style>
