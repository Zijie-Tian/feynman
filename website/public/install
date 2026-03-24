#!/bin/sh

set -eu

VERSION="${1:-latest}"
INSTALL_BIN_DIR="${FEYNMAN_INSTALL_BIN_DIR:-$HOME/.local/bin}"
INSTALL_APP_DIR="${FEYNMAN_INSTALL_APP_DIR:-$HOME/.local/share/feynman}"
SKIP_PATH_UPDATE="${FEYNMAN_INSTALL_SKIP_PATH_UPDATE:-0}"
path_action="already"
path_profile=""

step() {
  printf '==> %s\n' "$1"
}

normalize_version() {
  case "$1" in
    "" | latest)
      printf 'latest\n'
      ;;
    v*)
      printf '%s\n' "${1#v}"
      ;;
    *)
      printf '%s\n' "$1"
      ;;
  esac
}

download_file() {
  url="$1"
  output="$2"

  if command -v curl >/dev/null 2>&1; then
    if [ -t 2 ]; then
      curl -fL --progress-bar "$url" -o "$output"
    else
      curl -fsSL "$url" -o "$output"
    fi
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    if [ -t 2 ]; then
      wget --show-progress -O "$output" "$url"
    else
      wget -q -O "$output" "$url"
    fi
    return
  fi

  echo "curl or wget is required to install Feynman." >&2
  exit 1
}

download_text() {
  url="$1"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -q -O - "$url"
    return
  fi

  echo "curl or wget is required to install Feynman." >&2
  exit 1
}

add_to_path() {
  path_action="already"
  path_profile=""

  case ":$PATH:" in
    *":$INSTALL_BIN_DIR:"*)
      return
      ;;
  esac

  if [ "$SKIP_PATH_UPDATE" = "1" ]; then
    path_action="skipped"
    return
  fi

  profile="${FEYNMAN_INSTALL_SHELL_PROFILE:-$HOME/.profile}"
  if [ -z "${FEYNMAN_INSTALL_SHELL_PROFILE:-}" ]; then
    case "${SHELL:-}" in
      */zsh)
        profile="$HOME/.zshrc"
        ;;
      */bash)
        profile="$HOME/.bashrc"
        ;;
    esac
  fi

  path_profile="$profile"
  path_line="export PATH=\"$INSTALL_BIN_DIR:\$PATH\""
  if [ -f "$profile" ] && grep -F "$path_line" "$profile" >/dev/null 2>&1; then
    path_action="configured"
    return
  fi

  {
    printf '\n# Added by Feynman installer\n'
    printf '%s\n' "$path_line"
  } >>"$profile"
  path_action="added"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required to install Feynman." >&2
    exit 1
  fi
}

resolve_version() {
  normalized_version="$(normalize_version "$VERSION")"

  if [ "$normalized_version" != "latest" ]; then
    printf '%s\n' "$normalized_version"
    return
  fi

  release_json="$(download_text "https://api.github.com/repos/getcompanion-ai/feynman/releases/latest")"
  resolved="$(printf '%s\n' "$release_json" | sed -n 's/.*"tag_name":[[:space:]]*"v\([^"]*\)".*/\1/p' | head -n 1)"

  if [ -z "$resolved" ]; then
    echo "Failed to resolve the latest Feynman release version." >&2
    exit 1
  fi

  printf '%s\n' "$resolved"
}

case "$(uname -s)" in
  Darwin)
    os="darwin"
    ;;
  Linux)
    os="linux"
    ;;
  *)
    echo "install.sh supports macOS and Linux. Use install.ps1 on Windows." >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64 | amd64)
    arch="x64"
    ;;
  arm64 | aarch64)
    arch="arm64"
    ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

require_command mktemp
require_command tar

resolved_version="$(resolve_version)"
asset_target="$os-$arch"
bundle_name="feynman-${resolved_version}-${asset_target}"
archive_name="${bundle_name}.tar.gz"
base_url="${FEYNMAN_INSTALL_BASE_URL:-https://github.com/getcompanion-ai/feynman/releases/download/v${resolved_version}}"
download_url="${base_url}/${archive_name}"

step "Installing Feynman ${resolved_version} for ${asset_target}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

archive_path="$tmp_dir/$archive_name"
step "Downloading ${archive_name}"
download_file "$download_url" "$archive_path"

mkdir -p "$INSTALL_APP_DIR"
rm -rf "$INSTALL_APP_DIR/$bundle_name"
step "Extracting ${archive_name}"
tar -xzf "$archive_path" -C "$INSTALL_APP_DIR"

mkdir -p "$INSTALL_BIN_DIR"
step "Linking feynman into $INSTALL_BIN_DIR"
cat >"$INSTALL_BIN_DIR/feynman" <<EOF
#!/bin/sh
set -eu
exec "$INSTALL_APP_DIR/$bundle_name/feynman" "\$@"
EOF
chmod 0755 "$INSTALL_BIN_DIR/feynman"

add_to_path

case "$path_action" in
  added)
    step "PATH updated for future shells in $path_profile"
    step "Run now: export PATH=\"$INSTALL_BIN_DIR:\$PATH\" && feynman"
    ;;
  configured)
    step "PATH is already configured for future shells in $path_profile"
    step "Run now: export PATH=\"$INSTALL_BIN_DIR:\$PATH\" && feynman"
    ;;
  skipped)
    step "PATH update skipped"
    step "Run now: export PATH=\"$INSTALL_BIN_DIR:\$PATH\" && feynman"
    ;;
  *)
    step "$INSTALL_BIN_DIR is already on PATH"
    step "Run: feynman"
    ;;
esac

printf 'Feynman %s installed successfully.\n' "$resolved_version"
