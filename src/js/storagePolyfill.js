/*
 * localStorage polyfill for service workers
 * Maps localStorage calls to chrome.storage.local
 */

// Ensure window object exists in service worker context
if (typeof window === 'undefined') {
  self.window = self;
}

// Create a polyfill for localStorage in service workers
if (typeof localStorage === 'undefined') {
  const localStoragePolyfill = {
    _cache: {},
    _initialized: false,
    
    async _init() {
      if (!this._initialized) {
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(null, resolve);
          });
          this._cache = result || {};
          this._initialized = true;
        } catch (error) {
          console.error('Failed to initialize localStorage polyfill:', error);
          this._cache = {};
          this._initialized = true;
        }
      }
    },

    getItem(key) {
      return this._cache[key] || null;
    },

    setItem(key, value) {
      this._cache[key] = value;
      // Async save to chrome.storage.local
      chrome.storage.local.set({ [key]: value }).catch(error => {
        console.error('Failed to save to chrome.storage.local:', error);
      });
    },

    removeItem(key) {
      delete this._cache[key];
      chrome.storage.local.remove(key).catch(error => {
        console.error('Failed to remove from chrome.storage.local:', error);
      });
    },

    clear() {
      this._cache = {};
      chrome.storage.local.clear().catch(error => {
        console.error('Failed to clear chrome.storage.local:', error);
      });
    }
  };

  // Set up localStorage in both contexts
  window.localStorage = localStoragePolyfill;
  self.localStorage = localStoragePolyfill;

  // Initialize the cache
  localStoragePolyfill._init();
}
