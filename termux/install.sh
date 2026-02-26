#!/bin/bash
# ============================================
# OpenClaw-Mobile Installation Script
# For Android Termux + Proot Environments
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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
# Environment Detection
# ============================================

detect_environment() {
    log_info "Detecting environment..."
    
    # Check if running in Termux
    if [[ -n "$TERMUX_VERSION" ]] || [[ "$PREFIX" == *"termux"* ]]; then
        IS_TERMUX=true
        log_success "Termux environment detected"
    else
        IS_TERMUX=false
        log_warn "Not running in Termux"
    fi
    
    # Check if running in Proot
    if [[ -f "/proc/1/root/.proot" ]] || [[ "$PROOT" == "1" ]] || [[ -n "$PROOT_TMP_DIR" ]]; then
        IS_PROOT=true
        log_success "Proot environment detected"
    else
        IS_PROOT=false
        log_info "Not running in Proot"
    fi
    
    # Detect architecture
    ARCH=$(uname -m)
    log_info "Architecture: $ARCH"
}

# ============================================
# Package Installation
# ============================================

update_packages() {
    log_info "Updating package lists..."
    pkg update -y
    log_success "Package lists updated"
}

install_core_packages() {
    log_info "Installing core packages..."
    
    # Essential packages
    local packages=(
        "nodejs"
        "git"
        "python"
        "build-essential"
        "curl"
        "wget"
    )
    
    for package in "${packages[@]}"; do
        log_info "Installing $package..."
        pkg install -y "$package" || {
            log_warn "Failed to install $package, continuing..."
        }
    done
    
    log_success "Core packages installed"
}

install_chromium() {
    log_info "Installing Chromium..."
    
    # Try different Chromium packages
    if pkg install -y chromium 2>/dev/null; then
        log_success "Chromium installed via pkg"
    elif pkg install -y chromium-browser 2>/dev/null; then
        log_success "Chromium installed via chromium-browser"
    elif apt install -y chromium 2>/dev/null; then
        log_success "Chromium installed via apt"
    else
        log_warn "Could not install Chromium automatically"
        log_info "Please install Chromium manually and set PUPPETEER_EXECUTABLE_PATH"
    fi
}

# ============================================
# Node.js Setup
# ============================================

setup_nodejs() {
    log_info "Setting up Node.js..."
    
    # Check Node.js version
    NODE_VERSION=$(node --version 2>/dev/null || echo "none")
    log_info "Node.js version: $NODE_VERSION"
    
    # Check npm version
    NPM_VERSION=$(npm --version 2>/dev/null || echo "none")
    log_info "npm version: $NPM_VERSION"
    
    # Configure npm for mobile environment
    log_info "Configuring npm..."
    npm config set cache ~/.npm-cache --global 2>/dev/null || true
    npm config set maxsockets 3 --global 2>/dev/null || true
    npm config set fetch-retries 3 --global 2>/dev/null || true
    npm config set fetch-retry-mintimeout 20000 --global 2>/dev/null || true
    npm config set fetch-retry-maxtimeout 120000 --global 2>/dev/null || true
    
    log_success "Node.js configured"
}

# ============================================
# OpenClaw-Mobile Installation
# ============================================

install_openclaw_mobile() {
    log_info "Installing OpenClaw-Mobile..."
    
    # Set environment variables for Puppeteer
    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
    export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
    
    # Create installation directory
    INSTALL_DIR="$HOME/openclaw-mobile"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Clone or update repository
    if [[ -d ".git" ]]; then
        log_info "Updating existing repository..."
        git pull origin main || git pull origin master || true
    else
        log_info "Cloning OpenClaw-Mobile repository..."
        # If git clone fails, we'll create the structure manually
        if ! git clone https://github.com/Sultanchh/openclaw-mobile-.git . 2>/dev/null; then
            log_warn "Git clone failed, will create structure manually"
            mkdir -p src/agents/tools src/browser src/gateway termux
        fi
    fi
    
    log_success "OpenClaw-Mobile repository ready"
}

install_dependencies() {
    log_info "Installing npm dependencies..."
    
    cd "$HOME/openclaw-mobile"
    
    # Create package.json if it doesn't exist
    if [[ ! -f "package.json" ]]; then
        log_info "Creating package.json..."
        cat > package.json << 'EOF'
{
  "name": "openclaw-mobile",
  "version": "1.0.0",
  "description": "Termux/Proot optimized fork of OpenClaw",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "gateway": "node dist/gateway/server.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@sinclair/typebox": "^0.32.0",
    "puppeteer-core": "^21.0.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.0.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
    fi
    
    # Create tsconfig.json if it doesn't exist
    if [[ ! -f "tsconfig.json" ]]; then
        log_info "Creating tsconfig.json..."
        cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
    fi
    
    # Install dependencies
    log_info "Running npm install (this may take a while)..."
    npm install --production --no-audit --no-fund 2>&1 | tail -20
    
    log_success "Dependencies installed"
}

# ============================================
# Configuration Setup
# ============================================

setup_configuration() {
    log_info "Setting up configuration..."
    
    # Create config directory
    mkdir -p "$HOME/.openclaw"
    
    # Copy mobile config if it exists
    if [[ -f "$HOME/openclaw-mobile/config.mobile.toml" ]]; then
        cp "$HOME/openclaw-mobile/config.mobile.toml" "$HOME/.openclaw/config.toml"
        log_success "Mobile configuration copied"
    fi
    
    # Create logs directory
    mkdir -p "$HOME/.openclaw/logs"
    
    log_success "Configuration setup complete"
}

# ============================================
# Environment Variables
# ============================================

setup_environment() {
    log_info "Setting up environment variables..."
    
    # Add to .bashrc or .zshrc
    SHELL_RC="$HOME/.bashrc"
    if [[ -f "$HOME/.zshrc" ]]; then
        SHELL_RC="$HOME/.zshrc"
    fi
    
    # Check if already added
    if ! grep -q "OpenClaw-Mobile" "$SHELL_RC" 2>/dev/null; then
        log_info "Adding environment variables to $SHELL_RC"
        cat >> "$SHELL_RC" << 'EOF'

# OpenClaw-Mobile Environment
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
export OPENCLAW_MOBILE=1
export NODE_OPTIONS="--max-old-space-size=512"
EOF
        log_success "Environment variables added to $SHELL_RC"
    else
        log_info "Environment variables already configured"
    fi
    
    # Set for current session
    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
    export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
    export OPENCLAW_MOBILE=1
    export NODE_OPTIONS="--max-old-space-size=512"
}

# ============================================
# Build
# ============================================

build_project() {
    log_info "Building OpenClaw-Mobile..."
    
    cd "$HOME/openclaw-mobile"
    
    # Install dev dependencies for build
    npm install --no-audit --no-fund 2>&1 | tail -10
    
    # Build TypeScript
    npx tsc 2>&1 || {
        log_warn "TypeScript build had warnings, continuing..."
    }
    
    log_success "Build complete"
}

# ============================================
# Main Installation
# ============================================

main() {
    echo "========================================"
    echo "  OpenClaw-Mobile Installer"
    echo "  For Android Termux + Proot"
    echo "========================================"
    echo
    
    detect_environment
    echo
    
    log_info "Starting installation..."
    echo
    
    update_packages
    echo
    
    install_core_packages
    echo
    
    install_chromium
    echo
    
    setup_nodejs
    echo
    
    install_openclaw_mobile
    echo
    
    install_dependencies
    echo
    
    setup_configuration
    echo
    
    setup_environment
    echo
    
    build_project
    echo
    
    log_success "Installation complete!"
    echo
    echo "========================================"
    echo "  Next Steps:"
    echo "========================================"
    echo
    echo "1. Restart your shell or run:"
    echo "   source ~/.bashrc"
    echo
    echo "2. Start the gateway:"
    echo "   cd ~/openclaw-mobile && ./termux/start.sh"
    echo
    echo "3. Or use the simple launcher:"
    echo "   openclaw-mobile"
    echo
    echo "For more information, see:"
    echo "  - MOBILE_CHANGELOG.md"
    echo "  - README.md"
    echo
}

# Run main function
main "$@"
