import { AuthStorage } from "@mariozechner/pi-coding-agent";
import { writeFileSync } from "node:fs";

import { readJson } from "../pi/settings.js";
import { promptChoice, promptText } from "../setup/prompts.js";
import { openUrl } from "../system/open-url.js";
import { printInfo, printSection, printSuccess, printWarning } from "../ui/terminal.js";
import {
	buildModelStatusSnapshotFromRecords,
	chooseRecommendedModel,
	getAvailableModelRecords,
	getSupportedModelRecords,
	type ModelStatusSnapshot,
} from "./catalog.js";

function collectModelStatus(settingsPath: string, authPath: string): ModelStatusSnapshot {
	return buildModelStatusSnapshotFromRecords(
		getSupportedModelRecords(authPath),
		getAvailableModelRecords(authPath),
		getCurrentModelSpec(settingsPath),
	);
}

type OAuthProviderInfo = {
	id: string;
	name?: string;
	usesCallbackServer?: boolean;
};

function getOAuthProviders(authPath: string): OAuthProviderInfo[] {
	return AuthStorage.create(authPath).getOAuthProviders() as OAuthProviderInfo[];
}

function resolveOAuthProvider(authPath: string, input: string): OAuthProviderInfo | undefined {
	const normalizedInput = input.trim().toLowerCase();
	if (!normalizedInput) {
		return undefined;
	}
	return getOAuthProviders(authPath).find((provider) => provider.id.toLowerCase() === normalizedInput);
}

async function selectOAuthProvider(authPath: string, action: "login" | "logout"): Promise<OAuthProviderInfo | undefined> {
	const providers = getOAuthProviders(authPath);
	if (providers.length === 0) {
		printWarning("No Pi OAuth model providers are available.");
		return undefined;
	}
	if (providers.length === 1) {
		return providers[0];
	}

	const choices = providers.map((provider) => `${provider.id} — ${provider.name ?? provider.id}`);
	choices.push("Cancel");
	const selection = await promptChoice(`Choose an OAuth provider to ${action}:`, choices, 0);
	if (selection >= providers.length) {
		return undefined;
	}
	return providers[selection];
}

function resolveAvailableModelSpec(authPath: string, input: string): string | undefined {
	const normalizedInput = input.trim().toLowerCase();
	if (!normalizedInput) {
		return undefined;
	}

	const available = getAvailableModelRecords(authPath);
	const fullSpecMatch = available.find((model) => `${model.provider}/${model.id}`.toLowerCase() === normalizedInput);
	if (fullSpecMatch) {
		return `${fullSpecMatch.provider}/${fullSpecMatch.id}`;
	}

	const exactIdMatches = available.filter((model) => model.id.toLowerCase() === normalizedInput);
	if (exactIdMatches.length === 1) {
		return `${exactIdMatches[0]!.provider}/${exactIdMatches[0]!.id}`;
	}

	return undefined;
}

export function getCurrentModelSpec(settingsPath: string): string | undefined {
	const settings = readJson(settingsPath);
	if (typeof settings.defaultProvider === "string" && typeof settings.defaultModel === "string") {
		return `${settings.defaultProvider}/${settings.defaultModel}`;
	}
	return undefined;
}

export function printModelList(settingsPath: string, authPath: string): void {
	const status = collectModelStatus(settingsPath, authPath);
	if (status.availableModels.length === 0) {
		printWarning("No authenticated Pi models are currently available.");
		for (const line of status.guidance) {
			printInfo(line);
		}
		return;
	}

	let lastProvider: string | undefined;
	for (const spec of status.availableModels) {
		const [provider] = spec.split("/", 1);
		if (provider !== lastProvider) {
			lastProvider = provider;
			printSection(provider);
		}
		const markers = [
			spec === status.current ? "current" : undefined,
			spec === status.recommended ? "recommended" : undefined,
		].filter(Boolean);
		printInfo(`${spec}${markers.length > 0 ? ` (${markers.join(", ")})` : ""}`);
	}
}

export async function loginModelProvider(authPath: string, providerId?: string, settingsPath?: string): Promise<void> {
	const provider = providerId ? resolveOAuthProvider(authPath, providerId) : await selectOAuthProvider(authPath, "login");
	if (!provider) {
		if (providerId) {
			throw new Error(`Unknown OAuth model provider: ${providerId}`);
		}
		printInfo("Login cancelled.");
		return;
	}

	const authStorage = AuthStorage.create(authPath);
	const abortController = new AbortController();

	await authStorage.login(provider.id, {
		onAuth: (info: { url: string; instructions?: string }) => {
			printSection(`Login: ${provider.name ?? provider.id}`);
			const opened = openUrl(info.url);
			if (opened) {
				printInfo("Opened the login URL in your browser.");
			} else {
				printWarning("Couldn't open your browser automatically.");
			}
			printInfo(`Auth URL: ${info.url}`);
			if (info.instructions) {
				printInfo(info.instructions);
			}
		},
		onPrompt: async (prompt: { message: string; placeholder?: string }) => {
			return promptText(prompt.message, prompt.placeholder ?? "");
		},
		onProgress: (message: string) => {
			printInfo(message);
		},
		onManualCodeInput: async () => {
			return promptText("Paste redirect URL or auth code");
		},
		signal: abortController.signal,
	});

	printSuccess(`Model provider login complete: ${provider.id}`);

	if (settingsPath) {
		const currentSpec = getCurrentModelSpec(settingsPath);
		const available = getAvailableModelRecords(authPath);
		const currentValid = currentSpec
			? available.some((m) => `${m.provider}/${m.id}` === currentSpec)
			: false;

		if ((!currentSpec || !currentValid) && available.length > 0) {
			const recommended = chooseRecommendedModel(authPath);
			if (recommended) {
				setDefaultModelSpec(settingsPath, authPath, recommended.spec);
			}
		}
	}
}

export async function logoutModelProvider(authPath: string, providerId?: string): Promise<void> {
	const provider = providerId ? resolveOAuthProvider(authPath, providerId) : await selectOAuthProvider(authPath, "logout");
	if (!provider) {
		if (providerId) {
			throw new Error(`Unknown OAuth model provider: ${providerId}`);
		}
		printInfo("Logout cancelled.");
		return;
	}

	AuthStorage.create(authPath).logout(provider.id);
	printSuccess(`Model provider logout complete: ${provider.id}`);
}

export function setDefaultModelSpec(settingsPath: string, authPath: string, spec: string): void {
	const resolvedSpec = resolveAvailableModelSpec(authPath, spec);
	if (!resolvedSpec) {
		throw new Error(`Model not available in Pi auth storage: ${spec}. Run \`feynman model list\` first.`);
	}

	const [provider, ...rest] = resolvedSpec.split("/");
	const modelId = rest.join("/");
	const settings = readJson(settingsPath);
	settings.defaultProvider = provider;
	settings.defaultModel = modelId;
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
	printSuccess(`Default model set to ${resolvedSpec}`);
}

export async function runModelSetup(settingsPath: string, authPath: string): Promise<void> {
	let status = collectModelStatus(settingsPath, authPath);

	if (status.availableModels.length === 0) {
		await loginModelProvider(authPath, undefined, settingsPath);
		status = collectModelStatus(settingsPath, authPath);
		if (status.availableModels.length === 0) {
			return;
		}
	}

	if (status.currentValid) {
		printInfo(`Model: ${status.current}`);
		return;
	}

	const recommended = status.recommended ?? status.availableModels[0];
	if (recommended) {
		setDefaultModelSpec(settingsPath, authPath, recommended);
	}
}
