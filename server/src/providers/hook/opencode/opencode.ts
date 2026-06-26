import * as os from 'os';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';
import {
  BASH_COMMAND_DISPLAY_MAX_LENGTH,
  TASK_DESCRIPTION_DISPLAY_MAX_LENGTH,
} from '../../../constants.js';
import { OPENCODE_TERMINAL_NAME_PREFIX } from './constants.js';
import {
  areHooksInstalled as installerAreHooksInstalled,
  installHooks as installerInstallHooks,
  uninstallHooks as installerUninstallHooks,
} from './opencodeHookInstaller.js';

// ── formatToolStatus ──
// OpenCode uses lowercase snake_case tool names rather than Claude's PascalCase.

export function formatToolStatus(toolName: string, input?: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');

  switch (toolName) {
    // File reading tools
    case 'read':
    case 'read_file':
      return `Reading ${base(inp.file_path ?? inp.path ?? inp.filePath)}`;

    // File writing tools
    case 'write':
    case 'write_file':
      return `Writing ${base(inp.file_path ?? inp.path ?? inp.filePath)}`;

    // File editing tools
    case 'edit':
    case 'str_replace':
    case 'str_replace_editor':
    case 'patch':
      return `Editing ${base(inp.file_path ?? inp.path ?? inp.filePath)}`;

    // Shell execution
    case 'bash':
    case 'shell':
    case 'command':
    case 'run': {
      const cmd = (inp.command as string) || (inp.cmd as string) || '';
      return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + '…' : cmd}`;
    }

    // File searching
    case 'glob':
    case 'list_files':
    case 'find_files':
      return 'Searching files';

    // Code searching
    case 'grep':
    case 'search_files':
    case 'search_code':
      return 'Searching code';

    // Web fetching
    case 'fetch':
    case 'web_fetch':
    case 'http_request':
      return 'Fetching web content';

    // Web searching
    case 'web_search':
    case 'search':
      return 'Searching the web';

    // Sub-agents / tasks
    case 'task':
    case 'agent':
    case 'computer': {
      const desc = typeof inp.description === 'string' ? inp.description : '';
      return desc
        ? `Subtask: ${desc.length > TASK_DESCRIPTION_DISPLAY_MAX_LENGTH ? desc.slice(0, TASK_DESCRIPTION_DISPLAY_MAX_LENGTH) + '…' : desc}`
        : 'Running subtask';
    }

    default:
      return `Using ${toolName}`;
  }
}

// ── Session dirs (optional — OpenCode is hooks-only but we provide a best-effort
//    path for the "Watch All Sessions" external scanner so stale-check can work) ──

function getAllSessionRoots(): string[] {
  // OpenCode stores sessions under ~/.local/share/opencode/storage/ on Linux/Mac.
  // On Windows the location depends on the XDG_DATA_HOME or LOCALAPPDATA env.
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'];
    if (localAppData) {
      return [path.join(localAppData, 'opencode', 'storage')];
    }
  }
  return [path.join(os.homedir(), '.local', 'share', 'opencode', 'storage')];
}

// ── Launch command (used only if user launches OpenCode from within the extension) ──

function buildLaunchCommand(
  sessionId: string,
  cwd: string,
): { command: string; args: string[]; env?: Record<string, string> } {
  return {
    command: 'opencode',
    args: ['run', '--session', sessionId],
    env: { PWD: cwd },
  };
}

// ── normalizeHookEvent ──
// Translates the raw payload POSTed by opencode-plugin.mjs into the canonical
// AgentEvent union. The plugin defines the payload shape; this function is the
// single place that reads plugin-specific field names.

function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  const eventName = raw.hook_event_name;
  const sessionId = raw.session_id;
  if (typeof eventName !== 'string' || typeof sessionId !== 'string') return null;

  switch (eventName) {
    case 'ToolBefore': {
      const toolName = typeof raw.tool_name === 'string' ? raw.tool_name : '';
      const toolInput =
        typeof raw.tool_input === 'object' && raw.tool_input !== null
          ? (raw.tool_input as Record<string, unknown>)
          : {};
      return {
        sessionId,
        event: {
          kind: 'toolStart',
          toolId: `hook-${Date.now()}`,
          toolName,
          input: toolInput,
          runInBackground: false,
        },
      };
    }

    case 'ToolAfter':
      return { sessionId, event: { kind: 'toolEnd', toolId: 'current' } };

    case 'SessionIdle':
      return { sessionId, event: { kind: 'turnEnd' } };

    case 'SessionCreated':
      return {
        sessionId,
        event: {
          kind: 'sessionStart',
          cwd: typeof raw.cwd === 'string' ? raw.cwd : undefined,
        },
      };

    case 'SessionDeleted':
      return {
        sessionId,
        event: { kind: 'sessionEnd' },
      };

    case 'PermissionAsked':
      return { sessionId, event: { kind: 'permissionRequest' } };

    default:
      return null;
  }
}

// ── Installer wrappers ──

function installHooks(_serverUrl: string, _authToken: string): Promise<void> {
  installerInstallHooks();
  return Promise.resolve();
}

function uninstallHooks(): Promise<void> {
  installerUninstallHooks();
  return Promise.resolve();
}

function areHooksInstalled(): Promise<boolean> {
  return Promise.resolve(installerAreHooksInstalled());
}

// ── The provider ──

export const opencodeProvider: HookProvider = {
  kind: 'hook',
  id: 'opencode',
  displayName: 'OpenCode',
  protocolVersion: 1,

  normalizeHookEvent,

  installHooks,
  uninstallHooks,
  areHooksInstalled,

  formatToolStatus,

  // OpenCode does not expose a concept analogous to Claude's permission-exempt tools,
  // but 'task' and 'agent' are subagent launchers and should not trigger permission timers.
  permissionExemptTools: new Set(['task', 'agent', 'computer']),
  subagentToolNames: new Set(['task', 'agent']),
  readingTools: new Set([
    'read',
    'read_file',
    'glob',
    'list_files',
    'find_files',
    'grep',
    'search_files',
    'search_code',
    'fetch',
    'web_fetch',
    'web_search',
    'search',
  ]),
  terminalNamePrefix: OPENCODE_TERMINAL_NAME_PREFIX,

  // OpenCode is a hooks-only provider: no JSONL transcripts, all state from hooks.
  // getAllSessionRoots is provided as a best-effort hint for the stale-check scanner.
  getAllSessionRoots,
  buildLaunchCommand,
};
