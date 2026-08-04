import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { calculateReviewDigest } from "../assets/skills/an-review/scripts/review-task.mjs";

const DETECT = fileURLToPath(new URL("../assets/skills/an-recipes/scripts/detect-recipes.mjs", import.meta.url));
const SCAN = fileURLToPath(new URL("../assets/skills/an-refresh/scripts/scan-projects.mjs", import.meta.url));

test("普通 requirements.txt 不会生成 pytest 动作", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "requirements.txt"), "requests==2.32.0\n");

  const result = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const ids = result.workspaces[0].actions.map((action) => action.id);

  assert.ok(!ids.includes("python:pytest"));
  assert.deepEqual(result.diagnostics, []);
});

test("脚本名按边界分类且冲突 ID 保持唯一", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ scripts: {
    "test:a": "node a.mjs",
    "test-a": "node b.mjs",
    contest: "node contest.mjs",
    "format:all": "formatter --write",
    "format:check": "formatter --check"
  } }));

  const result = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const packageActions = result.workspaces[0].actions.filter((action) => action.id.startsWith("package:"));
  const bySource = new Map(packageActions.map((action) => [action.source, action]));

  assert.equal(new Set(packageActions.map((action) => action.id)).size, packageActions.length);
  assert.ok(!bySource.has("package.json scripts.contest"));
  assert.equal(bySource.get("package.json scripts.format:all").purpose, "produce");
  assert.equal(bySource.get("package.json scripts.format:check").purpose, "review");
});

test("损坏配置和缺失根目录通过 diagnostics 显式报告", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "package.json"), "{ broken");

  const broken = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const missing = runJson(DETECT, root, ["--root", "missing", "--format", "json"]);

  assert.ok(broken.diagnostics.some((item) => item.code === "INVALID_JSON"));
  assert.equal(missing.rootExists, false);
  assert.ok(missing.diagnostics.some((item) => item.code === "ROOT_NOT_FOUND"));
});

test("敏感目录不会进入扫描清单", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(path.join(app, "secrets"), { recursive: true });
  fs.writeFileSync(path.join(app, "secrets/README.md"), "private\n");
  fs.writeFileSync(path.join(app, "main.mjs"), "export {};\n");

  const recipes = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const scan = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);

  assert.ok(!recipes.workspaces[0].actions.some((action) => action.id === "inspect:text"));
  assert.ok(!scan.workspaces[0].readmeFiles.some((file) => file.includes("secrets")));
  assert.equal(scan.workspaces[0].materialGroups.find((group) => group.name === "source").count, 1);
});

test("归档扫描只信任结构化且可接受的完成任务", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeArchived(root, "20260804__done", { status: "archived", outcome: "completed", conclusion: "PASS" });
  writeArchived(root, "20260804__cancelled", { status: "archived", outcome: "cancelled", conclusion: "PASS" });
  writeArchived(root, "20260804__accepted", { status: "archived", outcome: "completed", conclusion: "REVIEW", accepted: true });

  const result = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);
  const items = new Map(result.archivedReviews.items.map((item) => [item.artifact, item]));

  assert.equal(items.get("20260804__done").acceptable, true);
  assert.equal(items.get("20260804__accepted").acceptable, true);
  assert.equal(items.get("20260804__cancelled").acceptable, false);
});

test("归档 requirements 与 Review 不一致时不能成为背景来源", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = writeArchived(root, "20260804__requirements-drift", { status: "archived", outcome: "completed", conclusion: "PASS" });
  fs.writeFileSync(path.join(dir, "requirements/requirements.md"), "## 完成标准\n- AC-1: 已修改的标准\n");

  const result = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);

  assert.equal(result.archivedReviews.items[0].acceptable, false);
  assert.ok(result.diagnostics.some((item) => item.message.includes("Review 标准描述与 requirements 不一致")));
});

test("仍在活跃索引中的归档不能成为背景来源", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const id = "20260804__still-active";
  writeArchived(root, id, { status: "archived", outcome: "completed", conclusion: "PASS" });
  fs.writeFileSync(path.join(root, "artifacts/index.json"), JSON.stringify({ schemaVersion: 1, active: [{
    id, path: `artifacts/${id}`, status: "in_progress", updatedAt: "2026-08-04T00:00:00Z",
  }] }));

  const result = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);

  assert.equal(result.archivedReviews.items[0].acceptable, false);
  assert.ok(result.diagnostics.some((item) => item.message.includes("仍存在于活跃索引")));
});

test("输出路径不能通过符号链接越过工作区", (t) => {
  const root = createRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-scan-outside-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(root, "linked-output"));

  const result = run(DETECT, root, ["--root", "projects", "--write", "linked-output/recipes.json"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /不能包含符号链接/);
  assert.ok(!fs.existsSync(path.join(outside, "recipes.json")));
});

test("--write 创建深层嵌套输出路径", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }));

  const result = run(SCAN, root, ["--root", "projects", "--write", "deep/nested/output/scan.json", "--format", "json"]);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(root, "deep/nested/output/scan.json")));
});

test("路径越界和未知参数返回调用错误", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const outside = run(DETECT, root, ["--root", "../outside", "--format", "json"]);
  const unknown = run(SCAN, root, ["--unknown", "x"]);

  assert.equal(outside.status, 2);
  assert.match(outside.stderr, /工作区根目录内/);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /未知参数/);
});

test("悬空文件链接不能作为输出目标", (t) => {
  const root = createRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-scan-dangling-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(path.join(outside, "missing.json"), path.join(root, "recipes.json"));

  const result = run(DETECT, root, ["--root", "projects", "--write", "recipes.json"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /不能包含符号链接/);
  assert.ok(!fs.existsSync(path.join(outside, "missing.json")));
});

test("外部 manifest 符号链接不会被读取", (t) => {
  const root = createRoot();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-scan-manifest-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(outside, "package.json"), JSON.stringify({ scripts: { test: "secret-command" } }));
  fs.symlinkSync(path.join(outside, "package.json"), path.join(app, "package.json"));

  const recipes = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const scan = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);

  assert.ok(!recipes.workspaces[0].actions.some((action) => action.type === "command"));
  assert.ok(recipes.diagnostics.some((item) => item.code === "UNSAFE_FILE_SKIPPED"));
  assert.deepEqual(scan.workspaces[0].declaredActions.items, []);
  assert.ok(scan.diagnostics.some((item) => item.code === "UNSAFE_FILE_SKIPPED"));
});

test("敏感词位于名称中部时仍会跳过并禁止显式扫描", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(path.join(app, "prod-secrets"), { recursive: true });
  fs.writeFileSync(path.join(app, "prod-secrets/README.md"), "private\n");
  fs.writeFileSync(path.join(app, "access-token.json"), "{}\n");

  const scan = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);
  const explicit = run(DETECT, root, ["--root", "projects/app/prod-secrets", "--format", "json"]);

  assert.equal(scan.workspaces[0].fileCount, 0);
  assert.equal(explicit.status, 2);
  assert.match(explicit.stderr, /敏感路径/);
});

test("超大扫描上限被拒绝且 ..foo 仍是合法目录名", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "projects/..foo/app"), { recursive: true });

  const huge = run(DETECT, root, ["--root", "projects", "--limit", "999999999999999999999", "--format", "json"]);
  const valid = runJson(DETECT, root, ["--root", "projects/..foo", "--format", "json"]);

  assert.equal(huge.status, 2);
  assert.equal(valid.workspaces[0].name, "app");
});

test("缺失或错误 artifacts 路径不会伪装成空归档", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.rmSync(path.join(root, "artifacts"), { recursive: true });

  const missing = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);
  fs.writeFileSync(path.join(root, "artifacts-file"), "not a directory");
  const invalid = run(SCAN, root, ["--root", "projects", "--artifacts", "artifacts-file", "--format", "json"]);

  assert.equal(missing.artifactsExists, false);
  assert.ok(missing.diagnostics.some((item) => item.code === "ARTIFACTS_ROOT_NOT_FOUND"));
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /必须指向目录/);
});

test("冲突 PASS、畸形类型和缺失摘要均不能成为背景来源", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeArchived(root, "20260804__blocked-pass", { status: "archived", outcome: "completed", conclusion: "PASS", criteriaStatus: "BLOCKED" });
  const malformed = writeArchived(root, "20260804__malformed", { status: "archived", outcome: "completed", conclusion: "PASS" });
  const malformedReview = JSON.parse(fs.readFileSync(path.join(malformed, "review/review.json"), "utf8"));
  malformedReview.conclusion = 1;
  fs.writeFileSync(path.join(malformed, "review/review.json"), JSON.stringify(malformedReview));
  writeArchived(root, "20260804__missing-summary", { status: "archived", outcome: "completed", conclusion: "PASS", skipSummary: true });

  const result = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--format", "json"]);

  assert.ok(result.archivedReviews.items.every((item) => item.acceptable === false));
  assert.ok(result.diagnostics.filter((item) => item.code === "ARCHIVE_NOT_ACCEPTABLE").length >= 3);
});

test("archive-limit 优先保留最新归档", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeArchived(root, "20260101__old", { status: "archived", outcome: "completed", conclusion: "PASS" });
  writeArchived(root, "20261231__new", { status: "archived", outcome: "completed", conclusion: "PASS" });

  const result = runJson(SCAN, root, ["--root", "projects", "--artifacts", "artifacts", "--archive-limit", "1", "--format", "json"]);

  assert.equal(result.archivedReviews.items[0].artifact, "20261231__new");
  assert.equal(result.archivedReviews.truncated, true);
});

test("Markdown 输出转义工作区名称和结构化字段", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const name = "evil|`<script>\n# injected";
  fs.mkdirSync(path.join(root, "projects", name), { recursive: true });

  const result = run(DETECT, root, ["--root", "projects", "--format", "markdown"]);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes("<script>"));
  assert.ok(!result.stdout.includes("\n# injected"));
  assert.match(result.stdout, /&lt;script&gt;/);
  assert.match(result.stdout, /&#96;/);
});

test("Go、Rust 和 Java 项目通过文件检测工具动作", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const go = path.join(root, "projects/go-app");
  const rs = path.join(root, "projects/rust-app");
  const java = path.join(root, "projects/java-app");
  fs.mkdirSync(go, { recursive: true });
  fs.mkdirSync(rs, { recursive: true });
  fs.mkdirSync(java, { recursive: true });
  fs.writeFileSync(path.join(go, "go.mod"), "module example");
  fs.writeFileSync(path.join(rs, "Cargo.toml"), "[package]\nname = \"test\"");
  fs.writeFileSync(path.join(java, "pom.xml"), "<project></project>");

  const result = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const actions = new Map(result.workspaces.flatMap((ws) => ws.actions).map((action) => [action.id, action]));

  assert.ok(actions.has("go:test"), "Go 项目应生成 go:test 动作");
  assert.ok(actions.has("cargo:test"), "Rust 项目应生成 cargo:test 动作");
  assert.ok(actions.has("maven:test"), "Java 项目应生成 maven:test 动作");
  assert.equal(actions.get("go:test").source, "go.mod");
  assert.equal(actions.get("cargo:test").source, "Cargo.toml");
  assert.equal(actions.get("maven:test").source, "pom.xml");
});

test("Python 注释和相近依赖名不会生成工具动作", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "requirements.txt"), "mypy-extensions==1.0\n# pytest only in comment\n");
  fs.writeFileSync(path.join(app, "pyproject.toml"), "# ruff and pytest in comments only\n");
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ scripts: { typecheck: "tsc", vitest: "vitest run" } }));

  const result = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const ids = result.workspaces[0].actions.map((action) => action.id);

  assert.ok(!ids.includes("python:pytest"));
  assert.ok(!ids.includes("python:mypy"));
  assert.ok(!ids.includes("python:ruff"));
  assert.ok(result.workspaces[0].actions.some((action) => action.source === "package.json scripts.typecheck"));
  assert.ok(result.workspaces[0].actions.some((action) => action.source === "package.json scripts.vitest"));
});

test("明确声明的 Python 工具会生成对应动作和来源", (t) => {
  const root = createRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "projects/app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "requirements.txt"), "pytest==9.0\nruff==1.0\nmypy==2.0\n");

  const result = runJson(DETECT, root, ["--root", "projects", "--format", "json"]);
  const actions = new Map(result.workspaces[0].actions.map((action) => [action.id, action]));

  assert.equal(actions.get("python:pytest").source, "requirements.txt");
  assert.equal(actions.get("python:ruff").source, "requirements.txt");
  assert.equal(actions.get("python:mypy").source, "requirements.txt");
});

function createRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "an-scan-"));
  fs.mkdirSync(path.join(root, "projects"), { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts/_archived"), { recursive: true });
  fs.writeFileSync(path.join(root, "artifacts/index.json"), JSON.stringify({ schemaVersion: 1, active: [] }));
  return root;
}

function writeArchived(root, id, options) {
  const dir = path.join(root, "artifacts/_archived", id);
  fs.mkdirSync(path.join(dir, "review"), { recursive: true });
  fs.mkdirSync(path.join(dir, "archive"), { recursive: true });
  fs.mkdirSync(path.join(dir, "requirements"), { recursive: true });
  fs.writeFileSync(path.join(dir, "artifact.json"), JSON.stringify({
    schemaVersion: 1, id, flowLevel: "L2", status: options.status, outcome: options.outcome,
    createdAt: "2026-08-04T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z", parentArtifactId: null,
    deliverables: options.outcome === "completed" ? [{ kind: "deliverable", path: "projects/result.md", description: "测试产出" }] : [],
  }));
  if (options.outcome === "completed") {
    fs.writeFileSync(path.join(dir, "requirements/requirements.md"), "## 完成标准\n- AC-1: 产出符合要求\n");
    const review = {
      schemaVersion: 1, reviewedAt: "2026-08-04T00:00:00Z", conclusion: options.conclusion,
      criteria: [{ id: "AC-1", description: "产出符合要求", status: options.criteriaStatus || options.conclusion, method: "检查", evidence: options.evidence || ["结果"] }],
      unresolved: options.unresolved || [], acceptance: null,
    };
    if (options.accepted) review.acceptance = {
      accepted: true, acceptedAt: "2026-08-04T00:00:00Z", source: "用户本轮明确指令", items: ["AC-1"], reviewDigest: calculateReviewDigest(review),
    };
    fs.writeFileSync(path.join(dir, "review/review.json"), JSON.stringify(review));
  }
  if (!options.skipSummary) {
    const summary = options.summary || (options.outcome === "cancelled"
      ? "# 取消摘要\n\n## 取消原因\n用户主动取消。\n\n## 未完成范围\n尚未完成交付。\n"
      : "# 完结摘要\n\n## 最终产出\n产出位于 projects/result.md。\n");
    fs.writeFileSync(path.join(dir, "archive/summary.md"), summary);
  }
  return dir;
}

function runJson(script, cwd, args) {
  const result = run(script, cwd, args);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function run(script, cwd, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}
