import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bootstrapDevRunnerWorktreeEnv,
  isLinkedGitWorktreeCheckout,
  resolveWorktreeEnvFilePath,
} from "../dev-runner-worktree.ts";

const tempRoots = new Set<string>();

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.add(root);
  return root;
}

describe("dev-runner worktree env bootstrap", () => {
  it("detects linked git worktrees from .git files", () => {
    const root = createTempRoot("mspro-ltd-dev-runner-worktree-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/mspro-ltd/.git/worktrees/feature\n", "utf8");

    expect(isLinkedGitWorktreeCheckout(root)).toBe(true);
  });

  it("loads repo-local MSProLtd env for initialized worktrees without overriding explicit env", () => {
    const root = createTempRoot("mspro-ltd-dev-runner-worktree-env-");
    fs.mkdirSync(path.join(root, ".mspro-ltd"), { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/mspro-ltd/.git/worktrees/feature\n", "utf8");
    fs.writeFileSync(
      resolveWorktreeEnvFilePath(root),
      [
        "MSPROLTD_HOME=/tmp/mspro-ltd-worktrees",
        "MSPROLTD_INSTANCE_ID=feature-worktree",
        "MSPROLTD_IN_WORKTREE=true",
        "MSPROLTD_WORKTREE_NAME=feature-worktree",
        "MSPROLTD_OPTIONAL= # comment-only value",
        "",
      ].join("\n"),
      "utf8",
    );

    const env: NodeJS.ProcessEnv = {
      MSPROLTD_INSTANCE_ID: "already-set",
    };
    const result = bootstrapDevRunnerWorktreeEnv(root, env);

    expect(result).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: false,
    });
    expect(env.MSPROLTD_HOME).toBe("/tmp/mspro-ltd-worktrees");
    expect(env.MSPROLTD_INSTANCE_ID).toBe("already-set");
    expect(env.MSPROLTD_IN_WORKTREE).toBe("true");
    expect(env.MSPROLTD_OPTIONAL).toBe("");
  });

  it("reports uninitialized linked worktrees so dev runner can fail fast", () => {
    const root = createTempRoot("mspro-ltd-dev-runner-worktree-missing-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/mspro-ltd/.git/worktrees/feature\n", "utf8");

    expect(bootstrapDevRunnerWorktreeEnv(root, {})).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: true,
    });
  });
});
