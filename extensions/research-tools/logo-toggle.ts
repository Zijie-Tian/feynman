import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function resolveFeynmanSettingsPath(): string {
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? process.env.FEYNMAN_CODING_AGENT_DIR;
	if (agentDir?.trim()) {
		return resolve(agentDir.trim(), "settings.json");
	}
	return resolve(homedir(), ".feynman", "agent", "settings.json");
}

function readSettings(): Record<string, unknown> {
	const path = resolveFeynmanSettingsPath();
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	} catch {
		return {};
	}
}

function writeSettings(settings: Record<string, unknown>): void {
	const path = resolveFeynmanSettingsPath();
	writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

export function registerLogoToggle(pi: ExtensionAPI): void {
	pi.registerCommand("feynman-logo", {
		description: "Toggle the ASCII logo in feynman help output.",
		handler: async (_args, ctx) => {
			const settings = readSettings();
			const current = settings.showLogo !== false;

			if (!ctx.hasUI) {
				const next = !current;
				settings.showLogo = next;
				writeSettings(settings);
				ctx.ui.notify(`showLogo set to ${next}. Run "/feynman-logo" to toggle back.`, "info");
				return;
			}

			const choice = await ctx.ui.select("Show ASCII logo in help output?", [
				current ? "on (current)" : "on",
				!current ? "off (current)" : "off",
			]);
			if (!choice) return;

			const next = choice === "on" || choice === "on (current)";
			settings.showLogo = next;
			writeSettings(settings);
			ctx.ui.notify(`showLogo set to ${next}.`, "info");
		},
	});
}
