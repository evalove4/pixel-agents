import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { HOOK_SCRIPTS_DIR } from '../../../constants.js';
import { OPENCODE_PLUGIN_MARKER, OPENCODE_PLUGIN_NAME } from './constants.js';

/** Partial shape of ~/.config/opencode/opencode.json (only plugin is relevant). */
interface OpenCodeConfig {
  plugin?: string[];
  [key: string]: unknown;
}

/** Returns the platform-appropriate config directory for OpenCode.
 *  OpenCode follows XDG conventions on all platforms, using ~/.config/opencode. */
function getOpenCodeConfigDir(): string {
  return path.join(os.homedir(), '.config', 'opencode');
}

/** Returns the path to ~/.config/opencode/opencode.json (or Windows equivalent). */
function getOpenCodeConfigPath(): string {
  return path.join(getOpenCodeConfigDir(), 'opencode.json');
}

/** Returns the destination path for the plugin (~/.pixel-agents/hooks/opencode-plugin.mjs). */
function getPluginDestPath(): string {
  return path.join(os.homedir(), HOOK_SCRIPTS_DIR, OPENCODE_PLUGIN_NAME);
}

/** Read ~/.config/opencode/opencode.json. Returns empty object if missing or malformed. */
function readOpenCodeConfig(): OpenCodeConfig {
  const configPath = getOpenCodeConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as OpenCodeConfig;
    }
  } catch (e) {
    console.error(`[Pixel Agents] Failed to read OpenCode config: ${e}`);
  }
  return {};
}

/** Write config back to opencode.json via atomic tmp + rename. */
function writeOpenCodeConfig(config: OpenCodeConfig): void {
  const configPath = getOpenCodeConfigPath();
  const dir = path.dirname(configPath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = configPath + '.pixel-agents-tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmpPath, configPath);
  } catch (e) {
    console.error(`[Pixel Agents] Failed to write OpenCode config: ${e}`);
  }
}

/** Returns true if a plugin entry belongs to Pixel Agents. */
function isOurPlugin(entry: string): boolean {
  return entry.includes(OPENCODE_PLUGIN_MARKER);
}

/** Check if Pixel Agents plugin is registered in ~/.config/opencode/opencode.json. */
export function areHooksInstalled(): boolean {
  const pluginDest = getPluginDestPath();
  if (!fs.existsSync(pluginDest)) return false;

  const config = readOpenCodeConfig();
  if (!Array.isArray(config.plugin)) return false;
  return config.plugin.some(isOurPlugin);
}

/**
 * Install Pixel Agents OpenCode plugin:
 * 1. Copy plugin file to ~/.pixel-agents/hooks/opencode-plugin.mjs
 * 2. Register absolute path in ~/.config/opencode/opencode.json plugin[]
 *
 * Idempotent — removes any existing pixel-agents entry before adding fresh one.
 * Also cleans up legacy "plugins" key if present from older installs.
 */
export function installHooks(): void {
  const pluginDest = getPluginDestPath();

  // Ensure plugin file exists (copyPluginFile handles VS Code extension path;
  // the plugin should already be at the dest from copyPluginFile called on activation).
  if (!fs.existsSync(pluginDest)) {
    console.warn(
      `[Pixel Agents] OpenCode plugin file not found at ${pluginDest}. Run copyPluginFile first.`,
    );
    return;
  }

  const config = readOpenCodeConfig();

  // Clean up legacy "plugins" key written by older installs (OpenCode uses "plugin", singular).
  if (Array.isArray((config as Record<string, unknown>)['plugins'])) {
    delete (config as Record<string, unknown>)['plugins'];
  }

  if (!Array.isArray(config.plugin)) {
    config.plugin = [];
  }

  // Remove any existing pixel-agents plugin entries (path may have changed).
  config.plugin = config.plugin.filter((p) => !isOurPlugin(p));
  config.plugin.push(pluginDest);

  writeOpenCodeConfig(config);
  console.log(`[Pixel Agents] OpenCode plugin registered: ${pluginDest}`);
}

/** Remove Pixel Agents plugin entry from ~/.config/opencode/opencode.json. */
export function uninstallHooks(): void {
  const config = readOpenCodeConfig();

  // Also clean up legacy "plugins" key if present.
  if (Array.isArray((config as Record<string, unknown>)['plugins'])) {
    delete (config as Record<string, unknown>)['plugins'];
  }

  if (!Array.isArray(config.plugin)) return;

  const before = config.plugin.length;
  config.plugin = config.plugin.filter((p) => !isOurPlugin(p));
  if (config.plugin.length === before) return;

  if (config.plugin.length === 0) {
    delete config.plugin;
  }

  writeOpenCodeConfig(config);
  console.log('[Pixel Agents] OpenCode plugin removed from config.');
}

/** Copy the shipped plugin from the extension bundle to ~/.pixel-agents/hooks/ */
export function copyPluginFile(extensionPath: string): void {
  const src = path.join(extensionPath, 'dist', 'hooks', OPENCODE_PLUGIN_NAME);
  const dst = getPluginDestPath();
  const dstDir = path.dirname(dst);

  try {
    if (!fs.existsSync(dstDir)) {
      fs.mkdirSync(dstDir, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(src)) {
      console.warn(`[Pixel Agents] OpenCode plugin not found at ${src}`);
      return;
    }
    fs.copyFileSync(src, dst);
    console.log(`[Pixel Agents] OpenCode plugin installed at ${dst}`);
  } catch (e) {
    console.error(`[Pixel Agents] Failed to copy OpenCode plugin: ${e}`);
  }
}
