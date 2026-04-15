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

              <div v-else-if="post.isStub" class="
