import test from "node:test";
import assert from "node:assert/strict";

import { getOpenUrlCommand } from "../src/system/open-url.js";

test("getOpenUrlCommand uses open on macOS when available", () => {
	const command = getOpenUrlCommand(
		"https://example.com",
		"darwin",
		(name) => (name === "open" ? "/usr/bin/open" : undefined),
	);

	assert.deepEqual(command, {
		command: "/usr/bin/open",
		args: ["https://example.com"],
	});
});

test("getOpenUrlCommand uses xdg-open on Linux when available", () => {
	const command = getOpenUrlCommand(
		"https://example.com",
		"linux",
		(name) => (name === "xdg-open" ? "/usr/bin/xdg-open" : undefined),
	);

	assert.deepEqual(command, {
		command: "/usr/bin/xdg-open",
		args: ["https://example.com"],
	});
});

test("getOpenUrlCommand uses cmd start on Windows", () => {
	const command = getOpenUrlCommand("https://example.com", "win32");

	assert.deepEqual(command, {
		command: "cmd",
		args: ["/c", "start", "", "https://example.com"],
	});
});

test("getOpenUrlCommand returns undefined when no opener is available", () => {
	const command = getOpenUrlCommand("https://example.com", "linux", () => undefined);

	assert.equal(command, undefined);
});
