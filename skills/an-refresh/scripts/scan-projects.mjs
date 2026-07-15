#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || "projects");
const artifactsRoot = path.resolve(args.artifacts || "artifacts");
const format = args.format || (args.write ? "json" : "markdown");

const summary = {
  schemaVersion: 1,
  root: rel(root),
  projects: scanProjects(root),
  artifactsTesting: scanArtifactsTesting(artifactsRoot),
};

const output = format === "json" ? JSON.stringify(summary, null, 2) : toMarkdown(summary);
if (args.write) {
  const out = path.resolve(args.write);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${output}\n`);
} else {
  process.stdout.write(`${output}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function scanProjects(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => scanProject(path.join(rootDir, entry.name), entry.name));
}

function scanProject(dir, name) {
  const files = listFiles(dir, 800);
  const packageInfo = readPackageInfo(dir);
  const isCodeWorkspace = !!packageInfo || exists(dir, "go.mod") || exists(dir, "pyproject.toml") || exists(dir, "requirements.txt") || exists(dir, "pom.xml") || exists(dir, "build.gradle") || exists(dir, "build.gradle.kts") || exists(dir, "Cargo.toml");
  return {
    name,
    path: rel(dir),
    kind: isCodeWorkspace ? detectCodeKind(dir) : detectGeneralKind(dir, files),
    package: packageInfo,
    routes: isCodeWorkspace ? detectRoutes(dir, files) : [],
    apis: isCodeWorkspace ? detectApis(dir, files) : [],
    schemas: isCodeWorkspace ? detectSchemas(dir, files) : [],
    tests: isCodeWorkspace ? detectTests(files) : { testFileCount: 0, examples: [] },
    fileTypes: detectFileTypes(files),
    topLevelFiles: files.slice(0, 20),
  };
}

function detectCodeKind(dir) {
  if (exists(dir, "package.json")) {
    const pkg = readJson(path.join(dir, "package.json"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next) return "nextjs";
    if (deps.react) return "react";
    if (deps.vue) return "vue";
    if (deps["@nestjs/core"]) return "nestjs";
    if (deps.express) return "express";
    return "node";
  }
  if (exists(dir, "pyproject.toml") || exists(dir, "requirements.txt")) return "python";
  if (exists(dir, "go.mod")) return "go";
  if (exists(dir, "pom.xml")) return "java-maven";
  if (exists(dir, "build.gradle") || exists(dir, "build.gradle.kts")) return "java-gradle";
  if (exists(dir, "Cargo.toml")) return "rust";
  return "unknown";
}

function detectGeneralKind(dir, files) {
  const topFiles = listTopLevelFiles(dir, 100);
  if (topFiles.some((f) => /\.(md|mdx)$/.test(f)) || files.some((f) => /\.(md|mdx)$/.test(f))) return "markdown-docs";
  if (topFiles.some((f) => /\.(json|yaml|yml)$/.test(f)) || files.some((f) => /\.(json|yaml|yml)$/.test(f))) return "data-config";
  if (topFiles.some((f) => /\.(png|jpg|jpeg|svg|fig|sketch)$/.test(f))) return "design-assets";
  return "generic";
}

function readPackageInfo(dir) {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return {
      name: pkg.name || path.basename(dir),
      version: pkg.version || "",
      scripts: pkg.scripts || {},
      dependencies: Object.fromEntries(Object.entries(deps).slice(0, 40)),
    };
  } catch {
    return null;
  }
}

function detectFileTypes(files) {
  const counts = {};
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!ext) continue;
    counts[ext] = (counts[ext] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ext, count]) => ({ ext, count }));
}

function detectRoutes(dir, files) {
  return files
    .filter((file) => /(^|\/)(pages|app|routes|router|controllers?)(\/|$)/.test(file))
    .filter((file) => /\.(ts|tsx|js|jsx|py|go|java|rb)$/.test(file) || /route\.(ts|js)$/.test(file))
    .slice(0, 80)
    .map((file) => rel(path.join(dir, file)));
}

function detectApis(dir, files) {
  const hits = [];
  const patterns = [
    { kind: "express", regex: /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/gi },
    { kind: "fastapi", regex: /@(?:app|router)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/gi },
    { kind: "nest", regex: /@(Get|Post|Put|Patch|Delete)\(\s*["'`]?([^"'`)]*)["'`]?\s*\)/g },
    { kind: "spring", regex: /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\(\s*(?:value\s*=\s*)?["'`]([^"'`]+)["'`]/g },
    { kind: "next-route-handler", regex: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g },
  ];
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|py|java)$/.test(file)) continue;
    const text = readSmall(path.join(dir, file));
    if (!text) continue;
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern.regex)) {
        hits.push({
          kind: pattern.kind,
          method: normalizeMethod(match[1]),
          path: match[2] || routePathFromFile(file),
          file: rel(path.join(dir, file)),
        });
        if (hits.length >= 120) return hits;
      }
    }
  }
  return hits;
}

function detectSchemas(dir, files) {
  const hits = [];
  for (const file of files) {
    const full = path.join(dir, file);
    if (/schema\.prisma$/.test(file)) {
      const text = readSmall(full);
      for (const match of text.matchAll(/^model\s+(\w+)/gm)) hits.push({ kind: "prisma", name: match[1], file: rel(full) });
      continue;
    }
    if (/(schema|model|entity|migration|dto|types?)\.(ts|js|py|java|sql)$/.test(file)) {
      const text = readSmall(full);
      if (!text) continue;
      collectSchema(hits, "zod", /(?:export\s+const\s+)?(\w+)\s*=\s*z\.object\(/g, text, full);
      collectSchema(hits, "mongoose", /(?:new\s+Schema|mongoose\.Schema)\s*\(/g, text, full);
      collectSchema(hits, "pydantic", /class\s+(\w+)\(BaseModel\)/g, text, full);
      collectSchema(hits, "sql", /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)/gi, text, full);
      collectSchema(hits, "typeorm", /@Entity\(\s*["'`]?([^"'`)]*)/g, text, full);
      if (hits.length >= 120) return hits;
    }
  }
  return hits;
}

function collectSchema(hits, kind, regex, text, full) {
  const matches = [...text.matchAll(regex)];
  if (!matches.length) return;
  for (const match of matches.slice(0, 10)) {
    hits.push({ kind, name: match[1] || "detected", file: rel(full) });
  }
}

function detectTests(files) {
  const testFiles = files.filter((file) => /(\.test\.|\.spec\.|__tests__|\/tests?\/)/.test(file));
  return {
    testFileCount: testFiles.length,
    examples: testFiles.slice(0, 20),
  };
}

function scanArtifactsTesting(dir) {
  if (!fs.existsSync(dir)) return [];
  const reports = listFiles(dir, 500)
    .filter((file) => /testing-report\.md$/.test(file))
    .map((file) => {
      const full = path.join(dir, file);
      const text = readSmall(full) || "";
      return {
        file: rel(full),
        commandMentions: (text.match(/`[^`]*(test|lint|build|typecheck|check|pytest|go test|cargo test|mvn test|validate)[^`]*`/gi) || []).length,
        failureSignals: (text.match(/失败|未通过|❌|failed|failure|error/gi) || []).length,
      };
    });
  return reports.slice(0, 50);
}

function listFiles(rootDir, limit) {
  const output = [];
  walk(rootDir, "");
  return output;

  function walk(abs, prefix) {
    if (output.length >= limit) return;
    let entries = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (output.length >= limit) return;
      if (skip(entry.name)) continue;
      const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      const childAbs = path.join(abs, entry.name);
      if (entry.isDirectory()) walk(childAbs, childPrefix);
      else output.push(childPrefix);
    }
  }
}

function listTopLevelFiles(rootDir, limit) {
  const output = [];
  if (!fs.existsSync(rootDir)) return output;
  try {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (output.length >= limit) break;
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) continue;
      output.push(entry.name);
    }
  } catch {
    return [];
  }
  return output;
}

function skip(name) {
  return name.startsWith(".") ||
    ["node_modules", "dist", "build", ".next", "coverage", "target", "vendor", "__pycache__"].includes(name) ||
    /\.(lock|log|png|jpg|jpeg|gif|webp|pdf|zip|gz|tar|mp4|mov)$/.test(name);
}

function exists(dir, file) {
  return fs.existsSync(path.join(dir, file));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function readSmall(file) {
  try {
    const stat = fs.statSync(file);
    if (stat.size > 512 * 1024) return "";
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function normalizeMethod(value) {
  return String(value || "").toUpperCase();
}

function routePathFromFile(file) {
  return `/${file.replace(/(^|\/)(app|pages|api)\//g, "").replace(/\/route\.(ts|js)$/, "").replace(/\.(ts|tsx|js|jsx)$/, "")}`;
}

function rel(file) {
  return path.relative(process.cwd(), file) || ".";
}

function toMarkdown(summary) {
  const lines = ["# Background Scan", ""];
  if (!summary.projects.length) {
    lines.push(`No workspace directories found under \`${summary.root}\`.`, "");
    lines.push("You can start from an empty workspace or copy materials into `projects/{workspace}/`.");
    return lines.join("\n");
  }
  for (const project of summary.projects) {
    lines.push(`## ${project.name}`, "", `- Path: \`${project.path}\``, `- Kind: \`${project.kind}\``);
    if (project.package) {
      lines.push(`- Package: \`${project.package.name}\``, `- Scripts: ${Object.keys(project.package.scripts).map((name) => `\`${name}\``).join(", ") || "-"}`);
    }
    if (project.fileTypes.length) {
      lines.push(`- File types: ${project.fileTypes.map((ft) => `\`${ft.ext}\`(${ft.count})`).join(", ")}`);
    }
    lines.push(`- Routes/files: ${project.routes.length}`, `- API endpoints detected: ${project.apis.length}`, `- Schema hints: ${project.schemas.length}`, `- Test files: ${project.tests.testFileCount}`, "");
    if (project.apis.length) {
      lines.push("### API Hints", "", "| Kind | Method | Path | File |", "|------|--------|------|------|");
      for (const api of project.apis.slice(0, 20)) lines.push(`| ${api.kind} | ${api.method} | \`${api.path}\` | \`${api.file}\` |`);
      lines.push("");
    }
    if (project.schemas.length) {
      lines.push("### Schema Hints", "", "| Kind | Name | File |", "|------|------|------|");
      for (const schema of project.schemas.slice(0, 20)) lines.push(`| ${schema.kind} | \`${schema.name}\` | \`${schema.file}\` |`);
      lines.push("");
    }
  }
  if (summary.artifactsTesting.length) {
    lines.push("## Artifacts Testing Reports", "", "| File | Command Mentions | Failure Signals |", "|------|------------------|-----------------|");
    for (const report of summary.artifactsTesting) lines.push(`| \`${report.file}\` | ${report.commandMentions} | ${report.failureSignals} |`);
    lines.push("");
  }
  return lines.join("\n");
}
