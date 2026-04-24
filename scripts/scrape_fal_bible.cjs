/**
 * FAL.AI BIBLE SCRAPER v5 — DEFINITIVE EDITION
 * Uses discovered endpoint: fal.ai/api/openapi/queue/openapi.json?endpoint_id={id}
 * Fetches ALL 1312+ models with FULL OpenAPI 3.0 schemas
 * Date: 20/04/2026
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'FAL_AI_MODELS_BIBLE.md');

function httpsGet(hostname, urlPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname,
      path: urlPath,
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'NSK-BibleScraper/5.0' }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Phase 1: Get all endpoint IDs from the listing API
async function fetchAllEndpoints() {
  let all = [];
  let page = 1;
  
  while (true) {
    process.stdout.write(`\r[Phase 1] Page ${page}...`);
    const r = await httpsGet('fal.ai', `/api/models?page=${page}&per_page=40`);
    const parsed = JSON.parse(r.body);
    
    if (!parsed.items || parsed.items.length === 0) break;
    
    for (const item of parsed.items) {
      // endpoint_id is derived from modelUrl: "https://fal.run/fal-ai/xxx" -> "fal-ai/xxx"
      let eid = item.modelUrl ? item.modelUrl.replace('https://fal.run/', '') : null;
      // Remove /edit suffix if present
      if (eid && eid.endsWith('/edit')) eid = eid.replace(/\/edit$/, '');
      
      if (eid) {
        all.push({
          endpoint_id: eid,
          title: item.title || '',
          description: item.shortDescription || '',
          category: item.category || '',
          tags: item.tags || [],
          deprecated: item.deprecated || false,
          kind: item.kind || ''
        });
      }
    }
    
    if (page === 1) console.log(` (Total: ${parsed.total}, Pages: ${parsed.pages})`);
    if (parsed.items.length < 40) break;
    page++;
    await sleep(50);
  }
  
  // Deduplicate by endpoint_id
  const seen = new Set();
  const deduped = [];
  for (const m of all) {
    if (!seen.has(m.endpoint_id)) {
      seen.add(m.endpoint_id);
      deduped.push(m);
    }
  }
  
  console.log(`\n[Phase 1] Collected ${all.length} models, ${deduped.length} unique endpoints`);
  return deduped;
}

// Phase 2: Fetch OpenAPI schema for each endpoint
async function fetchOpenAPI(endpointId) {
  try {
    const r = await httpsGet('fal.ai', `/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(endpointId)}`);
    if (r.status === 200 && r.body.startsWith('{')) {
      return JSON.parse(r.body);
    }
  } catch (e) {}
  return null;
}

// Extract input properties from OpenAPI schema
function extractInputSchema(openapi) {
  if (!openapi || !openapi.components || !openapi.components.schemas) return null;
  
  const schemas = openapi.components.schemas;
  for (const [name, schema] of Object.entries(schemas)) {
    if (name.toLowerCase().includes('input') && !name.includes('Queue') && schema.properties) {
      return {
        name: schema.title || name,
        required: schema.required || [],
        properties: schema.properties,
        order: schema['x-fal-order-properties'] || Object.keys(schema.properties)
      };
    }
  }
  return null;
}

// Extract output properties from OpenAPI schema
function extractOutputSchema(openapi) {
  if (!openapi || !openapi.components || !openapi.components.schemas) return null;
  
  const schemas = openapi.components.schemas;
  for (const [name, schema] of Object.entries(schemas)) {
    if (name.toLowerCase().includes('output') && !name.includes('Queue') && schema.properties) {
      return {
        name: schema.title || name,
        required: schema.required || [],
        properties: schema.properties
      };
    }
  }
  return null;
}

// Format a property for the Bible
function formatProperty(propName, prop, indent = '') {
  let line = `${indent}- **\`${propName}\`**`;
  
  // Type
  let type = prop.type || '';
  if (prop.anyOf) {
    const types = prop.anyOf.filter(t => t.type !== 'null').map(t => t.type || (t.enum ? `enum[${t.enum.join(',')}]` : '?'));
    type = types.join(' | ');
  }
  if (prop.enum) type = `enum`;
  if (prop.items) {
    if (prop.items['$ref']) {
      const refName = prop.items['$ref'].split('/').pop();
      type = `list<${refName}>`;
    } else {
      type = `list<${prop.items.type || 'any'}>`;
    }
  }
  line += ` *(${type})*`;
  
  // Default
  if (prop.default !== undefined) line += ` — Default: \`${JSON.stringify(prop.default)}\``;
  
  // Description
  if (prop.description) line += ` — ${prop.description}`;
  
  // Enum values
  if (prop.enum) line += `\n${indent}  Possible values: ${prop.enum.map(v => '`' + v + '`').join(', ')}`;
  if (prop.anyOf) {
    for (const alt of prop.anyOf) {
      if (alt.enum) {
        line += `\n${indent}  Possible values: ${alt.enum.map(v => '`' + v + '`').join(', ')}`;
      }
    }
  }
  
  // Min/Max
  if (prop.minimum !== undefined || prop.maximum !== undefined) {
    const bounds = [];
    if (prop.minimum !== undefined) bounds.push(`min: ${prop.minimum}`);
    if (prop.maximum !== undefined) bounds.push(`max: ${prop.maximum}`);
    line += `\n${indent}  Range: ${bounds.join(', ')}`;
  }
  
  return line;
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  FAL.AI BIBLE SCRAPER v5.0 — DEFINITIVE ║');
  console.log('║  Date: ' + new Date().toISOString().substring(0,10) + '                        ║');
  console.log('╚══════════════════════════════════════════╝\n');
  
  // Phase 1
  const models = await fetchAllEndpoints();
  
  // Phase 2: Fetch all OpenAPI schemas
  console.log('\n[Phase 2] Fetching OpenAPI schemas...');
  let schemasOk = 0;
  let schemasFail = 0;
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < models.length; i += BATCH_SIZE) {
    const batch = models.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (m) => {
      const oa = await fetchOpenAPI(m.endpoint_id);
      if (oa) {
        m.openapi = oa;
        m.inputSchema = extractInputSchema(oa);
        m.outputSchema = extractOutputSchema(oa);
        schemasOk++;
      } else {
        schemasFail++;
      }
    });
    
    await Promise.all(promises);
    process.stdout.write(`\r[Phase 2] ${Math.min(i + BATCH_SIZE, models.length)}/${models.length} (OK: ${schemasOk}, fail: ${schemasFail})`);
    await sleep(100); // Rate limiting
  }
  
  console.log(`\n[Phase 2] Done: ${schemasOk} schemas OK, ${schemasFail} failed`);
  
  // Phase 3: Generate Bible
  console.log('\n[Phase 3] Generating Bible markdown...');
  
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${now.toLocaleTimeString()}`;
  
  // Group by category
  const byCategory = {};
  for (const m of models) {
    const cat = (m.category || 'uncategorized').toUpperCase().replace(/-/g, ' ');
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(m);
  }
  
  let md = '';
  md += `# 📖 LA BIBLIA DEFINITIVA DE FAL.AI — REFERENCIA PARA N8N\n\n`;
  md += `> **Total de modelos registrados:** ${models.length}\n`;
  md += `> **Modelos con schema completo:** ${schemasOk}\n`;
  md += `> **Fecha de generación:** ${dateStr}\n`;
  md += `> **Fuente:** \`fal.ai/api/openapi/queue/openapi.json\` — OpenAPI 3.0 oficial\n\n`;
  md += `---\n\n`;
  
  // Table of Contents
  md += `## 📑 Índice de Categorías\n\n`;
  for (const cat of Object.keys(byCategory).sort()) {
    const count = byCategory[cat].length;
    md += `- **${cat}** (${count} modelos)\n`;
  }
  md += `\n---\n\n`;
  
  // Each category
  for (const [cat, catModels] of Object.entries(byCategory).sort()) {
    md += `# CATEGORÍA: ${cat}\n`;
    md += `_${catModels.length} modelos_\n\n`;
    
    for (const m of catModels.sort((a, b) => a.endpoint_id.localeCompare(b.endpoint_id))) {
      md += `## ${m.endpoint_id}\n\n`;
      
      if (m.title) md += `**Title:** ${m.title}\n`;
      if (m.description) md += `**Description:** ${m.description}\n`;
      md += `**Endpoint:** \`https://fal.run/${m.endpoint_id}\`\n`;
      md += `**Category:** ${m.category || 'N/A'}\n`;
      if (m.tags && m.tags.length) md += `**Tags:** ${m.tags.join(', ')}\n`;
      if (m.deprecated) md += `**⚠️ DEPRECATED**\n`;
      md += '\n';
      
      // Input Schema
      if (m.inputSchema) {
        const input = m.inputSchema;
        md += `### 📥 Input Schema: \`${input.name}\`\n`;
        md += `**Required fields:** ${input.required.length > 0 ? input.required.map(r => '`' + r + '`').join(', ') : '_none_'}\n\n`;
        
        // Properties in order  
        const orderedKeys = input.order || Object.keys(input.properties);
        for (const key of orderedKeys) {
          if (input.properties[key]) {
            md += formatProperty(key, input.properties[key]) + '\n';
          }
        }
        md += '\n';
      } else {
        md += `### 📥 Input Schema\n_No schema available_\n\n`;
      }
      
      // Output Schema
      if (m.outputSchema) {
        const output = m.outputSchema;
        md += `### 📤 Output Schema: \`${output.name}\`\n`;
        for (const [key, prop] of Object.entries(output.properties)) {
          md += formatProperty(key, prop) + '\n';
        }
        md += '\n';
      }
      
      md += `---\n\n`;
    }
  }
  
  // Write to file
  fs.writeFileSync(OUTPUT_FILE, md, 'utf8');
  const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
  const lineCount = md.split('\n').length;
  
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  BIBLE GENERATION COMPLETE!              ║`);
  console.log(`║  Models: ${models.length.toString().padEnd(33)}║`);
  console.log(`║  Schemas: ${schemasOk.toString().padEnd(32)}║`);
  console.log(`║  Size: ${sizeMB} MB (${lineCount} lines)`.padEnd(44) + `║`);
  console.log(`║  File: FAL_AI_MODELS_BIBLE.md            ║`);
  console.log(`╚══════════════════════════════════════════╝`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
