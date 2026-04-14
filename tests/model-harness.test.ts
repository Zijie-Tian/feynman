import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveInitialPrompt } from "../src/cli.js";
import { buildModelStatusSnapshotFromRecords, chooseRecommendedModel } from "../src/model/catalog.js";
import { resolveModelProviderForCommand, setDefaultModelSpec } from "../src/model/commands.js";

const MODEL_AUTH_ENV_VARS = [
	"AI_GATEWAY_API_KEY",
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_AUTH_TOKEN",
	"AWS_ACCESS_KEY_ID",
	"AWS_DEFAULT_REGION",
	"AWS_PROFILE",
	"AWS_REGION",
	"AWS_SECRET_ACCESS_KEY",
	"AWS_SESSION_TOKEN",
	"AZURE_OPENAI_API_KEY",
	"CEREBRAS_API_KEY",
	"GEMINI_API_KEY",
	"GROQ_API_KEY",
	"HF_TOKEN",
	"KIMI_API_KEY",
	"MINIMAX_API_KEY",
	"MINIMAX_CN_API_KEY",
	"MISTRAL_API_KEY",
	"OPENAI_API_KEY",
	"OPENCODE_API_KEY",
	"OPENROUTER_API_KEY",
	"XAI_API_KEY",
	"ZAI_API_KEY",
] as const;

let previousModelAuthEnv = new Map<string, string | undefined>();

test.beforeEach(() => {
	previousModelAuthEnv = new Map(
		MODEL_AUTH_ENV_VARS.map((envVar) => {
			const value = process.env[envVar];
			delete process.env[envVar];
			return [envVar, value];
		}),
	);
});

test.afterEach(() => {
	for (const [envVar, value] of previousModelAuthEnv) {
		if (value === undefined) {
			delete process.env[envVar];
		} else {
			process.env[envVar] = value;
		}
	}
});

function createAuthPath(contents: Record<string, unknown>): string {
	const root = mkdtempSync(join(tmpdir(), "feynman-auth-"));
	const authPath = join(root, "auth.json");
	writeFileSync(authPath, JSON.stringify(contents, null, 2) + "\n", "utf8");
	return authPath;
}

test("chooseRecommendedModel prefers the strongest authenticated research model", () => {
	const authPath = createAuthPath({
		openai: { type: "api_key", key: "openai-test-key" },
		anthropic: { type: "api_key", key: "anthropic-test-key" },
	});

	const recommendation = chooseRecommendedModel(authPath);

	assert.equal(recommendation?.spec, "anthropic/claude-opus-4-6");
});

test("setDefaultModelSpec accepts a unique bare model id from authenticated models", () => {
	const authPath = createAuthPath({
		openai: { type: "api_key", key: "openai-test-key" },
	});
	const settingsPath = join(mkdtempSync(join(tmpdir(), "feynman-settings-")), "settings.json");

	setDefaultModelSpec(settingsPath, authPath, "gpt-5.4");

	const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
		defaultProvider?: string;
		defaultModel?: string;
	};
	assert.equal(settings.defaultProvider, "openai");
	assert.equal(settings.defaultModel, "gpt-5.4");
});

test("setDefaultModelSpec accepts provider:model syntax for authenticated models", () => {
	const authPath = createAuthPath({
		google: { type: "api_key", key: "google-test-key" },
	});
	const settingsPath = join(mkdtempSync(join(tmpdir(), "feynman-settings-")), "settings.json");

	setDefaultModelSpec(settingsPath, authPath, "google:gemini-3-pro-preview");

	const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
		defaultProvider?: string;
		defaultModel?: string;
	};
	assert.equal(settings.defaultProvider, "google");
	assert.equal(settings.defaultModel, "gemini-3-pro-preview");
});

test("resolveModelProviderForCommand falls back to API-key providers when OAuth is unavailable", () => {
	const authPath = createAuthPath({});

	const resolved = resolveModelProviderForCommand(authPath, "google");

	assert.equal(resolved?.kind, "api-key");
	assert.equal(resolved?.id, "google");
});

test("resolveModelProviderForCommand prefers OAuth when a provider supports both auth modes", () => {
	const authPath = createAuthPath({});

	const resolved = resolveModelProviderForCommand(authPath, "anthropic");

	assert.equal(resolved?.kind, "oauth");
	assert.equal(resolved?.id, "anthropic");
});

test("setDefaultModelSpec prefers the explicitly configured provider when a bare model id is ambiguous", () => {
	const authPath = createAuthPath({
		openai: { type: "api_key", key: "openai-test-key" },
	});
	const settingsPath = join(mkdtempSync(join(tmpdir(), "feynman-settings-")), "settings.json");

	setDefaultModelSpec(settingsPath, authPath, "gpt-5.4");

	const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
		defaultProvider?: string;
		defaultModel?: string;
	};
	assert.equal(settings.defaultProvider, "openai");
	assert.equal(settings.defaultModel, "gpt-5.4");
});

test("buildModelStatusSnapshotFromRecords flags an invalid current model and suggests a replacement", () => {
	const snapshot = buildModelStatusSnapshotFromRecords(
		[
			{ provider: "anthropic", id: "claude-opus-4-6" },
			{ provider: "openai", id: "gpt-5.4" },
		],
		[{ provider: "openai", id: "gpt-5.4" }],
		"anthropic/claude-opus-4-6",
	);

	assert.equal(snapshot.currentValid, false);
	assert.equal(snapshot.recommended, "openai/gpt-5.4");
	assert.ok(snapshot.guidance.some((line) => line.includes("Configured default model is unavailable")));
});

test("chooseRecommendedModel prefers MiniMax M2.7 over highspeed when that is the authenticated provider", () => {
	const authPath = createAuthPath({
		minimax: { type: "api_key", key: "minimax-test-key" },
	});

	const recommendation = chooseRecommendedModel(authPath);

	assert.equal(recommendation?.spec, "minimax/MiniMax-M2.7");
});

test("resolveInitialPrompt maps top-level research commands to Pi slash workflows", () => {
	const workflows = new Set(["lit", "watch", "jobs", "deepresearch"]);
	assert.equal(resolveInitialPrompt("lit", ["tool-using", "agents"], undefined, workflows), "/lit tool-using agents");
	assert.equal(resolveInitialPrompt("watch", ["openai"], undefined, workflows), "/watch openai");
	assert.equal(resolveInitialPrompt("jobs", [], undefined, workflows), "/jobs");
	assert.equal(resolveInitialPrompt("chat", ["hello"], undefined, workflows), "hello");
	assert.equal(resolveInitialPrompt("unknown", ["topic"], undefined, workflows), "unknown topic");
});
