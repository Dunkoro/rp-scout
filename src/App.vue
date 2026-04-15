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
      <div class="sidebar-content">
        <h2 class="desktop-only">RP Scout</h2>
        
        <div class="input-group">
          <label>Gemini API Key</label>
          <input v-model="apiKey" type="password">
        </div>

        <div class="input-group">
          <label>Blacklist</label>
          <div class="flex-row">
            <input v-model="newBlacklistTag" @keyup.enter="addCustomFilter" placeholder="Block something...">
            <button class="add-btn" @click="addCustomFilter">+</button>
          </div>
          <div class="mini-tag-list">
            <span v-for="tag in activeFilters" :key="tag" class="mini-tag" @click="toggleFilter(tag)">
              {{ tag }} <span>&times;</span>
            </span>
          </div>
        </div>

        <div class="input-group">
          <label>Reddit Subreddits</label>
          <input v-model="subs" type="text">
        </div>

        <div class="input-group">
          <label>Barbermonger IDs</label>
          <input v-model="bmIds" type="text" placeholder="1+45">
        </div>
        
        <button @click="fetchAndAnalyze" :disabled="isLoading" class="main-action">
          {{ isLoading ? 'Scouting...' : 'Refresh Feed' }}
        </button>
        
        <p class="status" :class="{ error: isError }">{{ statusMessage }}</p>
      </div>
    </aside>

    <main id="feed" @click="isSidebarOpen = false">
      <div class="feed-header">
        <div id="results-count">
          <strong>{{ filteredPosts.length }}</strong> posts
          <span v-if="posts.length > filteredPosts.length" class="hidden-count">
            ({{ posts.length - filteredPosts.length }} hidden)
          </span>
        </div>
      </div>
      
      <div id="posts-container">
        <TransitionGroup name="list">
          <div v-for="post in filteredPosts" :key="post.id" class="rp-card">
            <div class="card-header">
              <span class="card-source">{{ post.source }}</span>
              <span class="card-author" @click.stop="toggleFilter(post.author)">u/{{ post.author }}</span>
            </div>
            
            <h3><a :href="post.url" target="_blank">{{ post.title }}</a></h3>
            
            <div v-if="post.ai" class="ai-box">
              <p class="ai-summary">{{ post.ai.summary }}</p>
              <div class="tag-container">
                <span class="tag pairing" @click="toggleFilter(post.ai.pairing)">{{ post.ai.pairing }}</span>
                <span class="tag platform" @click="toggleFilter(post.ai.platform)">{{ post.ai.platform }}</span>
                <span class="tag type" @click="toggleFilter(post.ai.type)">{{ post.ai.type }}</span>
                <span class="tag fandom" :class="post.ai.fandom?.replace(/\s+/g, '-').toLowerCase()" @click="toggleFilter(post.ai.fandom)">
                  {{ post.ai.fandom }}
                </span>
                <span v-for="tag in post.ai.tags" :key="tag" class="tag genre" @click="toggleFilter(tag)">
                  {{ tag }}
                </span>
              </div>
            </div>

            <div v-else-if="post.isStub" class="stub-box">
              <button class="scan-btn" @click="scanSinglePost(post)">Scan with Gemini</button>
            </div>
          </div>
        </TransitionGroup>
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
  posts.value = [];
  try {
    const [redditRaw, bmRaw] = await Promise.all([
      fetchPostsFromSubreddits(subs.value),
      scrapeBarbermonger(bmIds.value)
    ]);
    
    // Mix them together
    const allRaw = [...redditRaw, ...bmRaw];
    
    // Analyze only the Reddit ones automatically (BM requires manual scan to save time/tokens)
    const toAnalyze = allRaw.filter(p => !p.isStub);
    const stubs = allRaw.filter(p => p.isStub);
    
    posts.value = stubs; // Show BM stubs immediately

    await analyzePostsWithGemini(toAnalyze, apiKey.value, (chunk) => {
      posts.value = [...posts.value, ...chunk];
    });

    statusMessage.value = 'Feed Updated';
  } catch (e) {
    statusMessage.value = "Error: " + e.message;
    isError.value = true;
  } finally {
    isLoading.value = false;
  }
};

// Function for Barbermonger manual scan
const scanSinglePost = async (post) => {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(post.url)}`;
  try {
    const resp = await fetch(proxyUrl);
    const json = await resp.json();
    const parser = new DOMParser();
    const doc = parser.parseFromString(json.contents, 'text/html');
    
    // Get the first post body from a Jcink thread
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
/* 1. CORE THEME & RESET */
:root { 
  --bg: #0d0d0d; 
  --sidebar-bg: #161616;
  --card-bg: #1e1e1e;
  --input-bg: #252525;
  --accent: #007bff; 
  --text: #ffffff; 
  --text-dim: #999; 
  --danger: #ff4444; 
}

body { 
  background: var(--bg); 
  color: var(--text); 
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  margin: 0; 
  overflow: hidden; /* Prevents double scrollbars */
}

/* 2. LAYOUT ENGINE */
#app-container { 
  display: flex; 
  height: 100vh; 
  width: 100vw;
}

/* 3. THE SIDEBAR (Desktop) */
#sidebar { 
  width: 320px; 
  min-width: 320px;
  background: var(--sidebar-bg); 
  border-right: 1px solid #2a2a2a; 
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-content { 
  padding: 24px; 
  overflow-y: auto; 
}

#sidebar h2 {
  font-size: 1.4rem;
  margin-top: 0;
  margin-bottom: 24px;
  color: var(--accent);
  letter-spacing: -0.5px;
}

/* 4. INPUT GROUPS & FORM FIELDS */
.input-group { 
  margin-bottom: 20px; 
}

label { 
  display: block;
  font-size: 0.7rem; 
  font-weight: 700; 
  color: var(--text-dim); 
  text-transform: uppercase; 
  margin-bottom: 8px; 
  letter-spacing: 0.5px;
}

input { 
  width: 100%; 
  padding: 12px; 
  background: var(--input-bg); 
  border: 1px solid #333; 
  color: white; 
  border-radius: 8px; 
  box-sizing: border-box; 
  font-size: 0.9rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
}

/* Unified Blacklist Input */
.flex-row { display: flex; gap: 8px; }
.add-btn { 
  background: #333; 
  color: white; 
  border: none; 
  padding: 0 16px; 
  border-radius: 8px; 
  cursor: pointer; 
  font-weight: bold;
}
.add-btn:hover { background: #444; }

/* 5. BLACKLIST TAGS (Sidebar) */
.mini-tag-list { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 6px; 
  margin-top: 12px; 
}

.mini-tag { 
  font-size: 0.7rem; 
  background: rgba(255, 68, 68, 0.1); 
  padding: 5px 10px; 
  border-radius: 6px; 
  border: 1px solid rgba(255, 68, 68, 0.3); 
  cursor: pointer; 
  color: var(--danger); 
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-tag:hover { 
  background: var(--danger); 
  color: white; 
}

/* 6. MAIN FEED & CARDS */
#feed { 
  flex-grow: 1; 
  padding: 30px; 
  overflow-y: auto; 
  background: var(--bg);
}

.feed-header {
  margin-bottom: 24px;
}

#results-count { 
  font-size: 0.9rem; 
  color: var(--text-dim); 
}

.rp-card { 
  background: var(--card-bg); 
  border-radius: 12px; 
  padding: 24px; 
  margin-bottom: 20px; 
  border: 1px solid #2a2a2a;
  transition: transform 0.2s ease;
}

.card-header { 
  display: flex; 
  justify-content: space-between; 
  font-size: 0.7rem; 
  margin-bottom: 12px; 
  color: var(--text-dim); 
  font-weight: 800;
  letter-spacing: 0.5px;
}

.card-author { color: var(--accent); cursor: pointer; }

/* 7. ACTION BUTTONS */
.main-action { 
  width: 100%; 
  padding: 14px; 
  background: var(--accent); 
  color: white; 
  border: none; 
  border-radius: 8px; 
  font-weight: bold; 
  cursor: pointer; 
  font-size: 1rem;
  margin-top: 10px;
}

.status { font-size: 0.8rem; margin-top: 15px; color: var(--text-dim); }
.status.error { color: var(--danger); }

/* 8. MOBILE RESPONSIVENESS */
@media (max-width: 768px) {
  #mobile-header { 
    display: flex; height: 60px; background: var(--sidebar-bg); width: 100%; 
    position: fixed; top: 0; z-index: 1100; align-items: center; 
    justify-content: space-between; padding: 0 20px; box-sizing: border-box; 
    border-bottom: 1px solid #2a2a2a;
  }
  
  #sidebar { 
    position: fixed; 
    left: 0; 
    transform: translateX(-100%); 
    height: 100%; 
    box-shadow: 10px 0 30px rgba(0,0,0,0.5);
  }
  
  #app-container.sidebar-open #sidebar { transform: translateX(0); }
  #feed { padding: 80px 15px 20px 15px; }
  .desktop-only { display: none; }
}

/* Animations */
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-10px); }
</style>
