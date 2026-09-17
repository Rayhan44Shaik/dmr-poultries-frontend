// Dev-SSR render check: mount the real CollectionsPie with live quarter data
// and assert the donut markup (no removed labels, ring + centre total +
// legend present, exact shares in the legend).
import { readFileSync } from "node:fs";
import "./dashboard-sync-check-stub";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "../src/i18n";
import CollectionsPie from "../src/modules/dashboard/components/CollectionsPie";

export async function runPieRenderCheck(): Promise<void> {
  const res = await fetch("http://127.0.0.1:4000/api/operations/dashboard");
  const json = (await res.json()) as { collectionsByMode?: { name: string; value: number }[] };
  const data = json.collectionsByMode ?? [];
  console.log("collectionsByMode:", JSON.stringify(data));

  const html = renderToString(
    <I18nProvider>
      <div style={{ width: 420, height: 420 }}>
        <CollectionsPie data={data} />
      </div>
    </I18nProvider>
  );

  // "svg" is not asserted: ResponsiveContainer renders the <svg> only once a
  // real container is measured, which never happens in SSR.
  // Largest slice's share — computed from the LIVE data (the mock API
  // rotates datasets, so never hard-code a percentage here).
  const topPercent =
    data.length > 0
      ? `${Math.max(...data.map((d) => d.value / data.reduce((s, x) => s + x.value, 0) * 100)).toFixed(1)}%`
      : "%";

  const mustNot = ["Payment Breakdown", "Collections Summary", "3D pie"];
  const must = [
    "Total",
    "recharts-responsive-container",
    "%",
    topPercent, // biggest share shows in the KPI strip
    "cs-pie-spin", // the rotating donut wrapper
  ];
  const missing = [...mustNot.filter((s) => html.includes(s))].map((s) => `"${s}" still present`);
  const absent = must.filter((s) => !html.includes(s)).map((s) => `"${s}" missing`);
  // Slice colours are bound to the slice's own NAME, not its array position:
  // the shape fill and the gradient ids must both be derived from the name
  // (checked against the source — recharts' ResponsiveContainer renders no
  // <svg> in SSR, so the defs are not in the markup).
  const src = readFileSync(
    new URL("../src/modules/dashboard/components/CollectionsPie.tsx", import.meta.url),
    "utf8"
  );
  for (const marker of ["slug(name)", "id={`cs-grad-${d.gid}`}", "url(#cs-grad-${gid})"]) {
    if (!src.includes(marker)) absent.push(`slice colour wiring missing: ${marker}`);
  }
  const modes = data.map((d) => d.name).filter((n) => !html.includes(n)).map((n) => `mode "${n}" missing`);
  // The % toggle badges are GONE (removed on request) — the static SSR
  // markup must contain no badge rects, and the source no badge layer.
  const badgeRects = (html.match(/x="-26"/g) ?? []).length;
  if (badgeRects !== 0) absent.push(`toggle badges still present in SSR: ${badgeRects} badge rects`);
  if (src.includes("cs-badge-shadow")) absent.push("toggle badge layer still present in source");

  console.log(missing.length + absent.length + modes.length === 0 ? "PIE RENDER CHECK PASS ✔" : "PIE RENDER CHECK FAIL ✖");
  for (const problem of [...missing, ...absent, ...modes]) console.log("  -", problem);

  // Empty-state render must not throw.
  renderToString(
    <I18nProvider>
      <CollectionsPie data={[]} />
    </I18nProvider>
  );
  console.log("empty state renders OK");
}
