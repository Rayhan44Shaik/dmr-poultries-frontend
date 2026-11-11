const before = require('../before/lint-full-before.json');
const after = require('./lint-full-after.json');
const sum = (r) => {
  let e = 0, w = 0;
  const byRule = {};
  for (const f of r) {
    e += f.errorCount; w += f.warningCount;
    for (const m of f.messages) byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1;
  }
  return { files: r.length, errors: e, warnings: w, byRule };
};
const B = sum(before), A = sum(after);
console.log('BEFORE files=' + B.files + ' errors=' + B.errors + ' warnings=' + B.warnings);
console.log('AFTER  files=' + A.files + ' errors=' + A.errors + ' warnings=' + A.warnings);
console.log('DELTA files=' + (A.files - B.files) + ' errors=' + (A.errors - B.errors) + ' warnings=' + (A.warnings - B.warnings));
console.log('only-export-components before=' + (B.byRule['react-refresh/only-export-components'] || 0) + ' after=' + (A.byRule['react-refresh/only-export-components'] || 0));
const norm = (p) => String(p).split('\\').join('/');
const scope = ['fleet-operations/routes.tsx', 'fleet-operations/index.ts', 'fleet-operations/activeFleetScope.test.ts', 'fleet-operations/fleetRouteConfig.tsx', 'fleet-operations/fleetLazyPages.tsx'];
for (const pair of [[before, 'B'], [after, 'A']]) {
  for (const f of pair[0]) {
    const n = norm(f.filePath);
    if (scope.some((s) => n.endsWith(s))) {
      console.log(pair[1] + ' ' + n.split('src/').pop() + ' E=' + f.errorCount + ' W=' + f.warningCount + ' [' + f.messages.map((m) => m.ruleId + '@' + m.line + ':' + m.column).join(' | ') + ']');
    }
  }
}
