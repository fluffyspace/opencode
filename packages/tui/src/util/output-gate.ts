import { Wildcard } from "@opencode-ai/core/util/wildcard"
import type { Config, PermissionRule, PermissionRuleset } from "@opencode-ai/sdk/v2"

export type OutputGateMode = "ask" | "deny"

export function configPermissionRules(permission: Config["permission"]): PermissionRule[] {
  if (!permission) return []
  if (typeof permission === "string") return [{ permission: "*", pattern: "*", action: permission }]
  return Object.entries(permission).flatMap(([tool, value]) => {
    if (value === undefined) return []
    if (typeof value === "string") return [{ permission: tool, pattern: "*", action: value }]
    return Object.entries(value).map(([pattern, action]) => ({ permission: tool, pattern, action }))
  })
}

// Mirrors SessionTools.approveOutput on the server: an explicit `tool_result`
// rule (config or agent) or a session-level `tool_result`/`*` override gates
// tool output. Returns the effective action for the badge and the toggle, or
// undefined when output is forwarded to the model unchanged.
export function outputGateMode(
  permission: Config["permission"],
  session: PermissionRuleset | undefined,
): OutputGateMode | undefined {
  const rules = [...configPermissionRules(permission), ...(session ?? [])]
  const sessionOverride = (session ?? []).some(
    (rule) =>
      rule.action !== "allow" &&
      (rule.permission === "*" || rule.permission === "tool_result") &&
      Wildcard.match("*", rule.pattern),
  )
  if (!rules.some((rule) => rule.permission === "tool_result") && !sessionOverride) return undefined
  const rule = rules.findLast(
    (rule) => Wildcard.match("tool_result", rule.permission) && Wildcard.match("*", rule.pattern),
  )
  if (!rule || rule.action === "allow") return undefined
  return rule.action
}

// The `/permissions` toggle flips output approval between on (ask) and off
// (allow). Turning it on writes an explicit ask rule so it works even when the
// configured default is allow.
export function nextOutputApproval(current: OutputGateMode | undefined): "ask" | "allow" {
  return current ? "allow" : "ask"
}
