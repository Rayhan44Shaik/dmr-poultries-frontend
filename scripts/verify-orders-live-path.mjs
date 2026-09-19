import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ordersRoot = path.join(root, "src", "modules", "orders");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const failures = [];
const files = walk(ordersRoot);

for (const file of files) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  if (file.endsWith("sampleOrdersData.ts") || /\.test\.(ts|tsx)$/.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (/sampleOrdersData/.test(text) || /ORDERS_SAMPLE_DATA_ENABLED\s*=\s*true/.test(text)) {
    failures.push(path.relative(root, file));
  }
}

const sampleModule = path.join(ordersRoot, "services", "sampleOrdersData.ts");
if (fs.existsSync(sampleModule)) {
  const text = fs.readFileSync(sampleModule, "utf8");
  if (/export const ORDERS_SAMPLE_DATA_ENABLED\s*=\s*true/.test(text)) {
    failures.push("src/modules/orders/services/sampleOrdersData.ts (sample flag enabled)");
  }
}

const vite = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
if (/quarter-sample-data\.mjs.*default port/i.test(vite)) {
  failures.push("vite.config.ts (quarter sample server appears to be the default API target)");
}

if (failures.length) {
  console.error("Orders live-path guard FAILED:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("Orders live-path guard PASS: production Orders code does not enable/import bundled sample data.");
