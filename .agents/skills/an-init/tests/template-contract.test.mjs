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
