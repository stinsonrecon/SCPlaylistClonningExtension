/**
 * Background Service Worker for SoundCloud Playlist Clone Extension
 * Handles API credential management and message passing
 */

console.log('[BACKGROUND] Service worker starting...');

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[BACKGROUND] Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Initialize storage on first install
    chrome.storage.local.set({
      'sc_credentials': null,
      'sc_credentials_timestamp': null,
      'last_activity': Date.now()
    });
  }
});

// Message handler từ content script và popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[BACKGROUND] Message received:', request.action);
  
  switch (request.action) {
    case 'storeCredentials':
      handleStoreCredentials(request.credentials)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
      
    case 'getCredentials':
      handleGetCredentials()
        .then(credentials => sendResponse({ credentials }))
        .catch(error => sendResponse({ credentials: null, error: error.message }));
      return true;
      
    case 'validateCredentials':
      handleValidateCredentials(request.credentials)
        .then(isValid => sendResponse({ isValid }))
        .catch(error => sendResponse({ isValid: false, error: error.message }));
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Store API credentials với timestamp
 */
async function handleStoreCredentials(credentials) {
  try {
    if (!isValidCredentials(credentials)) {
      throw new Error('Invalid credentials format');
    }
    
    const data = {
      'sc_credentials': credentials,
      'sc_credentials_timestamp': Date.now(),
      'last_activity': Date.now()
    };
    
    await chrome.storage.local.set(data);
    console.log('[BACKGROUND] Credentials stored successfully');
    
    // Notify popup if open
    notifyCredentialsUpdate(credentials);
    
  } catch (error) {
    console.error('[BACKGROUND] Error storing credentials:', error);
    throw error;
  }
}

/**
 * Get stored credentials nếu còn valid
 */
async function handleGetCredentials() {
  try {
    const result = await chrome.storage.local.get([
      'sc_credentials', 
      'sc_credentials_timestamp'
    ]);
    
    // Check if credentials exist và still valid (24 hours)
    const isExpired = !result.sc_credentials_timestamp || 
      (Date.now() - result.sc_credentials_timestamp > 24 * 60 * 60 * 1000);
    
    if (isExpired) {
      console.log('[BACKGROUND] Credentials expired or not found');
      return null;
    }
    
    console.log('[BACKGROUND] Valid credentials found');
    return result.sc_credentials;
    
  } catch (error) {
    console.error('[BACKGROUND] Error getting credentials:', error);
    return null;
  }
}

/**
 * Validate credentials bằng test API call
 */
async function handleValidateCredentials(credentials) {
  try {
    if (!isValidCredentials(credentials)) {
      return false;
    }
    
    // Test API call để validate credentials
    const testUrl = `https://api-v2.soundcloud.com/me?client_id=${credentials.client_id}&app_version=${credentials.app_version}&app_locale=${credentials.app_locale}`;
    
    const response = await fetch(testUrl);
    return response.ok;
    
  } catch (error) {
    console.error('[BACKGROUND] Error validating credentials:', error);
    return false;
  }
}

/**
 * Validate credentials format
 */
function isValidCredentials(credentials) {
  return credentials &&
         typeof credentials.client_id === 'string' &&
         typeof credentials.app_version === 'string' &&
         typeof credentials.app_locale === 'string' &&
         credentials.client_id.length > 10;
}

/**
 * Notify popup về credentials update
 */
function notifyCredentialsUpdate(credentials) {
  chrome.runtime.sendMessage({
    action: 'credentialsUpdated',
    credentials: credentials
  }).catch(() => {
    // Popup might not be open, ignore error
  });
}

// Keep service worker alive
chrome.runtime.onMessage.addListener(() => {
  // Update last activity
  chrome.storage.local.set({ 'last_activity': Date.now() });
});

console.log('[BACKGROUND] Service worker ready');