// Dev-SSR render check: mount the real CollectionsPie with live quarter data
// and assert the 3D pie markup (svg + paths, big % labels, legend, no removed
// labels, no recharts dependency left in this card).
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

  const mustNot = ["Payment Breakdown", "Collections Summary", "recharts", "Tooltip"];
  const must = ["<svg", "<path", "34%", "33%", "01", "linearGradient"];
  const missing = [...mustNot.filter((s) => html.includes(s))].map((s) => `"${s}" still present`);
  const absent = must.filter((s) => !html.includes(s)).map((s) => `"${s}" missing`);
  const modes = data.map((d) => d.name).filter((n) => !html.includes(n)).map((n) => `mode "${n}" missing`);

  console.log(missing.length + absent.length + modes.length === 0 ? "PIE RENDER CHECK PASS ✔" : "PIE RENDER CHECK FAIL ✖");
  for (const problem of [...missing, ...absent, ...modes]) console.log("  -", problem);

  // Geometry sanity: every path/ellipse/text coordinate must be a finite number.
  if (/[A-Za-z]+="?[^\"]*\bNaN\b/.test(html) || html.includes("NaN")) {
    console.log("PIE RENDER CHECK FAIL ✖ — NaN in rendered geometry");
    return;
  }

  // Empty-state render must not throw.
  renderToString(
    <I18nProvider>
      <CollectionsPie data={[]} />
    </I18nProvider>
  );
  console.log("empty state renders OK");
}
