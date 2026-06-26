/**
 * Pixel Agents — OpenCode Plugin
 *
 * This file is installed to ~/.pixel-agents/hooks/opencode-plugin.mjs and
 * registered in ~/.config/opencode/opencode.json so that OpenCode loads it
 * at startup via its plugin system (Bun ESM runtime).
 *
 * For each relevant OpenCode event it reads ~/.pixel-agents/server.json to
 * find the running pixel-agents server and POSTs a normalized event payload
 * to http://127.0.0.1:{port}/api/hooks/opencode.
 *
 * The payload shape mirrors the format that opencodeProvider.normalizeHookEvent
 * expects:  { hook_event_name, session_id, tool_name?, tool_input? }
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SERVER_JSON = path.join(os.homedir(), '.pixel-agents', 'server.json');
const HOOK_URL_PATH = '/api/hooks/opencode';

/** Read ~/.pixel-agents/server.json. Returns null if the server is not running. */
function readServerConfig() {
  try {
    return JSON.parse(fs.readFileSync(SERVER_JSON, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * POST a normalized event payload to the pixel-agents server.
 * Silently swallows all errors — the hook must never break the agent.
 */
async function postEvent(payload) {
  const server = readServerConfig();
  if (!server) return;

  const body = JSON.stringify(payload);
  try {
    await fetch(`http://127.0.0.1:${server.port}${HOOK_URL_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${server.token}`,
      },
      body,
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Server not reachable — ignore silently.
  }
}

/**
 * Extract session ID from an event input.
 * OpenCode may use camelCase or other casing depending on version.
 */
function extractSessionId(input) {
  if (!input || typeof input !== 'object') return '';
  return (
    input.sessionID ?? input.sessionId ?? input.session_id ?? input.session?.id ?? input.id ?? ''
  );
}

/**
 * Track sessions we've seen so we can emit synthetic SessionCreated events
 * on the first tool event for a session (needed because OpenCode does not
 * expose a dedicated session.created hook in v1).
 */
const knownSessions = new Set();

/**
 * Pixel Agents plugin entry point.
 * OpenCode calls this once at startup with a context object.
 *
 * @param {{ client: unknown, project: unknown, directory: string, $: unknown }} ctx
 */
export default async ({ directory }) => {
  return {
    /**
     * Tool about to execute — maps to toolStart.
     * Also emits a synthetic SessionCreated on the first tool event for a
     * new session, since OpenCode does not have a dedicated session-start hook.
     */
    'tool.execute.before': async (input) => {
      const sessionId = extractSessionId(input);
      if (!sessionId) return;

      // Synthetic session start on first tool event for this session.
      if (!knownSessions.has(sessionId)) {
        knownSessions.add(sessionId);
        await postEvent({
          hook_event_name: 'SessionCreated',
          session_id: sessionId,
          cwd: directory ?? '',
        });
      }

      await postEvent({
        hook_event_name: 'ToolBefore',
        session_id: sessionId,
        tool_name: input?.tool ?? input?.name ?? '',
        tool_input: input?.args ?? input?.input ?? {},
      });
    },

    /** Tool finished executing — maps to toolEnd */
    'tool.execute.after': async (input) => {
      const sessionId = extractSessionId(input);
      if (!sessionId) return;
      await postEvent({
        hook_event_name: 'ToolAfter',
        session_id: sessionId,
      });
    },

    /**
     * Permission prompt shown to user — maps to permissionRequest.
     * OpenCode uses 'permission.ask' (not 'permission.asked').
     */
    'permission.ask': async (input) => {
      const sessionId = extractSessionId(input);
      if (!sessionId) return;
      await postEvent({
        hook_event_name: 'PermissionAsked',
        session_id: sessionId,
      });
    },

    /**
     * Catch-all bus event hook — used to detect session lifecycle events
     * (session idle, session deleted) if OpenCode emits them as bus events.
     */
    event: async (input) => {
      if (!input || typeof input !== 'object') return;
      const sessionId = extractSessionId(input);
      if (!sessionId) return;

      // Detect session idle (agent finished responding)
      const type = input.type ?? input.event ?? input.kind ?? '';
      if (type === 'session.idle' || type === 'session.complete' || type === 'agent.idle') {
        await postEvent({
          hook_event_name: 'SessionIdle',
          session_id: sessionId,
        });
      } else if (
        type === 'session.deleted' ||
        type === 'session.destroy' ||
        type === 'session.end'
      ) {
        knownSessions.delete(sessionId);
        await postEvent({
          hook_event_name: 'SessionDeleted',
          session_id: sessionId,
        });
      }
    },
  };
};
