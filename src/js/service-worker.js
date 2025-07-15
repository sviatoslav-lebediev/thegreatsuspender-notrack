/* global gsStorage, gsChrome, gsIndexedDb, gsUtils, gsFavicon, gsSession, gsMessages, gsTabSuspendManager, gsTabDiscardManager, gsTabCheckManager, gsSuspendedTab, chrome, XMLHttpRequest */
/*
 * The Great Suspender - Service Worker (Manifest V3)
 * Copyright (C) 2017 Dean Oemcke
 * Available under GNU GENERAL PUBLIC LICENSE v2
 * http://github.com/aciidic/thegreatsuspender
 * ༼ つ ◕_◕ ༽つ
 */

// Import storage polyfill first to ensure localStorage is available
importScripts('storagePolyfill.js');

// Import all the background scripts in order
importScripts(
  'gsUtils.js',
  'gsChrome.js', 
  'gsStorage.js',
  'db.js',
  'gsIndexedDb.js',
  'gsMessages.js',
  'gsSession.js',
  'gsTabQueue.js',
  'gsTabCheckManager.js',
  'gsFavicon.js',
  'gsCleanScreencaps.js',
  'gsTabSuspendManager.js',
  'gsTabDiscardManager.js',
  'gsSuspendedTab.js',
  'background.js'
);

// Service worker lifecycle events
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Handle service worker startup
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'KEEP_ALIVE') {
    // Handle keep alive messages to prevent service worker from being terminated
    event.ports[0].postMessage({type: 'KEEP_ALIVE_RESPONSE'});
  }
});

// Initialize using the same sequence as background.js
setTimeout(() => {
  Promise.resolve()
    .then(tgs.backgroundScriptsReadyAsPromised) // wait until all gsLibs have loaded
    .then(gsStorage.initSettingsAsPromised) // ensure settings have been loaded and synced
    .then(gsStorage.checkManagedStorageAndOverride) // enforce managed settings
    .then(() => {
      // initialise other gsLibs
      return Promise.all([
        gsFavicon.initAsPromised(),
        gsTabSuspendManager.initAsPromised(),
        gsTabCheckManager.initAsPromised(),
        gsTabDiscardManager.initAsPromised(),
        gsSession.initAsPromised(),
        gsCleanScreencaps.initAsPromised()
      ]);
    })
    .catch(error => {
      gsUtils.error('background init error: ', error);
    })
    .then(gsSession.runStartupChecks) // performs crash check (and maybe recovery) and tab responsiveness checks
    .catch(error => {
      gsUtils.error('background startup checks error: ', error);
    })
    .then(tgs.initAsPromised) // adds handle(Un)SuspendedTabChanged listeners!
    .catch(error => {
      gsUtils.error('background init error: ', error);
    })
    .finally(() => {
      tgs.startTimers();
      console.log('Service worker initialized successfully');
    });
}, 100);
