const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const r = require(path.join(OUT, 'lint-full.json'));
const dirty = new Set(
  fs.readFileSync(path.join(OUT, 'before', 'dirty-files.txt'), 'utf8')
    .split('\n').map((l) => l.trim().split(/\s+/).slice(-1)[0]).filter(Boolean)
);
const norm = (p) => String(p).split('\\').join('/');
const isTest = (n) => /\.test\.[cm]?[jt]sx?$/.test(n) || /(^|\/)tests?\//.test(n) || /__tests__/.test(n) || /\.contract\.[jt]s/.test(n);
const moduleOf = (n) => {
  const m = n.match(/src\/modules\/([^/]+)\//);
  if (m) return 'modules/' + m[1];
  const m2 = n.match(/src\/([^/]+)\//);
  return m2 ? 'src/' + m2[1] : 'root/other';
};
let E = 0, W = 0;
const byRule = {}, byModule = {}, prod = { e: 0, w: 0 }, test = { e: 0, w: 0 };
const dirtyF = { e: 0, w: 0, files: new Set() }, cleanF = { e: 0, w: 0 };
const perFile = [];
for (const f of r) {
  if (!f.errorCount && !f.warningCount) continue;
  const n = norm(f.filePath);
  const rel = n.split('/dmr-poultries-web/').pop();
  const t = isTest(n), d = dirty.has(rel) || [...dirty].some((x) => rel.endsWith(x));
  E += f.errorCount; W += f.warningCount;
  const entry = { file: rel, E: f.errorCount, W: f.warningCount, test: t, dirty: d, messages: f.messages.map((m) => ({ rule: m.ruleId, line: m.line, col: m.column, sev: m.severity, msg: m.message.slice(0, 120) })) };
  perFile.push(entry);
  for (const m of f.messages) {
    byRule[m.ruleId] = byRule[m.ruleId] || { e: 0, w: 0, files: new Set(), test: 0, dirty: 0 };
    if (m.severity === 2) byRule[m.ruleId].e++; else byRule[m.ruleId].w++;
    byRule[m.ruleId].files.add(rel);
    if (t) byRule[m.ruleId].test++;
    if (d) byRule[m.ruleId].dirty++;
  }
  const mod = moduleOf(n);
  byModule[mod] = byModule[mod] || { e: 0, w: 0, files: new Set() };
  byModule[mod].e += f.errorCount; byModule[mod].w += f.warningCount; byModule[mod].files.add(rel);
  if (t) { test.e += f.errorCount; test.w += f.warningCount; } else { prod.e += f.errorCount; prod.w += f.warningCount; }
  if (d) { dirtyF.e += f.errorCount; dirtyF.w += f.warningCount; dirtyF.files.add(rel); }
  else { cleanF.e += f.errorCount; cleanF.w += f.warningCount; }
}
console.log('TOTAL files=' + r.length + ' errors=' + E + ' warnings=' + W + ' problems=' + (E + W));
console.log('PROD errors=' + prod.e + ' warnings=' + prod.w + ' | TEST errors=' + test.e + ' warnings=' + test.w);
console.log('DIRTY-USER files-with-findings=' + dirtyF.files.size + ' errors=' + dirtyF.e + ' warnings=' + dirtyF.w);
console.log('CLEAN-COMMITTED errors=' + cleanF.e + ' warnings=' + cleanF.w);
console.log('\n--- BY RULE (errors+warnings, files, test#, dirty#) ---');
for (const [rule, v] of Object.entries(byRule).sort((a, b) => (b[1].e + b[1].w) - (a[1].e + a[1].w))) {
  console.log(rule + ' total=' + (v.e + v.w) + ' (E' + v.e + '/W' + v.w + ') files=' + v.files.size + ' test=' + v.test + ' dirty=' + v.dirty);
}
console.log('\n--- BY MODULE ---');
for (const [mod, v] of Object.entries(byModule).sort((a, b) => (b.e + b.w) - (a.e + a.w)).slice(0, 20)) {
  console.log(mod + ' problems=' + (v.e + v.w) + ' (E' + v.e + '/W' + v.w + ') files=' + v.files.size);
}
fs.writeFileSync(path.join(OUT, 'per-file.json'), JSON.stringify(perFile, null, 1));
console.log('\nper-file.json written with ' + perFile.length + ' files having findings');
