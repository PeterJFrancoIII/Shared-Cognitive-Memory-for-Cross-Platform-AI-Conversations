#!/usr/bin/env node

/**
 * Read-only Shared Cognitive Memory inspector.
 * All graph mutations must go through the hardened MCP server.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = process.env.MEMORY_FILE_PATH || path.join(__dirname, '..', 'memory.json');

function loadGraph() {
  if (!fs.existsSync(MEMORY_FILE)) {
    throw new Error(`Canonical memory file not found: ${MEMORY_FILE}`);
  }
  const raw = fs.readFileSync(MEMORY_FILE, 'utf-8').trim();
  if (!raw) return { entities: [], relations: [] };

  const entities = [];
  const relations = [];

  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  for (const [index, line] of lines.entries()) {
    let item;
    try {
      item = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid knowledge graph JSONL at line ${index + 1}`);
    }
    if (item.type === 'entity') {
      entities.push(item);
    } else if (item.type === 'relation') {
      relations.push(item);
    }
  }
  return { entities, relations };
}

function requireFullGraphReason(args) {
  const purposeIndex = args.indexOf('--purpose');
  const reasonIndex = args.indexOf('--reason');
  const purpose = purposeIndex >= 0 ? args[purposeIndex + 1] : undefined;
  const reason = reasonIndex >= 0 ? args[reasonIndex + 1] : undefined;
  if (!['debug', 'recovery'].includes(purpose) || typeof reason !== 'string' || reason.trim().length < 12) {
    console.error('Full graph output requires --purpose debug|recovery --reason "concrete reason".');
    process.exit(2);
  }
}

const args = process.argv.slice(2);
const command = args[0] || 'list';

switch (command) {
  case 'list':
  case 'read': {
    requireFullGraphReason(args);
    const graph = loadGraph();
    console.log('\n=== SHARED KNOWLEDGE GRAPH MEMORY ===');
    console.log(`Memory Location: ${MEMORY_FILE}`);
    console.log(`Entities (${graph.entities.length}):`);
    graph.entities.forEach(e => {
      console.log(`\n  • [${e.entityType}] ${e.name}`);
      (e.observations || []).forEach(o => console.log(`      - ${o}`));
    });
    console.log(`\nRelations (${graph.relations.length}):`);
    graph.relations.forEach(r => {
      console.log(`  • ${r.from} --[${r.relationType}]--> ${r.to}`);
    });
    console.log('\n=====================================\n');
    break;
  }

  case 'search': {
    const query = (args[1] || '').toLowerCase();
    if (!query) {
      console.error('Usage: inspect_memory.js search <query>');
      process.exit(1);
    }
    const graph = loadGraph();
    const matchedEntities = graph.entities.filter(e =>
      e.name.toLowerCase().includes(query) ||
      (e.entityType && e.entityType.toLowerCase().includes(query)) ||
      (e.observations && e.observations.some(o => o.toLowerCase().includes(query)))
    );

    console.log(`\nSearch results for "${query}":`);
    matchedEntities.forEach(e => {
      console.log(`\n  • [${e.entityType}] ${e.name}`);
      (e.observations || []).forEach(o => console.log(`      - ${o}`));
    });
    break;
  }

  case 'entity': {
    const name = args[1];
    if (!name) {
      console.error('Usage: inspect_memory.js entity <name>');
      process.exit(1);
    }
    const graph = loadGraph();
    const entity = graph.entities.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!entity) {
      console.log(`Entity "${name}" not found.`);
    } else {
      console.log(`\n• [${entity.entityType}] ${entity.name}`);
      (entity.observations || []).forEach(o => console.log(`    - ${o}`));
      const incoming = graph.relations.filter(r => r.to.toLowerCase() === name.toLowerCase());
      const outgoing = graph.relations.filter(r => r.from.toLowerCase() === name.toLowerCase());
      if (outgoing.length > 0) {
        console.log('  Outgoing relations:');
        outgoing.forEach(r => console.log(`    --> [${r.relationType}] ${r.to}`));
      }
      if (incoming.length > 0) {
        console.log('  Incoming relations:');
        incoming.forEach(r => console.log(`    <-- [${r.relationType}] ${r.from}`));
      }
    }
    break;
  }

  case 'json': {
    requireFullGraphReason(args);
    const graph = loadGraph();
    console.log(JSON.stringify(graph, null, 2));
    break;
  }

  default:
    console.log('Usage: inspect_memory.js [search <query>|entity <name>|list|json]');
    console.log('Full list/json: add --purpose debug|recovery --reason "concrete reason"');
    process.exitCode = 1;
}
