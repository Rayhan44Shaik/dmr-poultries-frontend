// Test-only asset stub.
//
// The PDF/Excel utilities import brand images (hen cut-out, logos) that Vite
// resolves at build time. Node has no loader for those extensions, so tests
// register one that maps every image import to a tiny transparent PNG data
// URL. Only the *layout maths* of an export depends on the image; the browser
// build keeps using the real asset.
import { registerHooks } from "node:module";

const IMAGE = /\.(jpe?g|png|gif|svg|webp)$/i;
const STUB_URL = "dmr-test-asset:image";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (IMAGE.test(specifier)) {
      return { url: STUB_URL, format: "module", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === STUB_URL) {
      return {
        format: "module",
        source:
          'export default "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";',
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
