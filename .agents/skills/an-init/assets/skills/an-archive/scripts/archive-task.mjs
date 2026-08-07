#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { reviewReadiness } from "../../an-review/scripts/review-task.mjs";

const ARTIFACT_ID = /^\d{8}__[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isMain = process.argv[1] && sameFile(process.argv[1], fileURLToPath(import.meta.url));

function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  try {
    const input = parseArgs(argv);
    const result = archiveTask(fs.realpathSync(cwd), input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error?.exitCode || 1;
  }
}

export function archiveTask(root, input) {
  root = fs.realpathSync(root);
  const paths = resolvePaths(root, input);
  const recovered = recoverPendingArchive(root, paths.id);
  if (recovered?.status === "committed") return recovered;

  validateArchivePaths(paths);
  const artifact = readJsonFile(paths.artifactFile, "artifact.json");
  const index = readJsonFile(paths.indexFile, "artifacts/index.json");
  validateArtifactContract(artifact, paths.id);
  validateActiveIndex(index, artifact, paths);
  validateSummary(paths.root, paths.summaryFile, artifact.status === "cancelled" ? "cancelled" : "completed");

  let outcome;
  let conclusion = "NOT_REQUIRED";
  if (artifact.status === "cancelled") {
    outcome = "cancelled";
  } else {
    assertReviewInputs(paths, artifact);
    const review = reviewReadiness(paths.source, { archive: true, cwd: root });
    if (review.gate !== "PASS") throw new ArchiveGateError(`Review 归档门禁未通过：${review.blockers.join("；") || review.gate}`);
    outcome = "completed";
    conclusion = review.conclusion;
  }

  const updatedAt = new Date().toISOString();
  const nextArtifact = { ...artifact, status: "archived", outcome, updatedAt };
  const nextIndex = { ...index, active: index.active.filter((item) => item.id !== paths.id) };
  const journal = {
    schemaVersion: 1,
    id: paths.id,
    phase: "prepared",
    oldArtifact: artifact,
    nextArtifact,
    oldIndex: index,
    nextIndex,
  };

  writeJsonAtomic(paths.journalFile, journal, { createOnly: true });
  try {
    safeRenameSync(paths.source, paths.target);
    setJournalPhase(paths.journalFile, journal, "moved");
    writeJsonAtomic(path.join(paths.target, "artifact.json"), nextArtifact);
    setJournalPhase(paths.journalFile, journal, "state-updated");
    writeJsonAtomic(paths.indexFile, nextIndex);
    setJournalPhase(paths.journalFile, journal, "index-updated");
    fs.unlinkSync(paths.journalFile);
  } catch (error) {
    const rollbackError = rollbackArchive(root, journal);
    if (rollbackError) throw new Error(`${error.message}；归档回滚失败：${rollbackError.message}`);
    throw error;
  }

  return { status: "archived", artifact: paths.id, path: relativePosix(root, paths.target), outcome, conclusion };
}

export function recoverPendingArchive(root, id) {
  root = fs.realpathSync(root);
  if (!ARTIFACT_ID.test(id || "")) throw new InvocationError("Artifact ID 格式无效");
  const journalFile = path.join(root, "artifacts", `.archive-${id}.json`);
  if (!entryExists(journalFile)) return null;
  assertRegularInside(root, journalFile, "归档事务日志");
  const journal = readJsonFile(journalFile, "归档事务日志");
  validateJournal(journal, id);
  const paths = resolvePaths(root, path.join("artifacts", id));

  if (journal.phase === "index-updated") {
    if (!entryExists(paths.target) || entryExists(paths.source)) throw new Error("已提交归档事务的目录状态不一致");
    writeJsonAtomic(path.join(paths.target, "artifact.json"), journal.nextArtifact);
    writeJsonAtomic(paths.indexFile, journal.nextIndex);
    fs.unlinkSync(paths.journalFile);
    return { status: "committed", artifact: id, path: relativePosix(root, paths.target), outcome: journal.nextArtifact.outcome };
  }

  const error = rollbackArchive(root, journal);
  if (error) throw new Error(`无法恢复未完成归档事务：${error.message}`);
  return { status: "rolled-back", artifact: id };
}

function safeRenameSync(src, dst) {
  try { fs.renameSync(src, dst); }
  catch (error) {
    if (error.code !== "EXDEV") throw error;
    fs.cpSync(src, dst, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
}

function rollbackArchive(root, journal) {
  try {
    const paths = resolvePaths(root, path.join("artifacts", journal.id));
    if (entryExists(paths.target)) {
      if (entryExists(paths.source)) throw new Error("源目录和归档目录同时存在");
      safeRenameSync(paths.target, paths.source);
    }
    if (!entryExists(paths.source)) throw new Error("找不到可恢复的 Artifact 目录");
    writeJsonAtomic(path.join(paths.source, "artifact.json"), journal.oldArtifact);
    writeJsonAtomic(paths.indexFile, journal.oldIndex);
    if (entryExists(paths.journalFile)) fs.unlinkSync(paths.journalFile);
    return null;
  } catch (error) {
    return error;
  }
}

function resolvePaths(root, input) {
  const artifactsRoot = path.join(root, "artifacts");
  assertDirectoryInside(root, artifactsRoot, "artifacts 目录");
  const source = path.resolve(root, input);
  const id = path.basename(source);
  if (!ARTIFACT_ID.test(id) || path.dirname(source) !== artifactsRoot) throw new InvocationError("只允许归档 artifacts/ 下的一级 Artifact");
  const archiveRoot = path.join(artifactsRoot, "_archived");
  if (!entryExists(archiveRoot)) fs.mkdirSync(archiveRoot, { recursive: true });
  assertDirectoryInside(root, archiveRoot, "归档目录");
  return {
    root,
    id,
    artifactsRoot,
    archiveRoot,
    source,
    target: path.join(archiveRoot, id),
    artifactFile: path.join(source, "artifact.json"),
    reviewFile: path.join(source, "review", "review.json"),
    requirementsFile: path.join(source, "requirements", "requirements.md"),
    summaryFile: path.join(source, "archive", "summary.md"),
    indexFile: path.join(artifactsRoot, "index.json"),
    journalFile: path.join(artifactsRoot, `.archive-${id}.json`),
  };
}

function validateArchivePaths(paths) {
  assertDirectoryInside(paths.root, paths.source, "Artifact 目录");
  if (entryExists(paths.target)) throw new InvocationError("目标归档目录已存在");
  if (entryExists(paths.journalFile)) throw new InvocationError("存在未恢复的归档事务日志");
  assertRegularInside(paths.root, paths.artifactFile, "artifact.json");
  assertRegularInside(paths.root, paths.indexFile, "artifacts/index.json");
}

function assertReviewInputs(paths, artifact) {
  assertRegularInside(paths.root, paths.reviewFile, "review/review.json");
  if (["L2", "L3"].includes(artifact.flowLevel)) assertRegularInside(paths.root, paths.requirementsFile, "requirements/requirements.md");
}

function validateArtifactContract(artifact, id) {
  if (artifact?.schemaVersion !== 1 || artifact.id !== id || !["L1", "L2", "L3"].includes(artifact.flowLevel)) throw new ArchiveGateError("artifact.json 基础契约无效");
  if (!["in_progress", "paused", "completed", "cancelled"].includes(artifact.status) || artifact.outcome !== null) throw new ArchiveGateError("Artifact 生命周期状态不允许归档");
  if (!isTimestamp(artifact.createdAt) || !isTimestamp(artifact.updatedAt) || Date.parse(artifact.createdAt) > Date.parse(artifact.updatedAt)) throw new ArchiveGateError("Artifact 时间字段无效");
  if (artifact.parentArtifactId !== null && !ARTIFACT_ID.test(artifact.parentArtifactId || "")) throw new ArchiveGateError("parentArtifactId 无效");
  if (!Array.isArray(artifact.deliverables) || artifact.deliverables.some((item) => !item || !["deliverable", "artifact-reference"].includes(item.kind) || typeof item.path !== "string" || !item.path.trim() || typeof item.description !== "string" || !item.description.trim())) throw new ArchiveGateError("artifact.json deliverables 契约无效");
}

function isTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === normalized;
}
function validateActiveIndex(index, artifact, paths) {
  if (index?.schemaVersion !== 1 || !Array.isArray(index.active)) throw new ArchiveGateError("artifacts/index.json 契约无效");
  const seen = new Set();
  for (const item of index.active) {
    if (!item || !ARTIFACT_ID.test(item.id || "") || item.path !== `artifacts/${item.id}` || !["pending", "in_progress", "paused", "completed", "cancelled"].includes(item.status) || !isTimestamp(item.updatedAt) || seen.has(item.id)) throw new ArchiveGateError("artifacts/index.json 包含无效或重复索引项");
    seen.add(item.id);
  }
  const matches = index.active.filter((item) => item.id === paths.id);
  if (matches.length !== 1) throw new ArchiveGateError("活跃索引必须且只能登记一次当前 Artifact");
  const item = matches[0];
  if (item.path !== relativePosix(paths.root, paths.source) || item.status !== artifact.status || item.updatedAt !== artifact.updatedAt) {
    throw new ArchiveGateError("活跃索引与 artifact.json 不一致");
  }
}

function validateSummary(root, file, outcome) {
  assertRegularInside(root, file, "archive/summary.md");
  const text = fs.readFileSync(file, "utf8");
  if (outcome === "cancelled") {
    if (!/^# 取消摘要\s*$/m.test(text) || !validSection(text, "取消原因") || !validSection(text, "未完成范围")) {
      throw new ArchiveGateError("取消摘要必须包含“取消原因”和“未完成范围”的有效内容");
    }
    return;
  }
  if (!/^# 完结摘要\s*$/m.test(text) || !validSection(text, "最终产出")) throw new ArchiveGateError("完结摘要必须包含“最终产出”的有效内容");
}

function validSection(text, name) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${name}`);
  if (start < 0) return false;
  const values = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s+/.test(line)) break;
    if (line.trim()) values.push(line.trim());
  }
  const value = values.join(" " );
  return Boolean(value) && !/^(?:待补充.*|无|N\/?A)$/i.test(value);
}

function validateJournal(journal, id) {
  const phases = new Set(["prepared", "moved", "state-updated", "index-updated"]);
  if (journal?.schemaVersion !== 1 || journal.id !== id || !phases.has(journal.phase) || !journal.oldArtifact || !journal.nextArtifact || !journal.oldIndex || !journal.nextIndex) {
    throw new Error("归档事务日志契约无效");
  }
}

function setJournalPhase(file, journal, phase) {
  journal.phase = phase;
  writeJsonAtomic(file, journal);
}

function writeJsonAtomic(file, value, options = {}) {
  if (options.createOnly && entryExists(file)) throw new InvocationError(`目标已存在：${file}`);
  const parent = path.dirname(file);
  const temp = path.join(parent, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  if (entryExists(temp)) throw new Error(`临时文件已存在：${temp}`);
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    fs.renameSync(temp, file);
  } catch (error) {
    if (entryExists(temp)) fs.unlinkSync(temp);
    throw error;
  }
}

function readJsonFile(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { throw new InvocationError(`${label} 不存在或 JSON 无法解析`); }
}

function assertDirectoryInside(root, file, label) {
  if (!entryExists(file)) throw new InvocationError(`${label}不存在`);
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new InvocationError(`${label}必须是非符号链接目录`);
  assertInside(root, fs.realpathSync(file), label);
}

function assertRegularInside(root, file, label) {
  if (!entryExists(file)) throw new InvocationError(`${label}不存在`);
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new InvocationError(`${label}必须是非符号链接普通文件`);
  assertInside(root, fs.realpathSync(file), label);
}

function assertInside(root, file, label) {
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new InvocationError(`${label}越过工作区边界`);
}

function entryExists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function parseArgs(argv) {
  if (argv.length !== 1 || argv[0].startsWith("--")) throw new InvocationError("用法：archive-task.mjs artifacts/{artifact-id}");
  return argv[0];
}

function relativePosix(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function sameFile(left, right) {
  try { return fs.realpathSync(left) === fs.realpathSync(right); }
  catch { return false; }
}

class InvocationError extends Error {
  constructor(message) { super(message); this.exitCode = 2; }
}

class ArchiveGateError extends Error {
  constructor(message) { super(message); this.exitCode = 1; }
}

if (isMain) runCli();
