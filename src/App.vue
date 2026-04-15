<template>
  <div id="app-container" :class="{ 'sidebar-open': isSidebarOpen }">
    <header id="mobile-header">
      <button class="menu-toggle" @click="isSidebarOpen = !isSidebarOpen">☰</button>
      <h1>RP Scout</h1>
      <button class="refresh-mini" @click="fetchAndAnalyze" :disabled="isLoading">
        {{ isLoading ? '...' : '↻' }}
      </button>
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
            <label>Blacklist Manager</label>
            <div class="add-tag-row">
              <input v-model="newBlacklistTag" @keyup.enter="addCustomFilter" placeholder="Type tag or u/user...">
              <button class="add-btn" @click="addCustomFilter">+</button>
            </div>
            <div class="blacklist-pills">
              <span v-for="tag in activeFilters" :key="tag" class="pill" @click="toggleFilter(tag)">
                {{ tag }} <span class="close-icon">&times;</span>
              </span>
            </div>
          </div>

          <div class="input-group">
            <label>Reddit Subs</label>
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
            {{ posts.length - filteredPosts.length }} hidden by blacklist
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
                <p>{{ post.ai.summary }}</p>
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

const filteredPosts = computed(() => {
  return posts.value.filter(post => {
    const postTags = [post.author, post.source, ...(post.ai ? [post.ai.pairing, post.ai.platform, post.ai.type, post.ai.fandom, ...(post.ai.tags || [])] : [])];
    return !activeFilters.value.some(f => postTags.includes(f));
  });
});

const fetchAndAnalyze = async () => {
  if (!apiKey.value) return;
  isLoading.value = true;
  isError.value = false;
  posts.value = [];
  try {
    buttonText.value = 'Connecting...';
    const [redditRaw, bmRaw] = await Promise.all([
      fetchPostsFromSubreddits(subs.value),
      scrapeBarbermonger(bmIds.value)
    ]);
    
    const allRaw = [...redditRaw, ...bmRaw];
    const toAnalyze = allRaw.filter(p => !p.isStub);
    const stubs = allRaw.filter(p => p.isStub);
    
    posts.value = stubs; 

    buttonText.value = 'AI Reading...';
    await analyzePostsWithGemini(toAnalyze, apiKey.value, (chunk) => {
      posts.value = [...posts.value, ...chunk];
    });

    statusMessage.value = 'Feed up to date.';
  } catch (e) {
    statusMessage.value = "Error: " + e.message;
    isError.value = true;
  } finally {
    isLoading.value = false;
    buttonText.value = '';
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
/* THE NUCLEAR RESET 
   Ensures browser defaults are nuked and our styles win.
*/
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

:root {
  --bg-main: #0a0a0b;
  --bg-side: #121214;
  --bg-card: #1c1c1f;
  --bg-input: #252529;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --text-primary: #f3f4f6;
  --text-secondary: #9ca3af;
  --danger: #ef4444;
}

body {
  background-color: var(--bg-main);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  overflow: hidden;
  height: 100vh;
}

#app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

/* SIDEBAR STRUCTURE */
#sidebar {
  width: 320px;
  min-width: 320px;
  background-color: var(--bg-side);
  border-right: 1px solid #27272a;
  display: flex;
  flex-direction: column;
}

.sidebar-inner {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 32px;
  color: var(--accent);
  letter-spacing: -0.025em;
}

.form-section { flex-grow: 1; overflow-y: auto; }

.input-group { 
  margin-bottom: 24px; 
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

input {
  width: 100%;
  padding: 12px 16px;
  background-color: var(--bg-input);
  border: 1px solid #3f3f46;
  border-radius: 8px;
  color: white;
  font-family: inherit;
  font-size: 0.9rem;
}

input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.add-tag-row { display: flex; gap: 8px; }
.add-btn {
  background: #3f3f46;
  border: none;
  color: white;
  width: 42px;
  border-radius: 8px;
  cursor: pointer;
}

/* PILLS */
.blacklist-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.pill {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pill:hover { background: var(--danger); color: white; }

.main-btn {
  width: 100%;
  padding: 14px;
  background-color: var(--accent);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}

.status-msg { font-size: 0.8rem; margin-top: 12px; color: var(--text-secondary); text-align: center; }
.status-msg.error { color: var(--danger); }

/* FEED STRUCTURE */
#feed {
  flex-grow: 1;
  overflow-y: auto;
  padding: 40px;
}

.feed-container { max-width: 850px; margin: 0 auto; }

.feed-info {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.count-badge { background: #27272a; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; }
.filter-count { font-size: 0.85rem; color: var(--text-secondary); }

/* CARDS */
.post-card {
  background: var(--bg-card);
  border: 1px solid #27272a;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
}

.post-meta { display: flex; gap: 12px; font-size: 0.75rem; font-weight: 600; margin-bottom: 12px; color: var(--text-secondary); }
.user-tag { color: var(--accent); cursor: pointer; }

.post-title { margin: 0 0 16px 0; font-size: 1.25rem; }
.post-title a { color: white; text-decoration: none; line-height: 1.4; }

.ai-summary-box {
  background: #121214;
  padding: 16px;
  border-radius: 12px;
  border-left: 4px solid var(--accent);
}

.ai-summary-box p { margin-bottom: 12px; font-size: 0.95rem; line-height: 1.6; color: #d1d5db; }

.ai-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.ai-tag { background: #27272a; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; }

.ai-tag.fandom.fandom-canon { background: var(--danger); color: white; }
.ai-tag.fandom.is-celebrity { background: #9333ea; color: white; }

.scan-single-btn { width: 100%; padding: 10px; background: #27272a; color: white; border: 1px solid #3f3f46; border-radius: 8px; cursor: pointer; }

/* MOBILE HEADER */
#mobile-header { display: none; }

@media (max-width: 768px) {
  #mobile-header {
    display: flex; position: fixed; top: 0; left: 0; right: 0; height: 64px;
    background: var(--bg-side); border-bottom: 1px solid #27272a;
    align-items: center; justify-content: space-between; padding: 0 20px; z-index: 100;
  }
  #sidebar { position: fixed; top: 0; left: 0; bottom: 0; transform: translateX(-100%); transition: transform 0.3s; z-index: 200; }
  #app-container.sidebar-open #sidebar { transform: translateX(0); }
  #feed { padding: 84px 20px 20px; }
}

.post-anim-enter-active { transition: all 0.3s ease-out; }
.post-anim-enter-from { opacity: 0; transform: translateY(20px); }
</style>
