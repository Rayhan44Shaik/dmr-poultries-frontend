// Dev-SSR render check: mount the real CollectionsPie with live quarter data
// and assert the donut markup (no removed labels, ring + centre total +
// legend present, exact shares in the legend).
import "./dashboard-sync-check-stub";
import { renderToString } from "react-dom/server";
import { I18nProvider } from "../src/i18n";
import CollectionsPie from "../src/modules/operations/dashboard/components/CollectionsPie";

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
  const mustNot = ["Payment Breakdown", "Collections Summary", "3D pie"];
  const must = [
    "Total",
    "recharts-responsive-container",
    "%",
    "33.7%",
    "cs-badge-shadow", // badge layer is wired up
    "cs-pie-spin", // the slow donut revolution
  ];
  // The % badge renders only for the checked (hovered) slice — SSR has no
  // hover, so no badge rect may be present in static markup.
  if (html.includes('x="-26"')) absent.push("badge rect rendered without hover");
  const missing = [...mustNot.filter((s) => html.includes(s))].map((s) => `"${s}" still present`);
  const absent = must.filter((s) => !html.includes(s)).map((s) => `"${s}" missing`);
  const modes = data.map((d) => d.name).filter((n) => !html.includes(n)).map((n) => `mode "${n}" missing`);

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
