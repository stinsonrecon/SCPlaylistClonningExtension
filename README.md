# SoundCloud Playlist Clone Extension

A powerful browser extension that allows you to clone and merge SoundCloud playlists with advanced duplicate detection and multiple merge strategies.

## 🚀 Features

### Core Functionality
- **Auto-detect API credentials** from SoundCloud pages
- **Authentication verification** with OAuth token extraction
- **Playlist URL parsing** supporting multiple formats
- **Source playlist analysis** with validation and preview
- **Target playlist permission checking**
- **Advanced duplicate detection** using multiple algorithms
- **Multiple merge strategies** (Append, Prepend, Smart, Replace)
- **Real-time progress tracking** during operations
- **Actual playlist updates** via SoundCloud API

### Advanced Features
- **Smart duplicate detection** with confidence scoring
- **Fuzzy matching** for similar tracks (title, artist, duration)
- **Batch processing** for large playlists
- **Memory-efficient** track processing
- **Comprehensive error handling** with retry logic
- **User-friendly interface** with progress indicators

## 📋 Requirements

- Chrome/Chromium browser (Manifest V3)
- Active SoundCloud account
- Valid SoundCloud session (logged in)

## 🛠️ Installation

### Development Setup
1. Clone or download the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your browser toolbar

### File Structure
```
soundcloud-clone-extension/
├── manifest.json          # Extension configuration
├── popup.html             # Main UI interface
├── popup.js              # UI logic and event handling
├── content.js            # SoundCloud page interaction
├── background.js         # Service worker for API calls
├── utils/
│   └── utils.js          # Core utility functions
└── icons/
    ├── icon16.png        # Extension icons
    ├── icon48.png
    └── icon128.png
```

## 🎯 How to Use

### Step 1: Setup
1. Navigate to any SoundCloud page to auto-capture API credentials
2. Extension will automatically detect if you're logged in

### Step 2: Source Playlist
1. Click the extension icon to open the popup
2. Enter source playlist URL or use "Use Current Page" if on a playlist
3. Click "Preview Source" to analyze the playlist
4. Review track count, accessibility, and preview tracks

### Step 3: Target Playlist  
1. Enter target playlist URL (must be your own playlist)
2. Click "Analyze Target" to check permissions and current tracks
3. Review merge preview showing duplicates and new tracks

### Step 4: Configure Merge
1. Click "Execute Merge" to open merge options
2. Choose merge strategy:
   - **Append**: Add new tracks to the end (recommended)
   - **Prepend**: Add new tracks to the beginning
   - **Smart**: Group similar tracks together
   - **Replace**: Replace all existing tracks
3. Configure duplicate detection sensitivity
4. Enable/disable duplicate skipping and order preservation

### Step 5: Execute
1. Review final merge summary
2. Click "Proceed with Merge" to update the playlist
3. Monitor progress and wait for completion
4. Success screen shows statistics and provides playlist link

## 🔧 Supported URL Formats

The extension supports various SoundCloud playlist URL formats:

```
https://soundcloud.com/username/sets/playlist-name
https://soundcloud.com/username/sets/playlist-name?si=...
https://api-v2.soundcloud.com/playlists/123456789
Direct playlist ID: 123456789
```

## ⚙️ Technical Details

### Architecture
- **Phase 1**: Setup & Authentication
- **Phase 2**: Source Playlist Analysis  
- **Phase 3**: Target Playlist Analysis
- **Phase 4**: Merge Execution with Duplicate Detection
- **Phase 5**: API Update via SoundCloud

### Duplicate Detection Algorithms
1. **Exact ID Match**: Perfect track ID matching (100% confidence)
2. **Title+Artist Match**: Exact text matching with duration validation (95% confidence)
3. **Fuzzy Matching**: Levenshtein distance algorithm for similar tracks (50-90% confidence)

### Merge Strategies
- **Append**: Safest option, adds tracks to end of playlist
- **Prepend**: Adds tracks to beginning, useful for chronological ordering
- **Smart**: Uses artist similarity to group related tracks
- **Replace**: Completely replaces playlist content (use with caution)

### Performance Optimizations
- Efficient track ID extraction and processing
- Batch API calls for large playlists
- Memory usage estimation and monitoring
- Exponential backoff retry logic

## 🛡️ Privacy & Security

- **No data collection**: Extension operates locally in your browser
- **Secure API calls**: Uses your existing SoundCloud authentication
- **No external servers**: All processing happens client-side
- **Minimal permissions**: Only accesses SoundCloud domains

## ⚠️ Limitations

- Only works with public playlists for source (or your own private playlists)
- Target playlist must be owned by you
- Large playlists (500+ tracks) may take longer to process
- Rate limited by SoundCloud API (built-in retry handling)
- Requires active SoundCloud login session

## 🐛 Troubleshooting

### Common Issues

**"No API Credentials" Error**
- Solution: Visit any SoundCloud page and refresh to capture credentials

**"Authentication Required" Error**  
- Solution: Make sure you're logged into SoundCloud in the same browser

**"Access Denied" to Target Playlist**
- Solution: Ensure the target playlist belongs to your account

**Extension Not Loading**
- Solution: Refresh the SoundCloud page and try again
- Check if content script injection failed

### Debug Information
If issues persist, check browser console for detailed error messages:
1. Right-click → "Inspect" → "Console" tab
2. Look for `[POPUP]`, `[CONTENT]`, or `[UTILS]` prefixed messages

## 🔄 Version History

### v1.0.0 (Current)
- ✅ Complete playlist cloning functionality
- ✅ Advanced duplicate detection with multiple algorithms
- ✅ Four merge strategies (Append, Prepend, Smart, Replace)
- ✅ Real-time progress tracking and comprehensive error handling
- ✅ Production-ready UI without debug features
- ✅ Full SoundCloud API integration

## 🤝 Contributing

This extension is designed as a comprehensive solution for SoundCloud playlist management. 

### Potential Enhancements
- Multiple source playlist support
- Playlist backup/restore functionality
- Advanced filtering and sorting options
- Cross-platform playlist export
- Automated playlist synchronization

## 📄 License

This project is for educational and personal use. Please respect SoundCloud's Terms of Service when using this extension.

## ⚡ Quick Start

1. **Install** the extension in Chrome
2. **Visit** SoundCloud and log in
3. **Navigate** to a source playlist  
4. **Open** extension popup
5. **Click** "Use Current Page" → "Preview Source"
6. **Enter** target playlist URL → "Analyze Target"
7. **Click** "Execute Merge" → Configure options → "Proceed"
8. **Wait** for completion and enjoy your merged playlist! 🎵

---

**Made with ❤️ for the SoundCloud community**