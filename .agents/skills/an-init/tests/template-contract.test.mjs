import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const INIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Skill 元数据、目录名和暂存文件保持一致", () => {
  const skills = [INIT, ...fs.readdirSync(path.join(INIT, "assets/skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(INIT, "assets/skills", entry.name))];

  for (const skillDir of skills) {
    const name = path.basename(skillDir);
    const skillFile = skillDir === INIT ? path.join(skillDir, "SKILL.md") : path.join(skillDir, "SKILL.md.txt");
    const metadataFile = path.join(skillDir, "agents/openai.yaml");
    const skill = fs.readFileSync(skillFile, "utf8");
    const metadata = fs.readFileSync(metadataFile, "utf8");
    const declaredName = skill.match(/^name:\s*([a-z0-9-]+)$/m)?.[1];
    const description = metadata.match(/short_description:\s*"([^"]+)"/)?.[1] || "";
    const prompt = metadata.match(/default_prompt:\s*"([^"]+)"/)?.[1] || "";

    assert.equal(declaredName, name, `${name} frontmatter name 不一致`);
    assert.ok(Array.from(description).length >= 25 && Array.from(description).length <= 64, `${name} short_description 长度无效`);
    assert.ok(prompt.includes(`$${name}`), `${name} default_prompt 未显式引用 Skill`);
  }
});

test("an-task 触发机制锁定讨论态到执行态的切换", () => {
  const skill = fs.readFileSync(path.join(INIT, "assets/skills/an-task/SKILL.md.txt"), "utf8");
  const metadata = fs.readFileSync(path.join(INIT, "assets/skills/an-task/agents/openai.yaml"), "utf8");
  const init = fs.readFileSync(path.join(INIT, "SKILL.md"), "utf8");

  // AC-1：发现描述包含进入执行态的触发信号，隐式调用也能命中
  assert.match(skill, /^description:.*“开始吧”.*“实现”.*(执行态|分流).*$/m);

  // AC-2：正文包含逐消息重新分流规则；连续讨论后用户下达开始/实现指令必须进入分流
  assert.match(skill, /## 〇、触发与逐消息重新分流/);
  assert.match(skill, /每收到一条新消息都重新分流/);
  assert.match(skill, /不构成跳过分流的理由|不得因前文/);
  assert.ok(metadata.includes("$an-task"), "an-task 元数据未引用 Skill");

  // AC-3：初始化生成的根 AGENTS 路由要求包含触发规则
  assert.match(init, /an-task.*触发规则|触发规则.*an-task/);
});

test("an-task 规模感知触发机制：小改动不跳过分流、规模膨胀升级", () => {
  const skill = fs.readFileSync(path.join(INIT, "assets/skills/an-task/SKILL.md.txt"), "utf8");
  const flow = fs.readFileSync(path.resolve(INIT, "../../../conventions/flow-policy.md"), "utf8");
  const init = fs.readFileSync(path.join(INIT, "SKILL.md"), "utf8");

  // AC-1：分流判定与建 Artifact 分离；小改动也必须先判定
  assert.match(skill, /分流判定不等于/);
  assert.match(skill, /不允许跳过判定|不允许不判定/);

  // AC-2：L0/L1 客观判据锁定具体数值与层约束（两文档口径一致）
  assert.match(flow, /L0 不超过 1 个/);
  assert.match(flow, /L1 不超过 2 个/);
  assert.match(flow, /不跨前后端/);
  assert.match(skill, /L0 限不超过 1 个文件、L1 限不超过 2 个文件/);

  // AC-3：3 个以上文件或跨前后端 → 至少 L2；两文档阈值与清单一致
  assert.match(flow, /3 个以上文件/);
  assert.match(skill, /3 个以上文件/);
  assert.match(flow, /至少使用 L2/);
  assert.match(skill, /数据迁移/);
  assert.match(skill, /权限或安全边界/);
  assert.match(skill, /多轮迭代/);

  // AC-4：迭代膨胀再评估；两文档 3 轮阈值一致，区分未建仓/已建仓，且已建仓不重复询问建仓
  assert.match(flow, /达 3 轮实质迭代/);
  assert.match(skill, /连续迭代达 3 轮/);
  assert.match(flow, /未建仓任务.*补建 Artifact/);
  assert.match(flow, /含 L1 轻量 Artifact/);
  assert.match(flow, /相应阶段文档/);
  assert.match(skill, /相应阶段文档/);
  assert.match(flow, /不重复询问是否建仓/);
  assert.match(skill, /不重复询问是否建仓/);

  // 根路由要求包含规模规则
  assert.match(init, /an-task.*规模|规模.*an-task/);
});

test("an-init 必须禁止隐式触发", () => {
  const metadata = fs.readFileSync(path.join(INIT, "agents/openai.yaml"), "utf8");
  assert.match(metadata, /allow_implicit_invocation:\s*false/);
});

test("模板初始状态契约有效且不预置个人 Memory", () => {
  const root = path.resolve(INIT, "../../../");
  const index = JSON.parse(fs.readFileSync(path.join(root, "artifacts/index.json"), "utf8"));
  const memories = fs.readdirSync(path.join(root, "conventions/memories"));

  assert.deepEqual(index, { schemaVersion: 1, active: [] });
  assert.deepEqual(memories, ["AGENTS.md"]);
  assert.match(fs.readFileSync(path.join(root, "README.md"), "utf8"), /^<!-- ai-native-template-readme -->/);
});
