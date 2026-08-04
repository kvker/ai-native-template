#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FLOW_LEVELS = new Set(["L1", "L2", "L3"]);
const STATUSES = new Set(["pending", "in_progress", "paused", "completed", "cancelled", "archived"]);
const ACTIVE_STATUSES = new Set(["pending", "in_progress", "paused", "completed", "cancelled"]);
const CONCLUSIONS = new Set(["PASS", "REVIEW", "BLOCKED"]);
const ID_PATTERN = /^[A-Z][A-Z0-9_-]*\d+$/;
const PLACEHOLDER = /^(?:无(?:。)?|[-—]|待补充.*|待定.*|未提供.*|未执行.*|无证据.*|N\/?A(?:\s*[（(].*)?|None)$/i;

const isMain = process.argv[1] && sameFile(process.argv[1], fileURLToPath(import.meta.url));
if (isMain) runCli();

function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  try {
    const args = parseArgs(argv);
    const artifact = resolveArtifact(args.positionals[0], cwd);
    const result = reviewReadiness(artifact, { archive: args.archive, cwd });
    process.stdout.write(toMarkdown(result));
    process.exitCode = result.gate === "PASS" ? 0 : result.gate === "REVIEW" ? 3 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

export function reviewReadiness(artifact, options = {}) {
  const cwd = fs.realpathSync(options.cwd || process.cwd());
  artifact = path.resolve(artifact);
  if (!entryExists(artifact) || fs.lstatSync(artifact).isSymbolicLink()) throw new Error("Artifact 目录必须是非符号链接目录");
  artifact = fs.realpathSync(artifact);
  assertDirectoryInside(cwd, artifact, "Artifact 目录");
  const archiveMode = options.archive === true;
  const artifactPath = path.join(artifact, "artifact.json");
  const reviewPath = path.join(artifact, "review", "review.json");
  const requirementsPath = path.join(artifact, "requirements", "requirements.md");
  const artifactRead = readJson(artifactPath, cwd);
  const reviewRead = readJson(reviewPath, cwd);
  const indexRead = readJson(path.join(cwd, "artifacts", "index.json"), cwd);
  const blockers = [];

  if (artifactRead.error) blockers.push(artifactRead.error);
  if (reviewRead.error) blockers.push(reviewRead.error);
  if (indexRead.error) blockers.push(indexRead.error);

  const artifactData = artifactRead.value || {};
  const review = reviewRead.value || {};
  blockers.push(...validateArtifact(artifactData, path.basename(artifact)));
  blockers.push(...validateIndex(indexRead.value, artifactData, path.relative(cwd, artifact)));
  blockers.push(...validateReview(review));
  if (!archiveMode && !["in_progress", "paused"].includes(artifactData.status)) blockers.push("执行 Review 前 Artifact 状态必须为 in_progress 或 paused");
  if (isTimestamp(review.reviewedAt) && isTimestamp(artifactData.createdAt) && Date.parse(review.reviewedAt) < Date.parse(artifactData.createdAt)) blockers.push("reviewedAt 不能早于 Artifact createdAt");

  const level = artifactData.flowLevel;
  const requirementsMissing = ["L2", "L3"].includes(level) && !entryExists(requirementsPath);
  const requirements = requirementsMissing
    ? { criteria: [], errors: [] }
    : ["L2", "L3"].includes(level)
      ? parseRequirementsCriteria(readText(requirementsPath, cwd), requirementsPath)
      : { criteria: [], errors: [] };
  blockers.push(...requirements.errors);

  if (["L2", "L3"].includes(level)) {
    if (requirementsMissing) blockers.push("L2/L3 缺少 requirements/requirements.md");
    blockers.push(...validateCriteriaCoverage(requirements.criteria, review.criteria));
  }

  const conclusion = review.conclusion;
  const reviewDigest = calculateReviewDigest(review);
  const pendingIds = Array.isArray(review.criteria)
    ? review.criteria.filter((item) => item?.status === "REVIEW").map((item) => item.id)
    : [];
  const blockedIds = Array.isArray(review.criteria)
    ? review.criteria.filter((item) => item?.status === "BLOCKED").map((item) => item.id)
    : [];
  const unresolved = Array.isArray(review.unresolved) ? review.unresolved : [];

  if (blockedIds.length) blockers.push(`存在 BLOCKED 完成标准：${blockedIds.join("、")}`);
  if (conclusion === "PASS") {
    if (pendingIds.length) blockers.push(`PASS 结论仍有 REVIEW 完成标准：${pendingIds.join("、")}`);
    if (unresolved.length) blockers.push(`PASS 结论仍有 ${unresolved.length} 项未解决事项`);
  }
  if (conclusion === "REVIEW" && pendingIds.length === 0 && unresolved.length === 0) {
    blockers.push("REVIEW 结论没有待复核标准或未解决事项");
  }
  if (conclusion === "BLOCKED") blockers.push("Review 结论为 BLOCKED");

  let acceptanceRecorded = false;
  if (archiveMode) {
    if (conclusion === "PASS" && artifactData.status !== "completed") blockers.push("PASS 归档前 Artifact 状态必须为 completed");
    if (conclusion === "REVIEW" && !["in_progress", "paused"].includes(artifactData.status)) blockers.push("REVIEW 接受归档要求 Artifact 仍为活跃状态");
    if (!Array.isArray(artifactData.deliverables) || artifactData.deliverables.length === 0) blockers.push("归档前必须记录实际交付物引用");
    if (conclusion === "REVIEW" && review.acceptance !== null && review.acceptance !== undefined) {
      const acceptanceErrors = validateAcceptance(review.acceptance, pendingIds, unresolved, reviewDigest, review.reviewedAt);
      blockers.push(...acceptanceErrors);
      acceptanceRecorded = acceptanceErrors.length === 0;
    }
  }

  const gate = blockers.length
    ? "BLOCKED"
    : conclusion === "REVIEW" && !(archiveMode && acceptanceRecorded)
      ? "REVIEW"
      : conclusion === "PASS" || (conclusion === "REVIEW" && acceptanceRecorded)
        ? "PASS"
        : "BLOCKED";

  return {
    artifact: path.relative(cwd, artifact) || ".",
    artifactFile: path.relative(cwd, artifactPath),
    reviewFile: path.relative(cwd, reviewPath),
    archiveMode,
    level: level || "MISSING",
    status: typeof artifactData.status === "string" ? artifactData.status : "MISSING",
    conclusion: conclusion || "MISSING",
    gate,
    criteriaDefined: requirements.criteria.length || (Array.isArray(review.criteria) ? review.criteria.length : 0),
    reviewRows: Array.isArray(review.criteria) ? review.criteria.length : 0,
    pendingIds,
    unresolved,
    acceptanceRecorded,
    reviewDigest,
    blockers: unique(blockers),
  };
}

function validateIndex(value, artifact, artifactPath) {
  if (!isObject(value) || value.schemaVersion !== 1 || !Array.isArray(value.active)) return ["artifacts/index.json 契约无效"];
  const seen = new Set();
  for (const item of value.active) {
    if (!isObject(item) || !/^\d{8}__[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || "") || item.path !== `artifacts/${item.id}` || !ACTIVE_STATUSES.has(item.status) || !isTimestamp(item.updatedAt) || seen.has(item.id)) {
      return ["artifacts/index.json 包含无效或重复索引项"];
    }
    seen.add(item.id);
  }
  if (!artifact?.id) return [];
  const matches = value.active.filter((item) => item.id === artifact.id);
  if (matches.length !== 1) return ["artifacts/index.json 必须且只能登记一次当前 Artifact"];
  const item = matches[0];
  const errors = [];
  if (item.path !== artifactPath.split(path.sep).join("/")) errors.push("artifacts/index.json 中的 Artifact 路径不一致");
  if (item.status !== artifact.status) errors.push("artifacts/index.json 中的 Artifact 状态不一致");
  if (item.updatedAt !== artifact.updatedAt) errors.push("artifacts/index.json 中的 updatedAt 与 Artifact 不一致");
  return errors;
}

function validateArtifact(value, directoryName) {
  const errors = [];
  if (!isObject(value)) return ["缺少或无法解析 artifact.json"];
  if (value.schemaVersion !== 1) errors.push("artifact.json schemaVersion 必须为 1");
  if (value.id !== directoryName) errors.push("artifact.json id 必须与目录名一致");
  if (!FLOW_LEVELS.has(value.flowLevel)) errors.push("artifact.json flowLevel 必须严格使用 L1、L2 或 L3");
  if (!/^\d{8}__[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id || "")) errors.push("artifact.json id 格式无效");
  if (!STATUSES.has(value.status)) errors.push("artifact.json status 无效");
  if (["cancelled", "archived"].includes(value.status)) errors.push("已取消或已归档 Artifact 不能执行 Review");
  if (value.outcome !== null) errors.push("活跃 Artifact 的 outcome 必须为 null");
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) errors.push("artifact.json 缺少有效 UTC createdAt 或 updatedAt");
  else if (Date.parse(value.createdAt) > Date.parse(value.updatedAt)) errors.push("artifact.json updatedAt 不能早于 createdAt");
  if (value.parentArtifactId !== null && !/^\d{8}__[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.parentArtifactId || "")) errors.push("artifact.json parentArtifactId 必须为合法 Artifact ID 或 null");
  if (!Array.isArray(value.deliverables)) errors.push("artifact.json deliverables 必须为数组");
  else if (value.deliverables.some((item) => !isObject(item) || !["deliverable", "artifact-reference"].includes(item.kind) || isPlaceholder(item.path) || isPlaceholder(item.description))) errors.push("artifact.json deliverables 项必须包含有效 path 和 description");
  return errors;
}

export function validateReview(value) {
  const errors = [];
  if (!isObject(value)) return ["缺少或无法解析 review/review.json"];
  if (value.schemaVersion !== 1) errors.push("review.json schemaVersion 必须为 1");
  const conclusion = value.conclusion;
  if (!CONCLUSIONS.has(conclusion)) errors.push("review.json conclusion 必须严格使用 PASS、REVIEW 或 BLOCKED");
  if (!isTimestamp(value.reviewedAt)) errors.push("review.json 缺少有效 UTC reviewedAt");
  if (!Array.isArray(value.criteria) || value.criteria.length === 0) {
    errors.push("review.json criteria 必须包含至少一项检查记录");
  } else {
    const seen = new Set();
    for (const [index, criterion] of value.criteria.entries()) {
      if (!isObject(criterion)) { errors.push(`review.json criteria[${index}] 必须为对象`); continue; }
      const id = criterion.id;
      if (typeof id !== "string" || !ID_PATTERN.test(id)) errors.push(`review.json criteria[${index}] ID 无效，必须使用大写稳定 ID`);
      else if (seen.has(id)) errors.push(`review.json 存在重复完成标准 ID：${id}`);
      else seen.add(id);
      if (isPlaceholder(criterion.description)) errors.push(`完成标准 ${id || index} 缺少标准描述`);
      if (!CONCLUSIONS.has(criterion.status)) errors.push(`完成标准 ${id || index} 的 status 必须严格使用 PASS、REVIEW 或 BLOCKED`);
      if (isPlaceholder(criterion.method)) errors.push(`完成标准 ${id || index} 缺少有效检查方式`);
      if (!Array.isArray(criterion.evidence) || criterion.evidence.length === 0 || criterion.evidence.some(isPlaceholder)) {
        errors.push(`完成标准 ${id || index} 缺少有效证据`);
      }
    }
  }
  if (!Array.isArray(value.unresolved) || value.unresolved.some((item) => typeof item !== "string" || isPlaceholder(item))) {
    errors.push("review.json unresolved 必须为不含占位值的字符串数组；没有事项时使用空数组");
  }
  if (conclusion !== "REVIEW" && value.acceptance !== null) errors.push("只有 REVIEW 结论可以包含 acceptance");
  if (conclusion === "REVIEW" && value.acceptance !== null) {
    const pendingIds = Array.isArray(value.criteria) ? value.criteria.filter((item) => item?.status === "REVIEW").map((item) => item.id) : [];
    const unresolved = Array.isArray(value.unresolved) ? value.unresolved : [];
    errors.push(...validateAcceptance(value.acceptance, pendingIds, unresolved, calculateReviewDigest(value), value.reviewedAt));
  }
  return errors;
}

export function parseRequirementsCriteria(text, source = "requirements/requirements.md") {
  const criteria = [];
  const errors = [];
  const seen = new Set();
  let inSection = false;
  let fence = "";
  let inComment = false;

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    if (line.includes("<!--")) {
      if (!line.includes("-->")) inComment = true;
      continue;
    }
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = "";
      continue;
    }
    if (fence || /^(?: {4}|\t)/.test(line)) continue;
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].replace(/\s+#+\s*$/, "").trim();
      if (level <= 2) inSection = level === 2 && /^(完成标准|验收标准|Acceptance Criteria)$/i.test(title);
      continue;
    }
    if (!inSection || !line.trim()) continue;
    const item = line.match(/^ {0,3}(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s*)?([A-Za-z][A-Za-z0-9_-]*\d+)\s*[:：.\-]\s*(.+)$/);
    if (!item) {
      errors.push(`${source}:${lineNumber} 完成标准章节只允许单行稳定 ID 列表`);
      continue;
    }
    const id = item[1];
    if (id !== id.toUpperCase()) errors.push(`${source}:${lineNumber} 完成标准 ID 必须大写：${id}`);
    else if (seen.has(id)) errors.push(`${source}:${lineNumber} 存在重复完成标准 ID：${id}`);
    else { seen.add(id); criteria.push({ id, text: item[2].trim() }); }
  }
  if (criteria.length === 0) errors.push(`${source} 的“完成标准”章节缺少稳定 ID 列表`);
  return { criteria, errors };
}

export function validateCriteriaCoverage(requirements, reviewCriteria) {
  if (!Array.isArray(reviewCriteria)) return [];
  const required = new Map(requirements.map((item) => [item.id, item.text]));
  const reviewed = new Map(reviewCriteria.map((item) => [item?.id, item?.description]).filter(([id]) => Boolean(id)));
  const missing = [...required.keys()].filter((id) => !reviewed.has(id));
  const unexpected = [...reviewed.keys()].filter((id) => !required.has(id));
  const changed = [...required.entries()].filter(([id, description]) => reviewed.has(id) && reviewed.get(id) !== description).map(([id]) => id);
  const errors = [];
  if (missing.length) errors.push(`Review 未覆盖完成标准：${missing.join("、")}`);
  if (unexpected.length) errors.push(`Review 包含 requirements 中不存在的 ID：${unexpected.join("、")}`);
  if (changed.length) errors.push(`Review 标准描述与 requirements 不一致：${changed.join("、")}`);
  return errors;
}

export function calculateReviewDigest(review) {
  const payload = {
    schemaVersion: review?.schemaVersion,
    reviewedAt: review?.reviewedAt,
    conclusion: review?.conclusion,
    criteria: review?.criteria,
    unresolved: review?.unresolved,
  };
  return crypto.createHash("sha256").update(canonicalStringify(payload)).digest("hex");
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function validateAcceptance(value, pendingIds, unresolved, reviewDigest, reviewedAt) {
  if (!isObject(value) || value.accepted !== true) return ["REVIEW 归档前缺少明确接受记录"];
  const errors = [];
  if (!isTimestamp(value.acceptedAt)) errors.push("REVIEW 接受记录缺少有效 UTC acceptedAt");
  else if (isTimestamp(reviewedAt) && Date.parse(value.acceptedAt) < Date.parse(reviewedAt)) errors.push("REVIEW 接受时间不能早于 reviewedAt");
  if (value.reviewDigest !== reviewDigest) errors.push("REVIEW 接受记录与当前 Review 内容摘要不一致");
  if (isPlaceholder(value.source)) errors.push("REVIEW 接受记录缺少指令来源");
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.some(isPlaceholder)) {
    errors.push("REVIEW 接受记录必须列出已接受事项");
    return errors;
  }
  const accepted = new Set(value.items.map((item) => String(item).trim()));
  const missing = [...pendingIds, ...unresolved].filter((item) => !accepted.has(item));
  if (missing.length) errors.push(`REVIEW 接受记录未覆盖：${missing.join("、")}`);
  return errors;
}

function resolveArtifact(input, cwdInput) {
  if (!input) throw new Error("用法：review-task.mjs artifacts/{artifact-id} [--archive]");
  const cwd = fs.realpathSync(cwdInput);
  const artifactsRoot = path.join(cwd, "artifacts");
  const indexPath = path.join(artifactsRoot, "index.json");
  assertDirectoryInside(cwd, artifactsRoot, "artifacts 目录");
  assertRegularInside(cwd, indexPath, "artifacts/index.json");
  const artifact = path.resolve(cwd, input);
  if (path.dirname(artifact) !== artifactsRoot) throw new Error("只允许检查 artifacts/ 下的一级活跃 Artifact");
  assertDirectoryInside(cwd, artifact, "Artifact 目录");
  return fs.realpathSync(artifact);
}

function assertDirectoryInside(root, file, label) {
  if (!entryExists(file) || pathHasSymlink(root, file) || !fs.lstatSync(file).isDirectory()) throw new Error(`${label}必须是工作区内的非符号链接目录`);
}

function assertRegularInside(root, file, label) {
  if (!entryExists(file) || pathHasSymlink(root, file) || !fs.lstatSync(file).isFile()) throw new Error(`${label}必须是工作区内的非符号链接普通文件`);
}

function pathHasSymlink(root, file) {
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return true;
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (entryExists(current) && fs.lstatSync(current).isSymbolicLink()) return true;
  }
  return false;
}

function entryExists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function sameFile(left, right) {
  try { return fs.realpathSync(left) === fs.realpathSync(right); }
  catch { return false; }
}
function parseArgs(argv) {
  const parsed = { positionals: [], archive: false };
  for (const item of argv) {
    if (item === "--archive") parsed.archive = true;
    else if (item.startsWith("--")) throw new Error(`未知参数：${item}`);
    else parsed.positionals.push(item);
  }
  if (parsed.positionals.length !== 1) throw new Error("必须且只能指定一个 Artifact 路径");
  return parsed;
}

function readJson(file, root) {
  if (!entryExists(file)) return { value: null, error: `${path.basename(file)} 文件不存在` };
  if (pathHasSymlink(root, file) || !fs.lstatSync(file).isFile()) return { value: null, error: `${path.basename(file)} 不是工作区内的非符号链接普通文件` };
  try { return { value: JSON.parse(fs.readFileSync(file, "utf8")), error: null }; }
  catch { return { value: null, error: `${path.basename(file)} JSON 无法解析` }; }
}

function readText(file, root) {
  if (!entryExists(file) || pathHasSymlink(root, file) || !fs.lstatSync(file).isFile()) return "";
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function isPlaceholder(value) {
  return typeof value !== "string" || !value.trim() || PLACEHOLDER.test(value.trim());
}

function isTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === normalized;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unique(items) {
  return [...new Set(items)];
}

function toMarkdown(result) {
  const lines = [
    "# AI Native Review Gate",
    "",
    `- Artifact: \`${result.artifact}\``,
    `- Artifact state: **${result.status}**`,
    `- Flow level: **${result.level}**`,
    `- Declared conclusion: **${result.conclusion}**`,
    `- Archive mode: **${result.archiveMode ? "yes" : "no"}**`,
    `- Archive gate: **${result.gate}**`,
    `- Completion criteria defined: ${result.criteriaDefined}`,
    `- Review rows: ${result.reviewRows}`,
    `- Pending review rows: ${result.pendingIds.length}`,
    `- Unresolved items: ${result.unresolved.length}`,
    `- Acceptance recorded: ${result.acceptanceRecorded ? "yes" : "no"}`,
    `- Review digest: \`${result.reviewDigest}\``,
    "",
    "## Blockers",
    "",
  ];
  if (result.blockers.length) result.blockers.forEach((blocker) => lines.push(`- ${blocker}`));
  else lines.push("- None");
  lines.push("");
  return lines.join("\n");
}
