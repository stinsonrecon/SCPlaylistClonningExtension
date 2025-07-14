/**
 * Popup script for SoundCloud Playlist Clone Extension - Phase 4 Complete
 * Debug logging features removed for production
 */

console.log('[POPUP] Popup script starting...');

// Global state
let currentCredentials = null;
let currentPageInfo = null;
let isOperationInProgress = false;
let sourcePlaylistData = null;
let targetPlaylistData = null;
let currentUser = null;
let authToken = null;
let lastUpdatePackage = null;
let currentMode = 'create'; // NEW: Track current mode (create/merge)

// DOM elements
const elements = {};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[POPUP] DOM loaded, initializing...');
  cacheElements();
  setupEventListeners();
  await initializeUI();
  console.log('[POPUP] Popup initialization complete');
});

function cacheElements() {
  const ids = [
    'statusIndicator', 'credentialsStatus', 'refreshCredentialsBtn',
    'pageInfo', 'cloneSection', 'sourcePlaylistUrl', 'targetPlaylistUrl',
    'useCurrentPageBtn', 'skipDuplicates', 'preserveOrder', 'previewBtn',
    'cloneBtn', 'progressSection', 'progressFill', 'progressText',
    'progressDetails', 'cancelBtn', 'resultsSection', 'resultsTitle',
    'resultsSummary', 'resultsDetails', 'newCloneBtn', 'openTargetBtn',
    'errorSection', 'errorMessage', 'errorDetails', 'retryBtn',
    'clearDataBtn', 'loadingOverlay',
    // NEW Phase 6 elements
    'createNewMode', 'mergeExistingMode', 'createModeInputs', 'mergeModeInputs',
    'newPlaylistTitle'
  ];

  ids.forEach(id => {
    elements[id] = document.getElementById(id);
    if (!elements[id]) {
      console.warn(`[POPUP] Element not found: ${id}`);
    }
  });
}

function setupEventListeners() {
  elements.refreshCredentialsBtn?.addEventListener('click', handleRefreshCredentials);
  elements.useCurrentPageBtn?.addEventListener('click', handleUseCurrentPage);
  elements.previewBtn?.addEventListener('click', handlePreview);
  elements.cloneBtn?.addEventListener('click', handleClone);
  elements.cancelBtn?.addEventListener('click', handleCancel);
  elements.newCloneBtn?.addEventListener('click', handleNewClone);
  elements.openTargetBtn?.addEventListener('click', handleOpenTarget);
  elements.retryBtn?.addEventListener('click', handleRetry);
  elements.clearDataBtn?.addEventListener('click', handleClearData);
  elements.sourcePlaylistUrl?.addEventListener('input', validateInputs);
  elements.targetPlaylistUrl?.addEventListener('input', validateInputs);
  // NEW Phase 6 listeners - Mode toggle
  elements.createNewMode?.addEventListener('change', handleModeChange);
  elements.mergeExistingMode?.addEventListener('change', handleModeChange);
  elements.newPlaylistTitle?.addEventListener('input', validateInputs);
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

// NEW Phase 6: Handle mode change
function handleModeChange() {
  const newMode = elements.createNewMode?.checked ? 'create' : 'merge';
  
  if (newMode !== currentMode) {
    currentMode = newMode;
    console.log(`[POPUP] Mode changed to: ${currentMode}`);
    
    updateModeUI();
    
    if (currentMode === 'create' && sourcePlaylistData) {
      updateNewPlaylistTitle();
    }
    
    validateInputs();
  }
}

// NEW Phase 6: Update UI based on current mode
function updateModeUI() {
  const createInputs = elements.createModeInputs;
  const mergeInputs = elements.mergeModeInputs;
  const cloneBtnText = elements.cloneBtnText || elements.cloneBtn; // SAFE VERSION
  
  if (currentMode === 'create') {
    createInputs.style.display = 'block';
    mergeInputs.style.display = 'none';
    
    if (cloneBtnText) {
      if (cloneBtnText === elements.cloneBtn) {
        cloneBtnText.textContent = '🚀 Create Playlist';
      } else {
        cloneBtnText.textContent = 'Create Playlist';
      }
    }
    
    console.log('[POPUP] UI updated for create mode');
  } else {
    createInputs.style.display = 'none';
    mergeInputs.style.display = 'block';
    
    if (cloneBtnText) {
      if (cloneBtnText === elements.cloneBtn) {
        cloneBtnText.textContent = '🚀 Analyze Target';
      } else {
        cloneBtnText.textContent = 'Analyze Target';
      }
    }
    
    console.log('[POPUP] UI updated for merge mode');
  }
}

// NEW Phase 6: Update new playlist title based on source
function updateNewPlaylistTitle() {
  if (elements.newPlaylistTitle && sourcePlaylistData) {
    const defaultTitle = `Copy of ${sourcePlaylistData.title}`;
    elements.newPlaylistTitle.placeholder = defaultTitle;
    
    if (!elements.newPlaylistTitle.value.trim()) {
      elements.newPlaylistTitle.value = defaultTitle;
    }
  }
}

async function initializeUI() {
  try {
    showLoading('Initializing...');
    
    // Initialize mode UI
    updateModeUI();
    
    await checkCredentials();
    await checkCurrentPage();
    await checkAuthenticationStatus();
    updateUIState();
  } catch (error) {
    console.error('[POPUP] Initialization error:', error);
    showError('Initialization failed', error.message);
  } finally {
    hideLoading();
  }
}

async function sendMessageWithRetry(tabId, message, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;

      if (error.message.includes('Could not establish connection')) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (injectError) {
          console.warn('[POPUP] Content script injection failed:', injectError.message);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
}

async function checkCredentials() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCredentials' });
    currentCredentials = response.credentials;

    const statusCard = elements.credentialsStatus;
    const statusIndicator = elements.statusIndicator;

    if (currentCredentials) {
      statusCard.className = 'status-card success';
      statusCard.innerHTML = `
        <div class="status-message">✅ API Credentials Ready</div>
        <div class="status-details">
          Client ID: ${currentCredentials.client_id.substring(0, 8)}...
          <br>Version: ${currentCredentials.app_version}
        </div>
      `;
      statusIndicator.querySelector('.status-dot').className = 'status-dot success';
      statusIndicator.querySelector('.status-text').textContent = 'Ready';
      elements.refreshCredentialsBtn.style.display = 'none';
    } else {
      statusCard.className = 'status-card warning';
      statusCard.innerHTML = `
        <div class="status-message">⚠️ No API Credentials</div>
        <div class="status-details">
          Visit any SoundCloud page to automatically capture API credentials
        </div>
      `;
      statusIndicator.querySelector('.status-dot').className = 'status-dot warning';
      statusIndicator.querySelector('.status-text').textContent = 'Need Setup';
      elements.refreshCredentialsBtn.style.display = 'block';
    }
  } catch (error) {
    console.error('[POPUP] Error checking credentials:', error);
    const statusCard = elements.credentialsStatus;
    statusCard.className = 'status-card error';
    statusCard.innerHTML = `
      <div class="status-message">❌ Credential Check Failed</div>
      <div class="status-details">${error.message}</div>
    `;
    elements.statusIndicator.querySelector('.status-dot').className = 'status-dot error';
    elements.statusIndicator.querySelector('.status-text').textContent = 'Error';
  }
}

async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('soundcloud.com')) {
      elements.pageInfo.innerHTML = `
        <div class="page-status">📄 Not on SoundCloud</div>
        <div class="page-details">Please navigate to SoundCloud to use this extension</div>
      `;
      return;
    }

    const response = await sendMessageWithRetry(tab.id, { action: 'getCurrentPlaylistId' }, 3, 1000);

    if (response && response.playlistId) {
      currentPageInfo = {
        isPlaylist: true,
        playlistId: response.playlistId,
        url: tab.url
      };
      elements.pageInfo.innerHTML = `
        <div class="page-status">🎵 Playlist Page Detected</div>
        <div class="page-details">
          Playlist ID: ${response.playlistId}
          <br>URL: ${tab.url}
        </div>
      `;
      if (elements.sourcePlaylistUrl) {
        elements.sourcePlaylistUrl.value = tab.url;
      }
    } else {
      currentPageInfo = { isPlaylist: false, url: tab.url };
      elements.pageInfo.innerHTML = `
        <div class="page-status">🌐 SoundCloud Page</div>
        <div class="page-details">
          Not a playlist page. Navigate to a playlist to auto-detect.
        </div>
      `;
    }
  } catch (error) {
    console.error('[POPUP] Error checking current page:', error);
    let errorMessage = error.message;
    if (error.message.includes('Could not establish connection')) {
      errorMessage = 'Extension needs to reload. Please refresh the SoundCloud page.';
    }
    elements.pageInfo.innerHTML = `
      <div class="page-status">❌ Page Check Failed</div>
      <div class="page-details">${errorMessage}</div>
    `;
  }
}

async function checkAuthenticationStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('soundcloud.com')) {
      return;
    }

    const response = await sendMessageWithRetry(tab.id, { action: 'checkAuthentication' }, 3, 1000);

    if (response) {
      const { isLoggedIn, user, token, error } = response;

      if (error) {
        return;
      }

      if (isLoggedIn && token) {
        currentUser = user;
        authToken = token;

        if (!user && currentCredentials) {
          try {
            const validation = await SoundCloudUtils.validateAuthToken(token, currentCredentials);
            if (validation.valid && validation.user) {
              currentUser = validation.user;
            }
          } catch (validationError) {
            console.warn('[POPUP] Token validation error:', validationError.message);
          }
        }

        if (!currentUser) {
          const tokenParts = token.split('-');
          if (tokenParts.length >= 3) {
            currentUser = {
              id: parseInt(tokenParts[2]),
              username: `User_${tokenParts[2]}`,
              permalink: `user_${tokenParts[2]}`
            };
          }
        }
      } else {
        currentUser = null;
        authToken = null;
      }
    }
  } catch (error) {
    console.error('[POPUP] Error checking authentication:', error);
  }
}

function updateUIState() {
  const hasCredentials = !!currentCredentials;
  const onSoundCloud = currentPageInfo?.url?.includes('soundcloud.com');

  if (hasCredentials && onSoundCloud) {
    elements.cloneSection.style.display = 'block';
    if (elements.useCurrentPageBtn) {
      elements.useCurrentPageBtn.disabled = !currentPageInfo?.isPlaylist;
    }
  } else {
    elements.cloneSection.style.display = 'none';
  }

  validateInputs();
}

function validateInputs() {
  const sourceUrl = elements.sourcePlaylistUrl?.value?.trim();
  
  // Validate source URL (always required)
  let sourceValid = false;
  let sourceMessage = '';

  if (sourceUrl) {
    const sourceExtracted = SoundCloudUtils.extractPlaylistId(sourceUrl);
    sourceValid = !!sourceExtracted;

    if (!sourceValid) {
      sourceMessage = 'Invalid playlist URL format';
    } else if (sourceExtracted.id) {
      sourceMessage = `✓ Direct playlist ID: ${sourceExtracted.id}`;
    } else if (sourceExtracted.username && sourceExtracted.slug) {
      sourceMessage = `✓ Playlist URL: ${sourceExtracted.username}/${sourceExtracted.slug}`;
    }
  }

  // Mode-specific validation
  let secondaryValid = false;
  let secondaryMessage = '';

  if (currentMode === 'create') {
    // For create mode, validate new playlist title
    const newTitle = elements.newPlaylistTitle?.value?.trim();
    secondaryValid = !!newTitle && newTitle.length > 0;
    secondaryMessage = secondaryValid ? '✓ Playlist title ready' : 'Please enter playlist title';
  } else {
    // For merge mode, validate target URL
    const targetUrl = elements.targetPlaylistUrl?.value?.trim();
    
    if (targetUrl) {
      const targetExtracted = SoundCloudUtils.extractPlaylistId(targetUrl);
      secondaryValid = !!targetExtracted;

      if (!secondaryValid) {
        secondaryMessage = 'Invalid playlist URL format';
      } else if (targetExtracted.id) {
        secondaryMessage = `✓ Target playlist ID: ${targetExtracted.id}`;
      } else if (targetExtracted.username && targetExtracted.slug) {
        secondaryMessage = `✓ Target playlist: ${targetExtracted.username}/${targetExtracted.slug}`;
      }
    }
  }

  // Update button states
  if (elements.previewBtn) {
    elements.previewBtn.disabled = !sourceValid || isOperationInProgress;
  }

  if (elements.cloneBtn) {
    const authRequired = !!authToken;
    
    if (currentMode === 'create') {
      elements.cloneBtn.disabled = !sourceValid || !secondaryValid || !authRequired || !sourcePlaylistData || isOperationInProgress;
    } else {
      elements.cloneBtn.disabled = !sourceValid || !secondaryValid || !authRequired || !sourcePlaylistData || isOperationInProgress;
    }
  }

  // Visual feedback for inputs
  if (elements.sourcePlaylistUrl) {
    const isSourceError = sourceUrl && !sourceValid;
    elements.sourcePlaylistUrl.style.borderColor = isSourceError ? '#ef4444' : '';
    elements.sourcePlaylistUrl.title = sourceMessage;
  }

  if (currentMode === 'create' && elements.newPlaylistTitle) {
    const isTitleError = elements.newPlaylistTitle.value && !secondaryValid;
    elements.newPlaylistTitle.style.borderColor = isTitleError ? '#ef4444' : '';
    elements.newPlaylistTitle.title = secondaryMessage;
  }

  if (currentMode === 'merge' && elements.targetPlaylistUrl) {
    const targetUrl = elements.targetPlaylistUrl?.value?.trim();
    const isTargetError = targetUrl && !secondaryValid;
    elements.targetPlaylistUrl.style.borderColor = isTargetError ? '#ef4444' : '';
    elements.targetPlaylistUrl.title = secondaryMessage;
  }

  console.log(`[POPUP] Validation (${currentMode} mode): Source(${sourceValid ? '✅' : '❌'}), Secondary(${secondaryValid ? '✅' : '❌'}), Auth(${!!authToken ? '✅' : '❌'})`);
}

// Event handlers
async function handleRefreshCredentials() {
  try {
    showLoading('Refreshing credentials...');
    await chrome.tabs.create({ url: 'https://soundcloud.com' });
    setTimeout(async () => {
      await checkCredentials();
      updateUIState();
      hideLoading();
    }, 2000);
  } catch (error) {
    console.error('[POPUP] Error refreshing credentials:', error);
    hideLoading();
  }
}

function handleUseCurrentPage() {
  if (currentPageInfo?.isPlaylist && elements.sourcePlaylistUrl) {
    elements.sourcePlaylistUrl.value = currentPageInfo.url;
    validateInputs();
  }
}

async function handlePreview() {
  try {
    const sourceUrl = elements.sourcePlaylistUrl.value.trim();
    if (!sourceUrl) throw new Error('Please enter a source playlist URL');
    if (!currentCredentials) throw new Error('API credentials not available. Please visit SoundCloud first.');

    showProgress('Analyzing source playlist...', 10);

    updateProgress('Extracting playlist ID...', 20);
    const playlistId = await SoundCloudUtils.resolvePlaylistId(sourceUrl, currentCredentials);

    updateProgress('Fetching playlist data...', 40);
    const playlistInfo = await SoundCloudUtils.fetchPlaylistInfo(playlistId, currentCredentials);

    updateProgress('Validating playlist access...', 60);
    const validation = SoundCloudUtils.validatePlaylistAccess(playlistInfo);

    updateProgress('Processing track data...', 80);
    const trackIds = SoundCloudUtils.extractTrackIds(playlistInfo);
    const trackPreview = SoundCloudUtils.getTrackPreview(playlistInfo, 5);

    updateProgress('Complete!', 100);

    setTimeout(() => {
      showPreviewResults({
        playlist: playlistInfo,
        validation: validation,
        trackIds: trackIds,
        trackPreview: trackPreview
      });
      
      // NEW Phase 6: Update new playlist title after preview
      if (currentMode === 'create') {
        updateNewPlaylistTitle();
      }
    }, 500);

  } catch (error) {
    console.error('[POPUP] Preview error:', error);
    showError('Preview Failed', error.message);
  }
}

async function handleClone() {
  try {
    if (!sourcePlaylistData) throw new Error('Please preview source playlist first');
    if (!authToken) throw new Error('Authentication required. Please make sure you are logged into SoundCloud.');

    if (currentMode === 'create') {
      await handleCreateNewPlaylist();
    } else {
      await handleMergeExisting();
    }

  } catch (error) {
    console.error('[POPUP] Clone operation error:', error);
    showError('Clone Operation Failed', error.message);
  }
}

// NEW Phase 6: Create new playlist implementation
async function handleCreateNewPlaylist() {
  try {
    const newTitle = elements.newPlaylistTitle.value.trim();
    if (!newTitle) throw new Error('Please enter a title for the new playlist');

    const privacyRadios = document.querySelectorAll('input[name="privacy"]');
    const selectedPrivacy = Array.from(privacyRadios).find(radio => radio.checked)?.value || 'public';

    console.log(`[POPUP] Creating new playlist: "${newTitle}" (${selectedPrivacy})`);

    showProgress('Creating new playlist...', 10);

    updateProgress('Extracting tracks from source...', 30);
    const sourceTrackIds = SoundCloudUtils.extractTrackIds(sourcePlaylistData);
    console.log(`[POPUP] Extracted ${sourceTrackIds.length} tracks from source`);

    if (sourceTrackIds.length === 0) {
      throw new Error('Source playlist has no valid tracks to copy');
    }

    updateProgress('Creating playlist on SoundCloud...', 70);
    const newPlaylist = await SoundCloudUtils.createNewPlaylist({
      title: newTitle,
      sharing: selectedPrivacy,
      tracks: sourceTrackIds
    }, currentCredentials, authToken);

    updateProgress('Complete!', 100);

    setTimeout(() => {
      showCreateSuccess({
        newPlaylist,
        sourcePlaylist: sourcePlaylistData,
        tracksAdded: sourceTrackIds.length
      });
    }, 500);

    console.log(`[POPUP] New playlist created successfully: ${newPlaylist.id}`);

  } catch (error) {
    console.error('[POPUP] Create new playlist error:', error);
    throw error;
  }
}

// Existing merge flow (renamed for clarity)
async function handleMergeExisting() {
  try {
    const targetUrl = elements.targetPlaylistUrl.value.trim();
    if (!targetUrl) throw new Error('Please enter target playlist URL');

    showProgress('Analyzing target playlist...', 10);

    updateProgress('Extracting target playlist ID...', 20);
    const targetId = await SoundCloudUtils.resolvePlaylistId(targetUrl, currentCredentials);

    updateProgress('Fetching target playlist...', 40);
    targetPlaylistData = await SoundCloudUtils.fetchTargetPlaylist(targetId, currentCredentials, authToken);

    updateProgress('Checking permissions...', 60);
    const permissions = SoundCloudUtils.checkEditPermissions(targetPlaylistData, currentUser);
    if (!permissions.canEdit) throw new Error(permissions.reason);

    updateProgress('Analyzing current tracks...', 70);
    const targetAnalysis = SoundCloudUtils.analyzeTargetPlaylist(targetPlaylistData);

    updateProgress('Preparing merge preview...', 90);
    const mergeOptions = {
      strategy: 'APPEND',
      skipDuplicates: elements.skipDuplicates?.checked !== false,
      preserveOrder: elements.preserveOrder?.checked !== false
    };

    const mergePreview = SoundCloudUtils.prepareMergePreview(sourcePlaylistData, targetPlaylistData, mergeOptions);

    updateProgress('Complete!', 100);
    setTimeout(() => {
      showMergePreview({
        source: sourcePlaylistData,
        target: targetPlaylistData,
        targetAnalysis,
        mergePreview,
        permissions
      });
    }, 500);

  } catch (error) {
    console.error('[POPUP] Merge existing error:', error);
    throw error;
  }
}

// Phase 4: Execute Merge
async function handleExecuteMerge(previewData) {
  try {
    const { source, target, mergePreview } = previewData;

    if (!sourcePlaylistData || !targetPlaylistData) throw new Error('Missing playlist data for merge');
    if (!authToken) throw new Error('Authentication token required for merge execution');

    const mergeOptions = await showMergeOptionsDialog();
    if (!mergeOptions) {
      return;
    }

    showProgress('Executing merge...', 0);

    const progressCallback = (message, percentage) => {
      updateProgress(message, percentage);
    };

    const updatePackage = await SoundCloudUtils.executeMerge(sourcePlaylistData, targetPlaylistData, {
      ...mergeOptions,
      progressCallback
    });

    lastUpdatePackage = updatePackage;

    const confirmed = await showMergeConfirmation(updatePackage);
    if (!confirmed) {
      hideAllSections();
      return;
    }

    updateProgress('Updating playlist...', 95);
    await executePlaylistUpdate(updatePackage);

    showMergeSuccess(updatePackage);

  } catch (error) {
    console.error('[POPUP] Execute merge error:', error);
    showError('Merge Execution Failed', error.message);
  }
}

async function showMergeOptionsDialog() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;`;

    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; padding: 24px; max-width: 400px; width: 90%;">
        <h3 style="margin: 0 0 16px 0; color: #333;">🔄 Merge Options</h3>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-weight: 500; margin-bottom: 8px;">Merge Strategy:</label>
          <select id="mergeStrategy" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="APPEND">Append - Add to end (recommended)</option>
            <option value="PREPEND">Prepend - Add to beginning</option>
            <option value="SMART">Smart - Group similar tracks</option>
            <option value="REPLACE">Replace - Replace all tracks</option>
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="skipDuplicates" checked>
            <span>Skip duplicate tracks</span>
          </label>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="preserveOrder" checked>
            <span>Preserve track order</span>
          </label>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-weight: 500; margin-bottom: 8px;">Duplicate Detection Sensitivity:</label>
          <input type="range" id="duplicateThreshold" min="0.5" max="1.0" step="0.1" value="0.9" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
            <span>Loose (0.5)</span>
            <span>Strict (1.0)</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 20px;">
          <button id="cancelMerge" style="flex: 1; padding: 8px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="confirmMerge" style="flex: 1; padding: 8px; border: none; background: #ff5500; color: white; border-radius: 4px; cursor: pointer;">Start Merge</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#cancelMerge').onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };

    modal.querySelector('#confirmMerge').onclick = () => {
      const options = {
        strategy: modal.querySelector('#mergeStrategy').value,
        skipDuplicates: modal.querySelector('#skipDuplicates').checked,
        preserveOrder: modal.querySelector('#preserveOrder').checked,
        duplicateThreshold: parseFloat(modal.querySelector('#duplicateThreshold').value)
      };
      document.body.removeChild(modal);
      resolve(options);
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        resolve(null);
      }
    };
  });
}

async function showMergeConfirmation(updatePackage) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;`;

    const stats = updatePackage.stats;
    const warnings = updatePackage.validation.warnings;

    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <h3 style="margin: 0 0 16px 0; color: #333;">📊 Confirm Merge</h3>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; color: #555;">Merge Summary</h4>
          <div style="font-size: 13px; line-height: 1.5;">
            <strong>📥 Source:</strong> ${stats.originalSourceCount} tracks<br>
            <strong>📋 Target:</strong> ${stats.originalTargetCount} tracks<br>
            <strong>🔄 Strategy:</strong> ${updatePackage.operation.strategy}<br>
            <strong>➕ Adding:</strong> ${stats.tracksAdded} new tracks<br>
            <strong>➖ Skipping:</strong> ${stats.duplicatesSkipped} duplicates<br>
            <strong>📈 Final Total:</strong> ${stats.finalTotalCount} tracks
          </div>
        </div>
        ${warnings.length > 0 ? `
          <div style="background: #fffbeb; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #92400e;">⚠️ Warnings</h4>
            <div style="font-size: 12px; color: #92400e;">
              ${warnings.map(w => `• ${w}`).join('<br>')}
            </div>
          </div>
        ` : ''}
        <div style="background: #f0f9ff; border: 1px solid #0ea5e9; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
          <div style="font-size: 12px; color: #0c4a6e;">
            <strong>⏱️ Estimated update time:</strong> ${Math.round(updatePackage.validation.estimatedUpdateTime / 1000)} seconds<br>
            <strong>💾 Memory usage:</strong> ~${stats.memoryUsedMB}MB
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="cancelConfirm" style="flex: 1; padding: 10px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="proceedConfirm" style="flex: 2; padding: 10px; border: none; background: #22c55e; color: white; border-radius: 4px; cursor: pointer; font-weight: 500;">✅ Proceed with Merge</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#cancelConfirm').onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };

    modal.querySelector('#proceedConfirm').onclick = () => {
      document.body.removeChild(modal);
      resolve(true);
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        resolve(false);
      }
    };
  });
}

// NEW Phase 6: Show create success results
function showCreateSuccess(data) {
  hideAllSections();
  elements.resultsSection.style.display = 'block';
  elements.resultsTitle.textContent = '🎉 Playlist Created Successfully';

  const { newPlaylist, sourcePlaylist, tracksAdded } = data;

  elements.resultsSummary.innerHTML = `
    <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 16px;">
      <h3 style="margin: 0 0 8px 0; color: #15803d;">✅ New Playlist Created!</h3>
      <div style="font-size: 14px; color: #166534;">
        <strong>"${SoundCloudUtils.sanitizeString(newPlaylist.title)}"</strong><br>
        Successfully created with <strong>${tracksAdded}</strong> tracks
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; text-align: center;">
        <div style="font-size: 20px; font-weight: bold; color: #059669;">${tracksAdded}</div>
        <div style="font-size: 11px; color: #666;">Tracks Added</div>
      </div>
      <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; text-align: center;">
        <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${newPlaylist.sharing === 'public' ? '🌐' : '🔒'}</div>
        <div style="font-size: 11px; color: #666;">${newPlaylist.sharing === 'public' ? 'Public' : 'Private'}</div>
      </div>
    </div>
  `;

  elements.resultsDetails.innerHTML = `
    <div style="margin-top: 16px;">
      <strong>📊 Creation Details:</strong><br>
      <div style="font-size: 12px; color: #666; margin-top: 8px; line-height: 1.5;">
        Source: "${SoundCloudUtils.sanitizeString(sourcePlaylist.title)}"<br>
        New Playlist ID: ${newPlaylist.id}<br>
        Privacy: ${newPlaylist.sharing}<br>
        Created: ${new Date().toLocaleDateString()}
      </div>
    </div>
    
    <div style="background: #f0f9ff; border: 1px solid #0ea5e9; padding: 12px; border-radius: 6px; margin-top: 16px;">
      <div style="font-size: 12px; color: #0c4a6e;">
        💡 <strong>Your new playlist is ready!</strong> You can now find it in your SoundCloud library and share it with others.
      </div>
    </div>
  `;

  elements.openTargetBtn.style.display = 'inline-flex';
  elements.openTargetBtn.textContent = '🎵 Open New Playlist';
  elements.openTargetBtn.onclick = () => {
    chrome.tabs.create({ url: newPlaylist.permalink_url });
  };

  elements.newCloneBtn.textContent = '🔄 Create Another Playlist';

  const executeBtn = document.getElementById('executeMergeBtn');
  if (executeBtn) executeBtn.remove();

  console.log('[POPUP] Create success screen displayed');
}

async function executePlaylistUpdate(updatePackage) {
  try {
    const result = await SoundCloudUtils.updatePlaylist(
      updatePackage.operation.targetPlaylistId,
      updatePackage.finalTrackIds,
      currentCredentials,
      authToken
    );

    return result;

  } catch (error) {
    console.error('[POPUP] Playlist update error:', error);
    throw new Error(`Failed to update playlist: ${error.message}`);
  }
}

// UI Display Functions
function showPreviewResults(data) {
  hideAllSections();
  elements.resultsSection.style.display = 'block';
  elements.resultsTitle.textContent = '👁️ Source Playlist Preview';

  const { playlist, validation, trackIds, trackPreview } = data;
  sourcePlaylistData = playlist;

  elements.resultsSummary.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong>📋 ${SoundCloudUtils.sanitizeString(playlist.title)}</strong>
    </div>
    <div style="font-size: 12px; color: #666; line-height: 1.4;">
      👤 <strong>${SoundCloudUtils.sanitizeString(playlist.user.username)}</strong><br>
      🎵 ${playlist.track_count} tracks (${validation.availableTrackCount} available)<br>
      ⏱️ ${SoundCloudUtils.formatDuration(playlist.duration)}<br>
      ${playlist.public ? '🌐 Public' : '🔒 Private'} playlist<br>
      📅 Created: ${new Date(playlist.created_at).toLocaleDateString()}
    </div>
  `;

  let validationHtml = '';
  if (!validation.isAccessible) {
    validationHtml += `<div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 4px; padding: 8px; margin: 8px 0;">
      <strong>⚠️ Issues Detected:</strong><br>
      ${validation.issues.map(issue => `• ${issue}`).join('<br>')}
    </div>`;
  } else if (validation.issues.length > 0) {
    validationHtml += `<div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 4px; padding: 8px; margin: 8px 0;">
      <strong>⚠️ Warnings:</strong><br>
      ${validation.issues.map(issue => `• ${issue}`).join('<br>')}
    </div>`;
  }

  let authHtml = '';
  if (authToken) {
    if (currentUser && currentUser.username) {
      authHtml = `<div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 4px; padding: 8px; margin: 8px 0;">
        <strong>✅ Ready to Clone</strong><br>
        Authenticated as: <strong>${currentUser.username}</strong>
      </div>`;
    } else {
      authHtml = `<div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 4px; padding: 8px; margin: 8px 0;">
        <strong>✅ Ready to Clone</strong><br>
        Authenticated with valid token (User: ${authToken.split('-')[2] || 'Unknown'})
      </div>`;
    }
  } else {
    authHtml = `<div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 4px; padding: 8px; margin: 8px 0;">
      <strong>⚠️ Authentication Required</strong><br>
      Please make sure you are logged into SoundCloud to clone playlists.
    </div>`;
  }

  let tracksHtml = '';
  if (trackPreview.length > 0) {
    tracksHtml = `
      <div style="margin-top: 12px;">
        <strong>🎵 Track Preview (First ${trackPreview.length}):</strong>
        <div style="background: #f8f9fa; border-radius: 4px; padding: 8px; margin-top: 4px; font-size: 11px;">
          ${trackPreview.map(track => `
            <div style="margin: 4px 0; padding: 4px 0; border-bottom: 1px solid #e9ecef;">
              <strong>${track.index}. ${track.title}</strong><br>
              <span style="color: #666;">by ${track.artist} • ${track.duration}</span>
            </div>
          `).join('')}
          ${playlist.track_count > trackPreview.length ?
        `<div style="text-align: center; color: #666; margin-top: 8px; font-style: italic;">
              ... and ${playlist.track_count - trackPreview.length} more tracks
            </div>` : ''
      }
        </div>
      </div>
    `;
  }

  elements.resultsDetails.innerHTML = validationHtml + authHtml + tracksHtml;
  elements.openTargetBtn.style.display = 'none';
  elements.newCloneBtn.textContent = '🔄 Try Another URL';

  const hasValidToken = !!authToken;
  const canProceed = validation.isAccessible && hasValidToken;

  if (elements.cloneBtn) {
    elements.cloneBtn.disabled = !canProceed;
    
    // Update button text based on mode - SAFE VERSION
    const cloneBtnText = elements.cloneBtnText || elements.cloneBtn;
    
    if (currentMode === 'create') {
      if (cloneBtnText === elements.cloneBtn) {
        cloneBtnText.textContent = canProceed ? '🚀 Create Playlist' : '🔒 Login Required';
      } else {
        cloneBtnText.textContent = canProceed ? 'Create Playlist' : 'Login Required';
      }
    } else {
      if (cloneBtnText === elements.cloneBtn) {
        cloneBtnText.textContent = canProceed ? '🚀 Analyze Target' : '🔒 Login Required';
      } else {
        cloneBtnText.textContent = canProceed ? 'Analyze Target' : 'Login Required';
      }
    }
  }
}

function showMergePreview(data) {
  hideAllSections();
  elements.resultsSection.style.display = 'block';
  elements.resultsTitle.textContent = '🔄 Merge Preview';

  const { source, target, targetAnalysis, mergePreview } = data;

  elements.resultsSummary.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
      <div style="background: #f0f9ff; padding: 8px; border-radius: 4px; border: 1px solid #0ea5e9;">
        <strong>📥 Source</strong><br>
        <small>${SoundCloudUtils.sanitizeString(source.title, 25)}</small><br>
        <strong>${mergePreview.source.totalTracks}</strong> tracks
      </div>
      <div style="background: #f0fdf4; padding: 8px; border-radius: 4px; border: 1px solid #22c55e;">
        <strong>📋 Target</strong><br>
        <small>${SoundCloudUtils.sanitizeString(target.title, 25)}</small><br>
        <strong>${mergePreview.target.totalTracks}</strong> tracks
      </div>
    </div>
    
    <div style="background: #fefce8; border: 1px solid #eab308; border-radius: 4px; padding: 12px; text-align: center;">
      <strong>📊 Merge Result</strong><br>
      <div style="font-size: 14px; margin: 4px 0;">
        <strong style="color: #059669;">+${mergePreview.merge.tracksToAdd}</strong> new tracks •
        <strong style="color: #dc2626;">-${mergePreview.merge.duplicatesFound}</strong> duplicates •
        <strong style="color: #2563eb;">${mergePreview.merge.finalCount}</strong> total
      </div>
      <small style="color: #666;">Strategy: ${mergePreview.merge.strategy}</small>
    </div>
  `;

  let detailsHtml = '';

  if (targetAnalysis.warnings.length > 0) {
    detailsHtml += `<div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 4px; padding: 8px; margin: 8px 0;">
      <strong>⚠️ Warnings:</strong><br>
      ${targetAnalysis.warnings.map(warning => `• ${warning}`).join('<br>')}
    </div>`;
  }

  if (mergePreview.merge.duplicatesFound > 0) {
    detailsHtml += `<div style="margin-top: 12px;">
      <strong>🔍 Duplicate Tracks (${mergePreview.merge.duplicatesFound}):</strong>
      <div style="background: #fef2f2; border-radius: 4px; padding: 8px; margin-top: 4px; font-size: 11px;">
        ${mergePreview.preview.sampleDuplicates.length > 0 ?
        `Sample duplicates found by track ID: ${mergePreview.preview.sampleDuplicates.join(', ')}` :
        'No sample duplicates to display'
      }
      </div>
    </div>`;
  }

  if (mergePreview.preview.first5NewTracks.length > 0) {
    detailsHtml += `<div style="margin-top: 12px;">
      <strong>🎵 New Tracks to Add (First ${mergePreview.preview.first5NewTracks.length}):</strong>
      <div style="background: #f0fdf4; border-radius: 4px; padding: 8px; margin-top: 4px; font-size: 11px;">
        ${mergePreview.preview.first5NewTracks.map(track => `
          <div style="margin: 4px 0; padding: 4px 0; border-bottom: 1px solid #e9ecef;">
            <strong>${track.index}. ${track.title}</strong><br>
            <span style="color: #666;">by ${track.artist} • ${track.duration}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  elements.resultsDetails.innerHTML = detailsHtml;

  elements.openTargetBtn.style.display = 'inline-flex';
  elements.openTargetBtn.textContent = '👁️ Open Target Playlist';
  elements.openTargetBtn.onclick = () => {
    chrome.tabs.create({ url: target.permalink_url });
  };

  elements.newCloneBtn.textContent = '🔄 Start Over';

  const existingExecuteBtn = document.getElementById('executeMergeBtn');
  if (existingExecuteBtn) existingExecuteBtn.remove();

  const executeMergeBtn = document.createElement('button');
  executeMergeBtn.id = 'executeMergeBtn';
  executeMergeBtn.className = 'btn btn-success';
  executeMergeBtn.innerHTML = '🚀 Execute Merge';
  executeMergeBtn.onclick = () => handleExecuteMerge(data);

  elements.resultsSection.querySelector('.action-buttons').insertBefore(executeMergeBtn, elements.newCloneBtn);
}

function showMergeSuccess(updatePackage) {
  hideAllSections();
  elements.resultsSection.style.display = 'block';
  elements.resultsTitle.textContent = '🎉 Merge Completed Successfully';

  const stats = updatePackage.stats;

  elements.resultsSummary.innerHTML = `
    <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 16px;">
      <h3 style="margin: 0 0 8px 0; color: #15803d;">✅ Success!</h3>
      <div style="font-size: 14px; color: #166534;">
        Added <strong>${stats.tracksAdded}</strong> new tracks to your playlist
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; text-align: center;">
        <div style="font-size: 20px; font-weight: bold; color: #059669;">${stats.tracksAdded}</div>
        <div style="font-size: 11px; color: #666;">Tracks Added</div>
      </div>
      <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; text-align: center;">
        <div style="font-size: 20px; font-weight: bold; color: #dc2626;">${stats.duplicatesSkipped}</div>
        <div style="font-size: 11px; color: #666;">Duplicates Skipped</div>
      </div>
    </div>
    
    <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; text-align: center;">
      <div style="font-size: 18px; font-weight: bold; color: #2563eb;">${stats.finalTotalCount}</div>
      <div style="font-size: 11px; color: #666;">Final Playlist Size</div>
    </div>
  `;

  elements.resultsDetails.innerHTML = `
    <div style="margin-top: 16px;">
      <strong>📊 Operation Details:</strong><br>
      <div style="font-size: 12px; color: #666; margin-top: 8px; line-height: 1.5;">
        Strategy: ${updatePackage.operation.strategy}<br>
        Processing Time: ${Math.round(stats.processingTimeMs / 1000)}s<br>
        Duplicates Found: ${stats.duplicatesFound}<br>
        Memory Used: ~${stats.memoryUsedMB}MB
      </div>
    </div>
  `;

  elements.openTargetBtn.style.display = 'inline-flex';
  elements.openTargetBtn.textContent = '🎵 Open Updated Playlist';
  elements.openTargetBtn.onclick = () => {
    chrome.tabs.create({ url: targetPlaylistData.permalink_url });
  };

  elements.newCloneBtn.textContent = '🔄 Clone Another Playlist';

  const executeBtn = document.getElementById('executeMergeBtn');
  if (executeBtn) executeBtn.remove();
}

// Utility Functions
function handleCancel() {
  hideAllSections();
  updateUIState();
}

function handleNewClone() {
  hideAllSections();
  elements.sourcePlaylistUrl.value = '';
  elements.targetPlaylistUrl.value = '';
  elements.newPlaylistTitle.value = ''; // NEW: Clear new playlist title
  sourcePlaylistData = null;
  targetPlaylistData = null;
  
  // Reset to default mode (create)
  if (elements.createNewMode) {
    elements.createNewMode.checked = true;
    currentMode = 'create';
    updateModeUI();
  }
  
  updateUIState();
}

function handleOpenTarget() {
  const targetUrl = elements.targetPlaylistUrl.value.trim();
  if (targetUrl) chrome.tabs.create({ url: targetUrl });
}

function handleRetry() {
  hideAllSections();
  updateUIState();
}

function handleBackgroundMessage(request, sender, sendResponse) {
  if (request.action === 'credentialsUpdated') {
    currentCredentials = request.credentials;
    checkCredentials();
    updateUIState();
  }
}

function showError(title, message, details = '') {
  hideAllSections();
  elements.errorSection.style.display = 'block';
  elements.errorMessage.textContent = message;
  elements.errorDetails.textContent = details;
}

function showProgress(text, percentage = 0) {
  hideAllSections();
  elements.progressSection.style.display = 'block';
  elements.progressText.textContent = text;
  elements.progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
  isOperationInProgress = true;
  updateUIState();
}

function updateProgress(text, percentage, details = '') {
  if (elements.progressSection.style.display === 'block') {
    elements.progressText.textContent = text;
    elements.progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    elements.progressDetails.textContent = details;
  }
}

function hideAllSections() {
  ['progressSection', 'resultsSection', 'errorSection'].forEach(sectionId => {
    if (elements[sectionId]) elements[sectionId].style.display = 'none';
  });
  isOperationInProgress = false;
}

function showLoading(text = 'Loading...') {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.style.display = 'flex';
    const loadingText = elements.loadingOverlay.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = text;
  }
}

function hideLoading() {
  if (elements.loadingOverlay) elements.loadingOverlay.style.display = 'none';
}

async function handleClearData() {
  if (confirm('Clear all stored data? This will remove credentials and settings.')) {
    try {
      await chrome.storage.local.clear();
      currentCredentials = null;
      currentPageInfo = null;
      sourcePlaylistData = null;
      targetPlaylistData = null;
      currentUser = null;
      authToken = null;
      lastUpdatePackage = null;
      await initializeUI();
    } catch (error) {
      console.error('[POPUP] Error clearing data:', error);
    }
  }
}

// Development utilities (minimal version)
window.popupUtils = {
  getCredentials: () => currentCredentials,
  getPageInfo: () => currentPageInfo,
  getSourceData: () => sourcePlaylistData,
  getTargetData: () => targetPlaylistData,
  getCurrentUser: () => currentUser,
  getAuthToken: () => authToken,
  getLastUpdatePackage: () => lastUpdatePackage,
  getCurrentMode: () => currentMode,
  switchMode: (mode) => {
    if (mode === 'create' && elements.createNewMode) {
      elements.createNewMode.checked = true;
      handleModeChange();
    } else if (mode === 'merge' && elements.mergeExistingMode) {
      elements.mergeExistingMode.checked = true;
      handleModeChange();
    }
  },
  logCurrentState: () => {
    console.group('📊 CURRENT EXTENSION STATE');
    console.log('Credentials:', currentCredentials);
    console.log('Source Playlist:', sourcePlaylistData);
    console.log('Target Playlist:', targetPlaylistData);
    console.log('Current User:', currentUser);
    console.log('Auth Token:', authToken ? `${authToken.substring(0, 20)}...` : null);
    console.log('Last Update Package:', lastUpdatePackage);
    console.groupEnd();
  }
};

console.log('[POPUP] Popup script loaded (production version)');