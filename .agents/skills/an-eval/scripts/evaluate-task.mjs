#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const workspace = path.resolve(process.argv[2] || ".");
if (!fs.existsSync(workspace)) {
  console.error(`Workspace not found: ${workspace}`);
  process.exit(2);
}

const report = evaluate(workspace);
process.stdout.write(toMarkdown(report));

function evaluate(dir) {
  const files = {
    index: readMaybe(path.join(dir, "AGENTS.md")),
    requirements: readMaybe(path.join(dir, "requirements", "requirements.md")),
    techSpec: readMaybe(path.join(dir, "tech-spec", "tech-spec.md")),
    decisions: readMaybe(path.join(dir, "implementation", "decisions.md")),
    testing: readMaybe(path.join(dir, "testing", "testing-report.md")),
    release: readMaybe(path.join(dir, "deployment", "release-notes.md")),
  };

  const ac = parseAcceptanceCriteria(files.requirements);
  const tests = parseTests(files.testing);
  const changes = countChangeRows(files.techSpec);
  const unresolved = findUnresolved(Object.values(files).join("\n"));
  const flow = inferFlow(files);
  const scores = score({ ac, tests, changes, unresolved, files, flow });
  const blockers = findBlockers({ ac, tests, unresolved, flow, files });
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const gate = blockers.length ? "BLOCKED" : total >= 80 ? "PASS" : total >= 60 ? "REVIEW" : "BLOCKED";

  return {
    workspace: path.relative(process.cwd(), dir) || ".",
    flow,
    gate,
    total,
    scores,
    ac,
    tests,
    changes,
    unresolved,
    blockers,
  };
}

function inferFlow(files) {
  if (files.requirements && files.techSpec) return "full-or-standard";
  if (files.techSpec) return "standard";
  return "quick";
}

function score(ctx) {
  const acScore = ctx.flow === "quick"
    ? (ctx.ac.total ? Math.round((ctx.ac.closed / ctx.ac.total) * 20) : 12)
    : (ctx.ac.total ? Math.round((ctx.ac.closed / ctx.ac.total) * 20) : 0);
  const specScore = ctx.flow === "quick"
    ? (ctx.files.decisions || ctx.changes > 0 ? 18 : 8)
    : (ctx.changes > 0 ? 20 : 8);
  const testScore = ctx.tests.failures > 0
    ? 5
    : ctx.tests.commands > 0
      ? 30
      : ctx.files.testing
        ? 15
        : 0;
  const riskScore = ctx.unresolved.length === 0 ? 15 : Math.max(0, 15 - ctx.unresolved.length * 5);
  const closureScore = ctx.files.release || ctx.flow === "quick" ? 15 : 8;
  return {
    acceptanceCriteria: acScore,
    implementationTrace: specScore,
    testEvidence: testScore,
    riskClosure: riskScore,
    closureReadiness: closureScore,
  };
}

function findBlockers(ctx) {
  const blockers = [];
  if (ctx.flow !== "quick" && ctx.ac.total === 0) blockers.push("缺少验收标准");
  if (ctx.ac.total > 0 && ctx.ac.open > 0) blockers.push("存在未关闭的验收标准");
  if (!ctx.files.testing) blockers.push("缺少测试报告");
  if (ctx.tests.failures > 0) blockers.push("测试报告包含失败记录");
  if (ctx.unresolved.length > 0 && ctx.flow !== "quick") blockers.push("存在待确认或开放问题");
  return blockers;
}

function parseAcceptanceCriteria(text) {
  const result = { total: 0, closed: 0, open: 0 };
  let inAcSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s+/.test(line)) {
      inAcSection = /验收标准|Acceptance Criteria|AC\b/i.test(line);
      continue;
    }
    const isCheckbox = /^\s*[-*]\s+\[[ xX]\]/.test(line);
    const isAcLine = /AC\d*|验收|标准/i.test(line);
    if (isCheckbox && (inAcSection || isAcLine)) {
      result.total += 1;
      if (/\[[xX]\]/.test(line)) result.closed += 1;
      if (/\[ \]/.test(line)) result.open += 1;
    }
  }
  return result;
}

function parseTests(text) {
  const commands = (text.match(/`[^`]*(test|lint|build|typecheck|check|pytest|go test|cargo test|mvn test)[^`]*`/gi) || []).length;
  const failures = (text.match(/失败|未通过|❌|failed|failure|error/gi) || []).length;
  return { commands, failures };
}

function countChangeRows(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .length;
}

function findUnresolved(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .filter((line) => /待确认|开放问题|TODO|FIXME|风险未关闭|未决/.test(line))
    .slice(0, 20);
}

function readMaybe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function toMarkdown(report) {
  const lines = [
    "# AI Native Task Eval",
    "",
    `- Workspace: \`${report.workspace}\``,
    `- Flow: \`${report.flow}\``,
    `- Gate: **${report.gate}**`,
    `- Score: **${report.total}/100**`,
    "",
    "## Scores",
    "",
    "| Dimension | Score |",
    "|-----------|-------|",
  ];
  for (const [key, value] of Object.entries(report.scores)) lines.push(`| ${key} | ${value} |`);
  lines.push(
    "",
    "## Evidence",
    "",
    `- Acceptance criteria: ${report.ac.closed}/${report.ac.total} closed`,
    `- Test commands detected: ${report.tests.commands}`,
    `- Test failure signals: ${report.tests.failures}`,
    `- Tech-spec change rows: ${report.changes}`,
    `- Unresolved signals: ${report.unresolved.length}`,
    "",
    "## Blockers",
    ""
  );
  if (report.blockers.length) {
    for (const blocker of report.blockers) lines.push(`- ${blocker}`);
  } else {
    lines.push("- None");
  }
  if (report.unresolved.length) {
    lines.push("", "## Unresolved Lines", "");
    for (const line of report.unresolved) lines.push(`- ${line.trim()}`);
  }
  lines.push("");
  return lines.join("\n");
}
