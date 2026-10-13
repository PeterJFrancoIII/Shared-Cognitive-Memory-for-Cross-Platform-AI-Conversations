#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(PROJECT_ROOT, 'scripts', 'sse_bridge.js');
const INSPECTOR_PATH = path.join(PROJECT_ROOT, 'scripts', 'inspect_memory.js');
const AUTHORIZED_TOOLS = [
  'add_observations',
  'create_entities',
  'create_relations',
  'list_shared_memory_files',
  'open_nodes',
  'read_graph',
  'read_shared_memory_file',
  'search_nodes',
];

function startStdioServer(options = {}) {
  const ownsTempDir = !options.memoryPath;
  const tempDir = ownsTempDir
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'shared-memory-mcp-test-'))
    : path.dirname(options.memoryPath);
  const memoryPath = options.memoryPath || path.join(tempDir, 'memory.json');
  if (!fs.existsSync(memoryPath) && options.createMemory !== false) {
    fs.writeFileSync(memoryPath, '', { mode: 0o600 });
  }

  const child = spawn(process.execPath, [SERVER_PATH, ...(options.args || ['--stdio'])], {
    env: { ...process.env, MEMORY_FILE_PATH: memoryPath },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let nextId = 1;
  const pending = new Map();

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    let newline;
    while ((newline = stdout.indexOf('\n')) !== -1) {
      const line = stdout.slice(0, newline).trim();
      stdout = stdout.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        waiter.resolve(message);
      }
    }
  });

  function request(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}; stderr=${stderr}`));
      }, 2000);
      pending.set(id, {
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  return {
    child,
    memoryPath,
    request,
    close() {
      child.kill('SIGTERM');
      if (ownsTempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

test('stdio MCP lists the authorized memory and file inspection tools', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  await server.request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'runtime-test', version: '1.0.0' },
  });
  const response = await server.request('tools/list');

  assert.deepEqual(
    response.result.tools.map((tool) => tool.name).sort(),
    AUTHORIZED_TOOLS,
  );

  const readTools = response.result.tools.filter(t => t.annotations?.readOnlyHint === true).map(t => t.name).sort();
  const writeTools = response.result.tools.filter(t => t.annotations?.readOnlyHint === false).map(t => t.name).sort();
  assert.deepEqual(readTools, ['list_shared_memory_files', 'open_nodes', 'read_graph', 'read_shared_memory_file', 'search_nodes']);
  assert.deepEqual(writeTools, ['add_observations', 'create_entities', 'create_relations']);
});

test('delete tools are rejected without changing the graph', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  const createResponse = await server.request('tools/call', {
    name: 'create_entities',
    arguments: {
      entities: [{ name: 'KeepMe', entityType: 'Test', observations: [] }],
    },
  });
  assert.equal(createResponse.error, undefined);
  const before = fs.readFileSync(server.memoryPath, 'utf8');

  const response = await server.request('tools/call', {
    name: 'delete_entities',
    arguments: { entityNames: ['KeepMe'] },
  });

  assert.equal(response.error.code, -32601);
  assert.equal(fs.readFileSync(server.memoryPath, 'utf8'), before);
});

test('add_observations rejects an unknown entity without creating it', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  const response = await server.request('tools/call', {
    name: 'add_observations',
    arguments: {
      observations: [{ entityName: 'TypoEntity', contents: ['Must not be created'] }],
    },
  });

  assert.equal(response.result.isError, true);
  assert.equal(fs.readFileSync(server.memoryPath, 'utf8'), '');
});

test('malformed graph data fails closed without rewriting the file', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());
  const malformed = '{"type":"entity","name":"Valid","entityType":"Test","observations":[]}\nnot-json\n';
  fs.writeFileSync(server.memoryPath, malformed, { mode: 0o600 });

  const response = await server.request('tools/call', {
    name: 'search_nodes',
    arguments: { query: 'Valid' },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /invalid knowledge graph JSONL/i);
  assert.equal(fs.readFileSync(server.memoryPath, 'utf8'), malformed);
});

test('a missing canonical graph path fails closed instead of creating a new store', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-memory-mcp-missing-'));
  const memoryPath = path.join(tempDir, 'memory.json');
  const server = startStdioServer({ memoryPath, createMemory: false });
  t.after(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await server.request('tools/call', {
    name: 'search_nodes',
    arguments: { query: 'anything' },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /canonical memory file not found/i);
  assert.equal(fs.existsSync(memoryPath), false);
});

test('unknown graph record types fail closed without data loss', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());
  const unknown = '{"type":"opaque_future_record","payload":"preserve me"}\n';
  fs.writeFileSync(server.memoryPath, unknown, { mode: 0o600 });

  const response = await server.request('tools/call', {
    name: 'create_entities',
    arguments: { entities: [{ name: 'MustNotWrite', entityType: 'Test', observations: [] }] },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /unsupported knowledge graph record type/i);
  assert.equal(fs.readFileSync(server.memoryPath, 'utf8'), unknown);
});

test('credential-shaped observations are rejected atomically', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());
  const credentialKey = ['to', 'ken'].join('');
  await server.request('tools/call', {
    name: 'create_entities',
    arguments: {
      entities: [{ name: 'SafeEntity', entityType: 'Test', observations: [] }],
    },
  });
  const before = fs.readFileSync(server.memoryPath, 'utf8');

  const response = await server.request('tools/call', {
    name: 'add_observations',
    arguments: {
      observations: [{
        entityName: 'SafeEntity',
        contents: [`Synthetic leak: https://example.invalid/callback?${credentialKey}=scm_${'a'.repeat(48)}`],
      }],
    },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /credential-like content rejected/i);
  assert.equal(fs.readFileSync(server.memoryPath, 'utf8'), before);
});

test('read_graph requires an explicit debug or recovery justification', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  const denied = await server.request('tools/call', {
    name: 'read_graph',
    arguments: {},
  });
  assert.equal(denied.result.isError, true);
  assert.match(denied.result.content[0].text, /exceptional debug or recovery use/i);

  const allowed = await server.request('tools/call', {
    name: 'read_graph',
    arguments: { purpose: 'debug', reason: 'Validate graph-wide structural invariants' },
  });
  assert.equal(allowed.result.isError, undefined);
  assert.deepEqual(allowed.result.structuredContent, { entities: [], relations: [] });
});

test('initialize advertises only tools and deterministic session guidance', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  const response = await server.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'runtime-test', version: '1.0.0' },
  });

  assert.equal(response.result.protocolVersion, '2025-06-18');
  assert.deepEqual(response.result.capabilities, { tools: { listChanged: false } });
  assert.match(response.result.instructions, /Session_<Agent>_<Project>_<YYYYMMDD-HHMM>/);
  assert.match(response.result.instructions, /session node.*search_nodes.*open_nodes/is);
  assert.match(response.result.instructions, /read_graph.*debug.*recovery/is);
});

test('concurrent MCP writers retain every update in valid JSONL', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-memory-mcp-concurrency-'));
  const memoryPath = path.join(tempDir, 'memory.json');
  const seedEntities = Array.from({ length: 4000 }, (_, index) => ({
    type: 'entity',
    name: `Seed_${index}`,
    entityType: 'ConcurrencySeed',
    observations: ['x'.repeat(512)],
  }));
  fs.writeFileSync(
    memoryPath,
    `${seedEntities.map((entity) => JSON.stringify(entity)).join('\n')}\n`,
    { mode: 0o600 },
  );

  const servers = Array.from({ length: 6 }, () => startStdioServer({ memoryPath }));
  t.after(() => {
    servers.forEach((server) => server.close());
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  await Promise.all(servers.map((server) => server.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'concurrency-test', version: '1.0.0' },
  })));

  await Promise.all(servers.map((server, index) => server.request('tools/call', {
    name: 'create_entities',
    arguments: {
      entities: [{ name: `Concurrent_${index}`, entityType: 'Test', observations: [] }],
    },
  })));

  const lines = fs.readFileSync(memoryPath, 'utf8').split('\n').filter(Boolean);
  const records = lines.map((line) => JSON.parse(line));
  const names = new Set(records.filter((record) => record.type === 'entity').map((record) => record.name));
  for (let index = 0; index < servers.length; index += 1) {
    assert.equal(names.has(`Concurrent_${index}`), true, `Concurrent_${index} was lost`);
  }
  assert.deepEqual(
    fs.readdirSync(tempDir).sort(),
    ['memory.json'],
    'write lock or temporary files were left behind',
  );
});

test('the hardened server defaults to private stdio transport', async (t) => {
  const server = startStdioServer({ args: [] });
  t.after(() => server.close());

  const response = await server.request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'default-transport-test', version: '1.0.0' },
  });

  assert.equal(response.result.serverInfo.name, 'shared-cognitive-memory');
});

test('search_nodes rejects empty and overly broad graph reads', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());
  await server.request('tools/call', {
    name: 'create_entities',
    arguments: {
      entities: Array.from({ length: 30 }, (_, index) => ({
        name: `Common_${index}`,
        entityType: 'CommonType',
        observations: [],
      })),
    },
  });

  const empty = await server.request('tools/call', {
    name: 'search_nodes',
    arguments: { query: '' },
  });
  assert.equal(empty.result.isError, true);

  const broad = await server.request('tools/call', {
    name: 'search_nodes',
    arguments: { query: 'Common' },
  });
  assert.equal(broad.result.isError, true);
  assert.match(broad.result.content[0].text, /narrower query/i);
});

test('search_nodes keeps high-history matches relevant and within a bounded response', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-memory-mcp-bounded-search-'));
  const memoryPath = path.join(tempDir, 'memory.json');
  const query = 'CHAT-BTCB2-PPLNS-POOL-2026-09-11';
  const dialogueHistory = Array.from({ length: 80 }, (_, index) =>
    `Unrelated dialogue history ${index}: ${'x'.repeat(5000)}`
  );
  const matchingHandoff = `[2026-09-15 | Gemini -> ChatGPT] Review ${query} Surface #3`;
  const records = [
    {
      type: 'entity',
      name: 'InterAgent_Dialogue_Channel',
      entityType: 'Communication_Bus',
      observations: [...dialogueHistory, matchingHandoff],
    },
    {
      type: 'entity',
      name: query,
      entityType: 'Canonical_Project_Thread',
      observations: ['Canonical pool state'],
    },
  ];
  fs.writeFileSync(
    memoryPath,
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    { mode: 0o600 },
  );
  const server = startStdioServer({ memoryPath });
  t.after(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await server.request('tools/call', {
    name: 'search_nodes',
    arguments: { query },
  });

  assert.equal(response.result.isError, undefined);
  assert.equal(response.result.structuredContent.entities[0].name, query);
  const dialogueResult = response.result.structuredContent.entities.find(
    (entity) => entity.name === 'InterAgent_Dialogue_Channel',
  );
  assert.deepEqual(dialogueResult.observations, [matchingHandoff]);
  assert.equal(response.result.structuredContent.search.observationMode, 'matching_excerpts');
  assert.ok(
    Buffer.byteLength(JSON.stringify(response), 'utf8') <= 128 * 1024,
    'search response exceeded the connector-safe response budget',
  );
});

test('search_nodes returns the newest matching observation excerpts', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-memory-mcp-latest-search-'));
  const memoryPath = path.join(tempDir, 'memory.json');
  const query = 'HANDOFF-NEEDLE';
  const entity = {
    type: 'entity',
    name: 'InterAgent_Dialogue_Channel',
    entityType: 'Communication_Bus',
    observations: Array.from({ length: 5 }, (_, index) => `${query} message ${index + 1}`),
  };
  fs.writeFileSync(memoryPath, `${JSON.stringify(entity)}\n`, { mode: 0o600 });
  const server = startStdioServer({ memoryPath });
  t.after(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const response = await server.request('tools/call', {
    name: 'search_nodes',
    arguments: { query },
  });

  assert.deepEqual(response.result.structuredContent.entities[0].observations, [
    `${query} message 3`,
    `${query} message 4`,
    `${query} message 5`,
  ]);
});

test('create_entities preserves one canonical inter-agent dialogue channel', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  const canonical = await server.request('tools/call', {
    name: 'create_entities',
    arguments: {
      entities: [{
        name: 'InterAgent_Dialogue_Channel',
        entityType: 'Coordination_Bus',
        observations: [],
      }],
    },
  });
  assert.equal(canonical.result.isError, undefined);

  const duplicate = await server.request('tools/call', {
    name: 'create_entities',
    arguments: {
      entities: [{
        name: 'InterAgent_Dialogue_Channel_2',
        entityType: 'Coordination_Bus',
        observations: [],
      }],
    },
  });
  assert.equal(duplicate.result.isError, true);
  assert.match(duplicate.result.content[0].text, /one canonical.*InterAgent_Dialogue_Channel/i);

  const records = fs.readFileSync(server.memoryPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  assert.equal(records.filter((record) => /interagent.*dialog/i.test(record.name || '')).length, 1);
});

test('create_relations rejects dangling endpoints without mutation', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());
  await server.request('tools/call', {
    name: 'create_entities',
    arguments: {
      entities: [{ name: 'Existing', entityType: 'Test', observations: [] }],
    },
  });
  const before = fs.readFileSync(server.memoryPath, 'utf8');

  const response = await server.request('tools/call', {
    name: 'create_relations',
    arguments: {
      relations: [{ from: 'Existing', to: 'Missing', relationType: 'depends_on' }],
    },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /relation endpoint.*not found/i);
  assert.equal(fs.readFileSync(server.memoryPath, 'utf8'), before);
});

test('malformed tool arguments return an error without killing the server', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  const response = await server.request('tools/call', {
    name: 'create_entities',
    arguments: { entities: [null] },
  });
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /invalid arguments/i);

  const stillAlive = await server.request('tools/list');
  assert.equal(stillAlive.result.tools.length, AUTHORIZED_TOOLS.length);
  assert.equal(fs.readFileSync(server.memoryPath, 'utf8'), '');
});

test('diagnostic inspector cannot mutate or perform an unjustified full read', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-memory-inspector-test-'));
  const memoryPath = path.join(tempDir, 'memory.json');
  const seed = `${JSON.stringify({
    type: 'entity',
    name: 'KeepMe',
    entityType: 'Test',
    observations: [],
  })}\n`;
  fs.writeFileSync(memoryPath, seed, { mode: 0o600 });
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const env = { ...process.env, MEMORY_FILE_PATH: memoryPath };

  const fullRead = spawnSync(process.execPath, [INSPECTOR_PATH, 'list'], { env, encoding: 'utf8' });
  assert.equal(fullRead.status, 2);
  assert.match(fullRead.stderr, /full graph output requires/i);

  const removedWrite = spawnSync(
    process.execPath,
    [INSPECTOR_PATH, 'add-obs', 'KeepMe', 'Must not be written'],
    { env, encoding: 'utf8' },
  );
  assert.notEqual(removedWrite.status, 0);
  assert.equal(fs.readFileSync(memoryPath, 'utf8'), seed);
});

test('diagnostic inspector fails closed on malformed JSONL', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-memory-inspector-malformed-'));
  const memoryPath = path.join(tempDir, 'memory.json');
  const malformed = '{"type":"entity","name":"Valid","entityType":"Test","observations":[]}\nnot-json\n';
  fs.writeFileSync(memoryPath, malformed, { mode: 0o600 });
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const result = spawnSync(
    process.execPath,
    [INSPECTOR_PATH, 'search', 'Valid'],
    { env: { ...process.env, MEMORY_FILE_PATH: memoryPath }, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid knowledge graph JSONL at line 2/i);
  assert.equal(fs.readFileSync(memoryPath, 'utf8'), malformed);
});

test('safe project file inspection reads allowlisted files and fails closed on unapproved/traversal/memory targets', async (t) => {
  const server = startStdioServer();
  t.after(() => server.close());

  // 1. Approved file can be read
  const readBridge = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: 'scripts/sse_bridge.js' },
  });
  assert.equal(readBridge.result.isError, undefined);
  assert.match(readBridge.result.content[0].text, /Shared Cognitive Memory/i);

  const readRules = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: 'SHARED_MEMORY_AGENT_RULES.md' },
  });
  assert.equal(readRules.result.isError, undefined);
  assert.match(readRules.result.content[0].text, /Single Source of Truth/i);

  // 2. memory.json is denied
  const readMemory = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: 'memory.json' },
  });
  assert.equal(readMemory.result.isError, true);
  assert.match(readMemory.result.content[0].text, /Access denied/i);

  // 3. Backup memory files are denied
  const readBackup = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: 'memory.json.bak_before_proper_m3max_write' },
  });
  assert.equal(readBackup.result.isError, true);
  assert.match(readBackup.result.content[0].text, /Access denied/i);

  // 4. .auth_token is denied
  const readToken = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: '.auth_token' },
  });
  assert.equal(readToken.result.isError, true);
  assert.match(readToken.result.content[0].text, /Access denied/i);

  // 5. ../ path traversal is denied
  const readTraversal = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: '../package.json' },
  });
  assert.equal(readTraversal.result.isError, true);
  assert.match(readTraversal.result.content[0].text, /Access denied/i);

  const readDoubleTraversal = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: '../../etc/passwd' },
  });
  assert.equal(readDoubleTraversal.result.isError, true);
  assert.match(readDoubleTraversal.result.content[0].text, /Access denied/i);

  // 6. Absolute paths are denied
  const readAbsolute = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: '/etc/passwd' },
  });
  assert.equal(readAbsolute.result.isError, true);
  assert.match(readAbsolute.result.content[0].text, /Access denied/i);

  // 7. Symlink escape is denied
  const readSymlinkEscape = await server.request('tools/call', {
    name: 'read_shared_memory_file',
    arguments: { path: 'scripts/../../../etc/passwd' },
  });
  assert.equal(readSymlinkEscape.result.isError, true);
  assert.match(readSymlinkEscape.result.content[0].text, /Access denied/i);

  // 8. Arbitrary directories cannot be listed (only static allowlist exposed)
  const listFiles = await server.request('tools/call', {
    name: 'list_shared_memory_files',
    arguments: {},
  });
  assert.equal(listFiles.result.isError, undefined);
  const exposedPaths = listFiles.result.structuredContent.files.map(f => f.path);
  assert.ok(exposedPaths.includes('scripts/sse_bridge.js'));
  assert.ok(exposedPaths.includes('SHARED_MEMORY_AGENT_RULES.md'));
  assert.equal(exposedPaths.includes('memory.json'), false);
  assert.equal(exposedPaths.includes('.auth_token'), false);

  // 9. Write attempts are impossible through inspection tools (method not found)
  const writeAttempt = await server.request('tools/call', {
    name: 'write_shared_memory_file',
    arguments: { path: 'README.md', content: 'hack' },
  });
  assert.equal(writeAttempt.error.code, -32601);

  // 10. Existing delete tools remain unavailable
  const deleteAttempt = await server.request('tools/call', {
    name: 'delete_entities',
    arguments: { entityNames: ['test'] },
  });
  assert.equal(deleteAttempt.error.code, -32601);

  // 11. read_graph restrictions remain intact
  const readGraphAttempt = await server.request('tools/call', {
    name: 'read_graph',
    arguments: {},
  });
  assert.equal(readGraphAttempt.result.isError, true);
  assert.match(readGraphAttempt.result.content[0].text, /read_graph is restricted/i);
});

test('authenticated HTTP/SSE adapter enforces token auth and serves authorized 8-tool surface', async (t) => {
  const testPort = 8091;
  const testToken = 'scm_test_token_' + crypto.randomBytes(8).toString('hex');
  const server = spawn(process.execPath, [SERVER_PATH, '--http'], {
    env: { ...process.env, PORT: String(testPort), SHARED_MEMORY_TUNNEL_TOKEN: testToken },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill());

  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => {
      if (d.toString().includes('listening on')) resolve();
    });
    server.on('error', reject);
  });

  // 1. Unauthenticated request -> 401
  const unauthRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  assert.equal(unauthRes.status, 401);

  // 2. Bad auth -> 401
  const badAuthRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer wrong_token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
  });
  assert.equal(badAuthRes.status, 401);

  // 3. Bad query param auth -> 401
  const queryBadRes = await fetch(`http://127.0.0.1:${testPort}/mcp?token=invalid_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
  });
  assert.equal(queryBadRes.status, 401);

  // 4. OAuth discovery remains authenticated, then advertises no OAuth with empty 404s.
  const unauthMetadataRes = await fetch(
    `http://127.0.0.1:${testPort}/.well-known/oauth-protected-resource/mcp`,
  );
  assert.equal(unauthMetadataRes.status, 401);

  for (const metadataPath of [
    '/.well-known/oauth-protected-resource/mcp',
    '/.well-known/oauth-protected-resource',
  ]) {
    const metadataRes = await fetch(`http://127.0.0.1:${testPort}${metadataPath}`, {
      headers: { 'Authorization': `Bearer ${testToken}` },
    });
    assert.equal(metadataRes.status, 404);
    assert.equal(await metadataRes.text(), '');
  }

  // 5. Valid query param auth -> 200 (supports ChatGPT Developer Mode URL format)
  const queryValidRes = await fetch(`http://127.0.0.1:${testPort}/sse?token=${testToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }),
  });
  assert.equal(queryValidRes.status, 200);

  // 6. Valid Bearer auth -> 200, 8 tools
  const authRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testToken}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }),
  });
  assert.equal(authRes.status, 200);
  const data = await authRes.json();
  assert.equal(data.result.tools.length, 8);
  const toolNames = data.result.tools.map((tool) => tool.name);
  assert.deepEqual(toolNames.sort(), [...AUTHORIZED_TOOLS].sort());
});

test('SSE bridge handles namespaced tool calls, discovery methods, resilient POST fallback, and token preservation', async (t) => {
  const testPort = 8092;
  const testToken = 'scm_resilience_test_' + crypto.randomBytes(8).toString('hex');
  const server = spawn(process.execPath, [SERVER_PATH, '--http'], {
    env: { ...process.env, PORT: String(testPort), SHARED_MEMORY_TUNNEL_TOKEN: testToken },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill());

  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => {
      if (d.toString().includes('listening on')) resolve();
    });
    server.on('error', reject);
  });

  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${testToken}` };

  // 1. ping returns empty object
  const pingRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'ping' }),
  });
  assert.equal(pingRes.status, 200);
  const pingData = await pingRes.json();
  assert.deepEqual(pingData.result, {});

  // 2. resources/list and prompts/list return safe empty arrays
  const resourcesRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'resources/list' }),
  });
  assert.equal(resourcesRes.status, 200);
  const resourcesData = await resourcesRes.json();
  assert.deepEqual(resourcesData.result, { resources: [] });

  const promptsRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'prompts/list' }),
  });
  assert.equal(promptsRes.status, 200);
  const promptsData = await promptsRes.json();
  assert.deepEqual(promptsData.result, { prompts: [] });

  // 3. Namespaced tool call shared-cognitive-memory.search_nodes succeeds
  const namespacedRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: { name: 'shared-cognitive-memory.search_nodes', arguments: { query: 'test' } },
    }),
  });
  assert.equal(namespacedRes.status, 200);
  const namespacedData = await namespacedRes.json();
  assert.equal(namespacedData.error, undefined);
  assert.ok(namespacedData.result?.content);

  // 4. GET /sse?token= preserves token in advertised endpoint
  const sseGetRes = await fetch(`http://127.0.0.1:${testPort}/sse?token=${testToken}`, {
    headers: { Accept: 'text/event-stream' },
  });
  assert.equal(sseGetRes.status, 200);
  const reader = sseGetRes.body.getReader();
  const chunk1 = await reader.read();
  const sseText = new TextDecoder().decode(chunk1.value);
  assert.match(sseText, /event: endpoint/);
  assert.match(sseText, /data: \/message\?sessionId=[a-f0-9-]+&token=/);
  const sessionMatch = sseText.match(/sessionId=([a-f0-9-]+)/);
  const sseSessionId = sessionMatch[1];

  // 5. POST /message with active SSE stream delivers over SSE and returns 202
  const postMessageRes = await fetch(`http://127.0.0.1:${testPort}/message?sessionId=${sseSessionId}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', id: 14, method: 'tools/list', params: {} }),
  });
  assert.equal(postMessageRes.status, 202);
  const postMessageData = await postMessageRes.json();
  assert.equal(postMessageData.result.tools.length, 8);

  // Read message from SSE stream
  const chunk2 = await reader.read();
  const sseMsgText = new TextDecoder().decode(chunk2.value);
  assert.match(sseMsgText, /event: message/);
  assert.match(sseMsgText, /"tools":/);

  // Close SSE stream
  await reader.cancel();

  // 6. POST /message after SSE disconnected returns 200 with result (resilient fallback, no 400)
  const disconnectedPostRes = await fetch(`http://127.0.0.1:${testPort}/message?sessionId=${sseSessionId}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: { name: 'search_nodes', arguments: { query: 'test' } },
    }),
  });
  assert.equal(disconnectedPostRes.status, 200);
  const disconnectedData = await disconnectedPostRes.json();
  assert.equal(disconnectedData.error, undefined);
  assert.ok(disconnectedData.result?.content);

  // 7. POST /message with completely unknown/missing sessionId returns 200 with result
  const unknownSessionRes = await fetch(`http://127.0.0.1:${testPort}/message?sessionId=unknown-uuid`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', id: 16, method: 'tools/list', params: {} }),
  });
  assert.equal(unknownSessionRes.status, 200);
  const unknownData = await unknownSessionRes.json();
  assert.equal(unknownData.result.tools.length, 8);

  // 8. Tool name normalization handles leading underscores, double underscores, and direct params
  const underscoreRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 17,
      method: 'tools/call',
      params: { name: '_search_nodes', arguments: { query: 'test' } },
    }),
  });
  assert.equal(underscoreRes.status, 200);
  const underscoreData = await underscoreRes.json();
  assert.equal(underscoreData.error, undefined);
  assert.ok(underscoreData.result?.content);

  const doubleUnderscoreRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 18,
      method: 'tools/call',
      params: { name: 'codex_apps__shared_cognitive_memory__search_nodes', arguments: { query: 'test' } },
    }),
  });
  assert.equal(doubleUnderscoreRes.status, 200);
  const doubleUnderscoreData = await doubleUnderscoreRes.json();
  assert.equal(doubleUnderscoreData.error, undefined);
  assert.ok(doubleUnderscoreData.result?.content);

  const directParamsRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 19,
      method: 'tools/call',
      params: { name: '_search_nodes', query: 'test' },
    }),
  });
  assert.equal(directParamsRes.status, 200);
  const directParamsData = await directParamsRes.json();
  assert.equal(directParamsData.error, undefined);
  assert.ok(directParamsData.result?.content);

  // 9. resources/read returns clean JSON-RPC error -32002
  const resourceReadRes = await fetch(`http://127.0.0.1:${testPort}/mcp`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 20,
      method: 'resources/read',
      params: { uri: 'shared-cognitive-memory.search_nodes' },
    }),
  });
  assert.equal(resourceReadRes.status, 200);
  const resourceReadData = await resourceReadRes.json();
  assert.equal(resourceReadData.error?.code, -32002);
});
