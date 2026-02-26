# OpenClaw-Mobile 🦞📱

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Termux](https://img.shields.io/badge/Termux-Supported-green.svg)](https://termux.dev/)
[![Proot](https://img.shields.io/badge/Proot-Compatible-blue.svg)](https://github.com/termux/proot-distro)

> **Your personal AI assistant, now on Android.**

OpenClaw-Mobile is a specialized fork of [OpenClaw](https://github.com/openclaw/openclaw) optimized for Android Termux + Proot environments. Run your own AI assistant locally on your phone or tablet—no cloud required, no API keys needed for web search.

---

## ✨ Features

- 🤖 **AI-Powered Assistant** - Chat with LLMs via your favorite messaging apps
- 🔍 **API-Free Web Search** - Decentralized search using SearXNG + Jina Reader
- 🌐 **Browser Automation** - Full Puppeteer support with Android-optimized Chromium
- 🔒 **Privacy-First** - All data stays on your device
- 📱 **Android Native** - Optimized for Termux/Proot with battery and memory awareness
- 🚀 **Easy Setup** - One-command installation

---

## 📋 Termux Quick Start

### Prerequisites

1. **Install Termux** (F-Droid version recommended):
   ```bash
   # Download from: https://f-droid.org/packages/com.termux/
   # Do NOT use Play Store version (deprecated)
   ```

2. **Update Termux packages:**
   ```bash
   pkg update && pkg upgrade -y
   ```

3. **Grant storage permission:**
   ```bash
   termux-setup-storage
   ```

### Installation

#### Option 1: Quick Install (Recommended)

```bash
# Clone the repository
cd ~
git clone https://github.com/Sultanchh/openclaw-mobile-.git openclaw-mobile
cd openclaw-mobile

# Run the installer
./termux/install.sh
```

#### Option 2: Manual Installation

```bash
# Install dependencies
pkg install -y nodejs chromium git python build-essential

# Set environment variables
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Clone and setup
git clone https://github.com/Sultanchh/openclaw-mobile-.git openclaw-mobile
cd openclaw-mobile
npm install
npm run build
```

### Proot Setup (Optional but Recommended)

For a full Linux environment with better compatibility:

```bash
# Install proot-distro
pkg install proot-distro -y

# Install Ubuntu (or Debian)
proot-distro install ubuntu
proot-distro login ubuntu

# Inside proot, install dependencies
apt update
apt install -y nodejs chromium-browser git python3 build-essential

# Clone and install OpenClaw-Mobile
git clone https://github.com/Sultanchh/openclaw-mobile-.git
cd openclaw-mobile
./termux/install.sh
```

### Starting the Gateway

```bash
# Using the launcher script
cd ~/openclaw-mobile
./termux/start.sh

# Or with custom options
./termux/start.sh --port 18789 --verbose
```

The gateway will start on `ws://127.0.0.1:18789` by default.

### Configuration

Copy the mobile-optimized config:

```bash
cp ~/openclaw-mobile/config.mobile.toml ~/.openclaw/config.toml
```

Edit the config to customize:
- Gateway port and host
- Browser settings
- Search preferences
- Memory limits

---

## 🛠 Architecture

### Stability Patches

#### Error 13 Fix

Proot environments restrict access to `/proc/net/dev`, causing "Error 13: Permission Denied". OpenClaw-Mobile patches `os.networkInterfaces()` at startup:

```typescript
import os from 'os';
try {
  os.networkInterfaces();
} catch (e) {
  console.log('[OpenClaw Mobile] Proot environment detected — patching networkInterfaces.');
  os.networkInterfaces = () => ({});
}
```

### Browser Service

Android-optimized Puppeteer configuration:

```typescript
const ANDROID_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--single-process",
  "--no-zygote",
  // ... see src/browser/service.ts
];
```

### Web Search (API-Free)

Decentralized search using SearXNG instances:

```
Query → SearXNG Pool → Results → Jina Reader → Markdown → LLM
```

No API keys required. Privacy-respecting.

---

## 📁 Repository Structure

```
openclaw-mobile/
├── src/
│   ├── index.ts                    # CLI entry (with Error 13 patch)
│   ├── agents/tools/web-search.ts  # SearXNG + Jina search
│   ├── browser/service.ts          # Android Chromium service
│   └── gateway/server.ts           # Gateway server (with Error 13 patch)
├── termux/
│   ├── install.sh                  # Installation script
│   ├── chromium-setup.sh           # Chromium configuration
│   └── start.sh                    # Launcher script
├── config.mobile.toml              # Mobile-optimized config
├── MOBILE_CHANGELOG.md             # Detailed changelog
└── README.md                       # This file
```

---

## 🔧 Configuration

### config.mobile.toml

Key settings for mobile devices:

```toml
[resources]
memoryLimitMB = 512      # Prevent OOM kills
concurrency = 1          # Battery efficiency
maxBrowserSessions = 1   # Limit memory usage

[browser]
headless = true
executablePath = "/usr/bin/chromium"
args = ["--no-sandbox", "--disable-gpu", "--single-process"]

[tools.web.search]
provider = "searxng"     # API-free search
maxResults = 5
fetchContent = true      # Use Jina Reader
```

---

## 🐛 Troubleshooting

### "Error 13: Permission Denied"

This is automatically patched. If you still see it:

```bash
# Ensure you're using the patched entry points
node dist/index.js  # Patched
node dist/gateway/server.js  # Patched
```

### Chromium Not Found

```bash
# Run the setup script
./termux/chromium-setup.sh

# Or manually set the path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Out of Memory

```bash
# Reduce memory limit in config.mobile.toml
[resources]
memoryLimitMB = 256

# Enable swap (Termux)
pkg install swap
swapon /data/data/com.termux/files/usr/tmp/swap
```

### Slow Performance

```bash
# Enable single-process mode (already default)
# Disable content fetching for faster searches
[tools.web.search]
fetchContent = false
```

---

## 📱 Device Compatibility

| Device | RAM | Status | Notes |
|--------|-----|--------|-------|
| Pixel 7 | 8GB | ✅ Excellent | Full features |
| Samsung S21 | 8GB | ✅ Excellent | Full features |
| Pixel 4a | 6GB | ✅ Good | Reduce concurrency |
| Moto G Power | 4GB | ⚠️ Limited | Use minimal config |
| Older devices | 2GB | ❌ Not recommended | - |

---

## 🤝 Contributing

Contributions are welcome! Areas of interest:

- Battery optimization
- Network-aware scheduling
- Additional SearXNG instances
- UI improvements
- Documentation

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [OpenClaw](https://github.com/openclaw/openclaw) - The original project
- [Termux](https://termux.dev/) - Android terminal emulator
- [SearXNG](https://docs.searxng.org/) - Privacy-respecting metasearch
- [Jina AI](https://jina.ai/reader/) - Free content extraction

---

## 📞 Support

- 📧 Issues: [GitHub Issues](https://github.com/Sultanchh/openclaw-mobile-/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/Sultanchh/openclaw-mobile-/discussions)

---

<p align="center">
  <strong>Made with 🦞 for Android</strong>
</p>
