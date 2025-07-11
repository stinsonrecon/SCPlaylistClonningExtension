/**
 * Content Script for SoundCloud Playlist Clone Extension (FIXED VERSION)
 * Injected vào SoundCloud pages để intercept API calls
 */

(function () {
  'use strict';

  console.log('[CONTENT] Content script injected into SoundCloud');
  console.log('[CONTENT] Current URL:', window.location.href);
  console.log('[CONTENT] User agent:', navigator.userAgent);
  console.log('[CONTENT] Page ready state:', document.readyState);

  // Track nếu đã capture credentials
  let credentialsCaptured = false;

  // Intercept fetch requests để capture API credentials
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const url = args[0];

    // Check if this is SoundCloud API request
    if (typeof url === 'string' && url.includes('api-v2.soundcloud.com')) {
      console.log('[CONTENT] SoundCloud API call detected:', url);
      extractAndStoreCredentials(url);
    }

    // Call original fetch
    return originalFetch.apply(this, args);
  };

  // Also intercept XMLHttpRequest cho older API calls
  const originalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;

    xhr.open = function (method, url, ...args) {
      if (typeof url === 'string' && url.includes('api-v2.soundcloud.com')) {
        console.log('[CONTENT] XHR SoundCloud API call detected:', url);
        extractAndStoreCredentials(url);
      }
      return originalOpen.apply(this, [method, url, ...args]);
    };

    return xhr;
  };

  // Additional: Monitor network requests via Performance API
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name && entry.name.includes('api-v2.soundcloud.com')) {
        console.log('[CONTENT] Performance API detected SoundCloud request:', entry.name);
        extractAndStoreCredentials(entry.name);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['resource'] });
    console.log('[CONTENT] Performance observer started');
  } catch (e) {
    console.warn('[CONTENT] Performance observer not supported:', e.message);
  }

  /**
   * Extract credentials từ API URL và store
   */
  function extractAndStoreCredentials(url) {
    try {
      console.log('[CONTENT] Attempting to extract credentials from:', url);

      const urlObj = new URL(url);
      const credentials = {
        client_id: urlObj.searchParams.get('client_id'),
        app_version: urlObj.searchParams.get('app_version'),
        app_locale: urlObj.searchParams.get('app_locale') || 'en'
      };

      console.log('[CONTENT] Extracted parameters:', {
        has_client_id: !!credentials.client_id,
        client_id_length: credentials.client_id ? credentials.client_id.length : 0,
        app_version: credentials.app_version,
        app_locale: credentials.app_locale
      });

      // Validate credentials format
      if (credentials.client_id && credentials.client_id.length > 10 &&
        credentials.app_version && !credentialsCaptured) {

        console.log('[CONTENT] Valid credentials extracted:', {
          client_id: credentials.client_id.substring(0, 10) + '...',
          app_version: credentials.app_version,
          app_locale: credentials.app_locale
        });

        // Send to background script
        chrome.runtime.sendMessage({
          action: 'storeCredentials',
          credentials: credentials
        }).then(response => {
          if (response && response.success) {
            credentialsCaptured = true;
            console.log('[CONTENT] Credentials stored successfully');
            showCredentialsNotification();
          } else {
            console.error('[CONTENT] Failed to store credentials:', response);
          }
        }).catch(error => {
          console.error('[CONTENT] Error storing credentials:', error);
        });

      } else {
        console.log('[CONTENT] Invalid or incomplete credentials:', {
          client_id_valid: credentials.client_id && credentials.client_id.length > 10,
          app_version_valid: !!credentials.app_version,
          already_captured: credentialsCaptured
        });
      }

    } catch (error) {
      console.error('[CONTENT] Error extracting credentials:', error);
    }
  }

  /**
   * Show subtle notification khi credentials được capture
   */
  function showCredentialsNotification() {
    // Remove any existing notification first
    const existing = document.getElementById('sc-clone-notification');
    if (existing) {
      existing.remove();
    }

    // Tạo notification element
    const notification = document.createElement('div');
    notification.id = 'sc-clone-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff5500;
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        font-family: Interstate, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 280px;
        animation: slideIn 0.3s ease-out;
      ">
        ✓ SoundCloud Playlist Clone Ready
        <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">
          API credentials captured successfully
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(notification);
    console.log('[CONTENT] Notification displayed');

    // Auto remove after 4 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }
    }, 4000);
  }

  /**
   * Get current page playlist ID nếu đang ở playlist page
   */
  function getCurrentPlaylistId() {
    const url = window.location.href;
    console.log('[CONTENT] Checking URL for playlist:', url);

    // Check if current page is playlist
    const playlistMatch = url.match(/soundcloud\.com\/([^\/]+)\/sets\/([^\/\?]+)/);
    if (playlistMatch) {
      const username = playlistMatch[1];
      const playlistSlug = playlistMatch[2];

      console.log('[CONTENT] Playlist URL pattern matched:', { username, playlistSlug });

      // Try multiple methods to extract playlist ID
      const playlistId = extractPlaylistIdFromPage();
      console.log('[CONTENT] Extracted playlist ID:', playlistId);

      return playlistId;
    }

    console.log('[CONTENT] URL does not match playlist pattern');
    return null;
  }

  /**
   * Extract playlist ID từ page source hoặc embedded data
   */
  function extractPlaylistIdFromPage() {
    console.log('[CONTENT] Starting playlist ID extraction...');

    try {
      // Method 1: Try window.__sc_hydration (SoundCloud's hydration data)
      if (window.__sc_hydration && Array.isArray(window.__sc_hydration)) {
        console.log('[CONTENT] Found __sc_hydration data, checking', window.__sc_hydration.length, 'entries');
        for (let i = 0; i < window.__sc_hydration.length; i++) {
          const hydrationData = window.__sc_hydration[i];
          if (hydrationData.hydratable === 'playlist' && hydrationData.data) {
            console.log('[CONTENT] Found playlist in hydration data:', hydrationData.data.id);
            return hydrationData.data.id;
          }
        }
        console.log('[CONTENT] No playlist found in hydration data');
      } else {
        console.log('[CONTENT] No __sc_hydration data found');
      }

      // Method 2: Try to find playlist ID trong page scripts
      const scripts = document.querySelectorAll('script');
      console.log('[CONTENT] Searching through', scripts.length, 'scripts');

      for (let script of scripts) {
        if (script.textContent && script.textContent.includes('"kind":"playlist"')) {
          console.log('[CONTENT] Found playlist script');
          // Look for pattern: "id":1234567890,"kind":"playlist"
          const match = script.textContent.match(/"id":(\d+)[^}]*"kind":"playlist"/);
          if (match) {
            const playlistId = parseInt(match[1]);
            console.log('[CONTENT] Extracted playlist ID from script:', playlistId);
            return playlistId;
          }
        }
      }

      // Method 3: Try meta tags
      const metaTags = document.querySelectorAll('meta[property="twitter:player"], meta[property="og:url"]');
      console.log('[CONTENT] Checking', metaTags.length, 'meta tags');
      for (let meta of metaTags) {
        const content = meta.getAttribute('content');
        if (content && content.includes('playlists/')) {
          const match = content.match(/playlists\/(\d+)/);
          if (match) {
            const playlistId = parseInt(match[1]);
            console.log('[CONTENT] Extracted playlist ID from meta:', playlistId);
            return playlistId;
          }
        }
      }

      // Method 4: Try current URL for direct ID (fallback)
      const currentUrl = window.location.href;
      const directMatch = currentUrl.match(/playlists\/(\d+)/);
      if (directMatch) {
        const playlistId = parseInt(directMatch[1]);
        console.log('[CONTENT] Extracted playlist ID from current URL:', playlistId);
        return playlistId;
      }

      // Method 5: Wait for page to load more và retry (only once)
      if (document.readyState !== 'complete' && !getCurrentPlaylistId.retryAttempted) {
        console.log('[CONTENT] Page not fully loaded, will retry in 3 seconds...');
        getCurrentPlaylistId.retryAttempted = true;
        setTimeout(() => {
          const retryId = extractPlaylistIdFromPage();
          if (retryId) {
            console.log('[CONTENT] Retry successful:', retryId);
            // Update popup if needed
            chrome.runtime.sendMessage({
              action: 'playlistDetected',
              playlistId: retryId
            }).catch(() => { });
          }
        }, 3000);
      }

      console.log('[CONTENT] No playlist ID found with any method');
      return null;

    } catch (error) {
      console.error('[CONTENT] Error extracting playlist ID:', error);
      return null;
    }
  }

  // Expose enhanced utility functions cho popup
  window.SCCloneUtils = {
    getCurrentPlaylistId,
    isPlaylistPage: () => getCurrentPlaylistId() !== null,
    testCredentialExtraction: () => {
      console.log('[CONTENT] Testing credential extraction...');
      // Look for existing API calls in network
      const performanceEntries = performance.getEntriesByType('resource');
      let found = false;
      for (const entry of performanceEntries) {
        if (entry.name.includes('api-v2.soundcloud.com')) {
          console.log('[CONTENT] Found existing API call:', entry.name);
          extractAndStoreCredentials(entry.name);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log('[CONTENT] No existing API calls found');
      }
    },

    // Authentication utilities (content script specific - simplified)
    isUserLoggedIn: isUserLoggedInLocal,
    getCurrentUser: getCurrentUserLocal,
    extractOAuthToken: extractOAuthTokenLocal
  };

  // Listen for messages từ popup với enhanced error handling
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[CONTENT] Received message:', request.action);

    try {
      if (request.action === 'getCurrentPlaylistId') {
        const playlistId = getCurrentPlaylistId();
        console.log('[CONTENT] Responding with playlist ID:', playlistId);
        sendResponse({ playlistId });
        return true; // Keep message channel open
      }

      if (request.action === 'testExtraction') {
        window.SCCloneUtils.testCredentialExtraction();
        sendResponse({ success: true });
        return true;
      }

      if (request.action === 'checkAuthentication') {
        const authResult = checkAuthentication();
        console.log('[CONTENT] Authentication check result:', authResult);
        sendResponse(authResult);
        return true;
      }

      // Unknown action
      console.warn('[CONTENT] Unknown action:', request.action);
      sendResponse({ error: `Unknown action: ${request.action}` });

    } catch (error) {
      console.error('[CONTENT] Error handling message:', error);
      sendResponse({
        error: error.message,
        action: request.action
      });
    }

    return true; // Keep message channel open for async responses
  });

  /**
   * Check user authentication status
   */
  function checkAuthentication() {
    try {
      console.log('[CONTENT] Checking authentication status...');

      // Use local utility functions instead of SoundCloudUtils
      const isLoggedIn = isUserLoggedInLocal();
      const user = getCurrentUserLocal();
      const token = extractOAuthTokenLocal();

      console.log('[CONTENT] Auth check results:', {
        isLoggedIn,
        hasUser: !!user,
        hasToken: !!token,
        username: user?.username
      });

      return {
        isLoggedIn,
        user,
        token
      };

    } catch (error) {
      console.error('[CONTENT] Error checking authentication:', error);
      return {
        isLoggedIn: false,
        user: null,
        token: null,
        error: error.message
      };
    }
  }

  /**
   * Local authentication utilities (content script specific)
   */
  function isUserLoggedInLocal() {
    try {
      // Check for user navigation elements
      const userNavSelectors = [
        '.header__userNavUser',
        '[data-testid="user-nav"]',
        '.header__userNav .sc-button-account',
        '.header__userNavigation .userNav__user'
      ];

      for (const selector of userNavSelectors) {
        if (document.querySelector(selector)) {
          console.log('[CONTENT] Login detected via DOM element:', selector);
          return true;
        }
      }

      // Check cookies
      if (document.cookie.includes('oauth_token')) {
        console.log('[CONTENT] Login detected via oauth_token cookie');
        return true;
      }

      // Check hydration data
      if (window.__sc_hydration) {
        for (const hydration of window.__sc_hydration) {
          if (hydration.hydratable === 'user' && hydration.data?.id) {
            console.log('[CONTENT] Login detected via hydration data');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[CONTENT] Error checking login status:', error);
      return false;
    }
  }

  function getCurrentUserLocal() {
    try {
      console.log('[CONTENT] Attempting to get current user...');

      // Method 1: Try hydration data first (most reliable)
      if (window.__sc_hydration) {
        console.log('[CONTENT] Checking hydration data...');
        for (const hydration of window.__sc_hydration) {
          if (hydration.hydratable === 'user' && hydration.data) {
            console.log('[CONTENT] Found user in hydration data:', hydration.data.username);
            return {
              id: hydration.data.id,
              username: hydration.data.username,
              permalink: hydration.data.permalink,
              avatar_url: hydration.data.avatar_url
            };
          }
        }
        console.log('[CONTENT] No user found in hydration data');
      }

      // Method 2: Try to extract from DOM elements
      console.log('[CONTENT] Checking DOM elements...');

      // Try different user nav selectors
      const userNavSelectors = [
        '.header__userNavUser a',
        '.userNav__user a',
        '.sc-button-account',
        '[data-testid="user-nav"] a',
        '.header__userNav .userNav__usernameButton'
      ];

      for (const selector of userNavSelectors) {
        const userElement = document.querySelector(selector);
        if (userElement) {
          const href = userElement.getAttribute('href');
          const text = userElement.textContent?.trim();

          console.log(`[CONTENT] Found user element (${selector}):`, { href, text });

          if (href) {
            const match = href.match(/\/([^\/\?#]+)$/);
            if (match) {
              const username = match[1];
              console.log('[CONTENT] Extracted username from href:', username);
              return {
                username: username,
                permalink: username
              };
            }
          }

          if (text && text !== 'Account' && text.length > 2) {
            console.log('[CONTENT] Extracted username from text:', text);
            return {
              username: text,
              permalink: text
            };
          }
        }
      }

      // Method 3: Try to find username trong page title hoặc meta tags
      const titleMatch = document.title.match(/(.+) on SoundCloud/);
      if (titleMatch && !titleMatch[1].includes('Stream')) {
        console.log('[CONTENT] Extracted username from title:', titleMatch[1]);
        return {
          username: titleMatch[1],
          permalink: titleMatch[1]
        };
      }

      // Method 4: Try to extract from any script containing user info
      const scripts = document.querySelectorAll('script');
      for (let script of scripts) {
        if (script.textContent && script.textContent.includes('"username"')) {
          // Look for patterns like "username":"something"
          const usernameMatch = script.textContent.match(/"username"\s*:\s*"([^"]+)"/);
          if (usernameMatch && usernameMatch[1] && usernameMatch[1].length > 2) {
            console.log('[CONTENT] Found username in script:', usernameMatch[1]);
            return {
              username: usernameMatch[1],
              permalink: usernameMatch[1]
            };
          }
        }
      }

      // Method 5: If we have a valid OAuth token, try to parse user ID from it
      const token = extractOAuthTokenLocal();
      if (token) {
        // OAuth token format: "2-{app_id}-{user_id}-{signature}"
        const tokenParts = token.split('-');
        if (tokenParts.length >= 3) {
          const userId = tokenParts[2];
          console.log('[CONTENT] Extracted user ID from token:', userId);
          return {
            id: parseInt(userId),
            username: `User_${userId}`, // Fallback username
            permalink: `user_${userId}`
          };
        }
      }

      console.log('[CONTENT] Could not determine current user');
      return null;

    } catch (error) {
      console.error('[CONTENT] Error getting current user:', error);
      return null;
    }
  }

  function extractOAuthTokenLocal() {
    try {
      console.log('[CONTENT] Attempting to extract OAuth token...');

      // Check cookies first
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'oauth_token' && value) {
          const token = decodeURIComponent(value);
          console.log('[CONTENT] OAuth token found in cookies');
          return token;
        }
      }

      // Check localStorage
      try {
        const storedToken = localStorage.getItem('oauth_token');
        if (storedToken) {
          console.log('[CONTENT] OAuth token found in localStorage');
          return storedToken;
        }
      } catch (e) {
        // localStorage might not be accessible
      }

      // Check page scripts
      const scripts = document.querySelectorAll('script');
      for (let script of scripts) {
        if (script.textContent && script.textContent.includes('oauth_token')) {
          const match = script.textContent.match(/["']oauth_token["']\s*:\s*["']([^"']+)["']/);
          if (match) {
            console.log('[CONTENT] OAuth token found in page script');
            return match[1];
          }
        }
      }

      // Check hydration data
      if (window.__sc_hydration) {
        for (const hydration of window.__sc_hydration) {
          if (hydration.hydratable === 'oauth' && hydration.data?.token) {
            console.log('[CONTENT] OAuth token found in hydration data');
            return hydration.data.token;
          }
        }
      }

      console.log('[CONTENT] No OAuth token found');
      return null;

    } catch (error) {
      console.error('[CONTENT] Error extracting OAuth token:', error);
      return null;
    }
  }

  // Manual trigger for testing
  window.testExtension = function () {
    console.log('[CONTENT] === MANUAL TEST TRIGGERED ===');
    console.log('[CONTENT] Current URL:', window.location.href);
    console.log('[CONTENT] Page ready state:', document.readyState);
    console.log('[CONTENT] Is playlist?', getCurrentPlaylistId() !== null);
    console.log('[CONTENT] Playlist ID:', getCurrentPlaylistId());

    // Check for hydration data
    console.log('[CONTENT] Hydration data available?', !!window.__sc_hydration);
    if (window.__sc_hydration) {
      console.log('[CONTENT] Hydration entries:', window.__sc_hydration.length);
    }

    // Try to extract credentials from any existing network requests
    console.log('[CONTENT] Checking existing network requests...');
    const performanceEntries = performance.getEntriesByType('resource');
    let apiCallsFound = 0;
    for (const entry of performanceEntries) {
      if (entry.name.includes('api-v2.soundcloud.com')) {
        apiCallsFound++;
        console.log('[CONTENT] Found existing API call:', entry.name);
        extractAndStoreCredentials(entry.name);
      }
    }
    console.log('[CONTENT] Total API calls found:', apiCallsFound);

    // Test credential capture status
    console.log('[CONTENT] Credentials captured?', credentialsCaptured);

    console.log('[CONTENT] === TEST COMPLETE ===');
  };

  // Auto-run on page load và signal readiness
  if (document.readyState === 'complete') {
    console.log('[CONTENT] Page already loaded, running initial detection');
    setTimeout(() => {
      window.testExtension();
      signalContentScriptReady();
    }, 1000);
  } else {
    window.addEventListener('load', () => {
      console.log('[CONTENT] Page loaded, running initial detection');
      setTimeout(() => {
        window.testExtension();
        signalContentScriptReady();
      }, 1000);
    });
  }

  /**
   * Signal to background script that content script is ready
   */
  function signalContentScriptReady() {
    try {
      chrome.runtime.sendMessage({
        action: 'contentScriptReady',
        url: window.location.href,
        timestamp: Date.now()
      }).catch(() => {
        // Background script might not be ready, ignore
      });
      console.log('[CONTENT] Ready signal sent');
    } catch (error) {
      console.log('[CONTENT] Could not send ready signal:', error.message);
    }
  }

  console.log('[CONTENT] Test function available: window.testExtension()');
  console.log('[CONTENT] Utils available: window.SCCloneUtils');
  console.log('[CONTENT] Content script initialization complete');

})();