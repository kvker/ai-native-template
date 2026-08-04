#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SKIPPED_NAMES = new Set(["node_modules", "dist", "build", "coverage", "target", "vendor", "__pycache__", "venv", ".venv"]);
const SENSITIVE_NAMES = /(?:^|[._-])(?:secrets?|credentials?|tokens?)(?=$|[._-])/i;

try {
  const args = parseArgs(process.argv.slice(2));
  const cwd = fs.realpathSync(process.cwd());
  const root = resolveInside(cwd, args.root || "projects", "--root", { allowMissing: true });
  const format = args.format || (args.write ? "json" : "markdown");
  if (!["json", "markdown"].includes(format)) throw new Error("--format 只能是 json 或 markdown");
  const scanLimit = parseLimit(args.limit, 600);
  const diagnostics = [];
  const workspaces = scanWorkspaces(root, scanLimit, diagnostics, cwd);
  const result = {
    schemaVersion: 4,
    generatedAt: new Date().toISOString(),
    root: relativeTo(cwd, root),
    rootExists: entryExists(root),
    diagnostics,
    workspaces,
  };
  const output = format === "json" ? JSON.stringify(result, null, 2) : toMarkdown(result);

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
  catch (error) {
    diagnostics.push(diagnostic("error", "ROOT_UNREADABLE", relativeTo(cwd, root), error.message));
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && !shouldSkip(entry.name))
    .sort((left, right) => compareStrings(left.name, right.name))
    .map((entry) => scanWorkspace(path.join(root, entry.name), entry.name, limit, diagnostics, cwd));
}

function scanWorkspace(dir, name, limit, diagnostics, cwd) {
  const inventory = listFiles(dir, limit, diagnostics, cwd);
  const actions = [
    ...detectDeclaredCommands(dir, diagnostics, cwd),
    ...detectInspections(dir, inventory.files, cwd),
  ];
  const uniqueActions = uniqueActionIds(actions, diagnostics, relativeTo(cwd, dir));
  return {
    name,
    path: relativeTo(cwd, dir),
    scan: {
      entriesScanned: inventory.entriesScanned,
      filesScanned: inventory.files.length,
      scanLimit: inventory.limit,
      truncated: inventory.truncated,
    },
    fileTypes: countFileTypes(inventory.files),
    actions: uniqueActions,
  };
}

function detectDeclaredCommands(dir, diagnostics, cwd) {
  const actions = [];
  const packageFile = path.join(dir, "package.json");
  if (safeFile(packageFile, diagnostics, cwd)) {
    const pkg = readJson(packageFile, diagnostics, cwd);
    const manager = detectPackageManager(dir, diagnostics, cwd);
    for (const name of Object.keys(pkg?.scripts || {}).sort()) {
      const purpose = classifyPackageScript(name);
      if (!purpose) continue;
      actions.push(commandAction(actionId("package", name), purpose, manager, ["run", name], dir, `package.json scripts.${name}`, purpose === "review" ? "high" : "medium", cwd));
    }
  }

  if (safeFile(path.join(dir, "go.mod"), diagnostics, cwd)) actions.push(commandAction("go:test", "review", "go", ["test", "./..."], dir, "go.mod", "medium", cwd));
  if (safeFile(path.join(dir, "Cargo.toml"), diagnostics, cwd)) {
    actions.push(commandAction("cargo:test", "review", "cargo", ["test"], dir, "Cargo.toml", "medium", cwd));
    actions.push(commandAction("cargo:check", "review", "cargo", ["check"], dir, "Cargo.toml", "medium", cwd));
  }
  if (safeFile(path.join(dir, "pom.xml"), diagnostics, cwd)) actions.push(commandAction("maven:test", "review", "mvn", ["test"], dir, "pom.xml", "medium", cwd));
  if (safeFile(path.join(dir, "build.gradle"), diagnostics, cwd) || safeFile(path.join(dir, "build.gradle.kts"), diagnostics, cwd)) {
    const runner = safeFile(path.join(dir, "gradlew"), diagnostics, cwd) ? "./gradlew" : "gradle";
    actions.push(commandAction("gradle:test", "review", runner, ["test"], dir, "Gradle build file", "medium", cwd));
  }

  const pyprojectFile = path.join(dir, "pyproject.toml");
  const requirementsFile = path.join(dir, "requirements.txt");
  const pyproject = readText(pyprojectFile, diagnostics, cwd);
  const requirements = readText(requirementsFile, diagnostics, cwd);
  const pytestSources = pythonToolSources("pytest", pyproject, requirements);
  const ruffSources = pythonToolSources("ruff", pyproject, requirements);
  const mypySources = pythonToolSources("mypy", pyproject, requirements);
  if (pytestSources.length) {
    const usesUv = safeFile(path.join(dir, "uv.lock"), diagnostics, cwd);
    actions.push(commandAction("python:pytest", "review", usesUv ? "uv" : "python3", usesUv ? ["run", "pytest"] : ["-m", "pytest"], dir, pytestSources.join(" + "), "high", cwd));
  }
  if (ruffSources.length) actions.push(commandAction("python:ruff", "review", "ruff", ["check", "."], dir, ruffSources.join(" + "), "high", cwd));
  if (mypySources.length) actions.push(commandAction("python:mypy", "review", "mypy", ["."], dir, mypySources.join(" + "), "high", cwd));
  return actions;
}

function pythonToolSources(name, pyproject, requirements) {
  const sources = [];
  if (pyprojectDeclaresTool(name, pyproject)) sources.push("pyproject.toml");
  const requirementMatch = requirements.split(/\r?\n/).some((line) => declaredPackageName(stripTomlComment(line)) === name.toLowerCase());
  if (requirementMatch) sources.push("requirements.txt");
  return sources;
}

function pyprojectDeclaresTool(name, text) {
  const target = name.toLowerCase();
  let section = "";
  let dependencyArray = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) {
      section = heading[1].trim().toLowerCase();
      dependencyArray = false;
      if (section === `tool.${target}` || section.startsWith(`tool.${target}.`)) return true;
      continue;
    }
    const dependencyTable = section === "tool.poetry.dependencies" || /^tool\.poetry\.group\.[^.]+\.dependencies$/.test(section);
    if (dependencyTable) {
      const key = line.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*=/)?.[1]?.toLowerCase();
      if (key === target) return true;
    }
    const arrayOwner = section === "project" || section.startsWith("project.optional-dependencies") || section === "dependency-groups" || section === "tool.uv";
    if (arrayOwner && !dependencyArray && /^(?:dependencies|dev-dependencies|[A-Za-z0-9_.-]+)\s*=\s*\[/.test(line)) dependencyArray = true;
    if (dependencyArray && quotedDependencies(line).some((item) => item === target)) return true;
    if (dependencyArray && line.includes("]")) dependencyArray = false;
  }
  return false;
}

function stripTomlComment(line) {
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === "\"" || char === "\x27") && line[index - 1] !== "\\") quote = quote === char ? "" : quote || char;
    if (char === "#" && !quote) return line.slice(0, index);
  }
  return line;
}

function quotedDependencies(line) {
  const values = [];
  for (const match of line.matchAll(/["\x27]([^"\x27]+)["\x27]/g)) {
    const name = declaredPackageName(match[1]);
    if (name) values.push(name);
  }
  return values;
}

function declaredPackageName(value) {
  return value.trim().match(/^([A-Za-z0-9_.-]+)/)?.[1]?.toLowerCase() || "";
}
function classifyPackageScript(name) {
  const normalized = name.toLowerCase();
  if (/(^|[:_-])(test|check|lint|build|validate|verify|typecheck|vitest|jest)(?:$|[:_-])/.test(normalized)) return "review";
  if (/(^|[:_-])preview(?:$|[:_-])/.test(normalized)) return "preview";
  if (/(^|[:_-])(generate|export|format)(?:$|[:_-])/.test(normalized)) return "produce";
  return "";
}

function detectInspections(dir, files, rootCwd) {
  const actions = [];
  const has = (pattern) => files.some((file) => pattern.test(file));
  if (has(/\.(md|mdx|txt|rst)$/i)) actions.push(inspectionAction("inspect:text", "核对文本结构、引用、链接、格式和完成标准。", dir, "text materials present", rootCwd));
  if (has(/\.(doc|docx|odt|pdf)$/i)) actions.push(inspectionAction("inspect:document", "渲染并检查分页、字体、内容完整性和可读性。", dir, "document materials present", rootCwd));
  if (has(/\.(ppt|pptx|odp)$/i)) actions.push(inspectionAction("inspect:presentation", "渲染并逐页检查内容、版式、溢出和可读性。", dir, "presentation materials present", rootCwd));
  if (has(/\.(xls|xlsx|ods)$/i)) actions.push(inspectionAction("inspect:spreadsheet", "检查工作表、字段、公式、格式和关键数据完整性。", dir, "spreadsheet materials present", rootCwd));
  if (has(/\.(json|ya?ml|csv|tsv|xml)$/i)) actions.push(inspectionAction("inspect:structured-data", "核对格式、字段、完整性和任务约束。", dir, "structured data present", rootCwd));
  if (has(/\.(png|jpe?g|gif|webp|svg|pdf|fig|sketch)$/i)) actions.push(inspectionAction("inspect:visual", "渲染并检查内容完整性、可读性、尺寸和导出结果。", dir, "visual materials present", rootCwd));
  if (has(/\.(mp3|wav|m4a|mp4|mov|webm)$/i)) actions.push(inspectionAction("inspect:media", "播放并检查可访问性、时长、内容完整性和输出质量。", dir, "media materials present", rootCwd));
  actions.push(inspectionAction("inspect:requirements", "逐项核对实际产出与 requirements，并记录证据和未解决事项。", dir, "AI Native workflow", rootCwd));
  return actions;
}

function commandAction(id, purpose, executable, args, cwd, source, confidence, rootCwd) {
  return { id, type: "command", purpose, executable, args, cwd: relativeTo(rootCwd || cwd, cwd), source, confidence };
}

function inspectionAction(id, instruction, cwd, source, rootCwd) {
  return { id, type: "inspection", purpose: "review", instruction, cwd: relativeTo(rootCwd || cwd, cwd), source, confidence: "medium" };
}

function actionId(prefix, name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "script";
  const hash = crypto.createHash("sha256").update(name).digest("hex").slice(0, 16);
  return `${prefix}:${slug}-${hash}`;
}

function uniqueActionIds(actions, diagnostics, workspace) {
  const seen = new Set();
  return actions.filter((action) => {
    if (seen.has(action.id)) {
      diagnostics.push(diagnostic("error", "DUPLICATE_ACTION_ID", workspace, action.id));
      return false;
    }
    seen.add(action.id);
    return true;
  });
}

function detectPackageManager(dir, diagnostics, cwd) {
  if (safeFile(path.join(dir, "pnpm-lock.yaml"), diagnostics, cwd)) return "pnpm";
  if (safeFile(path.join(dir, "yarn.lock"), diagnostics, cwd)) return "yarn";
  if (safeFile(path.join(dir, "bun.lock"), diagnostics, cwd) || safeFile(path.join(dir, "bun.lockb"), diagnostics, cwd)) return "bun";
  return "npm";
}

function listFiles(root, limit, diagnostics, cwd) {
  const files = [];
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
      if (entry.isDirectory()) stack.push({ dir: absolute, prefix: relative });
      else if (entry.isFile()) files.push(relative);
    }
  }
  return { files: files.sort(compareStrings), entriesScanned, limit, truncated };
}

function countFileTypes(files) {
  const counts = {};
  for (const file of files) {
    const extension = path.extname(file).toLowerCase() || "[no-extension]";
    counts[extension] = (counts[extension] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0])).slice(0, 12).map(([extension, count]) => ({ extension, count }));
}

function isSensitiveName(name) {
  return /^\.env(?:\.|$)/i.test(name) || SENSITIVE_NAMES.test(name);
}
function shouldSkip(name) {
  const lower = name.toLowerCase();
  return name.startsWith(".") || SKIPPED_NAMES.has(lower) || isSensitiveName(name);
}

function safeFile(file, diagnostics, cwd) {
  if (!entryExists(file)) return false;
  const stat = fs.lstatSync(file);
  if (pathHasSymlink(cwd, file) || stat.isSymbolicLink() || !stat.isFile()) {
    diagnostics.push(diagnostic("warning", "UNSAFE_FILE_SKIPPED", relativeTo(cwd, file), "不是非符号链接普通文件"));
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
  catch (error) { diagnostics.push(diagnostic("error", "FILE_UNREADABLE", relativeTo(cwd, file), error.message)); return ""; }
}

function parseArgs(argv) {
  const parsed = {};
  const valueOptions = new Set(["root", "write", "format", "limit"]);
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
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100000) throw new Error("--limit 必须为 1-100000 的安全整数");
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
  const lines = ["# AI Native Recipes", "", `生成时间：${data.generatedAt}`, ""];
  if (data.diagnostics.length) {
    lines.push("## 扫描诊断", "", "| 级别 | 代码 | 路径 | 说明 |", "|------|------|------|------|");
    for (const item of data.diagnostics) lines.push(`| ${escapeCell(item.level)} | ${escapeCell(item.code)} | ${escapeCell(item.path)} | ${escapeCell(item.message)} |`);
    lines.push("");
  }
  if (!data.workspaces.length) lines.push(`\`${escapeCell(data.root)}\` 下没有可用工作单元。`, "");
  for (const workspace of data.workspaces) {
    lines.push(`## ${escapeHeading(workspace.name)}`, "", `- 路径：\`${escapeCell(workspace.path)}\``, `- 已扫描条目：${workspace.scan.entriesScanned}`, `- 已扫描文件：${workspace.scan.filesScanned}`, `- 扫描上限：${workspace.scan.scanLimit}`, `- 结果截断：${workspace.scan.truncated ? "是，以下动作可能不完整" : "否"}`, "", "| ID | 类型 | 用途 | 动作 | 来源 | 置信度 |", "|----|------|------|------|------|--------|");
    for (const action of workspace.actions) {
      const detail = action.type === "command" ? `\`${formatCommand(action)}\`` : action.instruction;
      lines.push(`| ${escapeCell(action.id)} | ${escapeCell(action.type)} | ${escapeCell(action.purpose)} | ${escapeCell(detail)} | ${escapeCell(action.source)} | ${escapeCell(action.confidence)} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatCommand(action) {
  return [action.executable, ...action.args.map((arg) => JSON.stringify(arg))].join(" " );
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
