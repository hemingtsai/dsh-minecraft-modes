/**
 * 校验脚本（开发期工具，不属于插件本体）：
 * 用与 dsh roster 相同的规则检查本插件的四个 preset：
 *   1. agent.cordis.yml 能被 entryListSchema（含 !!js）解析且行结构合法
 *   2. preset.yml 元信息可读（name/description/order）
 *   3. skills/<name>/SKILL.md frontmatter 合法（name + description，名称符合
 *      ^[a-z0-9]+(?:-[a-z0-9]+)*$；仅当组装声明了 customSkillDirs 时要求）
 *
 * 依赖 Harness 的 node_modules 来解析 entryListSchema。解析顺序：
 *   1. 环境变量 DSH_NM（显式指定 Harness node_modules 的绝对路径）
 *   2. PATH 上的 `dsh` 可执行文件（其 .bin 的上一级即 node_modules 根）
 * 两者都找不到时给出清晰报错退出。
 */
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

async function findHarnessNodeModules() {
  if (process.env.DSH_NM && process.env.DSH_NM.trim()) return process.env.DSH_NM.trim();
  const candidates = (process.env.PATH ?? "").split(sep === "/" ? ":" : ";").map((dir) => join(dir, "dsh"));
  for (const bin of candidates) {
    try {
      await access(bin);
      // 符号链接无关紧要：.bin 的上一级就是 node_modules 根
      return join(dirname(bin), "..");
    } catch { /* 该 PATH 项没有 dsh，继续 */ }
  }
  throw new Error(
    "找不到 DeepSeek Harness 的 node_modules：请设置环境变量 DSH_NM 指向它（例如 DSH_NM=/path/to/harness/node_modules），或把 `dsh` 加入 PATH。"
  );
}
const DSH_NM = await findHarnessNodeModules();
const yaml = (await import(`file://${DSH_NM}/js-yaml/index.js`)).default;
const { entryListSchema } = await import(`file://${DSH_NM}/@deepseek-ai/cordis-plugin-include/lib/index.js`);

const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRESETS = ["survival", "adventure", "hardcore", "spectator"];

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

function entryListProblem(rows, at = "") {
  if (!Array.isArray(rows)) return at === "" ? "the composition must be a top-level list of plugin rows" : `group ${at} must hold a list of plugin rows`;
  for (const [index, row] of rows.entries()) {
    const label = at === "" ? `row ${String(index + 1)}` : `${at} row ${String(index + 1)}`;
    if (typeof row !== "object" || row === null || Array.isArray(row)) return `${label} is not a plugin row`;
    const { name, group, config } = row;
    if (typeof name !== "string" || name === "") return `${label} names no plugin`;
    if (group === true) {
      const nested = entryListProblem(config, label);
      if (nested !== void 0) return nested;
    }
  }
}

for (const id of PRESETS) {
  console.log(`\n== ${id} ==`);
  const dir = join(ROOT, id);
  if (!PRESET_ID.test(id)) fail(`${id}: invalid preset id`);

  // 1. composition
  const compPath = join(dir, "agent.cordis.yml");
  try {
    const content = await readFile(compPath, "utf8");
    let rows;
    try {
      rows = yaml.load(content, { schema: entryListSchema });
    } catch (e) {
      fail(`agent.cordis.yml 无法解析: ${e.message.replace(/\n[\s\S]*$/, "")}`);
      continue;
    }
    const problem = entryListProblem(rows);
    if (problem) fail(`agent.cordis.yml: ${problem}`);
    else {
      ok(`agent.cordis.yml 可解析且行结构合法（${Array.isArray(rows) ? rows.length : 0} 行）`);
      // 检查 !!js baseUrl 表达式确实被构造成表达式节点而非字符串
      const raw = content;
      if (raw.includes("new URL('skills/', baseUrl)")) ok("customSkillDirs 使用 baseUrl 表达式（与官方 cordis preset 一致）");
    }
  } catch (e) {
    fail(`agent.cordis.yml 读取失败: ${e.message}`);
  }

  // 2. preset.yml metadata
  try {
    const meta = yaml.load(await readFile(join(dir, "preset.yml"), "utf8"));
    const name = typeof meta?.name === "string" && meta.name.trim() ? meta.name : void 0;
    const description = typeof meta?.description === "string" && meta.description.trim() ? meta.description : void 0;
    const order = typeof meta?.order === "number" && Number.isFinite(meta.order) ? meta.order : void 0;
    if (!name) fail("preset.yml: 缺少 name");
    else ok(`preset.yml name: ${name}`);
    if (!description) fail("preset.yml: 缺少 description");
    else ok("preset.yml description 存在");
    if (order === void 0) fail("preset.yml: 缺少 order");
    else ok(`preset.yml order: ${order}`);
  } catch (e) {
    fail(`preset.yml 解析失败: ${e.message}`);
  }

  // 3. skills（仅当组装声明了 customSkillDirs 时才要求 skills/ 目录存在）
  let wantsSkills = false;
  try {
    wantsSkills = (await readFile(compPath, "utf8")).includes("customSkillDirs");
  } catch { /* compPath 读取失败已在上面报过 */ }
  const skillsDir = join(dir, "skills");
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skillDirs = entries.filter((e) => e.isDirectory());
    if (skillDirs.length === 0 && wantsSkills) fail("skills/ 下没有技能目录");
    for (const skill of skillDirs) {
      if (!SKILL_NAME.test(skill.name)) fail(`skills/${skill.name}: 目录名不符合技能命名规则`);
      const skillPath = join(skillsDir, skill.name, "SKILL.md");
      let raw;
      try {
        raw = await readFile(skillPath, "utf8");
      } catch {
        fail(`skills/${skill.name}: 缺少 SKILL.md`);
        continue;
      }
      if (!raw.startsWith("---")) { fail(`skills/${skill.name}: 缺少 YAML frontmatter`); continue; }
      const end = raw.indexOf("\n---", 4);
      const fm = end === -1 ? raw.slice(3) : raw.slice(3, end);
      let data;
      try {
        data = yaml.load(fm);
      } catch (e) {
        fail(`skills/${skill.name}: frontmatter 解析失败: ${e.message}`);
        continue;
      }
      const sname = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : void 0;
      const sdesc = typeof data?.description === "string" && data.description.trim() ? data.description.trim() : void 0;
      if (!sname || !SKILL_NAME.test(sname)) fail(`skills/${skill.name}: name 缺失或非法（${String(sname)}）`);
      else if (sname !== skill.name) fail(`skills/${skill.name}: frontmatter name (${sname}) 与目录名不一致`);
      else ok(`skills/${skill.name}: name 合法`);
      if (!sdesc) fail(`skills/${skill.name}: 缺少 description`);
      else ok(`skills/${skill.name}: description 存在（${sdesc.slice(0, 40)}…）`);
    }
  } catch (e) {
    if (e.code === "ENOENT") { if (wantsSkills) fail("缺少 skills/ 目录"); else ok("无技能包（组装未声明 customSkillDirs，符合设计）"); }
    else fail(`skills 检查失败: ${e.message}`);
  }
}

console.log("");
if (failures > 0) {
  console.error(`校验失败：${failures} 处问题`);
  process.exit(1);
}
console.log("全部校验通过 ✅ 所有 preset 均可被 roster 发现与挂载。");
