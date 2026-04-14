import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveExecutable } from "../src/system/executables.js";

test("resolveExecutable avoids login-shell profile failures on POSIX", { skip: process.platform === "win32" }, () => {
	const tempRoot = mkdtempSync(join(tmpdir(), "feynman-exec-"));
	const fakeBin = join(tempRoot, "bin");
	const fakeShell = join(fakeBin, "sh");
	const fakeTool = join(fakeBin, "demo-tool");
	mkdirSync(fakeBin, { recursive: true });

	writeFileSync(
		fakeShell,
		[
			"#!/bin/sh",
			'if [ "$1" = "-lc" ]; then',
			'  echo "login shell should not be used" >&2',
			"  exit 2",
			"fi",
			'if [ "$1" = "-c" ]; then',
			'  shift',
			'  script="$1"',
			"  shift",
			'  exec /bin/sh -c "$script" "$@"',
			"fi",
			'echo "unexpected shell invocation" >&2',
			"exit 1",
			"",
		].join("\n"),
		"utf8",
	);
	chmodSync(fakeShell, 0o755);

	writeFileSync(fakeTool, "#!/bin/sh\nexit 0\n", "utf8");
	chmodSync(fakeTool, 0o755);

	const previousPath = process.env.PATH;
	process.env.PATH = `${fakeBin}:${previousPath ?? ""}`;
	try {
		assert.equal(resolveExecutable("demo-tool"), fakeTool);
	} finally {
		if (previousPath === undefined) {
			delete process.env.PATH;
		} else {
			process.env.PATH = previousPath;
		}
	}
});
