import { PageHeader as GlobalPageHeader } from "../../../ui";

/**
 * DEPRECATED ADAPTER — use `PageHeader` from `src/ui` (`@/ui`).
 *
 * This local header rendered the page title at `text-4xl` (36px), which was the
 * single largest type in the whole application and directly contradicted the
 * global heading hierarchy (page title = `text-xl`/20px semibold, so the module
 * nav and section headings still read as a hierarchy). It also had no slot for
 * the page actions, so every master page hand-rolled its own title + button row.
 *
 * It has no remaining consumers. It is kept as a thin adapter so that any
 * future import resolves to the ONE global page header rather than silently
 * reintroducing a second, conflicting one.
 */
function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return <GlobalPageHeader title={title} subtitle={subtitle} />;
}

export default PageHeader;
