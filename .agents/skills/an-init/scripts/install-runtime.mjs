#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_README_MARKER = "<!-- ai-native-template-readme -->";
const PENDING_START = "<!-- an-init-pending:start -->";
const PENDING_END = "<!-- an-init-pending:end -->";

const isMain = process.argv[1] && sameFile(process.argv[1], fileURLToPath(import.meta.url));
if (isMain) runCli();

function runCli(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const root = path.resolve(args.root || ".");
    const result = installRuntime(root, { dryRun: args.dryRun });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export function installRuntime(root, options = {}) {
  const plan = planInstallation(root);
  if (options.dryRun) {
    return {
      status: "dry-run",
      root: plan.root,
      skills: plan.skills.map((item) => item.name),
      pendingRouteWillBeRemoved: true,
    };
  }

  const committed = [];
  let agentsUpdated = false;
  fs.mkdirSync(plan.stagingDir);

  try {
    for (const skill of plan.skills) stageSkill(skill, plan.stagingDir, plan.root);
    validateStagedSkills(plan.skills, plan.stagingDir, plan.root);

    for (const skill of plan.skills) {
      const staged = path.join(plan.stagingDir, skill.name);
      if (entryExists(skill.target)) throw new Error(`安装目标已存在：${skill.target}`);
      fs.renameSync(staged, skill.target);
      committed.push(skill);
    }
    fs.rmdirSync(plan.stagingDir);
    writeTextAtomic(plan.rootAgents, plan.nextAgentsText);
    agentsUpdated = true;
    fs.renameSync(plan.initDir, plan.retiredDir);
    fs.renameSync(path.join(plan.retiredDir, "SKILL.md"), path.join(plan.retiredDir, "SKILL.md.retired"));
  } catch (error) {
    const rollbackErrors = rollback(plan, committed, agentsUpdated);
    if (rollbackErrors.length) throw new Error(`${error.message}；回滚不完整：${rollbackErrors.join("；")}`);
    throw error;
  }

  const warnings = [];
  try { fs.rmSync(plan.retiredDir, { recursive: true }); }
  catch (error) { warnings.push(`运行期 Skills 已安装，但旧 an-init 副本清理失败：${error.message}`); }

  return {
    status: "installed",
    root: plan.root,
    skills: plan.skills.map((item) => item.name),
    restartRequired: true,
    warnings,
  };
}

export function planInstallation(rootInput) {
  const root = fs.realpathSync(rootInput);
  const skillsRoot = path.join(root, ".agents", "skills");
  const initDir = path.join(skillsRoot, "an-init");
  const assetsDir = path.join(initDir, "assets", "skills");
  const stagingDir = path.join(skillsRoot, ".an-runtime-staging");
  const retiredDir = path.join(skillsRoot, ".an-init-retired");

  const workspace = validateWorkspace(root, initDir, skillsRoot);
  assertDirectoryInside(root, assetsDir, "运行期 Skills 源目录");
  if (entryExists(stagingDir) || entryExists(retiredDir)) throw new Error("检测到未清理的安装 staging，请先人工检查");

  const skills = fs.readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^an-[a-z0-9-]+$/.test(entry.name))
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    .map((entry) => ({
      name: entry.name,
      source: path.join(assetsDir, entry.name),
      target: path.join(skillsRoot, entry.name),
    }));

  if (skills.length === 0) throw new Error("没有可安装的运行期 Skill");
  for (const skill of skills) {
    assertTreeNoSymlinks(root, skill.source, skill.name);
    assertRegularInside(root, path.join(skill.source, "SKILL.md.txt"), `${skill.name} SKILL.md.txt`);
    if (entryExists(skill.target)) throw new Error(`安装目标已存在：${skill.target}`);
  }

  return {
    root,
    skillsRoot,
    rootAgents: workspace.rootAgents,
    oldAgentsText: workspace.oldAgentsText,
    nextAgentsText: workspace.nextAgentsText,
    initDir,
    stagingDir,
    retiredDir,
    skills,
  };
}

function validateWorkspace(root, initDir, skillsRoot) {
  const rootAgents = path.join(root, "AGENTS.md");
  const readme = path.join(root, "README.md");
  const artifactIndex = path.join(root, "artifacts", "index.json");
  assertDirectoryInside(root, path.join(root, ".agents"), ".agents 目录");
  assertDirectoryInside(root, skillsRoot, ".agents/skills 目录");
  assertDirectoryInside(root, initDir, "an-init 目录");
  assertRegularInside(root, path.join(initDir, "SKILL.md"), "an-init/SKILL.md");
  assertRegularInside(root, rootAgents, "根 AGENTS.md");
  assertRegularInside(root, readme, "根 README.md");
  assertRegularInside(root, artifactIndex, "artifacts/index.json");

  const oldAgentsText = fs.readFileSync(rootAgents, "utf8");
  if (oldAgentsText.includes("当前处于模板阶段")) throw new Error("根 AGENTS.md 尚未生成运行期路由");
  const nextAgentsText = removePendingBlock(oldAgentsText);
  if (nextAgentsText.includes(".agents/skills/an-init") || nextAgentsText.includes("$an-init")) throw new Error("an-init 路由必须完整放入待完成路由块");
  if (fs.readFileSync(readme, "utf8").includes(TEMPLATE_README_MARKER)) throw new Error("README.md 尚未改写为当前工作区概览");

  const index = readJson(artifactIndex, "artifacts/index.json");
  if (index.schemaVersion !== 1 || !Array.isArray(index.active) || index.active.length !== 0) throw new Error("初始化时 artifacts/index.json 必须是空的 schemaVersion 1 索引");
  return { rootAgents, oldAgentsText, nextAgentsText };
}

function removePendingBlock(text) {
  const start = text.indexOf(PENDING_START);
  const end = text.indexOf(PENDING_END);
  if (start < 0 || end < start || text.indexOf(PENDING_START, start + 1) >= 0 || text.indexOf(PENDING_END, end + 1) >= 0) {
    throw new Error("根 AGENTS.md 缺少唯一的 an-init 待完成路由块");
  }
  return `${text.slice(0, start)}${text.slice(end + PENDING_END.length)}`.replace(/\n{3,}/g, "\n\n");
}

function stageSkill(skill, stagingDir, root) {
  const staged = path.join(stagingDir, skill.name);
  fs.cpSync(skill.source, staged, { recursive: true, dereference: false, errorOnExist: true });
  assertTreeNoSymlinks(root, staged, `${skill.name} staging`);
  fs.renameSync(path.join(staged, "SKILL.md.txt"), path.join(staged, "SKILL.md"));
}

function validateStagedSkills(skills, stagingDir, root) {
  for (const skill of skills) {
    const staged = path.join(stagingDir, skill.name);
    const skillFile = path.join(staged, "SKILL.md");
    assertRegularInside(root, skillFile, `${skill.name} SKILL.md`);
    const text = fs.readFileSync(skillFile, "utf8");
    const name = text.match(/^---[\s\S]*?^name:\s*([a-z0-9-]+)\s*$/m)?.[1];
    if (name !== skill.name) throw new Error(`${skill.name} 的目录名与 frontmatter name 不一致`);
    if (entryExists(path.join(staged, "SKILL.md.txt"))) throw new Error(`${skill.name} 仍包含 SKILL.md.txt`);
  }
}

function rollback(plan, committed, agentsUpdated) {
  const errors = [];
  if (entryExists(plan.retiredDir) && !entryExists(plan.initDir)) {
    try { fs.renameSync(plan.retiredDir, plan.initDir); } catch (error) { errors.push(`恢复 an-init 失败：${error.message}`); }
  }
  if (agentsUpdated) {
    try { writeTextAtomic(plan.rootAgents, plan.oldAgentsText); } catch (error) { errors.push(`恢复根 AGENTS.md 失败：${error.message}`); }
  }
  for (const skill of [...committed].reverse()) {
    if (!entryExists(skill.target)) continue;
    try { fs.rmSync(skill.target, { recursive: true }); } catch (error) { errors.push(`移除 ${skill.name} 失败：${error.message}`); }
  }
  if (entryExists(plan.stagingDir)) {
    try { fs.rmSync(plan.stagingDir, { recursive: true }); } catch (error) { errors.push(`清理 staging 失败：${error.message}`); }
  }
  return errors;
}

function writeTextAtomic(file, text) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  if (entryExists(temp)) throw new Error(`临时文件已存在：${temp}`);
  try {
    fs.writeFileSync(temp, text, { flag: "wx" });
    fs.renameSync(temp, file);
  } catch (error) {
    if (entryExists(temp)) fs.unlinkSync(temp);
    throw error;
  }
}

function assertTreeNoSymlinks(root, directory, label) {
  assertDirectoryInside(root, directory, label);
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const stat = fs.lstatSync(child);
      if (stat.isSymbolicLink()) throw new Error(`${label} 包含符号链接：${child}`);
      assertInside(root, fs.realpathSync(child), label);
      if (stat.isDirectory()) stack.push(child);
    }
  }
}

function assertDirectoryInside(root, file, label) {
  assertNoSymlinkComponents(root, file, label);
  if (!entryExists(file) || !fs.lstatSync(file).isDirectory()) throw new Error(`${label}必须是目录`);
  assertInside(root, fs.realpathSync(file), label);
}

function assertRegularInside(root, file, label) {
  assertNoSymlinkComponents(root, file, label);
  if (!entryExists(file) || !fs.lstatSync(file).isFile()) throw new Error(`${label}必须是普通文件`);
  assertInside(root, fs.realpathSync(file), label);
}

function assertNoSymlinkComponents(root, file, label) {
  const relative = path.relative(root, file);
  assertInside(root, file, label);
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (entryExists(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`${label} 路径包含符号链接：${current}`);
  }
}

function assertInside(root, file, label) {
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`${label}越过工作区边界`);
}

function entryExists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function sameFile(left, right) {
  try { return fs.realpathSync(left) === fs.realpathSync(right); }
  catch { return false; }
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { throw new Error(`${label} 不存在或 JSON 无法解析`); }
}

function parseArgs(argv) {
  const parsed = { root: ".", dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run") { parsed.dryRun = true; continue; }
    if (item === "--root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--root 缺少路径");
      parsed.root = value;
      index += 1;
      continue;
    }
    throw new Error(`未知参数：${item}`);
  }
  return parsed;
}
