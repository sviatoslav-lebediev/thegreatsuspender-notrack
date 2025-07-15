/*global chrome, gsStorage, gsChrome, gsUtils */
(function(global) {
  try {
    // In Manifest V3, we can't access service worker globals directly
    // Instead, we need to use messaging to get what we need
    const backgroundPage = chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage();
    if (backgroundPage && backgroundPage.tgs) {
      backgroundPage.tgs.setViewGlobals(global);
    } else {
      // For Manifest V3, import the globals differently
      // We'll need to access them through chrome.runtime messaging
      console.log('Manifest V3 mode - using alternative global access');
      
      // Create basic stubs that will be populated via messaging
      global.gsStorage = {
        getOption: function(key) {
          // This will be synchronous access to our localStorage polyfill
          const settings = JSON.parse(localStorage.getItem('gsSettings') || '{}');
          
          // Provide default values if not set
          const defaults = {
            'screenCapture': '0',
            'screenCaptureForce': false,
            'cleanScreencaps': false,
            'suspendInPlaceOfDiscard': false,
            'onlineCheck': false,
            'batteryCheck': false,
            'gsUnsuspendOnFocus': false,
            'discardAfterSuspend': false,
            'gsDontSuspendPinned': true,
            'gsDontSuspendForms': true,
            'gsDontSuspendAudio': true,
            'gsDontSuspendActiveTabs': true,
            'gsIgnoreCache': false,
            'gsAddContextMenu': true,
            'gsSyncSettings': true,
            'gsNoNag': false,
            'gsTimeToSuspend': '60',
            'gsTheme': 'light',
            'gsWhitelist': ''
          };
          
          return settings[key] !== undefined ? settings[key] : defaults[key];
        },
        setOption: function(key, value) {
          const settings = JSON.parse(localStorage.getItem('gsSettings') || '{}');
          settings[key] = value;
          localStorage.setItem('gsSettings', JSON.stringify(settings));
        },
        setOptionAndSync: function(key, value) {
          this.setOption(key, value);
          // In a full implementation, this would sync to chrome.storage.sync
          chrome.runtime.sendMessage({
            action: 'syncSettings',
            key: key,
            value: value
          });
        },
        isOptionManaged: function(key) {
          return false; // Simplified for now
        },
        // Add other storage constants
        SCREEN_CAPTURE: 'screenCapture',
        SCREEN_CAPTURE_FORCE: 'screenCaptureForce',
        ENABLE_CLEAN_SCREENCAPS: 'cleanScreencaps',
        SUSPEND_IN_PLACE_OF_DISCARD: 'suspendInPlaceOfDiscard',
        IGNORE_WHEN_OFFLINE: 'onlineCheck',
        IGNORE_WHEN_CHARGING: 'batteryCheck',
        UNSUSPEND_ON_FOCUS: 'gsUnsuspendOnFocus',
        DISCARD_AFTER_SUSPEND: 'discardAfterSuspend',
        IGNORE_PINNED: 'gsDontSuspendPinned',
        IGNORE_FORMS: 'gsDontSuspendForms',
        IGNORE_AUDIO: 'gsDontSuspendAudio',
        IGNORE_ACTIVE_TABS: 'gsDontSuspendActiveTabs',
        IGNORE_CACHE: 'gsIgnoreCache',
        ADD_CONTEXT: 'gsAddContextMenu',
        SYNC_SETTINGS: 'gsSyncSettings',
        NO_NAG: 'gsNoNag',
        SUSPEND_TIME: 'gsTimeToSuspend',
        THEME: 'gsTheme',
        WHITELIST: 'gsWhitelist'
      };
      
      global.gsUtils = {
        cleanupWhitelist: function(whitelist) {
          var whitelistItems = whitelist ? whitelist.split(/[\s\n]+/).sort() : '';
          // Remove duplicates and empty items
          var cleanItems = [];
          for (var i = 0; i < whitelistItems.length; i++) {
            if (whitelistItems[i] && whitelistItems[i] !== '' && cleanItems.indexOf(whitelistItems[i]) === -1) {
              cleanItems.push(whitelistItems[i]);
            }
          }
          return cleanItems.length ? cleanItems.join('\n') : '';
        },
        performPostSaveUpdates: function(keys, oldValues, newValues) {
          // Send message to service worker to handle updates
          chrome.runtime.sendMessage({
            action: 'postSaveUpdates',
            keys: keys,
            oldValues: oldValues,
            newValues: newValues
          });
        },
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
              if (el.hasAttribute('data-i18n-tooltip')) {
                el.setAttribute(
                  'data-i18n-tooltip',
                  el
                    .getAttribute('data-i18n-tooltip')
                    .replace(/__MSG_(\w+)__/g, replaceTagFunc)
                );
              }
            }
            if (doc.body && doc.body.hidden) {
              doc.body.hidden = false;
            }
          });
        },
        debounce: function(func, wait) {
          let timeout;
          return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
              func.apply(context, args);
            }, wait);
          };
        },
        isSuspendedTab: function(tab) {
          return tab.url && tab.url.indexOf('suspended.html') > 0;
        },
        isSuspendedUrl: function(url) {
          return url && url.indexOf('suspended.html') > 0;
        },
        getOriginalUrl: function(url) {
          // Simple extraction from suspended URL
          const match = url.match(/uri=([^&]+)/);
          return match ? decodeURIComponent(match[1]) : url;
        },
        checkWhiteList: function(url) {
          const whitelist = global.gsStorage.getOption(global.gsStorage.WHITELIST) || '';
          const whitelistItems = whitelist.split(/[\s\n]+/);
          return whitelistItems.some(item => {
            if (!item) return false;
            try {
              return new RegExp(item).test(url);
            } catch (e) {
              return url.indexOf(item) >= 0;
            }
          });
        }
      };
      
      global.gsChrome = {
        tabsQuery: function(queryInfo) {
          return new Promise(function(resolve) {
            chrome.tabs.query(queryInfo || {}, resolve);
          });
        }
      };
    }
  } catch (e) {
    console.error('Failed to initialize options page:', e);
    window.setTimeout(() => window.location.reload(), 1000);
    return;
  }

  var elementPrefMap = {
    preview: gsStorage.SCREEN_CAPTURE,
    forceScreenCapture: gsStorage.SCREEN_CAPTURE_FORCE,
    cleanScreenCaptures: gsStorage.ENABLE_CLEAN_SCREENCAPS,
    suspendInPlaceOfDiscard: gsStorage.SUSPEND_IN_PLACE_OF_DISCARD,
    onlineCheck: gsStorage.IGNORE_WHEN_OFFLINE,
    batteryCheck: gsStorage.IGNORE_WHEN_CHARGING,
    unsuspendOnFocus: gsStorage.UNSUSPEND_ON_FOCUS,
    discardAfterSuspend: gsStorage.DISCARD_AFTER_SUSPEND,
    dontSuspendPinned: gsStorage.IGNORE_PINNED,
    dontSuspendForms: gsStorage.IGNORE_FORMS,
    dontSuspendAudio: gsStorage.IGNORE_AUDIO,
    dontSuspendActiveTabs: gsStorage.IGNORE_ACTIVE_TABS,
    ignoreCache: gsStorage.IGNORE_CACHE,
    addContextMenu: gsStorage.ADD_CONTEXT,
    syncSettings: gsStorage.SYNC_SETTINGS,
    noNag: gsStorage.NO_NAG,
    timeToSuspend: gsStorage.SUSPEND_TIME,
    theme: gsStorage.THEME,
    whitelist: gsStorage.WHITELIST,
  };

  function selectComboBox(element, key) {
    var i, child;

    for (i = 0; i < element.children.length; i += 1) {
      child = element.children[i];
      if (child.value === key) {
        child.selected = 'true';
        break;
      }
    }
  }

  // Used to prevent options set in managed storage from being changed
  function blockOption(element) {
    element.setAttribute('disabled', '');
  }

  //populate settings from synced storage
  function initSettings() {
    var optionEls = document.getElementsByClassName('option'),
      pref,
      element,
      i;

    for (i = 0; i < optionEls.length; i++) {
      element = optionEls[i];
      pref = elementPrefMap[element.id];
      populateOption(element, gsStorage.getOption(pref));
      if (gsStorage.isOptionManaged(pref)) {
        blockOption(element);
      }
    }

    setForceScreenCaptureVisibility(
      gsStorage.getOption(gsStorage.SCREEN_CAPTURE) !== '0'
    );
    setCleanScreenCaptureVisibility(
      gsStorage.getOption(gsStorage.SCREEN_CAPTURE) !== '0'
    );
    setAutoSuspendOptionsVisibility(
      parseFloat(gsStorage.getOption(gsStorage.SUSPEND_TIME)) > 0
    );
    setSyncNoteVisibility(!gsStorage.getOption(gsStorage.SYNC_SETTINGS));

    let searchParams = new URL(location.href).searchParams;
    if (searchParams.has('firstTime') && !gsStorage.getOption(gsStorage.NO_NAG)) {
      document
        .querySelector('.welcome-message')
        .classList.remove('reallyHidden');
      document.querySelector('#options-heading').classList.add('reallyHidden');
    }
  }

  function populateOption(element, value) {
    if (
      element.tagName === 'INPUT' &&
      element.hasAttribute('type') &&
      element.getAttribute('type') === 'checkbox'
    ) {
      element.checked = value;
    } else if (element.tagName === 'SELECT') {
      selectComboBox(element, value);
    } else if (element.tagName === 'TEXTAREA') {
      element.value = value;
    }
  }

  function getOptionValue(element) {
    if (
      element.tagName === 'INPUT' &&
      element.hasAttribute('type') &&
      element.getAttribute('type') === 'checkbox'
    ) {
      return element.checked;
    }
    if (element.tagName === 'SELECT') {
      return element.children[element.selectedIndex].value;
    }
    if (element.tagName === 'TEXTAREA') {
      return element.value;
    }
  }

  function setForceScreenCaptureVisibility(visible) {
    if (visible) {
      document.getElementById('forceScreenCaptureContainer').style.display =
        'block';
    } else {
      document.getElementById('forceScreenCaptureContainer').style.display =
        'none';
    }
  }

  function setCleanScreenCaptureVisibility(visible) {
    if (visible) {
      document.getElementById('cleanScreenCapturesContainer').style.display = 'block';
    } else {
      document.getElementById('cleanScreenCapturesContainer').style.display = 'none';
    }
  }

  function setSyncNoteVisibility(visible) {
    if (visible) {
      document.getElementById('syncNote').style.display = 'block';
    } else {
      document.getElementById('syncNote').style.display = 'none';
    }
  }

  function setAutoSuspendOptionsVisibility(visible) {
    Array.prototype.forEach.call(
      document.getElementsByClassName('autoSuspendOption'),
      function(el) {
        if (visible) {
          el.style.display = 'block';
        } else {
          el.style.display = 'none';
        }
      }
    );
  }

  function handleChange(element) {
    return function() {
      let prefKey = elementPrefMap[element.id],
        interval;
      //add specific screen element listeners
      switch (prefKey) {
        case gsStorage.SCREEN_CAPTURE:
          setForceScreenCaptureVisibility(getOptionValue(element) !== '0');
          setCleanScreenCaptureVisibility(getOptionValue(element) !== '0');
          break;
        case gsStorage.SUSPEND_TIME:
          interval = getOptionValue(element);
          setAutoSuspendOptionsVisibility(interval > 0);
          break;
        case gsStorage.SYNC_SETTINGS:
          if (getOptionValue(element)) {
            setSyncNoteVisibility(false);
          }
          break;
        case gsStorage.ENABLE_CLEAN_SCREENCAPS:
          if (getOptionValue(element)) {
            chrome.runtime.sendMessage({ action: 'loadCleanScreencaptureBlocklist' })
          }
          break;
      }

      var [oldValue, newValue] = saveChange(element);
      if (oldValue !== newValue) {
        gsUtils.performPostSaveUpdates(
          [prefKey],
          { [prefKey]: oldValue },
          { [prefKey]: newValue }
        );
      }
    };
  }

  function saveChange(element) {
    var pref = elementPrefMap[element.id],
      oldValue = gsStorage.getOption(pref),
      newValue = getOptionValue(element);

    //clean up whitelist before saving
    if (pref === gsStorage.WHITELIST) {
      newValue = gsUtils.cleanupWhitelist(newValue);
    }

    //save option
    if (oldValue !== newValue) {
      gsStorage.setOptionAndSync(elementPrefMap[element.id], newValue);
    }

    return [oldValue, newValue];
  }

  gsUtils.documentReadyAndLocalisedAsPromsied(document).then(function() {
    initSettings();

    var optionEls = document.getElementsByClassName('option'),
      element,
      i;

    //add change listeners for all 'option' elements
    for (i = 0; i < optionEls.length; i++) {
      element = optionEls[i];
      if (element.tagName === 'TEXTAREA') {
        element.addEventListener(
          'input',
          gsUtils.debounce(handleChange(element), 200),
          false
        );
      } else {
        element.onchange = handleChange(element);
      }
    }

    document.getElementById('testWhitelistBtn').onclick = async e => {
      e.preventDefault();
      const tabs = await gsChrome.tabsQuery();
      const tabUrls = tabs
        .map(
          tab =>
            gsUtils.isSuspendedTab(tab)
              ? gsUtils.getOriginalUrl(tab.url)
              : tab.url
        )
        .filter(
          url => !gsUtils.isSuspendedUrl(url) && gsUtils.checkWhiteList(url)
        )
        .map(url => (url.length > 55 ? url.substr(0, 52) + '...' : url));
      if (tabUrls.length === 0) {
        alert(chrome.i18n.getMessage('js_options_whitelist_no_matches'));
        return;
      }
      const firstUrls = tabUrls.splice(0, 22);
      let alertString = `${chrome.i18n.getMessage(
        'js_options_whitelist_matches_heading'
      )}\n${firstUrls.join('\n')}`;

      if (tabUrls.length > 0) {
        alertString += `\n${chrome.i18n.getMessage(
          'js_options_whitelist_matches_overflow_prefix'
        )} ${tabUrls.length} ${chrome.i18n.getMessage(
          'js_options_whitelist_matches_overflow_suffix'
        )}`;
      }
      alert(alertString);
    };

    //hide incompatible sidebar items if in incognito mode
    if (chrome.extension.inIncognitoContext) {
      Array.prototype.forEach.call(
        document.getElementsByClassName('noIncognito'),
        function(el) {
          el.style.display = 'none';
        }
      );
      window.alert(chrome.i18n.getMessage('js_options_incognito_warning'));
    }
  });

  global.exports = {
    initSettings,
  };
})(this);
