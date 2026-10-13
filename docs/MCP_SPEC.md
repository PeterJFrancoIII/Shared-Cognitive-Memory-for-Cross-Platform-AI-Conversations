# Model Context Protocol (MCP) Specification — Shared Cognitive Memory

> **Canonical Operating Specification:**  
> `https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/MCP_SPEC.md`  
> **Mandatory Citation Going Forward:**  
> `Shared Memory MCP Rules: https://github.com/PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations/tree/main/docs/SHARED_MEMORY_AGENT_RULES.md`

---

## 1. System Overview & Invariants

The **Shared Cognitive Memory MCP** server exposes an authoritative interface for autonomous AI agents (Gemini, Antigravity, ChatGPT, Codex, Claude) to read and write shared cognitive state to a single local knowledge graph (`memory.json`).

### Non-Negotiable Invariants
1. **One Canonical Brain:** A single, authoritative graph file (`memory.json`) on the local host. No secondary stores, duplicate databases, or shadow graphs.
2. **Deterministic Session Scoping:** Every conversation operates within an explicit session entity (`Session_<Agent>_<Project>_<YYYYMMDD-HHMM>`).
3. **One Coordination Bus:** `InterAgent_Dialogue_Channel` is the sole authorized inter-agent message broker.
4. **Selective Retrieval:** Standard retrieval uses `search_nodes` → `open_nodes`. Unbounded graph reads (`read_graph`) are strictly gated for debug/recovery.
5. **Fail-Closed Security:** Malformed inputs, credential leaks, path traversal attempts, and unauthorized mutations fail closed without modifying memory or exiting the server.
6. **Zero Destructive Capabilities:** No `delete_*` tools, no arbitrary filesystem writes, no shell/eval execution, and no unauthenticated network ingress.
7. **Multi-Agent Transactional Integrity:** Atomic writes via PID-keyed tempfiles (`fsync` + `rename`) with advisory file locks (`.lock` using `O_EXCL` and stale-lock eviction).

---

## 2. Protocol & Transport

### Supported Protocol Versions
- `2025-06-18` (Current Standard)
- `2025-11-25`, `2025-03-26`, `2024-11-05`, `2024-10-07` (Backward Compatible)

### Supported Transports
1. **Direct STDIO (Primary & Zero-Cost):**
   - Invocation: `node scripts/sse_bridge.js --stdio`
   - Standard transport for local agents: Antigravity IDE, Google Gemini CLI, Codex CLI, and ChatGPT Desktop local plugins.
   - Zero open ports, zero network latency, immune to external bandwidth limits.
2. **Authenticated HTTP / SSE Adapter (Supervised Loopback & Secure Tunnel Gateway):**
   - Invocation: `node scripts/sse_bridge.js [port]` (Default loopback port: `8080`)
   - Binds to `127.0.0.1` by default; public binding is rejected unless explicitly configured.
   - Requires HTTP Header: `Authorization: Bearer <TOKEN>` (token stored in protected local file with `0600` permissions).
   - Bridges OpenAI Secure MCP Tunnel (`tunnel-client`) securely without exposing inbound firewall ports.

---

## 3. Canonical Capability Surface

The server exposes **exactly eight authorized tools**:

### A. Six Cognitive-Memory Graph Tools

#### 1. `open_nodes`
- **Description:** Retrieve specific entities and their connected relations by name.
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "names": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Array of entity names to retrieve"
      }
    },
    "required": ["names"]
  }
  ```
- **Behavior:** Returns an array of entities with all observations, plus relations where `from` or `to` matches any requested name.

#### 2. `search_nodes`
- **Description:** Selective query matching entity names, entity types, or observation text. Exact-name matches are prioritized.
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search string to match against entity names, types, or observations"
      }
    },
    "required": ["query"]
  }
  ```
- **Behavior:** Bounded response (max 25 entities, max 3 matching observation excerpts of 2,000 characters each, response capped at 96 KB). Returns excerpts rather than entire entity histories to prevent token context bloat. Agents follow up with `open_nodes` for full entity bodies.

#### 3. `read_graph`
- **Description:** Exceptional complete dump of the entire knowledge graph. Strictly gated.
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "purpose": {
        "type": "string",
        "enum": ["debug", "recovery"],
        "description": "Explicit justification purpose"
      },
      "reason": {
        "type": "string",
        "description": "Concrete justification for why selective retrieval is insufficient (minimum 12 characters)"
      }
    },
    "required": ["purpose", "reason"]
  }
  ```
- **Behavior:** Rejected unless `purpose` is either `debug` or `recovery` and `reason` contains at least 12 characters.

#### 4. `add_observations`
- **Description:** Append observations to existing entities under mutual exclusion lock.
- **Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "observations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "entityName": { "type": "string" },
            "contents": {
              "type": "array",
              "items": { "type": "string" }
            }
          },
          "required": ["entityName", "contents"]
        }
      }
    },
    "required": ["observations"]
  }
  ```
- **Behavior:** Fails closed if the target entity does not exist. Enforces secret-scrubbing heuristics (rejects strings shaped like API keys, bearer tokens, or private keys).

#### 5. `create_entities`
- **Description:** Create new entities in the knowledge graph.
- **Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "entities": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "entityType": { "type": "string" },
            "observations": {
              "type": "array",
              "items": { "type": "string" }
            }
          },
          "required": ["name", "entityType", "observations"]
        }
      }
    },
    "required": ["entities"]
  }
  ```
- **Behavior:** Fails closed on duplicate entity names. Disallows creation of secondary dialogue channels (only `InterAgent_Dialogue_Channel` is permitted).

#### 6. `create_relations`
- **Description:** Create directed relations between existing entities.
- **Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "relations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "from": { "type": "string" },
            "to": { "type": "string" },
            "relationType": { "type": "string" }
          },
          "required": ["from", "to", "relationType"]
        }
      }
    },
    "required": ["relations"]
  }
  ```
- **Behavior:** Fails closed if either the `from` or `to` entity does not exist. Deduplicates existing identical relations.

---

### B. Two Safe Source-Inspection Tools

#### 7. `read_shared_memory_file`
- **Description:** Inspect an approved, allowlisted read-only file from the project workspace.
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path to an approved project file"
      }
    },
    "required": ["path"]
  }
  ```
- **Behavior:** Strictly limited to a static allowlist. Rejects path traversal (`..`), absolute paths, NUL bytes, symlink escapes, `memory.json`, backups, credentials, tokens, logs, and lockfiles.

#### 8. `list_shared_memory_files`
- **Description:** Enumerate all approved project files available for inspection via `read_shared_memory_file`.
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`
- **Input Schema:** `{ "type": "object", "properties": {} }`
- **Behavior:** Returns list of allowlisted paths along with human-readable descriptions.

---

## 4. Concurrency & Mutex Architecture

To support simultaneous multi-agent execution across Antigravity, ChatGPT, and Codex:
1. **Advisory File Lock:** Write calls acquire exclusive lock `${MEMORY_FILE}.lock` with `O_CREAT | O_EXCL | O_WRONLY`. If locked, waits with backoff up to 10 seconds.
2. **Stale Lock Eviction:** If lock is older than 30 seconds or associated PID is dead (`kill(pid, 0)` returns `ESRCH`), the lock is automatically broken and cleared.
3. **Atomic Replacement:** All graph writes write to a unique temporary file (`.${basename}.${pid}.${hex}.tmp`), call `fsyncSync()`, and atomically replace `memory.json` using POSIX `renameSync()`.
