const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add toast imports
if (!content.includes("import toast, { Toaster } from 'react-hot-toast'")) {
    content = content.replace("import React, { useState, useCallback, useRef, useEffect } from 'react'", "import React, { useState, useCallback, useRef, useEffect } from 'react'\nimport toast, { Toaster } from 'react-hot-toast'");
}

// 2. Add customConfirm helper
if (!content.includes("const customConfirm =")) {
    const helper = `\nconst customConfirm = (message, onConfirm) => {
  toast((t) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>{message}</span>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button className="btn ghost" style={{ padding: '4px 12px', fontSize: '12px', minHeight: 'auto' }} onClick={() => toast.dismiss(t.id)}>Cancel</button>
        <button className="btn danger" style={{ padding: '4px 12px', fontSize: '12px', minHeight: 'auto' }} onClick={() => { toast.dismiss(t.id); onConfirm(); }}>Confirm</button>
      </div>
    </div>
  ), { duration: Infinity, style: { background: '#25262b', border: '1px solid #373A40' } });
};\n`;
    content = content.replace("// ─── Constants & Helpers ────────────────────────", "// ─── Constants & Helpers ────────────────────────" + helper);
}

// 3. Add <Toaster />
if (!content.includes("<Toaster position=")) {
    content = content.replace('<div className="app-container">', '<div className="app-container">\n      <Toaster position="bottom-right" toastOptions={{ style: { background: "#1c1d21", color: "#fff", border: "1px solid #2d2e33" } }} />');
}

// 4. Replace alerts
content = content.replace(/window\.alert\(/g, 'toast.error(');
content = content.replace(/[^a-zA-Z0-9_]alert\(/g, (match) => {
    // Only replace if it's literally ` alert(` or `;alert(` etc.
    return match.replace('alert(', 'toast.error(');
});

// Fix specific successful toast cases where an error was used incorrectly:
// e.g. maybe some alerts were meant to be success? Most alerts in App.jsx are in catch blocks.
// Wait, `alert('Failed to...` => `toast.error('Failed to...` is perfect.

// 5. Replace confirms manually because there are only ~8 of them.
// Let's do a multi-replace or just manual regex since there are few patterns:

// Pattern A: if(confirm('...')) { doX() } -> customConfirm('...', () => { doX() })
content = content.replace(/if\s*\(\s*confirm\('Discard this image\? Your settings will be preserved\.'\)\s*\)\s*onDiscardVariant\(activeVariant\);/g, "customConfirm('Discard this image? Your settings will be preserved.', () => onDiscardVariant(activeVariant));");

content = content.replace(/if\s*\(\s*confirm\('Discard this output\? Your settings will be preserved\.'\)\s*\)\s*\{\s*deleteVariant\(activeVariant\)\.then\(\(\)\s*=>\s*refreshResults\(\)\);\s*\}/g, "customConfirm('Discard this output? Your settings will be preserved.', () => { deleteVariant(activeVariant).then(() => refreshResults()); });");

content = content.replace(/if\s*\(\s*confirm\(\`Delete experiment "\$\{exp\.name\}" and all its outputs\?\`\)\s*\)\s*\{\s*await\s+deleteAllVariantsForTask\(exp\.id,\s*results\);\s*const\s+u\s*=\s*\[\.\.\.experiments\];\s*u\.splice\(idx,\s*1\);\s*onChange\(\{\s*\.\.\.data,\s*freestyleExperiments:\s*u\s*\}\);\s*refreshResults\(\);\s*\}/g, "customConfirm(`Delete experiment \"${exp.name}\" and all its outputs?`, async () => { await deleteAllVariantsForTask(exp.id, results); const u = [...experiments]; u.splice(idx, 1); onChange({ ...data, freestyleExperiments: u }); refreshResults(); });");

content = content.replace(/if\s*\(\s*!window\.confirm\(`Load snapshot "\$\{snap\.name\}"\? Your current unsaved progress will be replaced\.`\)\s*\)\s*return;\s*updatePipeline\(snap\.pipelineData\);/g, "customConfirm(`Load snapshot \"${snap.name}\"? Your current unsaved progress will be replaced.`, () => { updatePipeline(snap.pipelineData); });");

content = content.replace(/if\s*\(\s*!window\.confirm\("Delete this snapshot\?"\)\s*\)\s*return;\s*onChange\(\{\s*\.\.\.data,\s*directorSnapshots:\s*\(data\.directorSnapshots\s*\|\|\s*\[\]\)\.filter\(s\s*=>\s*s\.id\s*!==\s*id\)\s*\}\);/g, "customConfirm(\"Delete this snapshot?\", () => { onChange({ ...data, directorSnapshots: (data.directorSnapshots || []).filter(s => s.id !== id) }); });");

content = content.replace(/if\s*\(\s*!window\.confirm\(t\.pushConfirm\)\s*\)\s*return\s*\/\/\s*Convert\s*approved\s*shotlist\s*to\s*production\s*shots\s*with\s*entity\s*references\s*const\s*productionShots\s*=\s*pipeline\.shotlist\.filter\(s\s*=>\s*s\.approved\)\.map\(s\s*=>\s*\{/g, "customConfirm(t.pushConfirm, () => {\n      // Convert approved shotlist to production shots with entity references\n      const productionShots = pipeline.shotlist.filter(s => s.approved).map(s => {");

content = content.replace(/if\s*\(\s*window\.confirm\("You are about to delete ALL your generate files and history from Supabase\.\s*Make sure you have downloaded everything via the '📦 ZIP Production' button if needed\.\s*Proceed\?"\)\s*\)\s*\{\s*await\s+supabase\.rpc\('delete_user_data'\)\s*setQuotaUsed\(0\)/g, "customConfirm(\"You are about to delete ALL your generate files and history from Supabase. Make sure you have downloaded everything via the '📦 ZIP Production' button if needed. Proceed?\", async () => {\n      await supabase.rpc('delete_user_data')\n      setQuotaUsed(0)");

// Close the blocks that we wrapped manually for the return cases.
// For the pipeline shotlist one:
content = content.replace(/      onChange\(\{ \.\.\.data, productionShots \}\)\n    \}\)/g, "      onChange({ ...data, productionShots })\n    })})");
// For the delete user data one:
content = content.replace(/      setQuotaUsed\(0\)\n    \}/g, "      setQuotaUsed(0)\n    })");

fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx updated!');
