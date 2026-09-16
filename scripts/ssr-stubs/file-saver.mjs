// SSR-only stub for the `file-saver` browser package (used by scripts/ssr-smoke.mjs).
// file-saver is CommonJS + minified UMD, so Node's ESM interop cannot provide
// its named `saveAs` export when Vite SSR-transforms an importer. Nothing in
// the smoke actually downloads a file — the stub keeps the module graph
// loadable and records calls so a test could assert on them.
const calls = [];
export async function saveAs(data, filename, options) {
  calls.push({ data, filename, options });
}
export default { saveAs };
export const __saveAsCalls = calls;
