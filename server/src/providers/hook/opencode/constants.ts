/**
 * OpenCode-specific constants. Kept separate from `server/src/constants.ts` so a
 * future single-provider `server/` build doesn't accidentally depend on OpenCode
 * unless OpenCode is the active provider.
 *
 * Adding another provider? Create its own `providers/<kind>/<name>/constants.ts`.
 */

/** Output filename copied to dist/hooks/ (pure ESM, runs in Bun runtime). */
export const OPENCODE_PLUGIN_NAME = 'opencode-plugin.mjs';

/** OpenCode event names that the pixel-agents plugin subscribes to. */
export const OPENCODE_HOOK_EVENTS = [
  'tool.execute.before',
  'tool.execute.after',
  'session.created',
  'session.deleted',
  'session.idle',
  'permission.asked',
] as const;

/** Terminal name prefix used when launching OpenCode in VS Code. */
export const OPENCODE_TERMINAL_NAME_PREFIX = 'OpenCode';

/** Marker string embedded in the plugin path used to identify pixel-agents entries
 *  in ~/.config/opencode/opencode.json. */
export const OPENCODE_PLUGIN_MARKER = 'pixel-agents';
