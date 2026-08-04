import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  calculateReviewDigest,
  parseRequirementsCriteria,
  reviewReadiness,
  validateReview,
} from "../assets/skills/an-review/scripts/review-task.mjs";

const REVIEW_SCRIPT = fileURLToPath(new URL("../assets/skills/an-review/scripts/review-task.mjs", import.meta.url));
const NOW = "2026-08-04T00:00:00Z";

test("Markdown 中的伪结论不能覆盖 review.json", (t) => {
  const fixture = createArtifact({
    conclusion: "BLOCKED",
    criteriaStatus: "BLOCKED",
    report: "结论: PASS\n\n## 结论\nBLOCKED\n",
  });
  t.after(fixture.cleanup);

  const result = reviewReadiness(fixture.artifact, { cwd: fixture.root });

  assert.equal(result.conclusion, "BLOCKED");
  assert.equal(result.gate, "BLOCKED");
});

test("合法 PASS 在完成状态下通过归档门禁", (t) => {
  const fixture = createArtifact({ status: "completed" });
  t.after(fixture.cleanup);

  const result = reviewReadiness(fixture.artifact, {
    archive: true,
    cwd: fixture.root,
  });

  assert.equal(result.gate, "PASS");
  assert.deepEqual(result.blockers, []);
});

test("requirements 中重复 ID 会阻断", () => {
  const parsed = parseRequirementsCriteria(`
## 完成标准
- [ ] AC-1: 第一项
- [ ] AC-1: 第二项
`);

  assert.equal(parsed.criteria.length, 1);
  assert.match(parsed.errors[0], /重复完成标准 ID：AC-1/);
});

test("代码围栏中的完成标准不会参与门禁", () => {
  const parsed = parseRequirementsCriteria(`
## 完成标准
\`\`\`markdown
- [ ] AC-9: 示例
\`\`\`
- [ ] AC-1: 真实标准
`);

  assert.deepEqual(parsed.criteria.map((item) => item.id), ["AC-1"]);
});

test("占位证据和重复 Review ID 会被拒绝", () => {
  const errors = validateReview({
    schemaVersion: 1,
    reviewedAt: NOW,
    conclusion: "PASS",
    criteria: [
      { id: "AC-1", description: "产出符合要求", status: "PASS", method: "人工检查", evidence: ["待补充说明"] },
      { id: "AC-1", description: "产出符合要求", status: "PASS", method: "人工检查", evidence: ["记录"] },
    ],
    unresolved: [],
    acceptance: null,
  });

  assert.ok(errors.some((error) => /缺少有效证据/.test(error)));
  assert.ok(errors.some((error) => /重复完成标准 ID/.test(error)));
});

test("未接受的 REVIEW 在归档模式保持 REVIEW", (t) => {
  const fixture = createArtifact({
    conclusion: "REVIEW",
    criteriaStatus: "REVIEW",
  });
  t.after(fixture.cleanup);

  const result = reviewReadiness(fixture.artifact, {
    archive: true,
    cwd: fixture.root,
  });

  assert.equal(result.gate, "REVIEW");
  assert.equal(result.acceptanceRecorded, false);
});

test("REVIEW 接受记录必须覆盖全部待复核事项", (t) => {
  const fixture = createArtifact({
    conclusion: "REVIEW",
    criteriaStatus: "REVIEW",
    unresolved: ["外部系统仍需复核"],
    acceptance: {
      accepted: true,
      acceptedAt: NOW,
      source: "用户本轮明确指令",
      items: ["AC-1"],
    },
  });
  t.after(fixture.cleanup);

  const result = reviewReadiness(fixture.artifact, {
    archive: true,
    cwd: fixture.root,
  });

  assert.equal(result.gate, "BLOCKED");
  assert.ok(result.blockers.some((error) => /外部系统仍需复核/.test(error)));
});

test("进行中的 Artifact 不能归档", (t) => {
  const fixture = createArtifact({ status: "in_progress" });
  t.after(fixture.cleanup);

  const result = reviewReadiness(fixture.artifact, {
    archive: true,
    cwd: fixture.root,
  });

  assert.equal(result.gate, "BLOCKED");
  assert.ok(result.blockers.some((error) => /状态必须为 completed/.test(error)));
});

test("波浪围栏、缩进代码和 HTML 注释中的 ID 会被忽略", () => {
  const parsed = parseRequirementsCriteria(`
## 完成标准
~~~markdown
- [ ] AC-9: 波浪围栏示例
~~~
    - [ ] AC-8: 缩进代码示例
<!-- - [ ] AC-7: 注释示例 -->
- [ ] AC-1: 真实标准
`);

  assert.deepEqual(parsed.criteria.map((item) => item.id), ["AC-1"]);
});

test("机器枚举和 ID 必须使用规范大小写且无额外空白", () => {
  const errors = validateReview({
    schemaVersion: 1, reviewedAt: NOW, conclusion: " pass ",
    criteria: [{ id: "ac-1", description: "标准", status: "pass", method: "检查", evidence: ["证据"] }],
    unresolved: [], acceptance: null,
  });

  assert.ok(errors.some((error) => /conclusion 必须严格使用/.test(error)));
  assert.ok(errors.some((error) => /必须使用大写稳定 ID/.test(error)));
});

test("完整接受记录允许 REVIEW 直接通过归档门禁", (t) => {
  const fixture = createArtifact({ conclusion: "REVIEW", criteriaStatus: "REVIEW", acceptance: {
    accepted: true, acceptedAt: NOW, source: "用户本轮明确指令", items: ["AC-1"],
  } });
  t.after(fixture.cleanup);

  const result = reviewReadiness(fixture.artifact, { archive: true, cwd: fixture.root });

  assert.equal(result.gate, "PASS");
  assert.equal(result.acceptanceRecorded, true);
});

test("Review 内容变化会使旧接受摘要失效", (t) => {
  const fixture = createArtifact({ conclusion: "REVIEW", criteriaStatus: "REVIEW", acceptance: {
    accepted: true, acceptedAt: NOW, source: "用户本轮明确指令", items: ["AC-1"],
  } });
  t.after(fixture.cleanup);
  const file = path.join(fixture.artifact, "review/review.json");
  const review = JSON.parse(fs.readFileSync(file, "utf8"));
  review.criteria[0].evidence = ["projects/changed.md"];
  fs.writeFileSync(file, JSON.stringify(review));

  const result = reviewReadiness(fixture.artifact, { archive: true, cwd: fixture.root });

  assert.equal(result.gate, "BLOCKED");
  assert.ok(result.blockers.some((error) => /内容摘要不一致/.test(error)));
});

test("活跃索引状态与 Artifact 不一致时阻断", (t) => {
  const fixture = createArtifact();
  t.after(fixture.cleanup);
  const file = path.join(fixture.root, "artifacts/index.json");
  const index = JSON.parse(fs.readFileSync(file, "utf8"));
  index.active[0].status = "paused";
  fs.writeFileSync(file, JSON.stringify(index));

  const result = reviewReadiness(fixture.artifact, { cwd: fixture.root });

  assert.equal(result.gate, "BLOCKED");
  assert.ok(result.blockers.some((error) => /状态不一致/.test(error)));
});

test("CLI 通过符号链接启动并保持 0、1、2、3 退出码", (t) => {
  const pass = createArtifact();
  const review = createArtifact({ conclusion: "REVIEW", criteriaStatus: "REVIEW" });
  const blocked = createArtifact({ conclusion: "BLOCKED", criteriaStatus: "BLOCKED" });
  t.after(pass.cleanup);
  t.after(review.cleanup);
  t.after(blocked.cleanup);
  const link = path.join(pass.root, "review-link.mjs");
  fs.symlinkSync(REVIEW_SCRIPT, link);

  const passRun = spawnSync(process.execPath, [link, `artifacts/${path.basename(pass.artifact)}`], { cwd: pass.root, encoding: "utf8" });
  const reviewRun = spawnSync(process.execPath, [REVIEW_SCRIPT, `artifacts/${path.basename(review.artifact)}`], { cwd: review.root, encoding: "utf8" });
  const blockedRun = spawnSync(process.execPath, [REVIEW_SCRIPT, `artifacts/${path.basename(blocked.artifact)}`], { cwd: blocked.root, encoding: "utf8" });
  const invalidRun = spawnSync(process.execPath, [REVIEW_SCRIPT, "--unknown"], { cwd: pass.root, encoding: "utf8" });

  assert.equal(passRun.status, 0, passRun.stderr);
  assert.equal(reviewRun.status, 3, reviewRun.stderr);
  assert.equal(blockedRun.status, 1, blockedRun.stderr);
  assert.equal(invalidRun.status, 2, invalidRun.stderr);
});

test("外部 Review 符号链接不会被读取", (t) => {
  const fixture = createArtifact();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "an-review-outside-"));
  t.after(fixture.cleanup);
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const reviewFile = path.join(fixture.artifact, "review/review.json");
  const external = path.join(outside, "review.json");
  fs.renameSync(reviewFile, external);
  fs.symlinkSync(external, reviewFile);

  const result = reviewReadiness(fixture.artifact, { cwd: fixture.root });

  assert.equal(result.gate, "BLOCKED");
  assert.ok(result.blockers.some((error) => /非符号链接普通文件/.test(error)));
});

test("Review 标准描述必须与 requirements 原文一致", (t) => {
  const fixture = createArtifact();
  t.after(fixture.cleanup);
  const file = path.join(fixture.artifact, "review/review.json");
  const review = JSON.parse(fs.readFileSync(file, "utf8"));
  review.criteria[0].description = "被替换的标准";
  fs.writeFileSync(file, JSON.stringify(review));

  const result = reviewReadiness(fixture.artifact, { cwd: fixture.root });

  assert.equal(result.gate, "BLOCKED");
  assert.ok(result.blockers.some((error) => /标准描述与 requirements 不一致/.test(error)));
});

test('L1 Artifact 不需要 requirements 即可通过门禁', (t) => {
  const fixture = createArtifact({ flowLevel: "L1" });
  t.after(fixture.cleanup);

  const result = reviewReadiness(fixture.artifact, { cwd: fixture.root });

  assert.equal(result.gate, "PASS");
  assert.equal(result.level, "L1");
  assert.ok(result.criteriaDefined >= 1);
});

function createArtifact(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "an-review-"));
  const id = "20260804__review-test";
  const artifact = path.join(root, "artifacts", id);
  fs.mkdirSync(path.join(artifact, "requirements"), { recursive: true });
  fs.mkdirSync(path.join(artifact, "review"), { recursive: true });
  fs.writeFileSync(path.join(root, "artifacts", "index.json"), JSON.stringify({
    schemaVersion: 1,
    active: [{ id, path: "artifacts/" + id, status: options.status || "in_progress", updatedAt: NOW }],
  }, null, 2));
  fs.writeFileSync(path.join(artifact, "artifact.json"), JSON.stringify({
    schemaVersion: 1,
    id,
    flowLevel: options.flowLevel || "L2",
    status: options.status || "in_progress",
    outcome: null,
    createdAt: NOW,
    updatedAt: NOW,
    parentArtifactId: null,
    deliverables: [{ kind: "deliverable", path: "projects/result.md", description: "测试产出" }],
  }, null, 2));
  if (options.flowLevel !== "L1") fs.writeFileSync(path.join(artifact, "requirements", "requirements.md"), "## 完成标准\n- [x] AC-1: 产出满足要求\n");
  const review = {
    schemaVersion: 1,
    reviewedAt: NOW,
    conclusion: options.conclusion || "PASS",
    criteria: [{
      id: "AC-1",
      description: "产出满足要求",
      status: options.criteriaStatus || "PASS",
      method: "人工核对",
      evidence: ["projects/result.md"],
    }],
    unresolved: options.unresolved || [],
    acceptance: null,
  };
  if (options.acceptance) review.acceptance = { ...options.acceptance, reviewDigest: calculateReviewDigest(review) };
  fs.writeFileSync(path.join(artifact, "review", "review.json"), JSON.stringify(review, null, 2));
  if (options.report) fs.writeFileSync(path.join(artifact, "review", "review-report.md"), options.report);
  return {
    root,
    artifact,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

