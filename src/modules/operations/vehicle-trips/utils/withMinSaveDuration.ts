/**
 * Keep Save Progress busy long enough for the spinner / “Saving…” label
 * to read clearly — fast APIs otherwise finish before the user notices.
 */
export async function withMinSaveDuration<T>(
  work: () => Promise<T>,
  minMs = 1400
): Promise<T> {
  const started = Date.now();
  try {
    return await work();
  } finally {
    const remain = minMs - (Date.now() - started);
    if (remain > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, remain);
      });
    }
  }
}
