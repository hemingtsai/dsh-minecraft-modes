#!/usr/bin/env node
/**
 * dsh-minecraft-modes 安装/卸载脚本
 *
 * 把本插件携带的四个 agent preset（survival 生存模式 / adventure 冒险模式 /
 * hardcore 极限模式 / spectator 旁观模式）安装到 DeepSeek Harness 的用户
 * preset 根目录，使模式选择器从四个模式变成八个模式。
 *
 * 用法：
 *   node install.mjs             # 安装（已存在则跳过，除非 --force）
 *   node install.mjs --force     # 安装并覆盖已存在的同名 preset
 *   node install.mjs --remove    # 卸载四个 preset
 *   node install.mjs --list      # 显示当前已安装情况
 *
 * 说明：
 *   - 目标根目录 = $DSH_HOME/.agent-presets （默认 ~/.dsh/.agent-presets）
 *   - 安装是整目录复制（composition + preset.yml + skills），绝不静默覆盖，
 *     目录权限收紧为仅属主可用。与 roster 的 copy() 不同，这里刻意**保留**
 *     preset.yml 的 name 与 order（order: 5–8 让新模式按序排在官方模式之后）。
 *   - 无需重启：roster 的发现每次 list() 都会重新读盘，装完刷新页面即可
 *     在模式选择器看到新的模式。
 */
import { cp, mkdir, readdir, rm, stat, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESET_IDS = ["survival", "adventure", "hardcore", "spectator"];
const DSH_HOME = resolve(process.env.DSH_HOME && process.env.DSH_HOME.trim() ? process.env.DSH_HOME : join(homedir(), ".dsh"));
const USER_PRESET_ROOT = join(DSH_HOME, ".agent-presets");

function log(message = "") {
  console.log(message);
}

/** 目录权限收紧为仅属主可用：目录 0o700，文件 0o600（保留属主执行位）。 */
async function tightenModes(dir) {
  await chmod(dir, 0o700);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name);
    if (entry.isDirectory()) await tightenModes(target);
    else await chmod(target, ((await stat(target)).mode & 0o100) === 0 ? 0o600 : 0o700);
  }
}

/** 复制一个 preset 目录到用户根，绝不覆盖已存在目录。 */
async function installPreset(id, { force }) {
  const source = join(__dirname, id);
  const target = join(USER_PRESET_ROOT, id);
  let exists = true;
  try {
    await stat(target);
  } catch {
    exists = false;
  }
  if (exists && !force) {
    log(`  ⏭  ${id}: 已存在于 ${target}（用 --force 覆盖）`);
    return false;
  }
  if (exists) await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true, dereference: true, force: false, errorOnExist: true });
  await tightenModes(target);
  log(`  ✅ ${id}: 已安装到 ${target}`);
  return true;
}

async function removePreset(id) {
  const target = join(USER_PRESET_ROOT, id);
  let exists = true;
  try {
    await stat(target);
  } catch {
    exists = false;
  }
  if (!exists) {
    log(`  ⏭  ${id}: 未安装，跳过`);
    return false;
  }
  await rm(target, { recursive: true, force: true });
  log(`  🗑  ${id}: 已从 ${target} 删除`);
  return true;
}

async function listInstalled() {
  log(`用户 preset 根目录: ${USER_PRESET_ROOT}`);
  let entries = [];
  try {
    entries = await readdir(USER_PRESET_ROOT, { withFileTypes: true });
  } catch {
    /* 根目录尚不存在 */
  }
  const installed = entries.filter((e) => e.isDirectory() && PRESET_IDS.includes(e.name)).map((e) => e.name);
  if (installed.length === 0) log("  尚未安装本插件的任何 preset。");
  for (const id of PRESET_IDS) log(`  ${installed.includes(id) ? "✅" : "⬜"} ${id}`);
}

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const force = args.includes("--force");
const list = args.includes("--list");

if (list) {
  await listInstalled();
  process.exit(0);
}

log(`dsh-minecraft-modes 安装脚本`);
log(`DSH_HOME: ${DSH_HOME}`);
log(`用户 preset 根目录: ${USER_PRESET_ROOT}`);
log("");

if (remove) {
  log("卸载中…");
  for (const id of PRESET_IDS) await removePreset(id);
  log("");
  log("卸载完成。已加入这四个模式的会话仍会运行其已挂载的组装；新建会话将不再看到它们。");
  process.exit(0);
}

await mkdir(USER_PRESET_ROOT, { recursive: true, mode: 0o700 });
log("安装中…");
let changed = 0;
for (const id of PRESET_IDS) {
  if (await installPreset(id, { force })) changed += 1;
}
log("");
if (changed === 0) {
  log("没有新增安装（均已存在）。");
} else {
  log("安装完成 ✅ 模式选择器现在应该显示八个模式：");
  log("  标准模式 · PTC 模式 · 极简模式 · 创造模式 · 生存模式 · 冒险模式 · 极限模式 · 旁观模式");
  log("");
  log("无需重启服务：roster 的发现每次读取都会重新扫描磁盘。");
  log("刷新页面 / 重新打开模式选择器即可看到新的模式。");
}
