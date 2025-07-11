# SoundCloud Playlist Clone Extension

Chrome extension để clone SoundCloud playlists với duplicate detection và preserve order.

## 🚀 Features

- **Auto-detect API Credentials**: Tự động capture SoundCloud API credentials
- **Smart Duplicate Detection**: Tránh duplicate tracks khi merge playlists  
- **Preserve Track Order**: Giữ nguyên thứ tự tracks trong playlist
- **Real-time Progress**: Theo dõi tiến trình clone real-time
- **Debug Tools**: Built-in debug panel cho development

## 📁 Project Structure

```
soundcloud-playlist-clone/
├── manifest.json              # Extension configuration
├── background.js              # Service worker
├── content.js                 # SoundCloud page injection
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.js              # Popup logic
│   └── popup.css             # Popup styling
├── utils/
│   └── utils.js              # Shared utilities
├── assets/
│   ├── icon16.png            # Extension icons
│   ├── icon48.png
│   └── icon128.png
├── .vscode/
│   └── settings.json         # VS Code configuration
└── README.md
```

## 🛠️ Development Setup

### Prerequisites
- Google Chrome Browser
- VS Code (recommended)

### Installation

1. **Clone project**:
   ```bash
   git clone <repository-url>
   cd soundcloud-playlist-clone
   ```

2. **Load extension trong Chrome**:
   - Mở Chrome → `chrome://extensions/`
   - Enable "Developer mode" (toggle góc phải)
   - Click "Load unpacked"
   - Select project folder

3. **VS Code setup**:
   - Install recommended extensions:
     - Chrome Extension Pack
     - JavaScript (ES6) code snippets
   - VS Code settings đã được pre-configured

### Development Workflow

1. **Edit code** trong VS Code
2. **Reload extension** trong Chrome Extensions page
3. **Test changes** trên SoundCloud
4. **Debug** using Chrome DevTools

## 🔧 Debugging

### Service Worker (background.js)
```
Chrome Extensions → Extension details → "Inspect views: service worker"
```

### Content Script (content.js)  
```
F12 trên SoundCloud page → Console tab
```

### Popup (popup.js)
```
Right-click extension icon → "Inspect popup"
```

### Built-in Debug Panel
- Click "View Debug Logs" trong extension popup
- Hoặc trong console: `popupUtils.showDebug()`

## 📊 Development Phases

### ✅ Phase 1: Extension Setup & Configuration (Current)
- Chrome Extension structure
- API credentials auto-detection
- Basic popup UI
- Utils foundation

### 🔄 Phase 2: Source Playlist Processing (Next)
- Extract playlist ID từ URLs
- Fetch complete playlist data
- Handle large playlists
- User authentication

### 🔄 Phase 3: Target Playlist Management
- List user playlists
- Target playlist selection
- Validation

### 🔄 Phase 4: Merge & Deduplication Logic
- Smart merge algorithm
- Duplicate detection
- Preserve order

### 🔄 Phase 5: Update & Error Handling
- Execute playlist updates
- Progress tracking
- Error recovery

### 🔄 Phase 6: Optimization & Polish
- Performance improvements
- Background sync
- Advanced features

## 🔍 Current Status

**Phase 1 Complete** ✅
- Extension loads và injects properly
- API credentials auto-capture working
- Popup UI functional
- Debug system operational

**Ready for Phase 2** 🔄

## 🧪 Testing

### Manual Testing Checklist

1. **Extension Loading**:
   - [ ] Extension loads without errors
   - [ ] Icon appears trong Chrome toolbar
   - [ ] Popup opens correctly

2. **Credential Capture**:
   - [ ] Visit SoundCloud → credentials auto-captured
   - [ ] Green status indicator appears
   - [ ] Credentials persist across sessions

3. **Page Detection**:
   - [ ] Navigate to playlist page → auto-detected
   - [ ] "Use Current Page" button works
   - [ ] Non-playlist pages handled correctly

4. **UI Functionality**:
   - [ ] All buttons respond
   - [ ] Input validation works
   - [ ] Debug panel accessible

### Debug Commands

```javascript
// Trong Chrome Console (popup context)
popupUtils.getCredentials()     // View current credentials
popupUtils.getPageInfo()        // View page detection
popupUtils.getLogs()            // View debug logs
popupUtils.showDebug()          // Open debug panel
popupUtils.clearData()          // Clear all data
```

## 🚨 Known Issues

- **Phase 1 Limitations**:
  - Clone functionality not yet implemented (Phase 2+)
  - OAuth token extraction needs refinement
  - Large playlist handling pending

## 📝 Next Steps

1. **Start Phase 2**: Source Playlist Processing
2. **Implement playlist ID extraction** từ various URL formats
3. **Add complete playlist fetching** với pagination
4. **OAuth token management** cho authentication

## 🤝 Contributing

Development follows phased approach:
1. Complete current phase thoroughly
2. Test all functionality
3. Move to next phase
4. Maintain backward compatibility

## 📄 License

Private development project.

---

**Current Phase**: 1 ✅ | **Next Phase**: 2 🔄