---
title: Installation
description: Install Feynman on macOS, Linux, or Windows using curl, pnpm, or bun.
section: Getting Started
order: 1
---

Feynman ships as a standalone runtime bundle for macOS, Linux, and Windows, and as a package-manager install for environments where Node.js is already installed. The recommended approach is the one-line installer, which downloads a prebuilt native bundle with zero external runtime dependencies.

## One-line installer (recommended)

On **macOS or Linux**, open a terminal and run:

```bash
curl -fsSL https://feynman.is/install | bash
```

The installer detects your OS and architecture automatically. On macOS it supports both Intel and Apple Silicon. On Linux it supports x64 and arm64. The launcher is installed to `~/.local/bin`, the bundled runtime is unpacked into `~/.local/share/feynman`, and your `PATH` is updated when needed.

By default, the one-line installer tracks the rolling `edge` channel from `main`.

On **Windows**, open PowerShell as Administrator and run:

```powershell
irm https://feynman.is/install.ps1 | iex
```

This installs the Windows runtime bundle under `%LOCALAPPDATA%\Programs\feynman`, adds its launcher to your user `PATH`, and lets you re-run the installer at any time to update.

## Stable or pinned releases

If you want the latest tagged release instead of the rolling `edge` channel:

```bash
curl -fsSL https://feynman.is/install | bash -s -- stable
```

On Windows:

```powershell
& ([scriptblock]::Create((irm https://feynman.is/install.ps1))) -Version stable
```

You can also pin an exact version by replacing `stable` with a version such as `0.2.14`.

## pnpm

If you already have Node.js 20.18.1+ installed, you can install Feynman globally via `pnpm`:

```bash
pnpm add -g @companion-ai/feynman
```

Or run it directly without installing:

```bash
pnpm dlx @companion-ai/feynman
```

## bun

```bash
bun add -g @companion-ai/feynman
```

Or run it directly without installing:

```bash
bunx @companion-ai/feynman
```

Both package-manager distributions ship the same core application but depend on Node.js being present on your system. The standalone installer is preferred because it bundles its own Node runtime and works without a separate Node installation.

## Post-install setup

After installation, run the guided setup wizard to configure your model provider and API keys:

```bash
feynman setup
```

This walks you through selecting a default model, authenticating with your provider, and optionally installing extra packages for features like web search and document preview. See the [Setup guide](/docs/getting-started/setup) for a detailed walkthrough.

## Verifying the installation

Confirm Feynman is installed and accessible:

```bash
feynman --version
```

If you see a version number, you are ready to go. Run `feynman doctor` at any time to diagnose configuration issues, missing dependencies, or authentication problems.

## Local development

For contributing or running Feynman from source:

```bash
git clone https://github.com/getcompanion-ai/feynman.git
cd feynman
pnpm install
pnpm start
```
