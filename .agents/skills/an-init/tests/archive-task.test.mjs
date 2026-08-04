import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { archiveTask, recoverPendingArchive } from "../assets/skills/an-archive/scripts/archive-task.mjs";
import { calculateReviewDigest } from "../assets/skills/an-review/scripts/review-task.mjs";

const ARCHIVE_SCRIPT = fileURLToPath(new URL("../assets/skills/an-archive/scripts/archive-task.mjs", import.meta.url));
const NOW = "2026-08-04T00:00:00Z";

test("PASS Artifact 以单一事务归档", (t) => {
  const fixture = createArtifact({ status: "completed" });
  t.after(fixture.cleanup);

  const result = archiveTask(fixture.root, `artifacts/${fixture.id}`);
  const archived = readJson(path.join(fixture.archivePath, "artifact.json"));
  const index = readJson(path.join(fixture.root, "artifacts/index.json"));

  assert.equal(result.status, "archived");
  assert.equal(archived.status, "archived");
  assert.equal(archived.outcome, "completed");
  assert.deepEqual(index.active, []);
  assert.ok(!fs.existsSync(fixture.source));
  assert.ok(!fs.existsSync(path.join(fixture.root, `artifacts/.archive-${fixture.id}.json`)));
});

test("已接受 REVIEW 可从活跃状态直接事务归档", (t) => {
  const fixture = createArtifact({ conclusion: "REVIEW", criteriaStatus: "REVIEW", accepted: true });
  t.after(fixture.cleanup);

  const result = archiveTask(fixture.root, `artifacts/${fixture.id}`);

  assert.equal(result.outcome, "completed");
  assert.equal(result.conclusion, "REVIEW");
  assert.ok(fs.existsSync(fixture.archivePath));
});

test("未接受 REVIEW 保持活跃且不改变索引", (t) => {
  const fixture = createArtifact({ conclusion: "REVIEW", criteriaStatus: "REVIEW" });
  t.after(fixture.cleanup);

  assert.throws(() => archiveTask(fixture.root, `artifacts/${fixture.id}`), /Review 归档门禁未通过/);
  assert.ok(fs.existsSync(fixture.source));
  assert.ok(!fs.existsSync(fixture.archivePath));
  assert.equal(readJson(path.join(fixture.root, "artifacts/index.json")).active.length, 1);
});

test("取消任务无需伪造 Review 即可归档", (t) => {
  const fixture = createArtifact({ status: "cancelled", skipReview: true, summary: "# 取消摘要\n\n## 取消原因\n用户主动取消。\n\n## 未完成范围\n发布尚未执行。\n" });
  t.after(fixture.cleanup);

  const result = archiveTask(fixture.root, `artifacts/${fixture.id}`);
  const archived = readJson(path.join(fixture.archivePath, "artifact.json"));

  assert.equal(result.outcome, "cancelled");
  assert.equal(archived.outcome, "cancelled");
});

test("悬空目标链接被视为冲突且不会写入外部", (t) => {
  const fixture = createArtifact({ status: "completed" });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-archive-outside-"));
  t.after(fixture.cleanup);
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(path.join(outside, "missing"), fixture.archivePath);

  assert.throws(() => archiveTask(fixture.root, `artifacts/${fixture.id}`), /目标归档目录已存在/);
  assert.ok(fs.existsSync(fixture.source));
  assert.ok(!fs.existsSync(path.join(outside, "missing")));
});

test("未完成事务会恢复源目录、状态和索引", (t) => {
  const fixture = createArtifact({ status: "completed" });
  t.after(fixture.cleanup);
  const oldArtifact = readJson(path.join(fixture.source, "artifact.json"));
  const oldIndex = readJson(path.join(fixture.root, "artifacts/index.json"));
  const nextArtifact = { ...oldArtifact, status: "archived", outcome: "completed" };
  const nextIndex = { ...oldIndex, active: [] };
  fs.renameSync(fixture.source, fixture.archivePath);
  fs.writeFileSync(path.join(fixture.archivePath, "artifact.json"), JSON.stringify(nextArtifact));
  fs.writeFileSync(path.join(fixture.root, `artifacts/.archive-${fixture.id}.json`), JSON.stringify({
    schemaVersion: 1, id: fixture.id, phase: "state-updated", oldArtifact, nextArtifact, oldIndex, nextIndex,
  }));

  const result = recoverPendingArchive(fixture.root, fixture.id);

  assert.equal(result.status, "rolled-back");
  assert.ok(fs.existsSync(fixture.source));
  assert.ok(!fs.existsSync(fixture.archivePath));
  assert.equal(readJson(path.join(fixture.source, "artifact.json")).status, "completed");
  assert.equal(readJson(path.join(fixture.root, "artifacts/index.json")).active.length, 1);
});

test("prepared 阶段恢复会回滚并有回滚状态", (t) => {
  const fixture = createArtifact({ status: "completed" });
  t.after(fixture.cleanup);
  const oldArtifact = readJson(path.join(fixture.source, "artifact.json"));
  const oldIndex = readJson(path.join(fixture.root, "artifacts/index.json"));
  const nextArtifact = { ...oldArtifact, status: "archived", outcome: "completed" };
  const nextIndex = { ...oldIndex, active: [] };
  fs.writeFileSync(path.join(fixture.root, `artifacts/.archive-${fixture.id}.json`), JSON.stringify({
    schemaVersion: 1, id: fixture.id, phase: "prepared", oldArtifact, nextArtifact, oldIndex, nextIndex,
  }));

  const result = recoverPendingArchive(fixture.root, fixture.id);

  assert.equal(result.status, "rolled-back");
  assert.ok(fs.existsSync(fixture.source));
  assert.ok(!fs.existsSync(fixture.archivePath));
  assert.equal(readJson(path.join(fixture.source, "artifact.json")).status, "completed");
});

test("moved 阶段恢复会回滚目录和状态", (t) => {
  const fixture = createArtifact({ status: "completed" });
  t.after(fixture.cleanup);
  const oldArtifact = readJson(path.join(fixture.source, "artifact.json"));
  const oldIndex = readJson(path.join(fixture.root, "artifacts/index.json"));
  const nextArtifact = { ...oldArtifact, status: "archived", outcome: "completed" };
  const nextIndex = { ...oldIndex, active: [] };
  fs.renameSync(fixture.source, fixture.archivePath);
  fs.writeFileSync(path.join(fixture.root, `artifacts/.archive-${fixture.id}.json`), JSON.stringify({
    schemaVersion: 1, id: fixture.id, phase: "moved", oldArtifact, nextArtifact, oldIndex, nextIndex,
  }));

  const result = recoverPendingArchive(fixture.root, fixture.id);

  assert.equal(result.status, "rolled-back");
  assert.ok(fs.existsSync(fixture.source));
  assert.ok(!fs.existsSync(fixture.archivePath));
  assert.equal(readJson(path.join(fixture.source, "artifact.json")).status, "completed");
});

test("通过符号链接启动 CLI 仍会执行主流程", (t) => {
  const fixture = createArtifact({ status: "completed" });
  t.after(fixture.cleanup);
  const link = path.join(fixture.root, "archive-link.mjs");
  fs.symlinkSync(ARCHIVE_SCRIPT, link);

  const result = spawnSync(process.execPath, [link, `artifacts/${fixture.id}`], { cwd: fixture.root, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(fixture.archivePath));
});

test("已提交事务日志会完成确认而不反向回滚", (t) => {
  const fixture = createArtifact({ status: "completed" });
  t.after(fixture.cleanup);
  const oldArtifact = readJson(path.join(fixture.source, "artifact.json"));
  const oldIndex = readJson(path.join(fixture.root, "artifacts/index.json"));
  const nextArtifact = { ...oldArtifact, status: "archived", outcome: "completed" };
  const nextIndex = { ...oldIndex, active: [] };
  fs.renameSync(fixture.source, fixture.archivePath);
  fs.writeFileSync(path.join(fixture.archivePath, "artifact.json"), JSON.stringify(nextArtifact));
  fs.writeFileSync(path.join(fixture.root, "artifacts/index.json"), JSON.stringify(nextIndex));
  fs.writeFileSync(path.join(fixture.root, `artifacts/.archive-${fixture.id}.json`), JSON.stringify({
    schemaVersion: 1, id: fixture.id, phase: "index-updated", oldArtifact, nextArtifact, oldIndex, nextIndex,
  }));

  const result = recoverPendingArchive(fixture.root, fixture.id);

  assert.equal(result.status, "committed");
  assert.ok(fs.existsSync(fixture.archivePath));
  assert.ok(!fs.existsSync(fixture.source));
  assert.deepEqual(readJson(path.join(fixture.root, "artifacts/index.json")).active, []);
});

function createArtifact(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "an-archive-"));
  const id = "20260804__archive-test";
  const source = path.join(root, "artifacts", id);
  const archivePath = path.join(root, "artifacts/_archived", id);
  fs.mkdirSync(path.join(source, "requirements"), { recursive: true });
  fs.mkdirSync(path.join(source, "review"), { recursive: true });
  fs.mkdirSync(path.join(source, "archive"), { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts/_archived"), { recursive: true });
  const status = options.status || "in_progress";
  const artifact = {
    schemaVersion: 1, id, flowLevel: "L2", status, outcome: null, createdAt: NOW, updatedAt: NOW, parentArtifactId: null,
    deliverables: [{ kind: "deliverable", path: "projects/result.md", description: "测试产出" }],
  };
  fs.writeFileSync(path.join(source, "artifact.json"), JSON.stringify(artifact, null, 2));
  fs.writeFileSync(path.join(root, "artifacts/index.json"), JSON.stringify({
    schemaVersion: 1, active: [{ id, path: `artifacts/${id}`, status, updatedAt: NOW }],
  }, null, 2));
  fs.writeFileSync(path.join(source, "requirements/requirements.md"), "## 完成标准\n- [x] AC-1: 产出符合要求\n");
  fs.writeFileSync(path.join(source, "archive/summary.md"), options.summary || "# 完结摘要\n\n## 最终产出\n产出位于 projects/result.md。\n");
  if (!options.skipReview) {
    const review = {
      schemaVersion: 1, reviewedAt: NOW, conclusion: options.conclusion || "PASS",
      criteria: [{ id: "AC-1", description: "产出符合要求", status: options.criteriaStatus || "PASS", method: "核对", evidence: ["projects/result.md"] }],
      unresolved: [], acceptance: null,
    };
    if (options.accepted) review.acceptance = {
      accepted: true, acceptedAt: NOW, source: "用户本轮明确指令", items: ["AC-1"], reviewDigest: calculateReviewDigest(review),
    };
    fs.writeFileSync(path.join(source, "review/review.json"), JSON.stringify(review, null, 2));
  }
  return { root, id, source, archivePath, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
