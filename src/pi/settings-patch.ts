import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function patchFile(path: string, patches: Array<{ search: string; replace: string; guard?: string }>): boolean {
	if (!existsSync(path)) {
		return false;
	}
	let source = readFileSync(path, "utf8");
	let changed = false;
	for (const { search, replace, guard } of patches) {
		if (guard && source.includes(guard)) {
			continue;
		}
		if (source.includes(search)) {
			source = source.replace(search, replace);
			changed = true;
		}
	}
	if (changed) {
		writeFileSync(path, source, "utf8");
	}
	return changed;
}

export function patchPiSettingsShowLogo(appRoot: string): boolean {
	const codingAgentDir = resolve(appRoot, "node_modules", "@mariozechner", "pi-coding-agent", "dist");

	const settingsManagerPath = resolve(codingAgentDir, "core", "settings-manager.js");
	const interactiveModePath = resolve(codingAgentDir, "modes", "interactive", "interactive-mode.js");
	const settingsSelectorPath = resolve(codingAgentDir, "modes", "interactive", "components", "settings-selector.js");

	let changed = false;

	// 1. Patch SettingsManager: add getShowLogo / setShowLogo
	changed = patchFile(settingsManagerPath, [
		{
			search: `    setCollapseChangelog(collapse) {
        this.globalSettings.collapseChangelog = collapse;
        this.markModified("collapseChangelog");
        this.save();
    }`,
			replace: `    setCollapseChangelog(collapse) {
        this.globalSettings.collapseChangelog = collapse;
        this.markModified("collapseChangelog");
        this.save();
    }
    getShowLogo() {
        return this.settings.showLogo ?? true;
    }
    setShowLogo(show) {
        this.globalSettings.showLogo = show;
        this.markModified("showLogo");
        this.save();
    }`,
			guard: "getShowLogo()",
		},
	]) || changed;

	// 2. Patch interactive-mode: wire showLogo into showSettingsSelector
	changed = patchFile(interactiveModePath, [
		{
			search: `                quietStartup: this.settingsManager.getQuietStartup(),
                clearOnShrink: this.settingsManager.getClearOnShrink(),`,
			replace: `                quietStartup: this.settingsManager.getQuietStartup(),
                showLogo: this.settingsManager.getShowLogo(),
                clearOnShrink: this.settingsManager.getClearOnShrink(),`,
			guard: "showLogo: this.settingsManager.getShowLogo()",
		},
		{
			search: `                onQuietStartupChange: (enabled) => {
                    this.settingsManager.setQuietStartup(enabled);
                },
                onDoubleEscapeActionChange: (action) => {`,
			replace: `                onQuietStartupChange: (enabled) => {
                    this.settingsManager.setQuietStartup(enabled);
                },
                onShowLogoChange: (enabled) => {
                    this.settingsManager.setShowLogo(enabled);
                },
                onDoubleEscapeActionChange: (action) => {`,
			guard: "onShowLogoChange",
		},
	]) || changed;

	// 3. Patch settings-selector: add show-logo toggle
	changed = patchFile(settingsSelectorPath, [
		{
			search: `            {
                id: "quiet-startup",
                label: "Quiet startup",
                description: "Disable verbose printing at startup",
                currentValue: config.quietStartup ? "true" : "false",
                values: ["true", "false"],
            },`,
			replace: `            {
                id: "quiet-startup",
                label: "Quiet startup",
                description: "Disable verbose printing at startup",
                currentValue: config.quietStartup ? "true" : "false",
                values: ["true", "false"],
            },
            {
                id: "show-logo",
                label: "Show logo",
                description: "Show ASCII logo in feynman help output",
                currentValue: config.showLogo ? "true" : "false",
                values: ["true", "false"],
            },`,
			guard: `"show-logo"`,
		},
		{
			search: `                case "quiet-startup":
                    callbacks.onQuietStartupChange(newValue === "true");
                    break;
                case "install-telemetry":
                    callbacks.onEnableInstallTelemetryChange(newValue === "true");
                    break;
                case "double-escape-action":`,
			replace: `                case "quiet-startup":
                    callbacks.onQuietStartupChange(newValue === "true");
                    break;
                case "show-logo":
                    callbacks.onShowLogoChange(newValue === "true");
                    break;
                case "install-telemetry":
                    callbacks.onEnableInstallTelemetryChange(newValue === "true");
                    break;
                case "double-escape-action":`,
			guard: `case "show-logo":`,
		},
	]) || changed;

	return changed;
}
