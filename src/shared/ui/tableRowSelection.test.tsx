import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  firstSelectableIndex,
  isEditableTarget,
  isInteractiveTarget,
  lastSelectableIndex,
  resolveClickSelection,
  resolveSelectedId,
  selectionKeyAction,
  stepSelectableIndex,
  tableSelectedRowClass,
  tabIndexFor,
} from "./tableRowSelection.ts";
import { RowSelectMark } from "./RowSelectMark.tsx";

const sourceOf = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("tableRowSelection: mouse click", () => {
  it("clicking a selectable row selects it", () => {
    assert.equal(
      resolveClickSelection({ rowSelected: false, selectable: true, toggleOnReselect: false }),
      "select",
    );
  });

  it("clicking the selected row keeps it selected unless the page opts into toggling", () => {
    assert.equal(
      resolveClickSelection({ rowSelected: true, selectable: true, toggleOnReselect: false }),
      "keep",
    );
    assert.equal(
      resolveClickSelection({ rowSelected: true, selectable: true, toggleOnReselect: true }),
      "deselect",
    );
  });

  it("disabled and non-actionable rows are never selectable by click", () => {
    assert.equal(
      resolveClickSelection({ rowSelected: false, selectable: false, toggleOnReselect: true }),
      "keep",
    );
  });

  it("single selection holds exactly one stable database id", () => {
    const known = new Set<string | number>([101, 102, 103]);
    assert.equal(resolveSelectedId(102, known), 102);
    assert.equal(resolveSelectedId(null, known), null);
  });
});

describe("tableRowSelection: keyboard", () => {
  it("Arrow Down/Up move the selection", () => {
    assert.deepEqual(selectionKeyAction("ArrowDown", { hasPrimaryAction: false, allowEscapeClear: false }), {
      kind: "move",
      delta: 1,
    });
    assert.deepEqual(selectionKeyAction("ArrowUp", { hasPrimaryAction: false, allowEscapeClear: false }), {
      kind: "move",
      delta: -1,
    });
    assert.equal(stepSelectableIndex(0, 1, 3), 1);
    assert.equal(stepSelectableIndex(2, -1, 3), 1);
    assert.equal(stepSelectableIndex(2, 1, 3), -1);
  });

  it("Home and End jump to the ends of the current page", () => {
    assert.deepEqual(selectionKeyAction("Home", { hasPrimaryAction: false, allowEscapeClear: false }), {
      kind: "first",
    });
    assert.deepEqual(selectionKeyAction("End", { hasPrimaryAction: false, allowEscapeClear: false }), {
      kind: "last",
    });
    assert.equal(firstSelectableIndex(4), 0);
    assert.equal(lastSelectableIndex(4), 3);
  });

  it("disabled and non-data rows are skipped by keyboard navigation", () => {
    const selectable = (index: number) => index !== 1;
    assert.equal(stepSelectableIndex(0, 1, 3, selectable), 2);
    assert.equal(stepSelectableIndex(2, -1, 3, selectable), 0);
    assert.equal(firstSelectableIndex(3, selectable), 0);
    assert.equal(lastSelectableIndex(3, () => false), -1);
  });

  it("Tab uses roving tabindex without a focus trap: only the active row is tabbable", () => {
    assert.equal(tabIndexFor({ selectable: true, active: true }), 0);
    assert.equal(tabIndexFor({ selectable: true, active: false }), -1);
    assert.equal(tabIndexFor({ selectable: false, active: true }), -1);
  });

  it("Space selects the focused row", () => {
    assert.deepEqual(selectionKeyAction(" ", { hasPrimaryAction: false, allowEscapeClear: false }), {
      kind: "select",
    });
  });

  it("Enter runs the row primary action only where the page has one", () => {
    assert.deepEqual(selectionKeyAction("Enter", { hasPrimaryAction: true, allowEscapeClear: false }), {
      kind: "primary",
    });
    assert.deepEqual(selectionKeyAction("Enter", { hasPrimaryAction: false, allowEscapeClear: false }), {
      kind: "select",
    });
  });

  it("Escape clears only where the page supports clearing", () => {
    assert.deepEqual(selectionKeyAction("Escape", { hasPrimaryAction: false, allowEscapeClear: true }), {
      kind: "clear",
    });
    assert.deepEqual(selectionKeyAction("Escape", { hasPrimaryAction: false, allowEscapeClear: false }), {
      kind: "none",
    });
  });

  it("editable controls keep their native keys", () => {
    assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
    assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
    assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
    assert.equal(isEditableTarget({ tagName: "TD", isContentEditable: true }), true);
    assert.equal(isEditableTarget({ tagName: "TD" }), false);
    assert.equal(selectionKeyAction("a", { hasPrimaryAction: true, allowEscapeClear: true }).kind, "none");
  });
});

describe("tableRowSelection: inline actions never select the row", () => {
  it("clicks inside buttons, links, inputs and menus are interactive", () => {
    const interactive = { tagName: "BUTTON", closest: () => ({}) };
    assert.equal(isInteractiveTarget(interactive), true);
    assert.equal(isInteractiveTarget({ tagName: "INPUT" }), true);
    assert.equal(isInteractiveTarget({ tagName: "TD", closest: () => null }), false);
  });

  it("the shared selector covers buttons, inputs, menus and editors", () => {
    const seen = sourceOf("./tableRowSelection.ts");
    for (const token of ["button", "input", "select", "textarea", "role='menuitem'", "contenteditable"]) {
      assert.ok(seen.includes(token), `expected INTERACTIVE_SELECTOR to cover ${token}`);
    }
  });
});

describe("tableRowSelection: stable identity", () => {
  it("the stored id resolves to the same record for contextual actions", () => {
    const rows = [
      { id: 11, tripNo: "TRP-011" },
      { id: 12, tripNo: "TRP-012" },
    ];
    const selectedId = resolveSelectedId(12, new Set(rows.map((row) => row.id)));
    const record = rows.find((row) => row.id === selectedId) ?? null;
    assert.equal(record?.tripNo, "TRP-012");
  });

  it("selection clears safely when the record disappears or the page/filter changes", () => {
    assert.equal(resolveSelectedId(99, new Set([11, 12])), null);
    assert.equal(resolveSelectedId(11, new Set<number>()), null);
  });
});

describe("RowSelectMark: serial position indicator", () => {
  it("shows only the serial number for unselected rows", () => {
    const html = renderToStaticMarkup(<RowSelectMark selected={false} serialNo={3} />);
    assert.ok(html.includes("3"), "serial number must render");
    assert.ok(!html.includes("<svg"), "no check icon for unselected rows");
  });

  it("replaces the serial with a check-circle only for the selected row", () => {
    const html = renderToStaticMarkup(
      <RowSelectMark selected serialNo={3} label="Selected trip TRP-012" />,
    );
    assert.ok(html.includes("<svg"), "selected row shows the check icon");
    assert.ok(!html.includes(">3<"), "serial number is replaced, not duplicated");
    assert.ok(html.includes("Selected trip TRP-012"), "accessible label names the record");
  });

  it("the selected row uses the light mint reference style, stronger than hover", () => {
    assert.equal(
      tableSelectedRowClass,
      "bg-emerald-50/80 shadow-[inset_4px_0_0_0_#10b981] hover:bg-emerald-50",
    );
  });
});

describe("tableRowSelection: shared adoption", () => {
  it("Operation Expenses and Rate Entry tables use the shared implementation", () => {
    for (const page of [
      "../../modules/operations/trip-expenses/pages/TripExpensesPage.tsx",
      "../../modules/operations/shop-sales/components/CompletedTripsTable.tsx",
    ]) {
      const source = sourceOf(page);
      assert.ok(
        source.includes("shared/ui/useTableRowSelection"),
        `${page} must use the shared row-selection hook`,
      );
      assert.ok(
        source.includes("tableSelectedRowClass") || source.includes("RowSelectMark"),
        `${page} must use the shared selection visuals`,
      );
    }
  });

  it("Order Collection remains unchanged by this task", () => {
    const source = sourceOf("../../modules/orders/pages/OrderCollectionPage.tsx");
    assert.ok(!source.includes("useTableRowSelection"), "Order Collection must not use the shared hook");
    assert.ok(!source.includes("tableRowSelection"), "Order Collection must not use the shared rules");
    assert.ok(!source.includes("RowSelectMark"), "Order Collection must not use the selection mark");
  });
});
