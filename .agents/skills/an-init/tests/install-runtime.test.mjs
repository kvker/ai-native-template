import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { installRuntime, planInstallation } from "../scripts/install-runtime.mjs";

const INSTALL_SCRIPT = fileURLToPath(new URL("../scripts/install-runtime.mjs", import.meta.url));

test("dry-run 不修改工作区", (t) => {
  const fixture = createWorkspace();
  t.after(fixture.cleanup);

  const result = installRuntime(fixture.root, { dryRun: true });

  assert.equal(result.status, "dry-run");
  assert.ok(fs.existsSync(path.join(fixture.root, ".agents/skills/an-init")));
  assert.ok(!fs.existsSync(path.join(fixture.root, ".agents/skills/an-task")));
});

test("完整校验后安装 Skill 并最后移除 an-init", (t) => {
  const fixture = createWorkspace();
  t.after(fixture.cleanup);

  const result = installRuntime(fixture.root);

  assert.equal(result.status, "installed");
  assert.equal(result.restartRequired, true);
  assert.ok(fs.existsSync(path.join(fixture.root, ".agents/skills/an-task/SKILL.md")));
  assert.ok(!fs.existsSync(path.join(fixture.root, ".agents/skills/an-task/SKILL.md.txt")));
  assert.ok(!fs.existsSync(path.join(fixture.root, ".agents/skills/an-init")));
  assert.ok(fs.existsSync(path.join(fixture.root, "projects/.gitkeep")));
  const agents = fs.readFileSync(path.join(fixture.root, "AGENTS.md"), "utf8");
  assert.ok(!agents.includes("an-init-pending"));
  assert.ok(!agents.includes("$an-init"));
  assert.ok(agents.includes("$an-task"));
});

test("目标冲突时保留 an-init 和已有目标", (t) => {
  const fixture = createWorkspace();
  t.after(fixture.cleanup);
  const target = path.join(fixture.root, ".agents/skills/an-task");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "existing.txt"), "keep");

  assert.throws(() => installRuntime(fixture.root), /安装目标已存在/);
  assert.ok(fs.existsSync(path.join(fixture.root, ".agents/skills/an-init")));
  assert.equal(fs.readFileSync(path.join(target, "existing.txt"), "utf8"), "keep");
});

test("模板路由未替换时拒绝安装", (t) => {
  const fixture = createWorkspace();
  t.after(fixture.cleanup);
  fs.writeFileSync(path.join(fixture.root, "AGENTS.md"), "当前处于模板阶段，使用 .agents/skills/an-init。\n");

  assert.throws(() => planInstallation(fixture.root), /尚未生成运行期路由/);
  assert.ok(fs.existsSync(path.join(fixture.root, ".agents/skills/an-init")));
});

test("源 Skill 中的符号链接会被拒绝", (t) => {
  const fixture = createWorkspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-install-outside-"));
  t.after(fixture.cleanup);
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, "external.txt"), "external");
  fs.symlinkSync(path.join(outside, "external.txt"), path.join(fixture.root, ".agents/skills/an-init/assets/skills/an-task/link.txt"));

  assert.throws(() => planInstallation(fixture.root), /包含符号链接/);
  assert.ok(!fs.existsSync(path.join(fixture.root, ".agents/skills/an-task")));
});

test("悬空安装目标链接被视为冲突", (t) => {
  const fixture = createWorkspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-install-target-"));
  t.after(fixture.cleanup);
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(path.join(outside, "missing"), path.join(fixture.root, ".agents/skills/an-task"));

  assert.throws(() => installRuntime(fixture.root), /安装目标已存在/);
  assert.ok(!fs.existsSync(path.join(outside, "missing")));
});

test("工作区内部目录不能通过符号链接指向其他位置", (t) => {
  const fixture = createWorkspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-install-agents-"));
  t.after(fixture.cleanup);
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.renameSync(path.join(fixture.root, ".agents"), path.join(outside, "agents"));
  fs.symlinkSync(path.join(outside, "agents"), path.join(fixture.root, ".agents"));

  assert.throws(() => planInstallation(fixture.root), /路径包含符号链接|越过工作区边界/);
});

test("通过符号链接启动安装 CLI 仍执行预检", (t) => {
  const fixture = createWorkspace();
  t.after(fixture.cleanup);
  const link = path.join(fixture.root, "install-link.mjs");
  fs.symlinkSync(INSTALL_SCRIPT, link);

  const result = spawnSync(process.execPath, [link, "--root", ".", "--dry-run"], { cwd: fixture.root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /dry-run/);
});

test("初始化索引非空时拒绝安装", (t) => {
  const fixture = createWorkspace();
  t.after(fixture.cleanup);
  fs.writeFileSync(path.join(fixture.root, "artifacts/index.json"), JSON.stringify({ schemaVersion: 1, active: [{ id: "20260804__unexpected" }] }));

  assert.throws(() => planInstallation(fixture.root), /必须是空的/);
});

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "an-install-"));
  const init = path.join(root, ".agents/skills/an-init");
  const runtime = path.join(init, "assets/skills/an-task");
  fs.mkdirSync(runtime, { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.mkdirSync(path.join(root, "projects"), { recursive: true });
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# 运行期路由\n\n使用 $an-task。\n\n<!-- an-init-pending:start -->\n初始化未完成时使用 $an-init，入口位于 .agents/skills/an-init。\n<!-- an-init-pending:end -->\n");
  fs.writeFileSync(path.join(root, "README.md"), "# 工作区概览\n");
  fs.writeFileSync(path.join(root, "artifacts/index.json"), `${JSON.stringify({ schemaVersion: 1, active: [] })}\n`);
  fs.writeFileSync(path.join(root, "projects/.gitkeep"), "");
  fs.writeFileSync(path.join(init, "SKILL.md"), "---\nname: an-init\n---\n");
  fs.writeFileSync(path.join(runtime, "SKILL.md.txt"), "---\nname: an-task\ndescription: test\n---\n");
  fs.writeFileSync(path.join(runtime, "asset.txt"), "asset\n");
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
