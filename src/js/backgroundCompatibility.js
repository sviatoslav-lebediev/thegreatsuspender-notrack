/*
 * Background page compatibility utility for Manifest V3
 * Provides safe access to background page globals
 */

function initializeBackgroundPageGlobals(global) {
  try {
    const backgroundPage = chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage();
    
    if (backgroundPage && backgroundPage.tgs) {
      // Manifest V2 - background page available
      backgroundPage.tgs.setViewGlobals(global);
      return true;
    } else {
      // Manifest V3 - service worker mode
      console.log('Background page not available - running in service worker mode');
      
      // Create minimal stubs for common functionality
      global.gsStorage = {
        getOption: function(key) {
          const settings = JSON.parse(localStorage.getItem('gsSettings') || '{}');
          const defaults = {
            'gsTimeToSuspend': '60',
            'gsTheme': 'light',
            'gsWhitelist': '',
            'gsAddContextMenu': true,
            'gsSyncSettings': true,
            'gsNoNag': false,
            'gsTheme': 'light'
          };
          return settings[key] !== undefined ? settings[key] : defaults[key];
        },
        setOption: function(key, value) {
          const settings = JSON.parse(localStorage.getItem('gsSettings') || '{}');
          settings[key] = value;
          localStorage.setItem('gsSettings', JSON.stringify(settings));
        },
        
        // Add storage constants
        THEME: 'gsTheme'
      };
      
      global.gsUtils = {
        STATUS_NORMAL: 'normal',
        STATUS_ACTIVE: 'active',
        STATUS_SUSPENDED: 'suspended',
        STATUS_NEVER: 'never',
        STATUS_SPECIAL: 'special',
        STATUS_WHITELISTED: 'whitelisted',
        STATUS_AUDIBLE: 'audible',
        STATUS_FORMINPUT: 'formInput',
        STATUS_PINNED: 'pinned',
        STATUS_TEMPWHITELIST: 'tempWhitelist',
        STATUS_NOCONNECTIVITY: 'noConnectivity',
        STATUS_CHARGING: 'charging',
        STATUS_BLOCKED_FILE: 'blockedFile',
        STATUS_LOADING: 'loading',
        STATUS_UNKNOWN: 'unknown',
        
        documentReadyAndLocalisedAsPromsied: function(doc) {
          return new Promise(function(resolve) {
            if (doc.readyState !== 'loading') {
              resolve();
            } else {
              doc.addEventListener('DOMContentLoaded', function() {
                resolve();
              });
            }
          }).then(function() {
            // Localize HTML
            var replaceTagFunc = function(match, p1) {
              return p1 ? chrome.i18n.getMessage(p1) : '';
            };
            for (let el of doc.getElementsByTagName('*')) {
              if (el.hasAttribute('data-i18n')) {
                el.innerHTML = el
                  .getAttribute('data-i18n')
                  .replace(/__MSG_(\w+)__/g, replaceTagFunc)
                  .replace(/\n/g, '<br />');
              }
            }
            if (doc.body && doc.body.hidden) {
              doc.body.hidden = false;
            }
          });
        },
        
        getSuspendedTitle: function(url) {
          const match = url.match(/ttl=([^&]+)/);
          return match ? decodeURIComponent(match[1]) : '';
        },
        
        getOriginalUrl: function(url) {
          const match = url.match(/uri=([^&]+)/);
          return match ? decodeURIComponent(match[1]) : url;
        },
        
        getSuspendedScrollPosition: function(url) {
          const match = url.match(/pos=([^&]+)/);
          return match ? decodeURIComponent(match[1]) : '0';
        }
      };
      
      global.gsSession = {
        isInitialising: function() {
          return false; // Simplified for stub
        }
      };
      
      global.tgs = {
        getActiveTabStatus: function(callback) {
          // Send message to service worker to get tab status
          chrome.runtime.sendMessage({action: 'getActiveTabStatus'}, function(response) {
            if (chrome.runtime.lastError) {
              console.log('Runtime error:', chrome.runtime.lastError);
              callback('unknown');
            } else {
              callback(response && response.status ? response.status : 'unknown');
            }
          });
        }
      };
      
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize background page globals:', error);
    return false;
  }
}
