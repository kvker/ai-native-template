#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || "projects");
const format = args.format || (args.write ? "json" : "markdown");
const scanLimit = parseLimit(args.limit, 600);
const result = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  root: rel(root),
  workspaces: scanWorkspaces(root, scanLimit),
};
const output = format === "json" ? JSON.stringify(result, null, 2) : toMarkdown(result);

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
  const inventory = listFiles(dir, limit);
  return {
    name,
    path: rel(dir),
    scan: {
      filesScanned: inventory.files.length,
      scanLimit: inventory.limit,
      truncated: inventory.truncated,
    },
    fileTypes: countFileTypes(inventory.files),
    actions: [...detectDeclaredCommands(dir), ...detectInspections(dir, inventory.files)],
  };
}

function detectDeclaredCommands(dir) {
  const actions = [];
  const packageFile = path.join(dir, "package.json");
  if (fs.existsSync(packageFile)) {
    const pkg = readJson(packageFile);
    const manager = detectPackageManager(dir);
    let scriptIndex = 0;
    for (const name of Object.keys(pkg.scripts || {})) {
      if (!/(test|check|lint|build|validate|verify|format|generate|export|preview)/i.test(name)) continue;
      scriptIndex += 1;
      actions.push(commandAction(`package:${slug(name) || `script-${scriptIndex}`}`, inferPurpose(name), manager, ["run", name], dir, `package.json scripts.${name}`, "high"));
    }
  }

  if (fs.existsSync(path.join(dir, "go.mod"))) {
    actions.push(commandAction("go:test", "review", "go", ["test", "./..."], dir, "go.mod", "medium"));
  }
  if (fs.existsSync(path.join(dir, "Cargo.toml"))) {
    actions.push(commandAction("cargo:test", "review", "cargo", ["test"], dir, "Cargo.toml", "medium"));
    actions.push(commandAction("cargo:check", "review", "cargo", ["check"], dir, "Cargo.toml", "medium"));
  }
  if (fs.existsSync(path.join(dir, "pom.xml"))) {
    actions.push(commandAction("maven:test", "review", "mvn", ["test"], dir, "pom.xml", "medium"));
  }
  if (fs.existsSync(path.join(dir, "build.gradle")) || fs.existsSync(path.join(dir, "build.gradle.kts"))) {
    const runner = fs.existsSync(path.join(dir, "gradlew")) ? "./gradlew" : "gradle";
    actions.push(commandAction("gradle:test", "review", runner, ["test"], dir, "Gradle build file", "medium"));
  }

  const pyproject = readMaybe(path.join(dir, "pyproject.toml"));
  const requirements = readMaybe(path.join(dir, "requirements.txt"));
  const pythonSource = pyproject ? "pyproject.toml" : requirements ? "requirements.txt" : "";
  if (/pytest|tool\.pytest/i.test(pyproject) || requirements) {
    const usesUv = fs.existsSync(path.join(dir, "uv.lock"));
    actions.push(commandAction("python:pytest", "review", usesUv ? "uv" : "python3", usesUv ? ["run", "pytest"] : ["-m", "pytest"], dir, pythonSource || "python convention", pyproject ? "high" : "medium"));
  }
  const pythonHints = pyproject + "\n" + requirements;
  if (/\bruff\b/i.test(pythonHints)) actions.push(commandAction("python:ruff", "review", "ruff", ["check", "."], dir, pythonSource || "python convention", "high"));
  if (/\bmypy\b/i.test(pythonHints)) actions.push(commandAction("python:mypy", "review", "mypy", ["."], dir, pythonSource || "python convention", "high"));
  return actions;
}

function detectInspections(dir, files) {
  const actions = [];
  const has = (pattern) => files.some((file) => pattern.test(file));

  if (has(/\.(md|mdx|txt|rst)$/i)) {
    actions.push(inspectionAction("inspect:text", "review", "核对文本结构、引用、链接、格式和任务完成标准。", dir, "text materials present"));
  }
  if (has(/\.(doc|docx|odt|pdf)$/i)) {
    actions.push(inspectionAction("inspect:document", "review", "打开或渲染文档，检查分页、字体、内容完整性、链接和可读性。", dir, "document materials present"));
  }
  if (has(/\.(ppt|pptx|odp)$/i)) {
    actions.push(inspectionAction("inspect:presentation", "review", "渲染并逐页检查演示文稿的内容完整性、版式、溢出和可读性。", dir, "presentation materials present"));
  }
  if (has(/\.(xls|xlsx|ods)$/i)) {
    actions.push(inspectionAction("inspect:spreadsheet", "review", "打开表格并检查工作表、字段、公式、格式和关键数据完整性。", dir, "spreadsheet materials present"));
  }
  if (has(/\.(json|ya?ml|csv|tsv|xml)$/i)) {
    actions.push(inspectionAction("inspect:structured-data", "review", "核对结构化材料的格式、字段、完整性和任务约束。", dir, "structured data present"));
  }
  if (has(/\.(png|jpe?g|gif|webp|svg|pdf|fig|sketch)$/i)) {
    actions.push(inspectionAction("inspect:visual", "review", "打开或渲染视觉材料，检查内容完整性、可读性、尺寸和导出结果。", dir, "visual materials present"));
  }
  if (has(/\.(mp3|wav|m4a|mp4|mov|webm)$/i)) {
    actions.push(inspectionAction("inspect:media", "review", "播放媒体材料，检查可访问性、时长、内容完整性和输出质量。", dir, "media materials present"));
  }
  actions.push(inspectionAction("inspect:requirements", "review", "逐项核对实际产出与当前任务 requirements，并记录证据和未解决事项。", dir, "AI Native workflow"));
  return actions;
}

function commandAction(id, purpose, executable, args, cwd, source, confidence) {
  return { id, type: "command", purpose, executable, args, cwd: rel(cwd), source, confidence };
}

function inspectionAction(id, purpose, instruction, cwd, source) {
  return { id, type: "inspection", purpose, instruction, cwd: rel(cwd), source, confidence: "medium" };
}

function inferPurpose(name) {
  if (/generate|export/i.test(name)) return "produce";
  if (/preview/i.test(name)) return "preview";
  return "review";
}

function detectPackageManager(dir) {
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(dir, "bun.lock")) || fs.existsSync(path.join(dir, "bun.lockb"))) return "bun";
  return "npm";
}

function countFileTypes(files) {
  const counts = {};
  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || "[no-extension]";
    counts[ext] = (counts[ext] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([extension, count]) => ({ extension, count }));
}

function listFiles(rootDir, limit) {
  const files = [];
  let truncated = false;
  walk(rootDir, "");
  return { files, limit, truncated };

  function walk(dir, prefix) {
    if (files.length >= limit) {
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
      if (files.length >= limit) {
        truncated = true;
        return;
      }
      if (shouldSkip(entry.name)) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute, relative);
      else files.push(relative);
    }
  }
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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function readMaybe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function rel(file) {
  return path.relative(process.cwd(), file) || ".";
}

function toMarkdown(data) {
  const lines = ["# AI Native Recipes", "", `生成时间：${data.generatedAt}`, ""];
  if (!data.workspaces.length) {
    lines.push(`\`${data.root}\` 下没有工作单元。`, "");
    return lines.join("\n");
  }
  for (const workspace of data.workspaces) {
    lines.push(
      `## ${workspace.name}`,
      "",
      `- 路径：\`${workspace.path}\``,
      `- 已扫描文件：${workspace.scan.filesScanned}`,
      `- 扫描上限：${workspace.scan.scanLimit}`,
      `- 结果截断：${workspace.scan.truncated ? "是，以下动作可能不完整" : "否"}`,
      "",
      "| ID | 类型 | 用途 | 动作 | 来源 | 置信度 |",
      "|----|------|------|------|------|--------|"
    );
    for (const action of workspace.actions) {
      const detail = action.type === "command" ? `\`${formatCommand(action)}\`` : action.instruction;
      lines.push(`| \`${escapeCell(action.id)}\` | ${action.type} | ${action.purpose} | ${escapeCell(detail)} | ${escapeCell(action.source)} | ${action.confidence} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatCommand(action) {
  return [action.executable, ...action.args.map((arg) => JSON.stringify(arg))].join(" ");
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|");
}
