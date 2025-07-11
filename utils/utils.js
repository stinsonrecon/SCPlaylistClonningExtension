/**
 * Utility functions cho SoundCloud Playlist Clone Extension
 * Shared functions across all components (cleaned up - no duplicate auth functions)
 */

const SoundCloudUtils = {

  /**
   * Build SoundCloud API URL với credentials
   */
  buildAPIUrl(endpoint, credentials, additionalParams = {}) {
    if (!credentials || !this.isValidCredentials(credentials)) {
      throw new Error('Invalid or missing credentials');
    }

    const url = new URL(`https://api-v2.soundcloud.com${endpoint}`);

    // Add required parameters
    url.searchParams.set('client_id', credentials.client_id);
    url.searchParams.set('app_version', credentials.app_version);
    url.searchParams.set('app_locale', credentials.app_locale);

    // Add additional parameters
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, value.toString());
      }
    });

    return url.toString();
  },

  /**
   * Validate credentials format
   */
  isValidCredentials(credentials) {
    return credentials &&
      typeof credentials.client_id === 'string' &&
      typeof credentials.app_version === 'string' &&
      typeof credentials.app_locale === 'string' &&
      credentials.client_id.length > 10 &&
      credentials.app_version.length > 5;
  },

  /**
   * Extract playlist ID từ các URL formats khác nhau
   */
  extractPlaylistId(url) {
    try {
      if (!url || typeof url !== 'string') {
        return null;
      }

      console.log(`[UTILS] Extracting playlist ID from: ${url}`);

      // Method 1: Direct playlist ID (numeric)
      if (/^\d+$/.test(url.trim())) {
        const id = parseInt(url.trim());
        console.log(`[UTILS] Direct ID found: ${id}`);
        return { id, username: null, slug: null };
      }

      // Method 2: API URL với playlist ID
      const apiMatch = url.match(/(?:api-v2\.soundcloud\.com|api\.soundcloud\.com).*?playlists\/(\d+)/);
      if (apiMatch) {
        const id = parseInt(apiMatch[1]);
        console.log(`[UTILS] API URL ID found: ${id}`);
        return { id, username: null, slug: null };
      }

      // Method 3: Standard playlist URL
      const standardMatch = url.match(/soundcloud\.com\/([^\/\?#]+)\/sets\/([^\/\?#]+)/);
      if (standardMatch) {
        const username = decodeURIComponent(standardMatch[1]);
        const slug = decodeURIComponent(standardMatch[2]);
        console.log(`[UTILS] Standard URL format: ${username}/${slug}`);
        return { id: null, username, slug };
      }

      // Method 4: Embed iframe src
      const embedMatch = url.match(/api\.soundcloud\.com.*?url=([^&]+)/);
      if (embedMatch) {
        const decodedUrl = decodeURIComponent(embedMatch[1]);
        console.log(`[UTILS] Embed URL found, recursing: ${decodedUrl}`);
        return this.extractPlaylistId(decodedUrl);
      }

      // Method 5: Share URL với redirect
      const shareMatch = url.match(/soundcloud\.com\/.*?\/([^\/\?#]+)\/sets\/([^\/\?#]+)/);
      if (shareMatch) {
        const username = decodeURIComponent(shareMatch[1]);
        const slug = decodeURIComponent(shareMatch[2]);
        console.log(`[UTILS] Share URL format: ${username}/${slug}`);
        return { id: null, username, slug };
      }

      console.log(`[UTILS] No playlist ID pattern matched`);
      return null;

    } catch (error) {
      console.error('[UTILS] Error extracting playlist ID:', error);
      return null;
    }
  },

  /**
   * Validate playlist URL
   */
  isValidPlaylistUrl(url) {
    return this.extractPlaylistId(url) !== null;
  },

  /**
   * Get playlist info từ SoundCloud API với full error handling
   */
  async fetchPlaylistInfo(playlistId, credentials) {
    try {
      if (!playlistId) {
        throw new Error('Playlist ID is required');
      }

      if (!this.isValidCredentials(credentials)) {
        throw new Error('Valid credentials are required');
      }

      console.log(`[UTILS] Fetching playlist info for ID: ${playlistId}`);

      const apiUrl = this.buildAPIUrl(`/playlists/${playlistId}`, credentials);
      console.log(`[UTILS] API URL: ${apiUrl.substring(0, 100)}...`);

      const response = await fetch(apiUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Playlist not found (ID: ${playlistId}). It may be private or deleted.`);
        } else if (response.status === 403) {
          throw new Error(`Access denied to playlist (ID: ${playlistId}). It may be private.`);
        } else if (response.status === 401) {
          throw new Error('Invalid API credentials. Please refresh the page and try again.');
        } else {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log(`[UTILS] Playlist fetched successfully:`, {
        id: data.id,
        title: data.title,
        track_count: data.track_count,
        user: data.user?.username
      });

      // Validate response structure
      if (!data.id || !data.tracks) {
        throw new Error('Invalid playlist data received from API');
      }

      return {
        id: data.id,
        title: data.title || 'Untitled Playlist',
        description: data.description || '',
        track_count: data.track_count || 0,
        duration: data.duration || 0,
        user: {
          id: data.user?.id,
          username: data.user?.username || 'Unknown User',
          permalink: data.user?.permalink
        },
        tracks: data.tracks || [],
        permalink_url: data.permalink_url,
        public: data.public,
        created_at: data.created_at,
        last_modified: data.last_modified
      };

    } catch (error) {
      console.error('[UTILS] Error fetching playlist info:', error);
      throw error;
    }
  },

  /**
   * Resolve playlist ID từ URL nếu chỉ có username/slug
   */
  async resolvePlaylistId(urlOrId, credentials) {
    try {
      // If already a number, return it
      if (typeof urlOrId === 'number') {
        return urlOrId;
      }

      // If string number, convert
      if (typeof urlOrId === 'string' && /^\d+$/.test(urlOrId)) {
        return parseInt(urlOrId);
      }

      // Extract from URL
      const extracted = this.extractPlaylistId(urlOrId);
      if (extracted?.id) {
        return extracted.id;
      }

      // If we have username/slug, need to resolve via search
      if (extracted?.username && extracted.slug) {
        console.log(`[UTILS] Resolving playlist ID for ${extracted.username}/${extracted.slug}`);

        // Try to resolve via SoundCloud resolve API
        const resolveUrl = this.buildAPIUrl('/resolve', credentials, {
          url: urlOrId
        });

        const response = await fetch(resolveUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.id && data.kind === 'playlist') {
            console.log(`[UTILS] Resolved playlist ID: ${data.id}`);
            return data.id;
          }
        }

        throw new Error(`Could not resolve playlist ID from URL: ${urlOrId}`);
      }

      throw new Error(`Invalid playlist URL or ID: ${urlOrId}`);

    } catch (error) {
      console.error('[UTILS] Error resolving playlist ID:', error);
      throw error;
    }
  },

  /**
   * Extract track IDs từ playlist data với validation
   */
  extractTrackIds(playlistData) {
    if (!playlistData || !playlistData.tracks || !Array.isArray(playlistData.tracks)) {
      console.warn('[UTILS] Invalid playlist data for track extraction');
      return [];
    }

    const trackIds = [];
    const skipped = [];

    playlistData.tracks.forEach((track, index) => {
      if (track && typeof track.id === 'number') {
        trackIds.push(track.id);
      } else {
        skipped.push({ index, track });
      }
    });

    if (skipped.length > 0) {
      console.warn(`[UTILS] Skipped ${skipped.length} invalid tracks:`, skipped);
    }

    console.log(`[UTILS] Extracted ${trackIds.length} valid track IDs`);
    return trackIds;
  },

  /**
   * Get detailed track info for preview
   */
  getTrackPreview(playlistData, maxTracks = 10) {
    if (!playlistData?.tracks) {
      return [];
    }

    return playlistData.tracks.slice(0, maxTracks).map((track, index) => ({
      index: index + 1,
      id: track.id,
      title: this.sanitizeString(track.title || 'Unknown Track', 60),
      artist: this.sanitizeString(track.user?.username || 'Unknown Artist', 30),
      duration: track.duration ? this.formatDuration(track.duration) : 'Unknown',
      permalink_url: track.permalink_url
    }));
  },

  /**
   * Validate playlist access và permissions
   */
  validatePlaylistAccess(playlistData) {
    const issues = [];

    if (!playlistData.public) {
      issues.push('Playlist is private');
    }

    if (!playlistData.tracks || playlistData.tracks.length === 0) {
      issues.push('Playlist is empty');
    }

    if (playlistData.track_count > 500) {
      issues.push(`Large playlist (${playlistData.track_count} tracks) - may take longer to process`);
    }

    const unavailableTracks = playlistData.tracks?.filter(track =>
      !track || !track.id || track.policy === 'BLOCK'
    ).length || 0;

    if (unavailableTracks > 0) {
      issues.push(`${unavailableTracks} tracks are unavailable or blocked`);
    }

    return {
      isAccessible: issues.length === 0 || issues.every(issue =>
        issue.includes('Large playlist') || issue.includes('unavailable')
      ),
      issues,
      trackCount: playlistData.tracks?.length || 0,
      availableTrackCount: (playlistData.tracks?.length || 0) - unavailableTracks
    };
  },

  /**
   * Merge track arrays với duplicate detection
   */
  mergeTrackArrays(existingTracks, newTracks) {
    const existingIds = new Set(existingTracks.map(track =>
      typeof track === 'object' ? track.id : track
    ));

    const uniqueNewTracks = newTracks.filter(track => {
      const trackId = typeof track === 'object' ? track.id : track;
      return !existingIds.has(trackId);
    });

    return {
      merged: [...existingTracks, ...uniqueNewTracks],
      addedCount: uniqueNewTracks.length,
      duplicateCount: newTracks.length - uniqueNewTracks.length,
      totalCount: existingTracks.length + uniqueNewTracks.length
    };
  },

  /**
   * Validate OAuth token bằng test API call (popup context only)
   */
  async validateAuthToken(token, credentials) {
    try {
      if (!token) {
        return { valid: false, error: 'No token provided' };
      }

      console.log('[UTILS] Validating OAuth token...');

      const testUrl = this.buildAPIUrl('/me', credentials);

      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `OAuth ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('[UTILS] OAuth token valid for user:', userData.username);
        return {
          valid: true,
          user: {
            id: userData.id,
            username: userData.username,
            permalink: userData.permalink
          }
        };
      } else {
        console.log('[UTILS] OAuth token validation failed:', response.status);
        return {
          valid: false,
          error: `Token validation failed: ${response.status} ${response.statusText}`
        };
      }

    } catch (error) {
      console.error('[UTILS] Error validating OAuth token:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  },

  /**
   * Fetch target playlist với authentication
   */
  async fetchTargetPlaylist(playlistId, credentials, authToken) {
    try {
      if (!authToken) {
        throw new Error('Authentication token required for target playlist access');
      }

      console.log(`[UTILS] Fetching target playlist: ${playlistId}`);

      const apiUrl = this.buildAPIUrl(`/playlists/${playlistId}`, credentials);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `OAuth ${authToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. You may not have permission to edit this playlist.');
        } else if (response.status === 404) {
          throw new Error('Target playlist not found. Please check the URL.');
        } else {
          throw new Error(`Failed to fetch target playlist: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();

      console.log(`[UTILS] Target playlist fetched:`, {
        id: data.id,
        title: data.title,
        track_count: data.track_count,
        user: data.user?.username
      });

      return {
        id: data.id,
        title: data.title || 'Untitled Playlist',
        description: data.description || '',
        track_count: data.track_count || 0,
        duration: data.duration || 0,
        user: {
          id: data.user?.id,
          username: data.user?.username || 'Unknown User',
          permalink: data.user?.permalink
        },
        tracks: data.tracks || [],
        permalink_url: data.permalink_url,
        public: data.public,
        created_at: data.created_at,
        last_modified: data.last_modified
      };

    } catch (error) {
      console.error('[UTILS] Error fetching target playlist:', error);
      throw error;
    }
  },

  /**
   * Check edit permissions cho playlist
   */
  checkEditPermissions(playlistData, currentUser) {
    try {
      if (!currentUser || !playlistData) {
        console.log('[UTILS] Missing user or playlist data for permission check');
        return { canEdit: false, reason: 'Missing authentication data' };
      }

      // Check if current user is the owner
      const isOwner = playlistData.user.id === currentUser.id ||
        playlistData.user.username === currentUser.username ||
        playlistData.user.permalink === currentUser.permalink;

      if (isOwner) {
        console.log('[UTILS] User has owner permissions');
        return { canEdit: true, reason: 'Owner access' };
      }

      // TODO: Check for collaborative permissions (if SoundCloud supports)
      // For now, only owners can edit

      console.log('[UTILS] User does not have edit permissions');
      return {
        canEdit: false,
        reason: `Only playlist owner (${playlistData.user.username}) can edit this playlist`
      };

    } catch (error) {
      console.error('[UTILS] Error checking edit permissions:', error);
      return { canEdit: false, reason: 'Permission check failed' };
    }
  },

  /**
   * Analyze target playlist cho merge preparation
   */
  analyzeTargetPlaylist(targetData) {
    try {
      const analysis = {
        totalTracks: targetData.track_count || 0,
        currentTracks: targetData.tracks ? targetData.tracks.length : 0,
        hasGaps: false,
        trackIds: [],
        warnings: [],
        recommendations: []
      };

      // Extract current track IDs
      if (targetData.tracks && Array.isArray(targetData.tracks)) {
        analysis.trackIds = targetData.tracks
          .filter(track => track && track.id)
          .map(track => track.id);

        // Check for gaps (missing tracks)
        const validTracks = targetData.tracks.filter(track => track && track.id);
        analysis.hasGaps = validTracks.length < targetData.track_count;

        if (analysis.hasGaps) {
          const missingCount = targetData.track_count - validTracks.length;
          analysis.warnings.push(`${missingCount} tracks may be unavailable or private`);
        }
      }

      // Size warnings
      if (analysis.totalTracks > 200) {
        analysis.warnings.push('Large playlist - merge operation may take longer');
      }

      if (analysis.totalTracks > 500) {
        analysis.warnings.push('Very large playlist - consider creating a new playlist instead');
      }

      // Recommendations
      if (analysis.totalTracks === 0) {
        analysis.recommendations.push('Empty target playlist - all source tracks will be added');
      } else if (analysis.totalTracks < 50) {
        analysis.recommendations.push('Small target playlist - good for merging');
      }

      console.log('[UTILS] Target playlist analysis:', analysis);
      return analysis;

    } catch (error) {
      console.error('[UTILS] Error analyzing target playlist:', error);
      return {
        totalTracks: 0,
        currentTracks: 0,
        hasGaps: false,
        trackIds: [],
        warnings: ['Analysis failed'],
        recommendations: []
      };
    }
  },

  /**
   * Prepare merge preview data
   */
  prepareMergePreview(sourceData, targetData, options = {}) {
    try {
      const sourceTrackIds = this.extractTrackIds(sourceData);
      const targetTrackIds = this.extractTrackIds(targetData);

      console.log(`[UTILS] Preparing merge preview: ${sourceTrackIds.length} source + ${targetTrackIds.length} target`);

      // Find duplicates
      const duplicates = this.findDuplicatesByIds(sourceTrackIds, targetTrackIds);
      const uniqueSourceTracks = sourceTrackIds.filter(id => !duplicates.includes(id));

      const preview = {
        source: {
          totalTracks: sourceTrackIds.length,
          title: sourceData.title,
          user: sourceData.user.username
        },
        target: {
          totalTracks: targetTrackIds.length,
          title: targetData.title,
          user: targetData.user.username
        },
        merge: {
          duplicatesFound: duplicates.length,
          tracksToAdd: uniqueSourceTracks.length,
          finalCount: targetTrackIds.length + uniqueSourceTracks.length,
          strategy: options.strategy || 'APPEND'
        },
        duplicates: duplicates,
        preview: {
          first5NewTracks: this.getTrackPreview({
            tracks: sourceData.tracks.filter(track =>
              uniqueSourceTracks.includes(track.id)
            )
          }, 5),
          sampleDuplicates: duplicates.slice(0, 3)
        }
      };

      console.log('[UTILS] Merge preview prepared:', preview.merge);
      return preview;

    } catch (error) {
      console.error('[UTILS] Error preparing merge preview:', error);
      throw error;
    }
  },

  /**
   * Simple duplicate detection by track IDs
   */
  findDuplicatesByIds(sourceIds, targetIds) {
    const targetSet = new Set(targetIds);
    return sourceIds.filter(id => targetSet.has(id));
  },

  /**
   * Update playlist với new tracks
   */
  async updatePlaylist(playlistId, trackIds, credentials, authToken) {
    try {
      if (!authToken) {
        throw new Error('Authentication token required for playlist updates');
      }

      const apiUrl = this.buildAPIUrl(`/playlists/${playlistId}`, credentials);

      const payload = {
        playlist: {
          tracks: trackIds
        }
      };

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `OAuth ${authToken}`,
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Update failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('[UTILS] Error updating playlist:', error);
      throw error;
    }
  },

  /**
   * Format duration từ milliseconds
   */
  formatDuration(durationMs) {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }
  },

  /**
   * Sanitize string cho display
   */
  sanitizeString(str, maxLength = 50) {
    if (!str) return '';

    const cleaned = str.replace(/<[^>]*>/g, '').trim();
    return cleaned.length > maxLength ?
      cleaned.substring(0, maxLength) + '...' :
      cleaned;
  },

  /**
   * Normalize string cho consistent matching
   */
  normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  },

  /**
   * Normalize artist name
   */
  normalizeArtist(artist) {
    if (!artist) return '';
    return this.normalizeString(artist)
      .replace(/^the\s+/i, '') // Remove "the" prefix
      .replace(/\s+feat\.?\s+.*/i, '') // Remove featuring
      .replace(/\s+ft\.?\s+.*/i, ''); // Remove ft.
  },

  /**
   * Extract title words for matching
   */
  extractTitleWords(title) {
    if (!title) return [];
    return this.normalizeString(title)
      .split(/\s+/)
      .filter(word => word.length > 2) // Skip short words
      .slice(0, 10); // Limit to first 10 words
  },

  /**
   * Calculate string similarity (0-1)
   */
  stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1 === s2) return 1;
    
    // Simple Levenshtein distance ratio
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(s1, s2);
    return 1 - (distance / maxLen);
  },

  /**
   * Levenshtein distance calculation
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  },

  /**
   * Calculate word overlap between two arrays
   */
  calculateWordOverlap(words1, words2) {
    if (!words1?.length || !words2?.length) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    return intersection.size / Math.max(set1.size, set2.size);
  },

  /**
   * Preserve track order based on strategy
   */
  preserveTrackOrder(tracks, strategy) {
    // For now, just return as-is
    // Could implement more sophisticated ordering later
    return tracks;
  },

  /**
   * Estimate memory usage
   */
  estimateMemoryUsage(mergeResult) {
    const trackCount = mergeResult.finalTracks.length;
    return Math.round((trackCount * 0.5) / 1024); // Rough estimate in MB
  },

  /**
   * Validate merge result
   */
  validateMergeResult(mergeResult) {
    const errors = [];
    
    if (!mergeResult.finalTracks || mergeResult.finalTracks.length === 0) {
      errors.push('No tracks in final result');
    }
    
    if (mergeResult.finalTracks.length > 5000) {
      errors.push('Result exceeds maximum playlist size (5000 tracks)');
    }
    
    return errors;
  },

  /**
   * Generate merge warnings
   */
  generateMergeWarnings(mergeResult, duplicateAnalysis) {
    const warnings = [];
    
    if (duplicateAnalysis.duplicates.length > 50) {
      warnings.push(`Large number of duplicates found (${duplicateAnalysis.duplicates.length})`);
    }
    
    if (mergeResult.finalTracks.length > 1000) {
      warnings.push('Large playlist - update may take longer');
    }
    
    if (duplicateAnalysis.conflicts.length > 0) {
      warnings.push(`${duplicateAnalysis.conflicts.length} potential conflicts detected`);
    }
    
    return warnings;
  },

  /**
   * Estimate update time
   */
  estimateUpdateTime(trackCount) {
    // Rough estimate: 100ms per track + base time
    return Math.max(1000, trackCount * 100);
  },

  /**
   * Delay function cho rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Advanced Merge Engine - Phase 4 Implementation
   */

  /**
   * Main merge function với multiple strategies
   */
  async executeMerge(sourceData, targetData, options = {}) {
    try {
      console.log('[UTILS] Starting merge execution...');

      const mergeOptions = {
        strategy: options.strategy || 'APPEND',
        duplicateThreshold: options.duplicateThreshold || 0.9,
        preserveOrder: options.preserveOrder !== false,
        skipDuplicates: options.skipDuplicates !== false,
        batchSize: options.batchSize || 100,
        progressCallback: options.progressCallback || (() => { })
      };

      console.log('[UTILS] Merge options:', mergeOptions);

      // Phase 1: Extract and validate tracks
      mergeOptions.progressCallback('Extracting tracks...', 10);
      const sourceTracks = this.extractTracksWithDetails(sourceData);
      const targetTracks = this.extractTracksWithDetails(targetData);

      console.log(`[UTILS] Source: ${sourceTracks.length} tracks, Target: ${targetTracks.length} tracks`);

      // Phase 2: Advanced duplicate detection
      mergeOptions.progressCallback('Detecting duplicates...', 30);
      const duplicateAnalysis = await this.advancedDuplicateDetection(
        sourceTracks,
        targetTracks,
        mergeOptions.duplicateThreshold
      );

      console.log(`[UTILS] Found ${duplicateAnalysis.duplicates.length} duplicates`);

      // Phase 3: Apply merge strategy
      mergeOptions.progressCallback('Applying merge strategy...', 60);
      const mergeResult = this.applyMergeStrategy(
        sourceTracks,
        targetTracks,
        duplicateAnalysis,
        mergeOptions
      );

      // Phase 4: Generate final update package
      mergeOptions.progressCallback('Generating update package...', 90);
      const updatePackage = this.generateUpdatePackage(
        sourceData,
        targetData,
        mergeResult,
        duplicateAnalysis,
        mergeOptions
      );

      mergeOptions.progressCallback('Complete!', 100);
      console.log('[UTILS] Merge execution complete:', updatePackage.stats);

      // 🔍 DETAILED MERGE DEBUG OUTPUT
      console.group('🔄 MERGE ENGINE OUTPUT');
      console.log('📊 Final Statistics:', {
        'Original Source': updatePackage.stats.originalSourceCount,
        'Original Target': updatePackage.stats.originalTargetCount,
        'Duplicates Found': updatePackage.stats.duplicatesFound,
        'Tracks Added': updatePackage.stats.tracksAdded,
        'Final Count': updatePackage.stats.finalTotalCount,
        'Processing Time': `${updatePackage.stats.processingTimeMs}ms`
      });

      console.log('🎯 Final Track IDs (first 10):', updatePackage.finalTrackIds.slice(0, 10));
      console.log('🎯 Final Track IDs (last 10):', updatePackage.finalTrackIds.slice(-10));
      console.log('🎯 Total Final Track IDs:', updatePackage.finalTrackIds.length);

      if (updatePackage.analysis.duplicates.length > 0) {
        console.log('🔍 Duplicate Examples:', updatePackage.analysis.duplicates.slice(0, 3).map(d => ({
          source: `${d.sourceTrack.title} - ${d.sourceTrack.artist}`,
          target: `${d.targetTrack.title} - ${d.targetTrack.artist}`,
          confidence: d.confidence,
          level: d.matchLevel
        })));
      }

      console.log('⚠️ Validation Status:', {
        valid: updatePackage.validation.isValid,
        canProceed: updatePackage.validation.canProceed,
        errorCount: updatePackage.validation.errors.length,
        warningCount: updatePackage.validation.warnings.length
      });

      console.groupEnd();

      return updatePackage;

    } catch (error) {
      console.error('[UTILS] Error executing merge:', error);
      throw error;
    }
  },

  /**
   * Extract tracks với detailed information
   */
  extractTracksWithDetails(playlistData) {
    if (!playlistData?.tracks || !Array.isArray(playlistData.tracks)) {
      return [];
    }

    return playlistData.tracks
      .filter(track => track && track.id)
      .map((track, index) => ({
        id: track.id,
        title: this.normalizeString(track.title || ''),
        artist: this.normalizeString(track.user?.username || ''),
        duration: track.duration || 0,
        originalIndex: index,
        permalink_url: track.permalink_url,
        // Additional metadata for smart matching
        titleWords: this.extractTitleWords(track.title || ''),
        artistNormalized: this.normalizeArtist(track.user?.username || ''),
        durationBucket: Math.floor((track.duration || 0) / 10000) // Group by 10s intervals
      }));
  },

  /**
   * Advanced duplicate detection với multiple levels
   */
  async advancedDuplicateDetection(sourceTracks, targetTracks, threshold = 0.9) {
    console.log('[UTILS] Starting advanced duplicate detection...');

    const duplicates = [];
    const conflicts = [];
    const targetTrackMap = new Map();

    // Build efficient lookup structures
    targetTracks.forEach(track => {
      // Exact ID lookup
      targetTrackMap.set(track.id, track);

      // Title+Artist lookup
      const key = `${track.title}|${track.artist}`.toLowerCase();
      if (!targetTrackMap.has(key)) {
        targetTrackMap.set(key, []);
      }
      targetTrackMap.get(key).push(track);
    });

    for (const sourceTrack of sourceTracks) {
      const matches = this.findTrackMatches(sourceTrack, targetTracks, targetTrackMap);

      if (matches.length > 0) {
        const bestMatch = matches[0];

        if (bestMatch.confidence >= threshold) {
          duplicates.push({
            sourceTrack,
            targetTrack: bestMatch.track,
            matchLevel: bestMatch.level,
            confidence: bestMatch.confidence,
            action: 'SKIP_SOURCE'
          });
        } else if (bestMatch.confidence >= 0.5) {
          conflicts.push({
            sourceTrack,
            targetTrack: bestMatch.track,
            matchLevel: bestMatch.level,
            confidence: bestMatch.confidence,
            requiresUserDecision: true
          });
        }
      }
    }

    console.log(`[UTILS] Duplicate detection complete: ${duplicates.length} duplicates, ${conflicts.length} conflicts`);

    return {
      duplicates,
      conflicts,
      stats: {
        totalSourceTracks: sourceTracks.length,
        totalTargetTracks: targetTracks.length,
        exactMatches: duplicates.filter(d => d.matchLevel === 'EXACT_ID').length,
        fuzzyMatches: duplicates.filter(d => d.matchLevel === 'FUZZY').length,
        conflictsNeedingResolution: conflicts.length
      }
    };
  },

  /**
   * Find potential matches cho một track
   */
  findTrackMatches(sourceTrack, targetTracks, targetTrackMap) {
    const matches = [];

    // Level 1: Exact ID match
    if (targetTrackMap.has(sourceTrack.id)) {
      matches.push({
        track: targetTrackMap.get(sourceTrack.id),
        level: 'EXACT_ID',
        confidence: 1.0
      });
      return matches; // Exact match found, no need to check further
    }

    // Level 2: Title + Artist exact match
    const titleArtistKey = `${sourceTrack.title}|${sourceTrack.artist}`.toLowerCase();
    const titleArtistMatches = targetTrackMap.get(titleArtistKey) || [];

    for (const targetTrack of titleArtistMatches) {
      const durationDiff = Math.abs(sourceTrack.duration - targetTrack.duration);
      if (durationDiff < 5000) { // Within 5 seconds
        matches.push({
          track: targetTrack,
          level: 'TITLE_ARTIST_EXACT',
          confidence: 0.95
        });
      }
    }

    // Level 3: Fuzzy matching (expensive, so only if no exact matches)
    if (matches.length === 0) {
      for (const targetTrack of targetTracks) {
        const fuzzyScore = this.calculateFuzzyMatchScore(sourceTrack, targetTrack);
        if (fuzzyScore > 0.5) {
          matches.push({
            track: targetTrack,
            level: 'FUZZY',
            confidence: fuzzyScore
          });
        }
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence);
  },

  /**
   * Calculate fuzzy match score between two tracks
   */
  calculateFuzzyMatchScore(track1, track2) {
    let score = 0;
    let factors = 0;

    // Title similarity (40% weight)
    const titleSim = this.stringSimilarity(track1.title, track2.title);
    score += titleSim * 0.4;
    factors += 0.4;

    // Artist similarity (30% weight)
    const artistSim = this.stringSimilarity(track1.artist, track2.artist);
    score += artistSim * 0.3;
    factors += 0.3;

    // Duration similarity (20% weight)
    if (track1.duration && track2.duration) {
      const durationDiff = Math.abs(track1.duration - track2.duration);
      const maxDuration = Math.max(track1.duration, track2.duration);
      const durationSim = Math.max(0, 1 - (durationDiff / maxDuration));
      score += durationSim * 0.2;
      factors += 0.2;
    }

    // Title word overlap (10% weight)
    const wordOverlap = this.calculateWordOverlap(track1.titleWords, track2.titleWords);
    score += wordOverlap * 0.1;
    factors += 0.1;

    return factors > 0 ? score / factors : 0;
  },

  /**
   * Apply selected merge strategy
   */
  applyMergeStrategy(sourceTracks, targetTracks, duplicateAnalysis, options) {
    console.log(`[UTILS] Applying merge strategy: ${options.strategy}`);

    // Filter out duplicates from source tracks
    const duplicateSourceIds = new Set(
      duplicateAnalysis.duplicates.map(d => d.sourceTrack.id)
    );

    const uniqueSourceTracks = options.skipDuplicates
      ? sourceTracks.filter(track => !duplicateSourceIds.has(track.id))
      : sourceTracks;

    console.log(`[UTILS] After deduplication: ${uniqueSourceTracks.length} unique source tracks`);

    let finalTracks = [];

    switch (options.strategy) {
      case 'APPEND':
        finalTracks = [...targetTracks, ...uniqueSourceTracks];
        break;

      case 'PREPEND':
        finalTracks = [...uniqueSourceTracks, ...targetTracks];
        break;

      case 'SMART':
        finalTracks = this.smartMerge(targetTracks, uniqueSourceTracks);
        break;

      case 'REPLACE':
        finalTracks = uniqueSourceTracks;
        break;

      default:
        finalTracks = [...targetTracks, ...uniqueSourceTracks];
    }

    // Preserve original indices if requested
    if (options.preserveOrder) {
      finalTracks = this.preserveTrackOrder(finalTracks, options.strategy);
    }

    return {
      finalTracks,
      strategy: options.strategy,
      uniqueSourceTracks,
      originalTargetTracks: targetTracks,
      stats: {
        finalCount: finalTracks.length,
        addedCount: uniqueSourceTracks.length,
        preservedCount: targetTracks.length,
        duplicatesSkipped: duplicateAnalysis.duplicates.length
      }
    };
  },

  /**
   * Smart merge algorithm - group similar tracks together
   */
  smartMerge(targetTracks, sourceTracks) {
    console.log('[UTILS] Applying smart merge algorithm...');

    // Simple smart merge: group by artist similarity
    const merged = [...targetTracks];

    for (const sourceTrack of sourceTracks) {
      // Find best insertion point based on artist similarity
      let bestInsertIndex = merged.length; // Default: append
      let bestSimilarity = 0;

      for (let i = 0; i < merged.length; i++) {
        const similarity = this.stringSimilarity(
          sourceTrack.artist,
          merged[i].artist
        );

        if (similarity > bestSimilarity && similarity > 0.5) {
          bestSimilarity = similarity;
          bestInsertIndex = i + 1; // Insert after similar artist
        }
      }

      merged.splice(bestInsertIndex, 0, sourceTrack);
    }

    return merged;
  },

  /**
   * Generate final update package cho Phase 5
   */
  generateUpdatePackage(sourceData, targetData, mergeResult, duplicateAnalysis, options) {
    const startTime = Date.now();

    // Extract final track IDs in correct order
    const finalTrackIds = mergeResult.finalTracks.map(track => track.id);

    const updatePackage = {
      // Main payload for Phase 5
      finalTrackIds,

      // Detailed statistics
      stats: {
        originalSourceCount: sourceData.track_count || 0,
        originalTargetCount: targetData.track_count || 0,
        duplicatesFound: duplicateAnalysis.duplicates.length,
        duplicatesSkipped: duplicateAnalysis.duplicates.length,
        conflictsFound: duplicateAnalysis.conflicts.length,
        tracksAdded: mergeResult.stats.addedCount,
        finalTotalCount: finalTrackIds.length,
        processingTimeMs: Date.now() - startTime,
        memoryUsedMB: this.estimateMemoryUsage(mergeResult)
      },

      // Operation metadata
      operation: {
        strategy: options.strategy,
        preserveOrder: options.preserveOrder,
        skipDuplicates: options.skipDuplicates,
        duplicateThreshold: options.duplicateThreshold,
        targetPlaylistId: targetData.id,
        sourcePlaylistId: sourceData.id,
        timestamp: Date.now()
      },

      // Validation results
      validation: {
        isValid: finalTrackIds.length > 0,
        errors: this.validateMergeResult(mergeResult),
        warnings: this.generateMergeWarnings(mergeResult, duplicateAnalysis),
        canProceed: finalTrackIds.length > 0 && finalTrackIds.length <= 5000,
        estimatedUpdateTime: this.estimateUpdateTime(finalTrackIds.length)
      },

      // Detailed analysis
      analysis: {
        duplicates: duplicateAnalysis.duplicates.map(d => ({
          sourceTrack: {
            id: d.sourceTrack.id,
            title: d.sourceTrack.title,
            artist: d.sourceTrack.artist
          },
          targetTrack: {
            id: d.targetTrack.id,
            title: d.targetTrack.title,
            artist: d.targetTrack.artist
          },
          matchLevel: d.matchLevel,
          confidence: d.confidence,
          action: d.action
        })),

        conflicts: duplicateAnalysis.conflicts.map(c => ({
          sourceTrack: {
            id: c.sourceTrack.id,
            title: c.sourceTrack.title,
            artist: c.sourceTrack.artist
          },
          targetTrack: {
            id: c.targetTrack.id,
            title: c.targetTrack.title,
            artist: c.targetTrack.artist
          },
          confidence: c.confidence,
          requiresUserDecision: c.requiresUserDecision
        })),

        additions: mergeResult.uniqueSourceTracks.map((track, index) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          position: options.strategy === 'PREPEND' ? index :
            (targetData.track_count || 0) + index
        }))
      },

      // API payload ready for execution
      apiPayload: {
        playlist: {
          tracks: finalTrackIds
        }
      },

      // Rollback information
      rollback: {
        originalTrackIds: mergeResult.originalTargetTracks.map(t => t.id),
        canRollback: true,
        rollbackComplexity: finalTrackIds.length > 500 ? 'COMPLEX' : 'SIMPLE'
      }
    };

    console.log('[UTILS] Update package generated:', updatePackage.stats);
    return updatePackage;
  },

  /**
   * Retry function với exponential backoff
   */
  async retry(asyncFn, maxRetries = 3, delayMs = 1000) {
    let lastError;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error;

        if (i === maxRetries) {
          throw error;
        }

        console.warn(`[UTILS] Retry ${i + 1}/${maxRetries} after error:`, error.message);
        await this.delay(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }

    throw lastError;
  }

};

// Export cho sử dụng trong other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundCloudUtils;
} else if (typeof window !== 'undefined') {
  window.SoundCloudUtils = SoundCloudUtils;
}