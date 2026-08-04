#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { calculateReviewDigest, parseRequirementsCriteria, validateCriteriaCoverage, validateReview } from "../../an-review/scripts/review-task.mjs";

const SKIPPED_NAMES = new Set(["node_modules", "dist", "build", "coverage", "target", "vendor", "__pycache__", "venv", ".venv"]);
const SENSITIVE_NAMES = /(?:^|[._-])(?:secrets?|credentials?|tokens?)(?=$|[._-])/i;

try {
  const args = parseArgs(process.argv.slice(2));
  const cwd = fs.realpathSync(process.cwd());
  const root = resolveInside(cwd, args.root || "projects", "--root", { allowMissing: true });
  const artifacts = resolveInside(cwd, args.artifacts || "artifacts", "--artifacts", { allowMissing: true });
  const format = args.format || (args.write ? "json" : "markdown");
  if (!["json", "markdown"].includes(format)) throw new Error("--format 只能是 json 或 markdown");
  const scanLimit = parseLimit(args.limit, 1000);
  const archiveLimit = parseLimit(args["archive-limit"], 100);
  const diagnostics = [];
  const artifactsExists = entryExists(artifacts);
  if (!artifactsExists) diagnostics.push(diagnostic("warning", "ARTIFACTS_ROOT_NOT_FOUND", relativeTo(cwd, artifacts), "artifacts 根目录不存在"));
  else if (!fs.lstatSync(artifacts).isDirectory()) throw new Error("--artifacts 必须指向目录");
  const activeIds = artifactsExists ? readActiveIds(artifacts, diagnostics, cwd) : new Set();
  const summary = {
    schemaVersion: 4,
    generatedAt: new Date().toISOString(),
    root: relativeTo(cwd, root),
    rootExists: entryExists(root),
    artifacts: relativeTo(cwd, artifacts),
    artifactsExists,
    diagnostics,
    workspaces: scanWorkspaces(root, scanLimit, diagnostics, cwd),
    archivedReviews: scanArchivedReviews(path.join(artifacts, "_archived"), archiveLimit, activeIds, diagnostics, cwd),
  };
  const output = format === "json" ? JSON.stringify(summary, null, 2) : toMarkdown(summary);

  if (args.write) {
    const target = resolveInside(cwd, args.write, "--write");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${output}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}

function scanWorkspaces(root, limit, diagnostics, cwd) {
  if (!entryExists(root)) {
    diagnostics.push(diagnostic("warning", "ROOT_NOT_FOUND", relativeTo(cwd, root), "工作区根目录不存在"));
    return [];
  }
  if (!fs.lstatSync(root).isDirectory()) throw new Error("--root 必须指向目录");
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch (error) { diagnostics.push(diagnostic("error", "ROOT_UNREADABLE", relativeTo(cwd, root), error.message)); return []; }
  return entries
    .filter((entry) => entry.isDirectory() && !shouldSkip(entry.name))
    .sort((left, right) => compareStrings(left.name, right.name))
    .map((entry) => scanWorkspace(path.join(root, entry.name), entry.name, limit, diagnostics, cwd));
}

function scanWorkspace(dir, name, limit, diagnostics, cwd) {
  const inventory = collectInventory(dir, limit, diagnostics, cwd);
  const topLevel = topLevelEntries(dir, 40, diagnostics, cwd);
  return {
    name,
    path: relativeTo(cwd, dir),
    scan: {
      entriesScanned: inventory.entriesScanned,
      scanLimit: inventory.limit,
      truncated: inventory.truncated,
    },
    fileCount: inventory.files.length,
    directoryCount: inventory.directories.length,
    topLevelEntries: topLevel.entries,
    topLevelTruncated: topLevel.truncated,
    fileTypes: countFileTypes(inventory.files),
    materialGroups: detectMaterialGroups(inventory.files),
    declaredActions: detectDeclaredActions(dir, diagnostics, cwd),
    readmeFiles: inventory.files.filter((file) => /(^|\/)readme(?:\.[^/]+)?$/i.test(file)).slice(0, 20),
    readmeTruncated: inventory.files.filter((file) => /(^|\/)readme(?:\.[^/]+)?$/i.test(file)).length > 20,
  };
}

function collectInventory(root, limit, diagnostics, cwd) {
  const files = [];
  const directories = [];
  const stack = [{ dir: root, prefix: "" }];
  let entriesScanned = 0;
  let truncated = false;
  while (stack.length) {
    if (entriesScanned >= limit) { truncated = true; break; }
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current.dir, { withFileTypes: true }).sort((a, b) => compareStrings(b.name, a.name)); }
    catch (error) { diagnostics.push(diagnostic("error", "DIRECTORY_UNREADABLE", relativeTo(cwd, current.dir), error.message)); continue; }
    for (const entry of entries) {
      if (entriesScanned >= limit) { truncated = true; break; }
      if (shouldSkip(entry.name)) continue;
      entriesScanned += 1;
      const relative = current.prefix ? `${current.prefix}/${entry.name}` : entry.name;
      const absolute = path.join(current.dir, entry.name);
      if (entry.isDirectory()) { directories.push(relative); stack.push({ dir: absolute, prefix: relative }); }
      else if (entry.isFile()) files.push(relative);
    }
  }
  return { files: files.sort(compareStrings), directories: directories.sort(compareStrings), entriesScanned, limit, truncated };
}

function topLevelEntries(dir, limit, diagnostics, cwd) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => (entry.isDirectory() || entry.isFile()) && !shouldSkip(entry.name)).sort((a, b) => compareStrings(a.name, b.name));
    return { entries: entries.slice(0, limit).map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "directory" : "file" })), truncated: entries.length > limit };
  } catch (error) {
    diagnostics.push(diagnostic("error", "TOP_LEVEL_UNREADABLE", relativeTo(cwd, dir), error.message));
    return { entries: [], truncated: false };
  }
}

function countFileTypes(files) {
  const counts = {};
  for (const file of files) {
    const extension = path.extname(file).toLowerCase() || "[no-extension]";
    counts[extension] = (counts[extension] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]));
  return { items: sorted.slice(0, 15).map(([extension, count]) => ({ extension, count })), truncated: sorted.length > 15 };
}

function detectMaterialGroups(files) {
  const definitions = [
    ["text", /\.(md|mdx|txt|rst)$/i],
    ["document", /\.(doc|docx|odt|pdf)$/i],
    ["presentation", /\.(ppt|pptx|odp)$/i],
    ["spreadsheet", /\.(xls|xlsx|ods)$/i],
    ["structured-data", /\.(json|ya?ml|csv|tsv|xml)$/i],
    ["visual", /\.(png|jpe?g|gif|webp|svg|fig|sketch)$/i],
    ["audio-video", /\.(mp3|wav|m4a|mp4|mov|webm)$/i],
    ["source", /\.(cjs|mjs|js|jsx|ts|tsx|py|go|rs|java|rb|php|c|cc|cpp|h|cs|swift|kt)$/i],
  ];
  return definitions.map(([name, pattern]) => ({ name, count: files.filter((file) => pattern.test(file)).length })).filter((group) => group.count);
}

function detectDeclaredActions(dir, diagnostics, cwd) {
  const packageFile = path.join(dir, "package.json");
  if (!safeFile(packageFile, diagnostics, cwd, { missing: "ignore" })) return { items: [], truncated: false };
  const pkg = readJson(packageFile, diagnostics, cwd);
  const scripts = Object.keys(pkg?.scripts || {}).sort();
  return { items: scripts.slice(0, 40), truncated: scripts.length > 40 };
}

function readActiveIds(artifacts, diagnostics, cwd) {
  const indexFile = path.join(artifacts, "index.json");
  if (!entryExists(indexFile)) return new Set();
  const index = readJson(indexFile, diagnostics, cwd);
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.active)) {
    diagnostics.push(diagnostic("error", "INVALID_ARTIFACT_INDEX", relativeTo(cwd, indexFile), "artifacts/index.json 契约无效"));
    return new Set();
  }
  const ids = [];
  let invalid = false;
  for (const item of index.active) {
    if (!item || typeof item !== "object" || !/^\d{8}__[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || "") || item.path !== `artifacts/${item.id}` || !["pending", "in_progress", "paused", "completed", "cancelled"].includes(item.status) || !isTimestamp(item.updatedAt)) {
      invalid = true;
      continue;
    }
    ids.push(item.id);
  }
  if (new Set(ids).size !== ids.length) invalid = true;
  if (invalid) diagnostics.push(diagnostic("error", "INVALID_ARTIFACT_INDEX", relativeTo(cwd, indexFile), "active 包含无效或重复索引项"));
  return new Set(ids);
}

function scanArchivedReviews(archiveDir, limit, activeIds, diagnostics, cwd) {
  let archiveStat;
  try { archiveStat = fs.lstatSync(archiveDir); }
  catch (error) { if (error.code === "ENOENT") return { items: [], limit, truncated: false }; throw error; }
  if (!archiveStat.isDirectory()) {
    diagnostics.push(diagnostic("error", "ARCHIVE_NOT_DIRECTORY", relativeTo(cwd, archiveDir), "归档路径不是目录"));
    return { items: [], limit, truncated: false };
  }
  let entries;
  try { entries = fs.readdirSync(archiveDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !shouldSkip(entry.name)).sort((a, b) => compareStrings(b.name, a.name)); }
  catch (error) { diagnostics.push(diagnostic("error", "ARCHIVE_UNREADABLE", relativeTo(cwd, archiveDir), error.message)); return { items: [], limit, truncated: false }; }
  const selected = entries.slice(0, limit);
  const items = selected.map((entry) => inspectArchivedArtifact(path.join(archiveDir, entry.name), entry.name, activeIds, diagnostics, cwd));
  return { items, limit, truncated: entries.length > limit };
}

function inspectArchivedArtifact(dir, name, activeIds, diagnostics, cwd) {
  const artifactFile = path.join(dir, "artifact.json");
  const reviewFile = path.join(dir, "review", "review.json");
  const summaryFile = path.join(dir, "archive", "summary.md");
  const requirementsFile = path.join(dir, "requirements", "requirements.md");
  const artifact = readJson(artifactFile, diagnostics, cwd);
  const errors = validateArchivedArtifact(artifact, name);
  if (activeIds.has(name)) errors.push("已归档 Artifact 仍存在于活跃索引");
  const summary = readSummary(summaryFile, diagnostics, cwd);
  errors.push(...validateArchiveSummary(summary, artifact?.outcome));

  let review = null;
  let conclusion = artifact?.outcome === "cancelled" ? "NOT_REQUIRED" : "MISSING";
  if (artifact?.outcome === "completed") {
    review = readJson(reviewFile, diagnostics, cwd);
    conclusion = typeof review?.conclusion === "string" ? review.conclusion : "MISSING";
    const requirements = ["L2", "L3"].includes(artifact?.flowLevel) ? readText(requirementsFile, diagnostics, cwd) : "";
    errors.push(...validateArchivedReview(review, artifact, requirements));
  }
  const acceptable = errors.length === 0 && artifact?.outcome === "completed";
  if (errors.length) diagnostics.push(diagnostic("warning", "ARCHIVE_NOT_ACCEPTABLE", relativeTo(cwd, dir), errors.join("；")));

  return {
    artifact: name,
    status: typeof artifact?.status === "string" ? artifact.status : "MISSING",
    outcome: typeof artifact?.outcome === "string" ? artifact.outcome : "MISSING",
    conclusion,
    acceptable,
    review: safeFile(reviewFile, diagnostics, cwd, { missing: "ignore", quiet: true }) ? relativeTo(cwd, reviewFile) : "",
    summary: summary ? relativeTo(cwd, summaryFile) : "",
  };
}

function validateArchivedArtifact(artifact, name) {
  const errors = [];
  if (!artifact || artifact.schemaVersion !== 1) return ["artifact.json 契约无效"];
  if (artifact.id !== name || !/^\d{8}__[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artifact.id)) errors.push("Artifact ID 与目录不一致");
  if (!["L1", "L2", "L3"].includes(artifact.flowLevel)) errors.push("flowLevel 无效");
  if (artifact.status !== "archived" || !["completed", "cancelled"].includes(artifact.outcome)) errors.push("归档生命周期无效");
  if (!isTimestamp(artifact.createdAt) || !isTimestamp(artifact.updatedAt) || Date.parse(artifact.createdAt) > Date.parse(artifact.updatedAt)) errors.push("Artifact 时间字段无效");
  if (artifact.parentArtifactId !== null && !/^\d{8}__[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artifact.parentArtifactId || "")) errors.push("parentArtifactId 无效");
  if (!Array.isArray(artifact.deliverables) || (artifact.outcome === "completed" && artifact.deliverables.length === 0) || artifact.deliverables.some((item) => !item || !["deliverable", "artifact-reference"].includes(item.kind) || typeof item.path !== "string" || !item.path.trim() || typeof item.description !== "string" || !item.description.trim())) errors.push("deliverables 契约无效");
  return errors;
}

function validateArchiveSummary(summary, outcome) {
  if (!summary) return ["缺少有效 archive/summary.md"];
  if (outcome === "cancelled") {
    return /^# 取消摘要\s*$/m.test(summary) && validSummarySection(summary, "取消原因") && validSummarySection(summary, "未完成范围")
      ? [] : ["取消摘要必须包含‘取消原因’和‘未完成范围’的有效内容"];
  }
  return /^# 完结摘要\s*$/m.test(summary) && validSummarySection(summary, "最终产出")
    ? [] : ["完结摘要必须包含‘最终产出’的有效内容"];
}

function validSummarySection(text, name) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${name}`);
  if (start < 0) return false;
  const values = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s+/.test(line)) break;
    if (line.trim()) values.push(line.trim());
  }
  const value = values.join(" ");
  return Boolean(value) && !/^(?:待补充.*|无|N\/?A)$/i.test(value);
}

function validateArchivedReview(review, artifact, requirementsText) {
  const errors = validateReview(review);
  if (errors.length) return errors;
  if (["L2", "L3"].includes(artifact.flowLevel)) {
    const parsed = parseRequirementsCriteria(requirementsText, "requirements/requirements.md");
    errors.push(...parsed.errors, ...validateCriteriaCoverage(parsed.criteria, review.criteria));
  }
  const statuses = review.criteria.map((item) => item.status);
  if (review.conclusion === "PASS") {
    if (statuses.some((status) => status !== "PASS") || review.unresolved.length) errors.push("PASS 与逐项结果或未解决事项冲突");
  } else if (review.conclusion === "REVIEW") {
    if (statuses.includes("BLOCKED") || (!statuses.includes("REVIEW") && review.unresolved.length === 0)) errors.push("REVIEW 与逐项结果不一致");
    if (!isAcceptedReview(review)) errors.push("REVIEW 缺少与当前内容匹配的完整接受记录");
  } else {
    errors.push("BLOCKED Review 不能作为稳定背景来源");
  }
  return errors;
}

function isAcceptedReview(review) {
  if (review?.conclusion !== "REVIEW") return false;
  const acceptance = review.acceptance;
  if (acceptance?.accepted !== true || !isTimestamp(acceptance.acceptedAt) || Date.parse(acceptance.acceptedAt) < Date.parse(review.reviewedAt) || typeof acceptance.source !== "string" || !acceptance.source.trim() || !Array.isArray(acceptance.items)) return false;
  if (acceptance.reviewDigest !== calculateReviewDigest(review)) return false;
  const accepted = new Set(acceptance.items.map((item) => String(item).trim()));
  const required = [
    ...review.criteria.filter((item) => item.status === "REVIEW").map((item) => item.id),
    ...review.unresolved,
  ];
  return required.length > 0 && required.every((item) => accepted.has(item));
}

function isTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === normalized;
}

function isSensitiveName(name) {
  return /^\.env(?:\.|$)/i.test(name) || SENSITIVE_NAMES.test(name);
}
function shouldSkip(name) {
  const lower = name.toLowerCase();
  return name.startsWith(".") || SKIPPED_NAMES.has(lower) || isSensitiveName(name);
}

function safeFile(file, diagnostics, cwd, options = {}) {
  if (!entryExists(file)) {
    if (options.missing !== "ignore" && !options.quiet) diagnostics.push(diagnostic("warning", "FILE_MISSING", relativeTo(cwd, file), "文件不存在"));
    return false;
  }
  const stat = fs.lstatSync(file);
  if (pathHasSymlink(cwd, file) || stat.isSymbolicLink() || !stat.isFile()) {
    if (!options.quiet) diagnostics.push(diagnostic("warning", "UNSAFE_FILE_SKIPPED", relativeTo(cwd, file), "不是非符号链接普通文件"));
    return false;
  }
  return true;
}

function pathHasSymlink(root, file) {
  const relative = path.relative(root, file);
  if (isOutside(relative)) return true;
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (entryExists(current) && fs.lstatSync(current).isSymbolicLink()) return true;
  }
  return false;
}
function readJson(file, diagnostics, cwd) {
  if (!safeFile(file, diagnostics, cwd)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) {
    const code = error instanceof SyntaxError ? "INVALID_JSON" : "FILE_UNREADABLE";
    diagnostics.push(diagnostic("error", code, relativeTo(cwd, file), error.message));
    return null;
  }
}

function readText(file, diagnostics, cwd) {
  if (!safeFile(file, diagnostics, cwd)) return "";
  try { return fs.readFileSync(file, "utf8"); }
  catch (error) {
    diagnostics.push(diagnostic("error", "FILE_UNREADABLE", relativeTo(cwd, file), error.message));
    return "";
  }
}

function readSummary(file, diagnostics, cwd) {
  if (!safeFile(file, diagnostics, cwd)) return "";
  try {
    const text = fs.readFileSync(file, "utf8").trim();
    return text && !/^(?:待补充|无|N\/?A)$/i.test(text) ? text : "";
  } catch (error) {
    diagnostics.push(diagnostic("error", "FILE_UNREADABLE", relativeTo(cwd, file), error.message));
    return "";
  }
}

function parseArgs(argv) {
  const parsed = {};
  const valueOptions = new Set(["root", "artifacts", "write", "format", "limit", "archive-limit"]);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--") || item.includes("=")) throw new Error(`无效参数：${item}`);
    const key = item.slice(2);
    if (!valueOptions.has(key)) throw new Error(`未知参数：${item}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${item} 缺少值`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function parseLimit(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100000) throw new Error("扫描上限必须为 1-100000 的安全整数");
  return parsed;
}

function resolveInside(cwd, input, label, options = {}) {
  const resolved = path.resolve(cwd, input);
  const relative = path.relative(cwd, resolved);
  if (isOutside(relative)) throw new Error(`${label} 必须位于工作区根目录内`);
  if (relative.split(path.sep).some(isSensitiveName)) throw new Error(`${label} 不能指向敏感路径`);
  let current = cwd;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (!entryExists(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`${label} 不能包含符号链接`);
  }
  if (entryExists(resolved)) return resolved;
  if (!options.allowMissing && label !== "--write") throw new Error(`${label} 路径不存在`);
  return resolved;
}

function entryExists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function isOutside(relative) {
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relativeTo(cwd, file) {
  return path.relative(cwd, file) || ".";
}

function diagnostic(level, code, file, message) {
  return { level, code, path: file, message };
}

function toMarkdown(data) {
  const lines = ["# 工作区扫描", "", `生成时间：${data.generatedAt}`, ""];
  if (data.diagnostics.length) {
    lines.push("## 扫描诊断", "", "| 级别 | 代码 | 路径 | 说明 |", "|------|------|------|------|");
    for (const item of data.diagnostics) lines.push(`| ${escapeCell(item.level)} | ${escapeCell(item.code)} | ${escapeCell(item.path)} | ${escapeCell(item.message)} |`);
    lines.push("");
  }
  if (!data.workspaces.length) lines.push(`\`${escapeCell(data.root)}\` 下没有可用工作单元。`, "");
  for (const workspace of data.workspaces) {
    lines.push(`## ${escapeHeading(workspace.name)}`, "", `- 路径：\`${escapeCell(workspace.path)}\``, `- 文件：${workspace.fileCount}`, `- 目录：${workspace.directoryCount}`, `- 已扫描条目：${workspace.scan.entriesScanned}`, `- 扫描上限：${workspace.scan.scanLimit}`, `- 结果截断：${workspace.scan.truncated ? "是，统计不完整" : "否"}`, `- 顶层条目截断：${workspace.topLevelTruncated ? "是" : "否"}`, `- 文件类型截断：${workspace.fileTypes.truncated ? "是" : "否"}`, `- 材料类型：${workspace.materialGroups.map((group) => `${escapeCell(group.name)}(${group.count})`).join("、") || "未识别"}`, `- 文件类型：${workspace.fileTypes.items.map((item) => `${escapeCell(item.extension)}(${item.count})`).join("、") || "无"}`, `- 声明动作：${workspace.declaredActions.items.map((action) => `\`${escapeCell(action)}\``).join("、") || "无"}${workspace.declaredActions.truncated ? "（已截断）" : ""}`, `- README：${workspace.readmeFiles.map((file) => `\`${escapeCell(file)}\``).join("、") || "无"}${workspace.readmeTruncated ? "（已截断）" : ""}`, "");
  }
  if (data.archivedReviews.items.length) {
    lines.push("## 已归档任务", "", "| Artifact | 状态 | Outcome | Review | 可用于背景 | 完结摘要 |", "|----------|------|---------|--------|------------|----------|");
    for (const item of data.archivedReviews.items) lines.push(`| ${escapeCell(item.artifact)} | ${escapeCell(item.status)} | ${escapeCell(item.outcome)} | ${escapeCell(item.conclusion)} | ${item.acceptable ? "是" : "否"} | ${item.summary ? `\`${escapeCell(item.summary)}\`` : "缺失"} |`);
    if (data.archivedReviews.truncated) lines.push("", `> 归档扫描达到 ${data.archivedReviews.limit} 项上限，结果不完整。`);
    lines.push("");
  }
  return lines.join("\n");
}

function escapeCell(value) {
  return escapeMarkdown(value).replace(/\|/g, "&#124;");
}

function escapeHeading(value) {
  return escapeMarkdown(value).replace(/[#|]/g, "-");
}

function escapeMarkdown(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "&#92;")
    .replace(/`/g, "&#96;")
    .replace(/[\r\n]+/g, " " );
}
