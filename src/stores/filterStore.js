import { defineStore } from 'pinia';

export const useFilterStore = defineStore('filterStore', {
  state: () => ({
    blockedUsers: [],
    blockedTags: [],
    tagBehavior: {},
  }),

  getters: {
    isUserBlocked: (state) => (userId) => {
      return state.blockedUsers.includes(userId);
    },
    isTagBlocked: (state) => (tagName) => {
      return state.tagBehavior[tagName] === 'blocked';
    },
  },

  actions: {
    addBlockedUser(userId) {
      if (!this.blockedUsers.includes(userId)) {
        this.blockedUsers.push(userId);
      }
    },
    removeBlockedUser(userId) {
      this.blockedUsers = this.blockedUsers.filter(user => user !== userId);
    },
    addBlockedTag(tagName) {
      if (!this.blockedTags.includes(tagName)) {
        this.blockedTags.push(tagName);
      }
    },
    removeBlockedTag(tagName) {
      this.blockedTags = this.blockedTags.filter(tag => tag !== tagName);
    },
    setTagBehavior(tagName) {
      const currentBehavior = this.tagBehavior[tagName];
      const behaviors = ['default', 'blocked', 'allowed'];
      const nextBehavior = behaviors[(behaviors.indexOf(currentBehavior) + 1) % behaviors.length];
      this.tagBehavior[tagName] = nextBehavior;
    },
    saveFilters() {
      localStorage.setItem('blockedUsers', JSON.stringify(this.blockedUsers));
      localStorage.setItem('blockedTags', JSON.stringify(this.blockedTags));
      localStorage.setItem('tagBehavior', JSON.stringify(this.tagBehavior));
    },
    loadFilters() {
      this.blockedUsers = JSON.parse(localStorage.getItem('blockedUsers')) || [];
      this.blockedTags = JSON.parse(localStorage.getItem('blockedTags')) || [];
      this.tagBehavior = JSON.parse(localStorage.getItem('tagBehavior')) || {};
    },
  },
});