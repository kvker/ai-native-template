#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || "projects");
const artifacts = path.resolve(args.artifacts || "artifacts");
const format = args.format || (args.write ? "json" : "markdown");
const scanLimit = parseLimit(args.limit, 1000);
const summary = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  root: rel(root),
  workspaces: scanWorkspaces(root, scanLimit),
  archivedReviews: scanArchivedReviews(path.join(artifacts, "_archived")),
};
const output = format === "json" ? JSON.stringify(summary, null, 2) : toMarkdown(summary);

if (args.write) {
  const target = path.resolve(args.write);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${output}\n`);
} else {
  process.stdout.write(`${output}\n`);
}

function scanWorkspaces(rootDir, limit) {
  if (!fs.existsSync(rootDir)) return [];
  return fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => scanWorkspace(path.join(rootDir, entry.name), entry.name, limit));
}

function scanWorkspace(dir, name, limit) {
  const inventory = collectInventory(dir, limit);
  const topLevel = topLevelEntries(dir, 40);
  return {
    name,
    path: rel(dir),
    scan: {
      entriesScanned: inventory.files.length + inventory.directories.length,
      scanLimit: inventory.limit,
      truncated: inventory.truncated,
    },
    fileCount: inventory.files.length,
    directoryCount: inventory.directories.length,
    topLevelEntries: topLevel.entries,
    topLevelTruncated: topLevel.truncated,
    fileTypes: countFileTypes(inventory.files),
    materialGroups: detectMaterialGroups(inventory.files),
    declaredActions: detectDeclaredActions(dir),
    readmeFiles: inventory.files.filter((file) => /(^|\/)readme(?:\.[^/]+)?$/i.test(file)).slice(0, 20),
  };
}

function collectInventory(rootDir, limit) {
  const files = [];
  const directories = [];
  let truncated = false;
  walk(rootDir, "");
  return { files, directories, limit, truncated };

  function walk(dir, prefix) {
    if (files.length + directories.length >= limit) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length + directories.length >= limit) {
        truncated = true;
        return;
      }
      if (shouldSkip(entry.name)) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        directories.push(relative);
        walk(path.join(dir, entry.name), relative);
      } else {
        files.push(relative);
      }
    }
  }
}

function topLevelEntries(dir, limit) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
    return {
      entries: entries.slice(0, limit).map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "directory" : "file" })),
      truncated: entries.length > limit,
    };
  } catch {
    return { entries: [], truncated: false };
  }
}

function countFileTypes(files) {
  const counts = {};
  for (const file of files) {
    const extension = path.extname(file).toLowerCase() || "[no-extension]";
    counts[extension] = (counts[extension] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([extension, count]) => ({ extension, count }));
}

function detectMaterialGroups(files) {
  const groups = [];
  const definitions = [
    ["text", /\.(md|mdx|txt|rst)$/i],
    ["document", /\.(doc|docx|odt|pdf)$/i],
    ["presentation", /\.(ppt|pptx|odp)$/i],
    ["spreadsheet", /\.(xls|xlsx|ods)$/i],
    ["structured-data", /\.(json|ya?ml|csv|tsv|xml)$/i],
    ["visual", /\.(png|jpe?g|gif|webp|svg|fig|sketch)$/i],
    ["audio-video", /\.(mp3|wav|m4a|mp4|mov|webm)$/i],
    ["source", /\.(js|jsx|ts|tsx|py|go|rs|java|rb|php|c|cc|cpp|h|cs|swift|kt)$/i],
  ];
  for (const [name, pattern] of definitions) {
    const count = files.filter((file) => pattern.test(file)).length;
    if (count) groups.push({ name, count });
  }
  return groups;
}

function detectDeclaredActions(dir) {
  const packageFile = path.join(dir, "package.json");
  if (!fs.existsSync(packageFile)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    return Object.keys(pkg.scripts || {}).slice(0, 40);
  } catch {
    return [];
  }
}

function scanArchivedReviews(archiveDir) {
  const limit = 100;
  if (!fs.existsSync(archiveDir)) return { items: [], limit, truncated: false };
  const reports = [];
  for (const entry of fs.readdirSync(archiveDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const reportFile = path.join(archiveDir, entry.name, "review", "review-report.md");
    const summaryFile = path.join(archiveDir, entry.name, "archive", "summary.md");
    const report = readMaybe(reportFile);
    reports.push({
      artifact: entry.name,
      conclusion: parseConclusion(report) || "MISSING",
      review: fs.existsSync(reportFile) ? rel(reportFile) : "",
      summary: fs.existsSync(summaryFile) ? rel(summaryFile) : "",
    });
  }
  return { items: reports.slice(0, limit), limit, truncated: reports.length > limit };
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

function shouldSkip(name) {
  return name.startsWith(".") || ["node_modules", "dist", "build", "coverage", "target", "vendor", "__pycache__"].includes(name);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
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

function parseLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readMaybe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function rel(file) {
  return path.relative(process.cwd(), file) || ".";
}

function toMarkdown(data) {
  const lines = ["# 工作区扫描", "", `生成时间：${data.generatedAt}`, ""];
  if (!data.workspaces.length) lines.push(`\`${data.root}\` 下没有工作单元。`, "");
  for (const workspace of data.workspaces) {
    lines.push(
      `## ${workspace.name}`,
      "",
      `- 路径：\`${workspace.path}\``,
      `- 文件：${workspace.fileCount}`,
      `- 目录：${workspace.directoryCount}`,
      `- 扫描上限：${workspace.scan.scanLimit}`,
      `- 结果截断：${workspace.scan.truncated ? "是，文件和材料统计不完整" : "否"}`,
      `- 顶层条目截断：${workspace.topLevelTruncated ? "是" : "否"}`,
      `- 材料类型：${workspace.materialGroups.map((group) => `${group.name}(${group.count})`).join("、") || "未识别"}`,
      `- 文件类型：${workspace.fileTypes.map((item) => `${item.extension}(${item.count})`).join("、") || "无"}`,
      `- 声明动作：${workspace.declaredActions.map((action) => `\`${action}\``).join("、") || "无"}`,
      `- README：${workspace.readmeFiles.map((file) => `\`${file}\``).join("、") || "无"}`,
      ""
    );
  }
  if (data.archivedReviews.items.length) {
    lines.push("## 已归档任务", "", "| Artifact | Review | 完结摘要 |", "|----------|--------|----------|");
    for (const item of data.archivedReviews.items) {
      lines.push(`| ${item.artifact} | ${item.conclusion} | ${item.summary ? `\`${item.summary}\`` : "缺失"} |`);
    }
    if (data.archivedReviews.truncated) lines.push("", `> 归档扫描达到 ${data.archivedReviews.limit} 项上限，结果不完整。`);
    lines.push("");
  }
  return lines.join("\n");
}
