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
:root { 
  --bg: #0f0f0f; --card: #1a1a1a; --accent: #3d8bff; 
  --text: #ffffff; --text-dim: #a0a0a0; --danger: #ff4d4d; 
}
body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; overflow: hidden; }

#app-container { display: flex; height: 100vh; position: relative; }

/* Mobile Header */
#mobile-header { 
  display: none; height: 60px; background: #1a1a1a; width: 100%; position: fixed; top: 0; z-index: 100;
  align-items: center; justify-content: space-between; padding: 0 15px; box-sizing: border-box; border-bottom: 1px solid #333;
}
#mobile-header h1 { font-size: 1.2rem; margin: 0; }
.menu-toggle, .refresh-mini { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }

/* Sidebar */
#sidebar { 
  width: 320px; background: #151515; border-right: 1px solid #333; height: 100vh; overflow-y: auto; 
  transition: transform 0.3s ease; z-index: 200;
}
.sidebar-content { padding: 25px; }

/* Main Feed */
#feed { flex-grow: 1; height: 100vh; overflow-y: auto; background: #121212; padding: 20px; padding-top: 20px; box-sizing: border-box; }

/* Cards */
.rp-card { 
  background: var(--card); border-radius: 12px; padding: 18px; margin-bottom: 15px; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 1px solid #2a2a2a; transition: transform 0.2s;
}
.card-header { display: flex; justify-content: space-between; font-size: 0.7rem; margin-bottom: 10px; color: var(--text-dim); text-transform: uppercase; font-weight: bold; }
.card-author { color: var(--accent); cursor: pointer; }
.rp-card h3 { margin: 0 0 12px 0; font-size: 1.1rem; line-height: 1.4; }
.rp-card h3 a { color: white; text-decoration: none; }

/* AI Content */
.ai-box { background: #222; border-radius: 8px; padding: 12px; border-left: 3px solid var(--accent); }
.ai-summary { font-size: 0.9rem; color: #ddd; margin: 0 0 10px 0; line-height: 1.5; }

/* Tags */
.tag-container { display: flex; gap: 6px; flex-wrap: wrap; }
.tag { padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer; background: #333; }
.tag.fandom.original { background: #444; }
.tag.fandom.fandom-canon { background: var(--danger); }
.tag.fandom.is-celebrity { background: #8e24aa; }

/* Buttons */
.main-action { width: 100%; padding: 14px; background: var(--accent); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
.scan-btn { background: #444; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 0.8rem; }

/* Responsive Mobile Layout */
@media (max-width: 768px) {
  #mobile-header { display: flex; }
  #sidebar { position: fixed; left: 0; transform: translateX(-100%); width: 280px; }
  #app-container.sidebar-open #sidebar { transform: translateX(0); }
  #feed { padding-top: 80px; }
  .desktop-only { display: none; }
}

/* Animations */
.list-enter-active, .list-leave-active { transition: all 0.4s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(30px); }
</style>
