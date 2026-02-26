#!/bin/bash
# ============================================
# OpenClaw-Mobile Chromium Setup Script
# Configures Puppeteer to use system Chromium
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================
# Chromium Detection
# ============================================

detect_chromium() {
    log_info "Detecting Chromium installation..."
    
    # Common Chromium paths
    local paths=(
        "/usr/bin/chromium"
        "/usr/bin/chromium-browser"
        "/usr/bin/google-chrome"
        "/usr/bin/google-chrome-stable"
        "/data/data/com.termux/files/usr/bin/chromium"
        "/data/data/com.termux/files/usr/bin/chromium-browser"
        "/usr/local/bin/chromium"
        "/snap/bin/chromium"
    )
    
    for path in "${paths[@]}"; do
        if [[ -x "$path" ]]; then
            CHROMIUM_PATH="$path"
            log_success "Found Chromium at: $path"
            return 0
        fi
    done
    
    # Try which command
    if command -v chromium &> /dev/null; then
        CHROMIUM_PATH=$(command -v chromium)
        log_success "Found Chromium at: $CHROMIUM_PATH"
        return 0
    fi
    
    if command -v chromium-browser &> /dev/null; then
        CHROMIUM_PATH=$(command -v chromium-browser)
        log_success "Found Chromium at: $CHROMIUM_PATH"
        return 0
    fi
    
    if command -v google-chrome &> /dev/null; then
        CHROMIUM_PATH=$(command -v google-chrome)
        log_success "Found Chrome at: $CHROMIUM_PATH"
        return 0
    fi
    
    log_error "Chromium not found!"
    log_info "Please install Chromium:"
    log_info "  pkg install chromium"
    log_info "  or"
    log_info "  apt install chromium-browser"
    return 1
}

# ============================================
# Environment Setup
# ============================================

setup_environment() {
    log_info "Setting up environment variables..."
    
    # Determine shell config file
    SHELL_RC="$HOME/.bashrc"
    if [[ -n "$ZSH_VERSION" ]] || [[ -f "$HOME/.zshrc" ]]; then
        SHELL_RC="$HOME/.zshrc"
    fi
    
    log_info "Using shell config: $SHELL_RC"
    
    # Remove old entries
    if [[ -f "$SHELL_RC" ]]; then
        sed -i '/PUPPETEER_SKIP_CHROMIUM_DOWNLOAD/d' "$SHELL_RC" 2>/dev/null || true
        sed -i '/PUPPETEER_EXECUTABLE_PATH/d' "$SHELL_RC" 2>/dev/null || true
        sed -i '/OPENCLAW_MOBILE/d' "$SHELL_RC" 2>/dev/null || true
    fi
    
    # Add new entries
    cat >> "$SHELL_RC" << EOF

# OpenClaw-Mobile Chromium Configuration
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH="$CHROMIUM_PATH"
export OPENCLAW_MOBILE=1
export NODE_OPTIONS="--max-old-space-size=512"
EOF
    
    log_success "Environment variables configured"
}

# ============================================
# Puppeteer Configuration
# ============================================

setup_puppeteer_config() {
    log_info "Creating Puppeteer configuration..."
    
    # Create .puppeteerrc.cjs
    cat > "$HOME/.puppeteerrc.cjs" << EOF
/**
 * Puppeteer Configuration for OpenClaw-Mobile
 * Uses system Chromium instead of bundled Chrome
 */

const { join } = require('path');

/**
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  // Skip Chromium download - use system Chromium
  skipDownload: true,
  
  // Path to system Chromium
  executablePath: '$CHROMIUM_PATH',
  
  // Cache directory
  cacheDirectory: join('$HOME', '.cache', 'puppeteer'),
};
EOF
    
    log_success "Puppeteer config created at ~/.puppeteerrc.cjs"
}

# ============================================
# Verify Chromium
# ============================================

verify_chromium() {
    log_info "Verifying Chromium..."
    
    # Check if Chromium is executable
    if [[ -x "$CHROMIUM_PATH" ]]; then
        log_success "Chromium is executable"
    else
        log_warn "Chromium may not be executable"
        log_info "Attempting to fix permissions..."
        chmod +x "$CHROMIUM_PATH" 2>/dev/null || true
    fi
    
    # Try to get version
    log_info "Chromium version:"
    "$CHROMIUM_PATH" --version 2>/dev/null || log_warn "Could not get Chromium version"
    
    # Check for required libraries (Proot only)
    if [[ "$IS_PROOT" == "true" ]] || [[ -f "/proc/1/root/.proot" ]]; then
        log_info "Proot environment detected - checking libraries..."
        
        # Check for common missing libraries
        local required_libs=(
            "libnss3.so"
            "libatk-1.0.so"
            "libatk-bridge-2.0.so"
            "libcups.so"
            "libdrm.so"
            "libxkbcommon.so"
            "libXcomposite.so"
            "libXdamage.so"
            "libXrandr.so"
            "libgbm.so"
            "libpango-1.0.so"
            "libcairo.so"
            "libasound.so"
        )
        
        for lib in "${required_libs[@]}"; do
            if ldconfig -p | grep -q "$lib" 2>/dev/null; then
                log_info "  ✓ $lib found"
            else
                log_warn "  ✗ $lib may be missing"
            fi
        done
    fi
}

# ============================================
# Create Wrapper Script
# ============================================

create_wrapper() {
    log_info "Creating Chromium wrapper script..."
    
    WRAPPER_PATH="$HOME/.local/bin/chromium-wrapper"
    mkdir -p "$(dirname "$WRAPPER_PATH")"
    
    cat > "$WRAPPER_PATH" << 'EOF'
#!/bin/bash
# Chromium Wrapper for OpenClaw-Mobile
# Adds required flags for Termux/Proot compatibility

# Default flags for Android/Proot
FLAGS=(
    --no-sandbox
    --disable-setuid-sandbox
    --disable-dev-shm-usage
    --disable-gpu
    --single-process
    --no-zygote
    --disable-background-networking
    --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows
    --disable-breakpad
    --disable-client-side-phishing-detection
    --disable-component-update
    --disable-default-apps
    --disable-features=TranslateUI
    --disable-hang-monitor
    --disable-ipc-flooding-protection
    --disable-popup-blocking
    --disable-prompt-on-repost
    --disable-renderer-backgrounding
    --force-color-profile=srgb
    --metrics-recording-only
    --safebrowsing-disable-auto-update
    --enable-automation
    --password-store=basic
    --use-mock-keychain
)

# Add user-provided flags
exec "$PUPPETEER_EXECUTABLE_PATH" "${FLAGS[@]}" "$@"
EOF
    
    chmod +x "$WRAPPER_PATH"
    log_success "Wrapper script created at $WRAPPER_PATH"
}

# ============================================
# Main
# ============================================

main() {
    echo "========================================"
    echo "  OpenClaw-Mobile Chromium Setup"
    echo "========================================"
    echo
    
    detect_chromium
    echo
    
    setup_environment
    echo
    
    setup_puppeteer_config
    echo
    
    verify_chromium
    echo
    
    create_wrapper
    echo
    
    log_success "Chromium setup complete!"
    echo
    echo "========================================"
    echo "  Configuration Summary:"
    echo "========================================"
    echo
    echo "Chromium Path: $CHROMIUM_PATH"
    echo "Skip Download: true"
    echo
    echo "Environment variables have been added to your shell config."
    echo "Please restart your shell or run:"
    echo "  source ~/.bashrc"
    echo
    echo "To verify the setup, run:"
    echo "  echo \$PUPPETEER_EXECUTABLE_PATH"
    echo
}

main "$@"
