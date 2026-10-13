# Changelog — Shared Cognitive Memory

All notable changes to the Shared Cognitive Memory MCP specification and runtime are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-10-13

### Added
- Created dedicated GitHub repository: `PeterJFrancoIII/Shared-Cognitive-Memory-for-Cross-Platform-AI-Conversations`.
- Comprehensive multi-agent architecture diagrams and documentation suite (`ARCHITECTURE.md`, `SECURITY.md`, `GOLDEN_MASTER.md`).
- Dedicated client configuration guides for Gemini/Antigravity (`SETUP_GEMINI.md`) and ChatGPT/Codex (`SETUP_CHATGPT.md`).
- Support for safe source-inspection allowlisting across both root files and `docs/` hierarchy.

### Changed
- Decoupled Shared Cognitive Memory entirely from `Gemini_To_Terminal_CLI_Remote_Agent`, preserving the Terminal Bridge as a distinct, independent project.
- Updated canonical operating URLs and agent citations to point to the dedicated repository.

---

## [2.0.0] - 2026-10-08

### Added
- Native local STDIO transport (`scripts/sse_bridge.js --stdio`) delivering zero network latency and $0 infrastructure cost.
- Multi-agent concurrency protection with exclusive advisory lockfiles (`memory.json.lock` using `O_EXCL`) and automatic stale-lock eviction.
- Hardware-flushed atomic replacement (`.tmp` -> `fsyncSync` -> `renameSync`).
- 22-test automated regression suite covering all 8 tools, concurrency, and security boundaries (`tests/mcp_runtime.test.js`).
- Local plugin integration for ChatGPT macOS Desktop (`shared-cognitive-memory@personal`).

### Removed
- Third-party reverse proxy dependency (ngrok) permanently decommissioned and purged.

---

## [1.0.0] - 2026-09-15

### Added
- Initial Golden Master release in `Gemini_To_Terminal_CLI_Remote_Agent` (`docs/shared-cognitive-memory`).
- Core 6 cognitive-memory graph tools (`open_nodes`, `search_nodes`, `read_graph`, `add_observations`, `create_entities`, `create_relations`).
- Universal multi-agent rules (`SHARED_MEMORY_AGENT_RULES.md`) and bootstrap procedure (`AGENT_BOOTSTRAP.md`).
