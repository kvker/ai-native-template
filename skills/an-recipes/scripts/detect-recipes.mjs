#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || "projects");
const format = args.format || (args.write ? "json" : "markdown");

const projects = scanProjects(root);

const result = {
  schemaVersion: 1,
  root: path.relative(process.cwd(), root) || ".",
  projects,
};

const output = format === "json" ? JSON.stringify(result, null, 2) : toMarkdown(result);

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
    if (item.startsWith("--")) {
      const key = item.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        i += 1;
      }
    }
  }
  return parsed;
}

function scanProjects(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => {
      const dir = path.join(rootDir, entry.name);
      const codeRecipes = detectCodeRecipes(dir);
      const generalRecipes = detectGeneralRecipes(dir);
      return {
        name: entry.name,
        path: rel(dir),
        kind: codeRecipes.length ? detectCodeKind(dir) : detectGeneralKind(dir),
        recipes: [...codeRecipes, ...generalRecipes],
      };
    });
}

function detectCodeKind(dir) {
  if (exists(dir, "package.json")) return detectPackageKind(dir);
  if (exists(dir, "pyproject.toml") || exists(dir, "requirements.txt")) return "python";
  if (exists(dir, "go.mod")) return "go";
  if (exists(dir, "pom.xml")) return "java-maven";
  if (exists(dir, "build.gradle") || exists(dir, "build.gradle.kts")) return "java-gradle";
  if (exists(dir, "Cargo.toml")) return "rust";
  return "unknown";
}

function detectPackageKind(dir) {
  const pkg = readJson(path.join(dir, "package.json"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next) return "nextjs";
  if (deps.react) return "react";
  if (deps.vue) return "vue";
  if (deps["@nestjs/core"]) return "nestjs";
  if (deps.express) return "express";
  return "node";
}

function detectGeneralKind(dir) {
  const topFiles = listTopLevelFiles(dir, 100);
  const allFiles = listFiles(dir, 200);
  if (topFiles.some((f) => /\.(md|mdx)$/.test(f)) || allFiles.some((f) => /\.(md|mdx)$/.test(f))) return "markdown-docs";
  if (topFiles.some((f) => /\.(json|yaml|yml)$/.test(f)) || allFiles.some((f) => /\.(json|yaml|yml)$/.test(f))) return "data-config";
  if (topFiles.some((f) => /\.(png|jpg|jpeg|svg|fig|sketch)$/.test(f))) return "design-assets";
  return "generic";
}

function detectCodeRecipes(dir) {
  if (exists(dir, "package.json")) return nodeRecipes(dir);
  if (exists(dir, "pyproject.toml") || exists(dir, "requirements.txt")) return pythonRecipes(dir);
  if (exists(dir, "go.mod")) return goRecipes(dir);
  if (exists(dir, "pom.xml")) return mavenRecipes(dir);
  if (exists(dir, "build.gradle") || exists(dir, "build.gradle.kts")) return gradleRecipes(dir);
  if (exists(dir, "Cargo.toml")) return rustRecipes(dir);
  return [];
}

function detectGeneralRecipes(dir) {
  const recipes = [];
  const files = listFiles(dir, 200);
  const topFiles = listTopLevelFiles(dir, 100);

  // Markdown docs: link check / word count / lint
  const mdFiles = files.filter((f) => /\.(md|mdx)$/.test(f));
  if (mdFiles.length) {
    recipes.push(recipe("docs-count", "check", "find . -name '*.md' -type f | wc -l", dir, "medium", "markdown files present", true));
    recipes.push(recipe("docs-link-check", "check", "# manual: review Markdown links", dir, "low", "markdown files present", false));
    recipes.push(recipe("docs-word-count", "check", "# manual: review Markdown word count", dir, "low", "markdown files present", false));
  }

  // JSON/YAML data validation
  const dataFiles = files.filter((f) => /\.(json|yaml|yml)$/.test(f));
  if (dataFiles.length) {
    recipes.push(recipe("data-validate", "check", "# manual: validate data/config files", dir, "low", "data files present", false));
  }

  // Design assets
  const imageFiles = topFiles.filter((f) => /\.(png|jpg|jpeg|svg|fig|sketch)$/.test(f));
  if (imageFiles.length) {
    recipes.push(recipe("assets-list", "check", "find . -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.svg' \) | sort", dir, "medium", "image assets present", true));
  }

  return recipes;
}

function nodeRecipes(dir) {
  const pkg = readJson(path.join(dir, "package.json"));
  const scripts = pkg.scripts || {};
  const pm = detectPackageManager(dir);
  const recipes = [];
  const purposeByScript = [
    ["test", "test"],
    ["test:unit", "test"],
    ["test:e2e", "e2e"],
    ["typecheck", "typecheck"],
    ["type-check", "typecheck"],
    ["lint", "lint"],
    ["build", "build"],
    ["generate", "generate"],
    ["codegen", "generate"],
    ["format:check", "format-check"],
  ];
  for (const [script, purpose] of purposeByScript) {
    if (scripts[script]) {
      recipes.push(recipe(scriptId(purpose, script), purpose, `${pm} run ${script}`, dir, "high", `package.json scripts.${script}`));
    }
  }
  return recipes;
}

function pythonRecipes(dir) {
  const runner = exists(dir, "uv.lock") ? "uv run" : "python -m";
  const recipes = [
    recipe("test", "test", `${runner} pytest`, dir, "medium", "python convention"),
  ];
  if (textIncludes(dir, "pyproject.toml", "ruff")) recipes.push(recipe("lint", "lint", "ruff check .", dir, "medium", "pyproject.toml"));
  if (textIncludes(dir, "pyproject.toml", "mypy")) recipes.push(recipe("typecheck", "typecheck", "mypy .", dir, "medium", "pyproject.toml"));
  return recipes;
}

function goRecipes(dir) {
  return [
    recipe("test", "test", "go test ./...", dir, "high", "go.mod"),
    recipe("vet", "lint", "go vet ./...", dir, "medium", "go.mod"),
  ];
}

function mavenRecipes(dir) {
  return [
    recipe("test", "test", "mvn test", dir, "high", "pom.xml"),
    recipe("build", "build", "mvn package", dir, "medium", "pom.xml"),
  ];
}

function gradleRecipes(dir) {
  const gradle = exists(dir, "gradlew") ? "./gradlew" : "gradle";
  return [
    recipe("test", "test", `${gradle} test`, dir, "high", "build.gradle"),
    recipe("build", "build", `${gradle} build`, dir, "medium", "build.gradle"),
  ];
}

function rustRecipes(dir) {
  return [
    recipe("test", "test", "cargo test", dir, "high", "Cargo.toml"),
    recipe("check", "typecheck", "cargo check", dir, "high", "Cargo.toml"),
    recipe("lint", "lint", "cargo clippy", dir, "medium", "Cargo.toml"),
  ];
}

function recipe(id, purpose, command, cwd, confidence, source, executable = true) {
  return { id, purpose, command, cwd: rel(cwd), confidence, source, executable };
}

function scriptId(purpose, script) {
  return purpose === script ? purpose : `${purpose}:${script.replace(/[^a-z0-9]+/gi, "-")}`;
}

function detectPackageManager(dir) {
  if (exists(dir, "pnpm-lock.yaml")) return "pnpm";
  if (exists(dir, "yarn.lock")) return "yarn";
  if (exists(dir, "bun.lockb") || exists(dir, "bun.lock")) return "bun";
  return "npm";
}

function listFiles(rootDir, limit) {
  const output = [];
  if (!fs.existsSync(rootDir)) return output;
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

function textIncludes(dir, file, needle) {
  try {
    return fs.readFileSync(path.join(dir, file), "utf8").includes(needle);
  } catch {
    return false;
  }
}

function rel(file) {
  return path.relative(process.cwd(), file) || ".";
}

function toMarkdown(data) {
  const lines = ["# Executable Recipes", ""];
  if (!data.projects.length) {
    lines.push(`No workspace directories found under \`${data.root}\`.`, "");
    lines.push("You can:", "- Copy existing work into `projects/{workspace}/` and rerun this command.", "- Start from an empty workspace; AI will infer minimal validation actions per task.");
    return lines.join("\n");
  }
  for (const project of data.projects) {
    lines.push(`## ${project.name}`, "", `- Path: \`${project.path}\``, `- Kind: \`${project.kind}\``, "");
    if (!project.recipes.length) {
      lines.push("No recipes detected.", "");
      continue;
    }
    lines.push("| ID | Purpose | Command | CWD | Confidence | Source | Executable |", "|----|---------|---------|-----|------------|--------|------------|");
    for (const item of project.recipes) {
      lines.push(`| \`${item.id}\` | ${item.purpose} | \`${item.command}\` | \`${item.cwd}\` | ${item.confidence} | ${item.source} | ${item.executable ? "yes" : "no"} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
