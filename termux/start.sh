#!/bin/bash
# ============================================
# OpenClaw-Mobile Launcher Script
# Simple startup script for Termux/Proot
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_banner() {
    echo -e "${CYAN}$1${NC}"
}

# ============================================
# Configuration
# ============================================

# Default configuration
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
GATEWAY_HOST="${GATEWAY_HOST:-127.0.0.1}"
CONFIG_FILE="${CONFIG_FILE:-$HOME/.openclaw/config.toml}"
MOBILE_CONFIG="${MOBILE_CONFIG:-config.mobile.toml}"

# Installation directory
INSTALL_DIR="${INSTALL_DIR:-$HOME/openclaw-mobile}"

# ============================================
# Environment Checks
# ============================================

check_environment() {
    log_info "Checking environment..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed!"
        log_info "Please run: pkg install nodejs"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log_info "Node.js: $NODE_VERSION"
    
    # Check if running in Termux
    if [[ -n "$TERMUX_VERSION" ]] || [[ "$PREFIX" == *"termux"* ]]; then
        log_info "Environment: Termux"
        IS_TERMUX=true
    else
        IS_TERMUX=false
    fi
    
    # Check if running in Proot
    if [[ -f "/proc/1/root/.proot" ]] || [[ "$PROOT" == "1" ]]; then
        log_info "Environment: Proot"
        IS_PROOT=true
    else
        IS_PROOT=false
    fi
    
    # Apply Proot patches if needed
    if [[ "$IS_PROOT" == "true" ]] && [[ -z "$OPENCLAW_NETWORK_PATCHED" ]]; then
        log_info "Applying Proot network patches..."
        export OPENCLAW_NETWORK_PATCHED=1
    fi
}

# ============================================
# Configuration Setup
# ============================================

setup_config() {
    log_info "Setting up configuration..."
    
    # Create config directory
    mkdir -p "$HOME/.openclaw"
    mkdir -p "$HOME/.openclaw/logs"
    
    # Use mobile config if no config exists
    if [[ ! -f "$CONFIG_FILE" ]]; then
        if [[ -f "$INSTALL_DIR/$MOBILE_CONFIG" ]]; then
            log_info "Using mobile configuration..."
            cp "$INSTALL_DIR/$MOBILE_CONFIG" "$CONFIG_FILE"
        elif [[ -f "$INSTALL_DIR/config.mobile.toml" ]]; then
            log_info "Using mobile configuration..."
            cp "$INSTALL_DIR/config.mobile.toml" "$CONFIG_FILE"
        fi
    fi
    
    # Export config path
    export OPENCLAW_CONFIG="$CONFIG_FILE"
}

# ============================================
# Chromium Verification
# ============================================

verify_chromium() {
    log_info "Verifying Chromium..."
    
    # Check environment variable
    if [[ -z "$PUPPETEER_EXECUTABLE_PATH" ]]; then
        log_warn "PUPPETEER_EXECUTABLE_PATH not set!"
        
        # Try to find Chromium
        if [[ -x "/usr/bin/chromium" ]]; then
            export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
        elif [[ -x "/usr/bin/chromium-browser" ]]; then
            export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
        elif command -v chromium &> /dev/null; then
            export PUPPETEER_EXECUTABLE_PATH=$(command -v chromium)
        else
            log_error "Chromium not found!"
            log_info "Please run: ./termux/chromium-setup.sh"
            exit 1
        fi
        
        log_success "Auto-detected Chromium: $PUPPETEER_EXECUTABLE_PATH"
    fi
    
    # Verify executable exists
    if [[ ! -x "$PUPPETEER_EXECUTABLE_PATH" ]]; then
        log_error "Chromium not found at: $PUPPETEER_EXECUTABLE_PATH"
        log_info "Please run: ./termux/chromium-setup.sh"
        exit 1
    fi
    
    log_success "Chromium: $PUPPETEER_EXECUTABLE_PATH"
}

# ============================================
# Memory Management
# ============================================

setup_memory() {
    log_info "Configuring memory limits..."
    
    # Set Node.js memory limit (512MB for mobile devices)
    export NODE_OPTIONS="--max-old-space-size=512"
    
    # Reduce memory pressure
    export UV_THREADPOOL_SIZE=4
    
    log_success "Memory limit: 512MB"
}

# ============================================
# Build Check
# ============================================

check_build() {
    log_info "Checking build..."
    
    cd "$INSTALL_DIR"
    
    # Check if dist exists
    if [[ ! -d "dist" ]] || [[ ! -f "dist/index.js" ]]; then
        log_warn "Build not found, attempting to build..."
        
        # Check for TypeScript
        if [[ ! -f "node_modules/.bin/tsc" ]]; then
            log_info "Installing dependencies..."
            npm install --no-audit --no-fund 2>&1 | tail -10
        fi
        
        # Build
        log_info "Building project..."
        npx tsc 2>&1 || {
            log_warn "Build had warnings, continuing..."
        }
    fi
    
    if [[ -f "dist/index.js" ]]; then
        log_success "Build verified"
    else
        log_warn "Build may be incomplete"
    fi
}

# ============================================
# Start Gateway
# ============================================

start_gateway() {
    log_banner "
╔══════════════════════════════════════════╗
║                                          ║
║       OpenClaw-Mobile Gateway            ║
║       Termux/Proot Edition               ║
║                                          ║
╚══════════════════════════════════════════╝
"
    
    log_info "Starting OpenClaw-Mobile Gateway..."
    log_info "Host: $GATEWAY_HOST"
    log_info "Port: $GATEWAY_PORT"
    log_info "Config: $CONFIG_FILE"
    
    echo
    log_info "Press Ctrl+C to stop"
    echo
    
    cd "$INSTALL_DIR"
    
    # Start the gateway
    exec node dist/gateway/server.js
}

# ============================================
# Signal Handlers
# ============================================

cleanup() {
    echo
    log_info "Shutting down..."
    # Cleanup is handled by Node.js process
    exit 0
}

trap cleanup INT TERM

# ============================================
# Main
# ============================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --port|-p)
                GATEWAY_PORT="$2"
                shift 2
                ;;
            --host|-h)
                GATEWAY_HOST="$2"
                shift 2
                ;;
            --config|-c)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --verbose|-v)
                export GATEWAY_VERBOSE=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo
                echo "Options:"
                echo "  -p, --port PORT       Gateway port (default: 18789)"
                echo "  -h, --host HOST       Gateway host (default: 127.0.0.1)"
                echo "  -c, --config FILE     Config file path"
                echo "  -v, --verbose         Enable verbose logging"
                echo "  --help                Show this help"
                echo
                exit 0
                ;;
            *)
                log_warn "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    check_environment
    echo
    
    setup_config
    echo
    
    verify_chromium
    echo
    
    setup_memory
    echo
    
    check_build
    echo
    
    start_gateway
}

main "$@"
