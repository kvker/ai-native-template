#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const artifact = path.resolve(args.positionals[0] || ".");
if (!fs.existsSync(artifact)) {
  console.error(`Artifact not found: ${artifact}`);
  process.exit(2);
}

const result = reviewReadiness(artifact, args.level);
process.stdout.write(toMarkdown(result));
process.exitCode = result.gate === "PASS" ? 0 : result.gate === "REVIEW" ? 3 : 1;

function reviewReadiness(dir, requestedLevel) {
  const requirements = readMarkdownTree(path.join(dir, "requirements"));
  const index = readMaybe(path.join(dir, "AGENTS.md"));
  const level = normalizeLevel(requestedLevel) || inferLevel(index, requirements);
  const reportPath = path.join(dir, "review", "review-report.md");
  const report = readMaybe(reportPath);
  const criteria = parseCriteria(requirements);
  const conclusion = parseConclusion(report);
  const reviewRows = parseReviewRows(report);
  const unresolved = parseUnresolved(report);
  const blockers = [];

  if (["L2", "L3"].includes(level) && !requirements.trim()) blockers.push("L2/L3 缺少 requirements 记录");
  if (["L2", "L3"].includes(level) && criteria.length === 0) blockers.push("L2/L3 requirements 中缺少可核对的完成标准");
  if (!report.trim()) blockers.push("缺少 review/review-report.md");
  if (!conclusion) blockers.push("Review 报告缺少明确结论");
  if (reviewRows.length === 0) blockers.push("Review 报告缺少完成标准检查记录");

  const invalidMethods = reviewRows.filter((row) => isPlaceholder(row.method));
  const invalidEvidence = reviewRows.filter((row) => isPlaceholder(row.evidence));
  const blockedRows = reviewRows.filter((row) => row.status === "BLOCKED");
  const pendingRows = reviewRows.filter((row) => row.status === "REVIEW");
  const missingCriteria = criteria.filter((criterion) => !reviewRows.some((row) => covers(row, criterion)));
  const openCriteria = criteria.filter((criterion) => criterion.open);

  if (invalidMethods.length) blockers.push(`${invalidMethods.length} 项检查记录缺少有效检查方式`);
  if (invalidEvidence.length) blockers.push(`${invalidEvidence.length} 项检查记录缺少有效证据`);
  if (missingCriteria.length) blockers.push(`Review 未覆盖完成标准：${missingCriteria.map((item) => item.id).join("、")}`);
  if (blockedRows.length) blockers.push(`${blockedRows.length} 项检查结果未通过或未执行`);

  if (conclusion === "PASS") {
    if (openCriteria.length) blockers.push(`存在 ${openCriteria.length} 项未关闭的完成标准`);
    if (pendingRows.length) blockers.push(`存在 ${pendingRows.length} 项待复核结果`);
    if (unresolved.length) blockers.push(`存在 ${unresolved.length} 项未解决事项`);
  }
  if (conclusion === "BLOCKED") blockers.push("Review 结论为 BLOCKED");

  const gate = blockers.length ? "BLOCKED" : conclusion === "REVIEW" ? "REVIEW" : conclusion === "PASS" ? "PASS" : "BLOCKED";
  return {
    artifact: path.relative(process.cwd(), dir) || ".",
    report: path.relative(process.cwd(), reportPath),
    level,
    conclusion: conclusion || "MISSING",
    gate,
    criteria,
    reviewRows,
    unresolved,
    pendingRows,
    blockers,
  };
}

function parseCriteria(text) {
  const criteria = [];
  let inSection = false;
  let tableHeaders = null;

  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s+/.test(line)) {
      inSection = /完成标准|验收标准|Acceptance Criteria|\bAC\b/i.test(line);
      tableHeaders = null;
      continue;
    }
    if (!inSection) continue;

    const list = line.match(/^\s*(?:[-*]|\d+\.)\s+(?:\[([ xX])\]\s*)?(\S.*)$/);
    if (list) {
      criteria.push(toCriterion(list[2], list[1] === " "));
      continue;
    }

    if (!/^\s*\|.*\|\s*$/.test(line)) {
      if (line.trim()) tableHeaders = null;
      continue;
    }
    if (/^\s*\|?\s*[-:]+/.test(line)) continue;
    const cells = splitTableRow(line);
    if (!tableHeaders) {
      if (cells.some((cell) => /完成标准|验收标准|^标准$/i.test(cell))) tableHeaders = cells;
      continue;
    }
    const standardIndex = findHeader(tableHeaders, /完成标准|验收标准|^标准$/i);
    const idIndex = findHeader(tableHeaders, /^(ID|编号|标准\s*ID)$/i);
    const textValue = cells[standardIndex];
    if (!textValue) continue;
    const idValue = idIndex >= 0 ? cells[idIndex] : "";
    criteria.push(toCriterion(idValue ? `${idValue}: ${textValue}` : textValue, false));
  }
  return uniqueBy(criteria, (item) => item.id);
}

function toCriterion(value, open) {
  const text = value.trim();
  const match = text.match(/^([A-Za-z][A-Za-z0-9_-]*\d+)\s*[:：.\-]?\s*(.*)$/);
  if (match) {
    return { id: match[1].toUpperCase(), text: match[2].trim() || match[1], open };
  }
  return { id: normalizeText(text), text, open };
}

function parseReviewRows(text) {
  const rows = [];
  let inSection = false;
  let headers = null;

  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s+/.test(line)) {
      inSection = /完成标准|检查结果|Review 结果/i.test(line);
      headers = null;
      continue;
    }
    if (!inSection || !/^\s*\|.*\|\s*$/.test(line)) continue;
    if (/^\s*\|?\s*[-:]+/.test(line)) continue;
    const cells = splitTableRow(line);
    if (!headers) {
      if (cells.some((cell) => /结果/i.test(cell)) && cells.some((cell) => /证据/i.test(cell))) headers = cells;
      continue;
    }

    const idIndex = findHeader(headers, /^(ID|编号|标准\s*ID)$/i);
    const standardIndex = findHeader(headers, /完成标准|验收标准|^标准$/i);
    const methodIndex = findHeader(headers, /检查方式|方法|动作/i);
    const resultIndex = findHeader(headers, /结果|状态/i);
    const evidenceIndex = findHeader(headers, /证据|依据/i);
    if ([methodIndex, resultIndex, evidenceIndex].some((index) => index < 0)) continue;

    const id = idIndex >= 0 ? cells[idIndex]?.toUpperCase() : "";
    const standard = standardIndex >= 0 ? cells[standardIndex] : id;
    if (!id && !standard) continue;
    rows.push({
      id,
      standard,
      method: cells[methodIndex] || "",
      result: cells[resultIndex] || "",
      evidence: cells[evidenceIndex] || "",
      status: classifyResult(cells[resultIndex] || ""),
    });
  }
  return rows;
}

function classifyResult(value) {
  const result = value.trim();
  if (/^(通过|已通过|PASS)$/i.test(result)) return "PASS";
  if (/^(待复核|REVIEW)$/i.test(result)) return "REVIEW";
  return "BLOCKED";
}

function covers(row, criterion) {
  if (/^[A-Z][A-Z0-9_-]*\d+$/.test(criterion.id)) {
    return row.id === criterion.id || leadingId(row.standard) === criterion.id;
  }
  return normalizeText(row.standard) === normalizeText(criterion.text);
}

function leadingId(value) {
  const match = value.trim().match(/^([A-Za-z][A-Za-z0-9_-]*\d+)\s*[:：.\-]?\s*/);
  return match ? match[1].toUpperCase() : "";
}

function parseUnresolved(text) {
  const items = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s+/.test(line)) {
      inSection = /未解决事项|开放问题|剩余问题/i.test(line);
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/^\s*[-*]\s+(.*)$/);
    if (!match) continue;
    const value = match[1].trim();
    if (!/^(无|无。|None|-|已关闭)$/i.test(value)) items.push(value);
  }
  return items;
}

function parseConclusion(text) {
  const inline = text.match(/(?:^|\n)\s*(?:[-*]\s*)?结论\s*[：:]\s*(PASS|REVIEW|BLOCKED)\b/i);
  if (inline) return inline[1].toUpperCase();
  const lines = text.split(/\r?\n/);
  const heading = lines.findIndex((line) => /^#{1,6}\s+结论\s*$/.test(line.trim()));
  if (heading < 0) return "";
  for (const line of lines.slice(heading + 1)) {
    const value = line.trim();
    if (!value) continue;
    const match = value.match(/^(PASS|REVIEW|BLOCKED)\b/i);
    return match ? match[1].toUpperCase() : "";
  }
  return "";
}

function inferLevel(index, requirements) {
  const match = index.match(/(?:流程等级|Level)\s*[：:]\s*(L[0-3])\b/i);
  return normalizeLevel(match?.[1]) || (requirements.trim() ? "L2" : "L1");
}

function normalizeLevel(value) {
  const level = String(value || "").toUpperCase();
  return /^L[0-3]$/.test(level) ? level : "";
}

function isPlaceholder(value) {
  return !value.trim() || /^(无|无。|-|待补充|无证据|未提供|未执行|N\/?A)$/i.test(value.trim());
}

function findHeader(headers, pattern) {
  return headers.findIndex((header) => pattern.test(header.trim()));
}

function splitTableRow(line) {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[`*_\s:：.。\-]/g, "");
}

function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readMarkdownTree(dir) {
  if (!fs.existsSync(dir)) return "";
  return listFiles(dir).filter((file) => /\.md$/i.test(file)).map(readMaybe).join("\n");
}

function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(child));
    else files.push(child);
  }
  return files;
}

function readMaybe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const parsed = { positionals: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      parsed.positionals.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function toMarkdown(result) {
  const lines = [
    "# AI Native Review Gate",
    "",
    `- Artifact: \`${result.artifact}\``,
    `- Review report: \`${result.report}\``,
    `- Flow level: **${result.level}**`,
    `- Declared conclusion: **${result.conclusion}**`,
    `- Archive gate: **${result.gate}**`,
    `- Completion criteria defined: ${result.criteria.length}`,
    `- Review rows: ${result.reviewRows.length}`,
    `- Pending review rows: ${result.pendingRows.length}`,
    `- Unresolved items: ${result.unresolved.length}`,
    "",
    "## Blockers",
    "",
  ];
  if (result.blockers.length) {
    for (const blocker of result.blockers) lines.push(`- ${blocker}`);
  } else {
    lines.push("- None");
  }
  lines.push("");
  return lines.join("\n");
}
