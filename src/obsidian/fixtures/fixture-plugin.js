// Synthetic Obsidian plugin bundle — test fixture for the IBR obsidian harness.
//
// Deliberately shaped like a REAL built Obsidian plugin so the harness is tested
// against the thing it actually has to handle:
//   - a bare top-level `require("obsidian")` destructure (the shim-collision
//     hazard: a shim leaking a top-level `class ItemView` makes this line throw
//     "Identifier 'ItemView' has already been declared" and kills the bundle),
//   - `module.exports.X = X` as the export surface,
//   - Obsidian DOM extensions (createEl / createDiv / createSpan / setText /
//     empty / addClass),
//   - a `Platform.isMobile` branch,
//   - addEventListener handlers, and
//   - styling that ONLY a real browser can resolve: var() tokens, CSS grid, and
//     a ::before-drawn control.
//
// Nothing here is Obsidian-specific magic; it is the minimum that proves the
// harness mounts real plugin code rather than a hand-shaped mock.

const { ItemView, Platform, Notice, setIcon } = require("obsidian");

class FixtureView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf, plugin);
    this.items = [];
    this.title = "Fixture";
  }

  getViewType() {
    return "ibr-fixture-view";
  }

  render() {
    const content = this.containerEl.children[1];
    content.empty();
    const root = content.createDiv({ cls: "fx-view" });
    this.rootEl = root;

    const header = root.createDiv({ cls: "fx-header" });
    header.createEl("h1", { text: this.title });
    if (Platform.isMobile) {
      // Mobile-only affordance. Rendered as a BUTTON, not a span, because IBR's
      // scan extracts interactive elements only — a non-interactive marker would
      // be invisible to the very scan that has to observe this branch.
      header.addClass("fx-mobile");
      const more = header.createEl("button", { cls: "fx-badge", text: "More", attr: { type: "button", "aria-label": "More actions" } });
      more.addEventListener("click", () => {});
    }

    const cta = root.createEl("button", { cls: "fx-cta", text: "Primary", attr: { type: "button" } });
    cta.addEventListener("click", () => new Notice("cta"));

    const list = root.createDiv({ cls: "fx-list" });
    this.items.forEach((item) => {
      const row = list.createDiv({ cls: "fx-row" });
      const check = row.createEl("button", { cls: "fx-check", attr: { type: "button", role: "checkbox", "aria-checked": "false", "aria-label": "Toggle " + item.title } });
      check.addEventListener("click", () => { item.done = !item.done; this.render(); });
      row.createDiv({ cls: "fx-row-title", text: item.title });
      const tiny = row.createEl("button", { cls: "fx-tiny", text: "x", attr: { type: "button", "aria-label": "Remove " + item.title } });
      tiny.addEventListener("click", () => {});
      const icon = row.createSpan({ cls: "fx-icon" });
      setIcon(icon, "trash");
    });
  }

  openSheet(mount) {
    const host = mount || document.body;
    const overlay = host.createEl("div", { cls: "fx-overlay", attr: { role: "dialog", "aria-modal": "true", "aria-label": "Sheet" } });
    const modal = overlay.createDiv({ cls: "fx-modal" });
    [15, 30, 45, 60].forEach((preset) => {
      modal.createEl("button", { cls: "fx-chip", text: String(preset), attr: { type: "button", "aria-label": preset + " minutes" } });
    });
    return overlay;
  }
}

class FixturePlugin {}

module.exports = FixturePlugin;
module.exports.FixtureView = FixtureView;
