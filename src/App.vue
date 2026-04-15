<template>
  <div id="app-container" :class="{ 'sidebar-open': isSidebarOpen }">
    <header id="mobile-header">
      <button class="menu-toggle" @click="isSidebarOpen = !isSidebarOpen">☰</button>
      <h1>RP Scout</h1>
      <button class="refresh-mini" @click="fetchAndAnalyze" :disabled="isLoading">↻</button>
    </header>

    <aside id="sidebar">
      <div class="sidebar-inner">
        <h2 class="logo">RP Scout</h2>
        
        <div class="form-section">
          <div class="input-group">
            <label>Gemini API Key</label>
            <input v-model="apiKey" type="password" placeholder="AIzaSy...">
          </div>

          <div class="input-group">
            <label>Blacklist</label>
            <div class="add-tag-row">
              <input v-model="newBlacklistTag" @keyup.enter="addCustomFilter" placeholder="Block tag or u/user...">
              <button class="add-btn" @click="addCustomFilter">+</button>
            </div>
            <div class="blacklist-pills">
              <span v-for="tag in activeFilters" :key="tag" class="pill" @click="toggleFilter(tag)">
                {{ tag }} <span class="close-icon">&times;</span>
              </span>
            </div>
          </div>

          <div class="input-group">
            <label>Reddit Subreddits</label>
            <input v-model="subs" type="text">
          </div>

          <div class="input-group">
            <label>Barbermonger IDs</label>
            <input v-model="bmIds" type="text">
          </div>
        </div>

        <div class="sidebar-footer">
          <button @click="fetchAndAnalyze" :disabled="isLoading" class="main-btn">
            {{ isLoading ? (buttonText || 'Thinking...') : 'Refresh Feed' }}
          </button>
          <p class="status-msg" :class="{ error: isError }">{{ statusMessage }}</p>
        </div>
      </div>
    </aside>

    <main id="feed" @click="isSidebarOpen = false">
      <div class="feed-container">
        <header class="feed-info">
          <span class="count-badge"><b>{{ filteredPosts.length }}</b> Results</span>
          <span v-if="posts.length > filteredPosts.length" class="filter-count">
            {{ posts.length - filteredPosts.length }} pre-filtered or blacklisted
          </span>
        </header>

        <div class="posts-list">
          <TransitionGroup name="post-anim">
            <div v-for="post in filteredPosts" :key="post.id" class="post-card">
              <div class="post-meta">
                <span class="source-tag">{{ post.source }}</span>
                <span class="user-tag" @click.stop="toggleFilter(post.author)">u/{{ post.author }}</span>
              </div>
              
              <h3 class="post-title"><a :href="post.url" target="_blank">{{ post.title }}</a></h3>
              
              <div v-if="post.ai" class="ai-summary-box">
                <p class="summary-text">{{ post.ai.summary }}</p>
                <div class="ai-tags">
                  <span class="ai-tag pairing" @click="toggleFilter(post.ai.pairing)">{{ post.ai.pairing }}</span>
                  <span class="ai-tag platform" @click="toggleFilter(post.ai.platform)">{{ post.ai.platform }}</span>
                  <span class="ai-tag type" @click="toggleFilter(post.ai.type)">{{ post.ai.type }}</span>
                  <span class="ai-tag fandom" :class="post.ai.fandom?.replace(/\s+/g, '-').toLowerCase()" @click="toggleFilter(post.ai.fandom)">
                    {{ post.ai.fandom }}
                  </span>
                  <span v-for="tag in post.ai.tags" :key="tag" class="ai-tag genre" @click="toggleFilter(tag)">
                    {{ tag }}
                  </span>
                </div>
              </div>

              <div v-else-if="post.isStub" class="stub-actions">
                <button class="scan-single-btn" @click="scanSinglePost(post)">Analyze with Gemini</button>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { fetchPostsFromSubreddits } from './services/redditFetcher.js';
import { analyzePostsWithGemini } from './services/geminiService.js';
import { scrapeBarbermonger } from './services/barbermongerScraper.js';

const apiKey = ref('');
const subs = ref('RoleplayPartnerSearch+Roleplay');
const bmIds = ref('1+45');
const posts = ref([]);
const isLoading = ref(false);
const isSidebarOpen = ref(false);
const statusMessage = ref('');
const buttonText = ref('');
const isError = ref(false);
const activeFilters = ref([]);
const newBlacklistTag = ref('');

onMounted(() => {
  apiKey.value = localStorage.getItem('gemini_api_key') || '';
  subs.value = localStorage.getItem('rp_scout_subs') || 'RoleplayPartnerSearch+Roleplay';
  bmIds.value = localStorage.getItem('rp_scout_bm') || '1+45';
  const savedFilters = localStorage.getItem('rp_scout_blacklist');
  if (savedFilters) activeFilters.value = JSON.parse(savedFilters);
  if (apiKey.value) fetchAndAnalyze();
});

watch([apiKey, subs, bmIds, activeFilters], () => {
  localStorage.setItem('gemini_api_key', apiKey.value);
  localStorage.setItem('rp_scout_subs', subs.value);
  localStorage.setItem('rp_scout_bm', bmIds.value);
  localStorage.setItem('rp_scout_blacklist', JSON.stringify(activeFilters.value));
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

const getNativeTags = (title) => {
  const bracketTags = title.match(/\[(.*?)\]/g) || [];
  const parenTags = title.match(/\((.*?)\)/g) || [];
  return [...bracketTags, ...parenTags].map(t => t.replace(/[\[\]\(\)]/g, '').trim());
};

// A "Loose" filter that checks titles, users, and tags
const isBlacklisted = (post) => {
  if (!activeFilters.value || activeFilters.value.length === 0) return false;
  
  // Build a "Wall of Text" to search through
  const searchableText = [
    post?.author,
    post?.title,
    post?.source,
    ...(post?.ai ? [
      post.ai.pairing,
      post.ai.platform,
      post.ai.fandom,
      ...(post.ai.tags || [])
    ] : [])
  ].map(t => String(t || '').toLowerCase());

  return activeFilters.value.some(filter => {
    if (!filter) return false;
    const f = filter.toLowerCase().trim();
    return searchableText.some(text => text.includes(f));
  });
};

// Defensive Computed Property
const filteredPosts = computed(() => {
  const currentPosts = posts.value || [];
  if (activeFilters.value?.length === 0) return currentPosts;
  return currentPosts.filter(post => !isBlacklisted(post));
});

const fetchAndAnalyze = async () => {
  if (!apiKey.value) return;
  isLoading.value = true;
  isError.value = false;
  posts.value = []; // Clear current feed
  
  try {
    const [redditRaw, bmRaw] = await Promise.all([
      fetchPostsFromSubreddits(subs.value).catch(() => []),
      scrapeBarbermonger(bmIds.value).catch(() => [])
    ]);
    
    // PRE-FILTER: Instantly drop forbidden titles/users
    const allPosts = [...(redditRaw || []), ...(bmRaw || [])];
    const preFiltered = allPosts.filter(post => !isBlacklisted(post));
    
    const toAnalyze = preFiltered.filter(p => !p.isStub);
    const stubs = preFiltered.filter(p => p.isStub);
    
    // Show stubs (BM posts) immediately
    posts.value = stubs; 

    // Analyze Reddit posts
    await analyzePostsWithGemini(toAnalyze, apiKey.value, (chunk) => {
      // Re-filter after AI adds new tags
      const safeChunk = (chunk || []).filter(post => !isBlacklisted(post));
      posts.value = [...posts.value, ...safeChunk];
    });

    statusMessage.value = 'Sync Complete';
  } catch (e) {
    statusMessage.value = "Connection Error";
    isError.value = true;
  } finally {
    isLoading.value = false;
  }
};

const scanSinglePost = async (post) => {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(post.url)}`;
  try {
    const resp = await fetch(proxyUrl);
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const postBody = doc.querySelector('.postcolor')?.textContent || "No text found";
    post.content = postBody;
    post.isStub = false;
    const analyzed = await analyzePostsWithGemini([post], apiKey.value);
    const index = posts.value.findIndex(p => p.id === post.id);
    if (index !== -1) posts.value[index] = analyzed[0];
  } catch (e) {
    console.error("Single scan failed", e);
  }
};
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-main: #0a0a0b; --bg-side: #121214; --bg-card: #1c1c1f;
  --bg-input: #252529; --accent: #3b82f6; --text-primary: #f3f4f6;
  --text-secondary: #9ca3af; --danger: #ef4444;
}

body {
  background-color: var(--bg-main); color: var(--text-primary);
  font-family: 'Inter', -apple-system, sans-serif; overflow: hidden;
}

#app-container { display: flex; height: 100vh; width: 100vw; }

/* SIDEBAR */
#sidebar {
  width: 320px; min-width: 320px; background-color: var(--bg-side);
  border-right: 1px solid #27272a; display: flex; flex-direction: column;
}

.sidebar-inner { padding: 32px 24px; display: flex; flex-direction: column; height: 100%; }
.logo { font-size: 1.5rem; font-weight: 700; margin-bottom: 32px; color: var(--accent); }
.form-section { flex-grow: 1; overflow-y: auto; }
.input-group { margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px; }
label { font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }

input {
  width: 100%; padding: 12px; background-color: var(--bg-input);
  border: 1px solid #3f3f46; border-radius: 8px; color: white;
}

.blacklist-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pill {
  background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; cursor: pointer;
}

.main-btn {
  width: 100%; padding: 14px; background-color: var(--accent); color: white;
  border: none; border-radius: 10px; font-weight: 600; cursor: pointer;
}

/* FEED */
#feed { flex-grow: 1; overflow-y: auto; padding: 40px; }
.feed-container { max-width: 850px; margin: 0 auto; }
.feed-info { margin-bottom: 24px; color: var(--text-secondary); font-size: 0.85rem; }

/* CARDS */
.post-card {
  background: var(--bg-card); border: 1px solid #27272a;
  border-radius: 16px; padding: 24px; margin-bottom: 20px;
}

.post-meta { display: flex; gap: 12px; font-size: 0.75rem; margin-bottom: 12px; color: var(--text-secondary); }
.user-tag { color: var(--accent); cursor: pointer; font-weight: bold; }

.post-title { margin-bottom: 16px; font-size: 1.25rem; }
.post-title a { color: white; text-decoration: none; }
.post-title a:hover { color: var(--accent); }
/* Fix the 1990s blue links */
.post-title a {
  color: var(--text-primary);
  text-decoration: none;
  transition: color 0.2s;
}

.post-title a:hover {
  color: var(--accent);
}

/* Fix the smashed tags */
.ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px; /* Adds space between tags */
  margin-top: 12px;
}

.ai-tag {
  background: #2a2a2e;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #e0e0e0;
  border: 1px solid #3f3f46;
}

/* Make the "Server Busy" box less intrusive */
.ai-summary-box {
  background: rgba(18, 18, 20, 0.5);
  padding: 16px;
  border-radius: 12px;
  border-left: 4px solid var(--accent);
  min-height: 50px;
}

/* Fandom Colors */
.ai-tag.fandom.fandom-canon { background: var(--danger); color: white; }
.ai-tag.fandom.is-celebrity { background: #9333ea; color: white; }

/* MOBILE */
#mobile-header { display: none; }
@media (max-width: 768px) {
  #mobile-header { display: flex; position: fixed; top: 0; left: 0; right: 0; height: 60px; background: var(--bg-side); align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid #333; }
  #sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: 0.3s; z-index: 200; }
  #app-container.sidebar-open #sidebar { transform: translateX(0); }
  #feed { padding-top: 80px; }
}
</style>
