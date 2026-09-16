import { apiGet } from '../../../api';
import { mapRawEntry, mapEntryToCollection } from '../../operations/collections/services/collectionMapping';
import { assertUniqueCollectionNumbers } from '../../operations/collections/utils/collectionNumberIntegrity';

type Page = Record<string, unknown>[] | { data: Record<string, unknown>[]; meta: { totalPages: number } };
/** Only collection entries, with at most four page requests in flight.
 * No shop-sale download, balance rebuild, or changes to the global cache. */
export async function loadAnalysisCollections() {
  const entries = new Map<number, ReturnType<typeof mapRawEntry>>();
  const limit = 200;
  const read = async (page: number): Promise<Page> => (await apiGet<Page>('/operations/collection-entry', {params: {page, limit, includeDeleted: 'true'}})).data;
  const merge = (data: Page) => {
    const rows = Array.isArray(data) ? data : data.data;
    const before = entries.size;
    for (const raw of rows) {
      const row = mapRawEntry(raw);
      if (!Number.isFinite(row.id) || row.id <= 0) throw new Error('Collection record has an invalid ID.');
      entries.set(row.id, row);
    }
    return { length: rows.length, added: entries.size - before };
  };
  const first = await read(1);
  merge(first);
  if (!Array.isArray(first)) {
    const pages = first.meta.totalPages;
    if (!Number.isInteger(pages) || pages < 0) throw new Error('Invalid collection pagination.');
    for (let page = 2; page <= pages; page += 4) {
      const batch = await Promise.all(Array.from({length: Math.min(4, pages - page + 1)}, (_, offset) => read(page + offset)));
      batch.forEach(data => {
        const result = merge(data);
        if (result.length > 0 && result.added === 0) throw new Error('Collection pagination did not advance. Please retry.');
      });
    }
  } else if (first.length >= limit) {
    // Legacy endpoints return arrays without total-pages metadata.
    for (let page = 2; ; page++) {
      const result = merge(await read(page));
      if (result.length < limit) break;
      if (!result.added) throw new Error('Collection pagination did not advance. Please retry.');
    }
  }
  const rows = [...entries.values()];
  assertUniqueCollectionNumbers(rows);
  return rows.filter(row => !row.deleted && row.status === 'Approved').map(mapEntryToCollection);
}
