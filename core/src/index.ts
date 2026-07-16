// @fonagents/core — the hexagon.
// Pure ports + domain logic. No knowledge of bd, anagent, Express, or any UI.
// Adapters implement the ports; UIs drive core through UiCommandPort and observe
// through UiEventPort.

export * from './domain/types.js'
export * from './ports/IssueTrackerPort.js'
export * from './ports/AgentRuntimePort.js'
export * from './ports/UiCommandPort.js'
export * from './ports/UiEventPort.js'
export * from './ports/ManagerToolsPort.js'
export * from './services/Orchestrator.js'
