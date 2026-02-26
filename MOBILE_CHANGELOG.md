# OpenClaw-Mobile Changelog

## Overview

OpenClaw-Mobile is a specialized fork of OpenClaw optimized for Android Termux + Proot environments. This changelog documents the architectural modifications and mobile-specific optimizations.

---

## Version 1.0.0 - Initial Mobile Release

### Core Modifications

#### 1. Stability Patch (The "Error 13" Fix)

**Problem:** In Proot environments, accessing `/proc/net/dev` causes an "Error 13: Permission Denied" because Proot restricts access to certain `/proc` filesystem entries.

**Solution:** A proactive patch is injected at the absolute top of all entry point files:

```typescript
import os from 'os';
try {
  os.networkInterfaces();
} catch (e) {
  console.log('[OpenClaw Mobile] Proot environment detected — patching networkInterfaces to prevent Error 13.');
  os.networkInterfaces = () => ({});
}
```

**Files Modified:**
- `src/index.ts` - Main CLI entry point
- `src/gateway/server.ts` - Gateway server entry point

**Impact:** This patch detects the Proot environment by attempting to call `os.networkInterfaces()` and, if it throws an error, replaces the function with a stub that returns an empty object. This prevents the Error 13 crash while maintaining compatibility with the rest of the codebase.

---

#### 2. Browser Service Optimization

**Problem:** Puppeteer's default configuration is designed for desktop environments with full sandbox support, GPU acceleration, and multi-process architecture. These features are not available or appropriate for Android Termux + Proot.

**Solution:** A new `BrowserService` class in `src/browser/service.ts` provides Android-optimized Puppeteer configuration:

**Key Optimizations:**

| Flag | Purpose |
|------|---------|
| `--no-sandbox` | Disable Chrome sandbox (required for Proot) |
| `--disable-setuid-sandbox` | Disable setuid sandbox (not available in Proot) |
| `--disable-dev-shm-usage` | Use `/tmp` instead of `/dev/shm` (memory constraints) |
| `--disable-gpu` | Disable GPU acceleration (not available) |
| `--single-process` | Run in single-process mode (resource constrained) |
| `--no-zygote` | Disable zygote process (not supported in Proot) |

**Desktop User-Agent:**
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36
```

This User-Agent ensures that websites serve desktop versions rather than mobile-optimized pages, providing better compatibility with web automation tasks.

**Files Created:**
- `src/browser/service.ts` - New browser service with Android optimizations

---

#### 3. Web Search Logic (API-Free Stack)

**Problem:** The original OpenClaw relies on paid APIs (Brave Search, Perplexity, Grok, etc.) for web search functionality, which requires API keys and incurs costs.

**Solution:** Complete rewrite of `src/agents/tools/web-search.ts` to use a decentralized, API-free search pipeline:

**Architecture:**

```
User Query
    ↓
SearXNG Instance Pool (searx.be, searx.dresden.network, etc.)
    ↓
JSON Search Results
    ↓
Jina Reader (https://r.jina.ai/{URL})
    ↓
Clean Markdown Content
    ↓
First 5000 Characters
    ↓
LLM Response
```

**SearXNG Instances Used:**
- `https://searx.be`
- `https://searx.dresden.network`
- `https://search.sapti.me`
- `https://searx.tiekoetter.com`
- `https://searx.fmac.xyz`
- `https://searx.nixnet.services`
- `https://searx.prvcy.eu`
- `https://search.bus-hit.me`

**Features:**
- **Instance Cycling:** Automatically cycles through multiple SearXNG instances for load distribution and failover
- **Content Extraction:** Uses Jina AI's free Reader API to extract clean Markdown from web pages
- **No API Keys:** Completely free, no registration or API keys required
- **Privacy-Respecting:** SearXNG is a privacy-focused metasearch engine

**Files Modified:**
- `src/agents/tools/web-search.ts` - Complete rewrite with SearXNG + Jina pipeline

---

#### 4. Resource Management Configuration

**Problem:** Mobile devices have limited memory (typically 512MB-4GB available to Termux) and CPU resources compared to desktop servers.

**Solution:** New `config.mobile.toml` with mobile-optimized defaults:

```toml
[resources]
memoryLimitMB = 512
concurrency = 1
maxBrowserSessions = 1
maxSearchConcurrency = 2

[browser]
headless = true
executablePath = "/usr/bin/chromium"

[tools.web.search]
maxResults = 5
timeoutSeconds = 30
fetchContent = true
```

**Key Settings:**

| Setting | Value | Rationale |
|---------|-------|-----------|
| `memoryLimitMB` | 512 | Prevents OOM kills on low-RAM devices |
| `concurrency` | 1 | Single-threaded for battery efficiency |
| `maxBrowserSessions` | 1 | Limits memory usage from browser |
| `maxSearchConcurrency` | 2 | Balances speed with resource usage |
| `headless` | true | Required for Termux (no display) |

**Files Created:**
- `config.mobile.toml` - Mobile-optimized configuration template

---

### Automation Scripts

#### `termux/install.sh`

Comprehensive installation script that:
- Detects Termux/Proot environment
- Updates package lists
- Installs Node.js, Git, Python, build-essential
- Installs Chromium browser
- Configures npm for mobile environment
- Sets up environment variables
- Builds the project

**Usage:**
```bash
./termux/install.sh
```

---

#### `termux/chromium-setup.sh`

Chromium configuration script that:
- Detects system Chromium installation
- Sets `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
- Configures `PUPPETEER_EXECUTABLE_PATH`
- Creates `.puppeteerrc.cjs` configuration
- Verifies required libraries
- Creates a wrapper script with required flags

**Usage:**
```bash
./termux/chromium-setup.sh
```

---

#### `termux/start.sh`

Simple launcher script that:
- Checks environment (Node.js, Termux, Proot)
- Sets up configuration
- Verifies Chromium
- Configures memory limits
- Starts the gateway server

**Usage:**
```bash
./termux/start.sh [options]

Options:
  -p, --port PORT     Gateway port (default: 18789)
  -h, --host HOST     Gateway host (default: 127.0.0.1)
  -c, --config FILE   Config file path
  -v, --verbose       Enable verbose logging
  --help              Show help
```

---

### Documentation

#### README.md Updates

Added "Termux Quick Start" section with:
- Prerequisites (Termux, Proot, storage)
- Installation commands
- Proot setup instructions
- Configuration guide
- Troubleshooting tips

---

### Compatibility

#### Tested Environments

| Environment | Status | Notes |
|-------------|--------|-------|
| Termux (F-Droid) | ✅ Supported | Recommended |
| Termux (Play Store) | ⚠️ Limited | Deprecated, use F-Droid |
| Proot-Distro (Ubuntu) | ✅ Supported | Primary target |
| Proot-Distro (Debian) | ✅ Supported | Fully compatible |
| Proot-Distro (Alpine) | ⚠️ Partial | May require manual setup |

#### Device Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Android Version | 8.0 (API 26) | 10+ (API 29+) |
| RAM | 2GB | 4GB+ |
| Storage | 1GB free | 2GB+ free |
| Architecture | ARM64 | ARM64 |

---

### Known Issues

1. **Chromium GPU Acceleration**
   - GPU acceleration is disabled due to Termux limitations
   - Impact: Slower page rendering, higher CPU usage
   - Workaround: Use `--single-process` mode

2. **Network Interface Detection**
   - Proot restricts `/proc/net/dev` access
   - Impact: Some network monitoring features may not work
   - Workaround: Error 13 patch applied

3. **Memory Constraints**
   - 512MB heap limit may cause issues with large pages
   - Impact: Potential OOM on complex sites
   - Workaround: Reduce concurrency, enable swap

---

### Future Enhancements

- [ ] Battery-aware scheduling
- [ ] Network type detection (WiFi/Mobile)
- [ ] Background execution support
- [ ] Notification integration
- [ ] Widget for quick actions

---

### Credits

- **OpenClaw:** Original project by Peter Steinberger and contributors
- **SearXNG:** Privacy-respecting metasearch engine
- **Jina AI:** Free content extraction service
- **Termux:** Android terminal emulator and Linux environment

---

### License

This fork maintains the same license as the original OpenClaw project.
