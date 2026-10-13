# Shared Cognitive Memory — Universal Agent Rules

> **Canonical Operating Authority:**  
> `https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SHARED_MEMORY_AGENT_RULES.md`  
> Directives Reference: `README.md`, `SHARED_MEMORY_AGENT_RULES.md`, `AGENT_BOOTSTRAP.md`, `MCP_SPEC.md`  
> **Mandatory Citation Going Forward:**  
> `Shared Memory MCP Rules: https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SHARED_MEMORY_AGENT_RULES.md`

Every agent (Gemini, Antigravity, GPT/ChatGPT, Codex, Claude) across all chats and sessions MUST consult and strictly adhere to the following non-negotiable requirements:

---

## 1. GitHub-Canonical Guidance
- The GitHub repository `PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations` is the authoritative public operating specification.
- Future chats and agents must use it as guidance rather than relying solely on remembered instructions, stale handoffs, or local prose.
- Required architecture/coordination citation:  
  `Shared Memory MCP Rules: https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SHARED_MEMORY_AGENT_RULES.md`
- If observed runtime behavior conflicts with these docs, report the discrepancy and resolve it explicitly; never silently redefine the canonical system.

## 2. Single Source of Truth
- Use only the canonical Shared Cognitive Memory graph for cognitive state (`memory.json` on local host).
- Never create secondary memory stores, shadow databases, or alternate graph files.
- `InterAgent_Dialogue_Channel` is the sole normal inter-agent communication bus. Never create alternate dialogue channels.

## 3. Retrieval Protocol
- Standard retrieval sequence: `search_nodes` → `open_nodes`.
- Query the relevant project/session before substantial work.
- Query `InterAgent_Dialogue_Channel` for relevant handoffs or coordination.
- `read_graph` is exceptional and permitted ONLY for justified `debug` or `recovery` with an explicit reason (`purpose="debug"|"recovery"`, `reason="concrete reason >= 12 chars"`).

## 4. Inter-Agent Communication
- Every message to `InterAgent_Dialogue_Channel` must begin with the standardized header:  
  `[TIMESTAMP | SOURCE → DESTINATION | MSG:<unique-id> | SESSION:<canonical-session-id>]`
- Keep payloads concise and action-oriented (`STATUS:`, `CHANGES:`, `VERIFICATION:`, `NEXT:`, `BLOCKER:`).
- Inter-agent dialogue represents coordination evidence, NOT automatic canonical truth.

## 5. Mandatory Provenance Citation
- Whenever utilizing or building upon another agent's findings, decisions, benchmarks, or instructions, cite the exact source:  
  `Shared Memory: <SESSION/ENTITY> | MSG:<message-id>`
- For Shared Memory MCP architecture/coordination work, also cite the canonical GitHub rules:  
  `Shared Memory MCP Rules: https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SHARED_MEMORY_AGENT_RULES.md`
- Never present peer-agent work as unsourced knowledge.

## 6. Writing State
- Promote only durable, empirical, verified state: architecture decisions, empirical findings, configuration changes, completed milestones, blockers, and handoffs.
- Never store routine chatter, intermediate tool dumps, bulk logs, or raw stack traces.

## 7. Supersession & Integrity
- Never silently contradict canonical state. When state changes or supersedes earlier records, explicitly declare:  
  `SUPERSEDES: <prior entity/message/state>`
- Preserve historical audit provenance; never rewrite history out of convenience.

## 8. Security & Secret Hygiene
- NEVER write passwords, API keys, bearer tokens, private keys, SSH keys, session cookies, credential-bearing URLs, or private bulk logs into Shared Memory, Git repositories, or markdown mirrors.
- Store abstract secret references only (e.g., `env:VAR_NAME` or `file:/protected/path`); retrieve credentials from secure environment variables or local protected configs.
- Never expose credentials in logs, handoffs, GitHub documentation, or citations.

## 9. MCP Integrity and Capability Surface
- All cognitive-memory reads/writes must pass through the hardened MCP.
- Never edit `memory.json` directly via filesystem tools.
- Never restore or invoke `delete_*` tools or the retired stock 9-tool memory server.
- **Canonical Cognitive-Memory Graph Tools (6):** `create_entities`, `create_relations`, `add_observations`, `search_nodes`, `open_nodes`, `read_graph`.
- **Canonical Safe Source-Inspection Tools (2):** `read_shared_memory_file(path)`, `list_shared_memory_files()`.
- Source inspection must remain static-allowlist, read-only, and fail closed for private graph data, credentials, traversal (`..`), symlink escape, arbitrary files, writes, deletes, shell, and execution.
- Never claim a tool is available merely because the specification defines it; report the actual client-discovered tool surface when diagnosing integrations.
- Never create, restore, or modify MCP network ingress unless explicitly authorized by the user and recorded as a canonical architecture decision in Shared Memory.

## 10. Session Isolation
- Operate only within the exact canonical session ID. Never guess IDs or mix unrelated sessions. Use deterministic session naming: `Session_<Agent>_<Project>_<YYYYMMDD-HHMM>`.

## 11. Handoff Validation
- Inter-agent dialogue is coordination evidence, not automatically canonical truth. Validate material handoff claims against the relevant canonical entity and/or empirical runtime state before promoting them.

## 12. Conflict Hierarchy
When information conflicts, resolve strictly in this order:
1. Explicit human directive
2. Canonical GitHub governance/specification
3. Verified canonical Shared Memory project/session state
4. Empirical runtime evidence
5. Inter-agent dialogue
6. Agent assumptions or remembered context
