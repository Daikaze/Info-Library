/* World Codex & Gazette — Foundry VTT v11 / dnd5e 3.3.1 */
const WC_ID = "world-codex";
const WC_STORAGE_FLAG = "database";
const WC_SOCKET = `module.${WC_ID}`;
const WC_DEFAULT = () => ({ schema: 1, categories: [], entries: [], issues: [], preferences: { paperName: "The Gazette", paperMotto: "News from across the realm" } });
const wcClone = (x) => foundry.utils.deepClone(x);
const wcId = () => foundry.utils.randomID(16);
const wcEsc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const wcColor = (x) => /^#[0-9a-f]{6}$/i.test(String(x)) ? String(x) : "#d8ad68";
const wcImage = (x) => {
  const s = String(x ?? "").trim();
  // Accept Foundry FilePicker paths in any user-created folder, plus HTTP(S).
  // Reject executable schemes, protocol-relative URLs and malformed markup.
  if (!s || /[<>"'`\\\x00-\x1f]/.test(s)) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s) || /^[a-z][a-z0-9+.-]*:/i.test(s)) return "";
  return s;
};
const wcIcon = (name = "book") => `<i class="fas fa-${wcEsc(name)}" aria-hidden="true"></i>`;
const wcAttr = (x) => wcEsc(x);
const wcBtn = (action, label, icon = "", extra = "", data = "") => `<button type="button" class="wc-btn ${extra}" data-wc-action="${wcEsc(action)}" ${data}>${icon ? wcIcon(icon) : ""}<span>${wcEsc(label)}</span></button>`;
const wcDate = () => new Date().toISOString().slice(0, 10);
const wcDateDisplay = (x) => {
  if (!x) return "Undated";
  // A date is author-provided, so retain fantasy calendar strings without reinterpretation.
  return String(x);
};
function wcMarkdown(raw) {
  const txt = String(raw ?? "").replace(/\r/g, "");
  if (!txt.trim()) return `<p class="wc-muted">No content yet.</p>`;
  return txt.split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n");
    if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
      const level = Math.min(3, lines[0].match(/^#+/)[0].length);
      return `<h${level + 2}>${wcInline(lines[0].replace(/^#{1,3} /, ""))}</h${level + 2}>`;
    }
    return `<p>${lines.map(wcInline).join("<br>")}</p>`;
  }).join("");
}
function wcInline(s) {
  return wcEsc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}
function wcTextField(field, value, label, placeholder = "", more = "") {
  return `<label class="wc-field"><span>${wcEsc(label)}</span><input type="text" data-wc-field="${wcAttr(field)}" value="${wcAttr(value)}" placeholder="${wcAttr(placeholder)}" ${more}></label>`;
}
function wcArea(field, value, label, placeholder = "", rows = 6) {
  return `<label class="wc-field wc-wide"><span>${wcEsc(label)}</span><textarea rows="${rows}" data-wc-field="${wcAttr(field)}" placeholder="${wcAttr(placeholder)}">${wcEsc(value)}</textarea></label>`;
}
function wcSelect(field, selected, label, choices) {
  return `<label class="wc-field"><span>${wcEsc(label)}</span><select data-wc-field="${wcAttr(field)}">${choices.map(([v, text]) => `<option value="${wcAttr(v)}" ${String(v) === String(selected) ? "selected" : ""}>${wcEsc(text)}</option>`).join("")}</select></label>`;
}
function wcEmpty(icon, title, text, action = "", button = "") {
  return `<section class="wc-empty"><div class="wc-empty-icon">${wcIcon(icon)}</div><h2>${wcEsc(title)}</h2><p>${wcEsc(text)}</p>${action ? wcBtn(action, button, "plus", "wc-primary") : ""}</section>`;
}
function wcFigure(src, alt, cls = "") {
  const valid = wcImage(src);
  return valid ? `<img class="${wcAttr(cls)}" src="${wcAttr(valid)}" alt="${wcAttr(alt)}" loading="lazy">` : `<div class="wc-art-empty ${wcAttr(cls)}">${wcIcon("book-open")}</div>`;
}
function wcPaperArticle(article = {}) {
  const style = ["lead", "standard", "notice"].includes(article.layout) ? article.layout : "standard";
  const picture = wcImage(article.image);
  const pictureHTML = picture ? `<figure class="wc-article-figure">${wcFigure(picture, article.headline)}${article.caption ? `<figcaption>${wcEsc(article.caption)}</figcaption>` : ""}</figure>` : "";
  return `<article class="wc-paper-story wc-story-${style}">
    ${article.kicker ? `<div class="wc-story-kicker">${wcEsc(article.kicker)}</div>` : ""}
    <h3>${wcEsc(article.headline || "Untitled Article")}</h3>
    ${article.byline ? `<div class="wc-story-byline">BY ${wcEsc(article.byline)}</div>` : ""}
    ${pictureHTML}
    <div class="wc-story-copy">${wcMarkdown(article.body)}</div>
  </article>`;
}
function wcPaperPage(issue, page, pageIndex) {
  const theme = ["parchment", "ivory", "noir"].includes(issue.theme) ? issue.theme : "parchment";
  const paperName = issue.paperName || "The Gazette";
  const cover = pageIndex === 0;
  const articles = Array.isArray(page.articles) ? page.articles : [];
  return `<section class="wc-paper wc-paper-${theme}">
    <div class="wc-paper-topline"><span>${wcEsc(issue.edition || "SPECIAL EDITION")}</span><span>${wcEsc(wcDateDisplay(issue.date))}</span><span>${wcEsc(issue.price || "FREE")}</span></div>
    <header class="wc-paper-masthead"><h1>${wcEsc(paperName)}</h1>${issue.motto ? `<p>${wcEsc(issue.motto)}</p>` : ""}</header>
    ${cover ? `<div class="wc-paper-banner"><span>${wcEsc(issue.kicker || "LATEST NEWS")}</span><h2>${wcEsc(issue.title || "The Latest Edition")}</h2>${issue.subtitle ? `<p>${wcEsc(issue.subtitle)}</p>` : ""}</div>` : `<div class="wc-paper-section"><h2>${wcEsc(page.title || `Page ${pageIndex + 1}`)}</h2></div>`}
    ${cover && wcImage(issue.coverImage) ? `<figure class="wc-paper-cover">${wcFigure(issue.coverImage, issue.title)}</figure>` : ""}
    <div class="wc-paper-articles">${articles.map(wcPaperArticle).join("") || `<p class="wc-paper-empty">No articles on this page yet.</p>`}</div>
    <footer class="wc-paper-footer"><span>${wcEsc(paperName)}</span><span>${wcEsc(issue.edition || "")}</span><span>PAGE ${pageIndex + 1} / ${(issue.pages || []).length}</span></footer>
  </section>`;
}
function wcAllPaperPages(issue) {
  return (issue.pages || []).map((p, i) => wcPaperPage(issue, p, i)).join("");
}
function wcSafeImport(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.categories) || !Array.isArray(raw.entries) || !Array.isArray(raw.issues)) {
    throw new Error("Not a World Codex backup (missing categories, entries, or issues).");
  }
  if (raw.categories.length > 2000 || raw.entries.length > 20000 || raw.issues.length > 5000) throw new Error("Backup exceeds supported limits.");
  const unique = (items) => new Set(items.map(x => String(x.id))).size === items.length;
  if (![raw.categories, raw.entries, raw.issues].every(unique)) throw new Error("Backup contains duplicate IDs.");
  // Only known fields are rehydrated. Rendering escapes user text and validates image URLs.
  const categories = raw.categories.map(c => ({id: String(c.id || wcId()), name: String(c.name || "Untitled"), description: String(c.description || ""), color: wcColor(c.color)}));
  const validCategories = new Set(categories.map(c => c.id));
  const entries = raw.entries.map(e => ({
    id: String(e.id || wcId()), categoryId: validCategories.has(String(e.categoryId)) ? String(e.categoryId) : "",
    name: String(e.name || "Untitled"), subtitle: String(e.subtitle || ""), image: wcImage(e.image),
    summary: String(e.summary || ""), body: String(e.body || ""),
    tags: Array.isArray(e.tags) ? e.tags.slice(0, 40).map(String) : [],
    fields: Array.isArray(e.fields) ? e.fields.slice(0, 50).map(f => ({label: String(f.label || ""), value: String(f.value || "")})) : [],
    visibility: e.visibility === "players" ? "players" : "gm", updatedAt: String(e.updatedAt || "")
  }));
  const issues = raw.issues.map(issue => ({
    id: String(issue.id || wcId()), paperName: String(issue.paperName || "The Gazette"), motto: String(issue.motto || ""),
    title: String(issue.title || "Untitled Issue"), subtitle: String(issue.subtitle || ""),
    date: String(issue.date || ""), edition: String(issue.edition || ""), price: String(issue.price || ""),
    kicker: String(issue.kicker || ""), theme: ["parchment", "ivory", "noir"].includes(issue.theme) ? issue.theme : "parchment",
    coverImage: wcImage(issue.coverImage), published: !!issue.published,
    pages: (Array.isArray(issue.pages) ? issue.pages : []).slice(0, 100).map(page => ({
      id: String(page.id || wcId()), title: String(page.title || ""),
      articles: (Array.isArray(page.articles) ? page.articles : []).slice(0, 100).map(a => ({
        id: String(a.id || wcId()), headline: String(a.headline || ""), kicker: String(a.kicker || ""),
        byline: String(a.byline || ""), body: String(a.body || ""), image: wcImage(a.image),
        caption: String(a.caption || ""), layout: ["lead", "standard", "notice"].includes(a.layout) ? a.layout : "standard"
      }))
    }))
  }));
  for (const issue of issues) if (!issue.pages.length) issue.pages.push({id:wcId(), title:"Front Page", articles:[]});
  return { schema: 1, categories, entries, issues, preferences: {
    paperName: String(raw.preferences?.paperName || "The Gazette"),
    paperMotto: String(raw.preferences?.paperMotto || "News from across the realm")
  }};
}

class WorldCodex extends Application {
  constructor(options = {}) {
    super(options);
    this.tab = "codex";
    this.view = "browse";
    this.query = "";
    this.categoryFilter = "all";
    this.entryId = null;
    this.issueId = null;
    this.pageId = null;
    this.draft = null;
    this.editedId = null;
    this.editingPageId = null;
  }
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: WC_ID, title: "World Codex & Gazette", template: `modules/${WC_ID}/templates/app.hbs`,
      classes: ["world-codex-window"], width: 1140, height: 780,
      resizable: true, minimizable: true, scrollY: [".wc-list", ".wc-content", ".wc-paper-view"]
    });
  }
  get isGM() { return !!game.user?.isGM; }
  get store() {
    if (!this.isGM) return wcClone(game.settings.get(WC_ID, "publicData") || WC_DEFAULT());
    const journal = wcFindStorage();
    return wcClone(journal?.getFlag(WC_ID, WC_STORAGE_FLAG) || WC_DEFAULT());
  }
  async getData() { return { bodyHtml: this._build() }; }
  _build() {
    const data = this.store;
    const rootHeader = `<header class="wc-topbar">
      <div class="wc-brand">${wcIcon("book-open")} <span>WORLD CODEX</span><b> & </b><span>GAZETTE</span></div>
      <div class="wc-top-links">${wcBtn("tab-codex", "Codex", "book", this.tab === "codex" ? "wc-selected" : "")}${wcBtn("tab-gazette", "Newspapers", "newspaper", this.tab === "gazette" ? "wc-selected" : "")}</div>
      <div class="wc-spacer"></div><span class="wc-role">${wcIcon(this.isGM ? "lock" : "eye")}${this.isGM ? "GM EDITOR" : "READER"}</span>
    </header>`;
    return `${rootHeader}<div class="wc-body"><aside class="wc-sidebar">${this.tab === "codex" ? this._codexSidebar(data) : this._gazetteSidebar(data)}</aside><main class="wc-content">${this.tab === "codex" ? this._codexMain(data) : this._gazetteMain(data)}</main></div>`;
  }
  _codexSidebar(data) {
    const categories = data.categories || [];
    const entries = (data.entries || []).filter(x => this.isGM || x.visibility === "players");
    const filtered = entries.filter(e => (this.categoryFilter === "all" || e.categoryId === this.categoryFilter) &&
      `${e.name} ${e.subtitle} ${e.summary} ${(e.tags || []).join(" ")}`.toLowerCase().includes(this.query.toLowerCase()));
    const items = filtered.map(e => {
      const c = categories.find(c => c.id === e.categoryId);
      return `<button type="button" class="wc-entry-row ${e.id === this.entryId ? "wc-active" : ""}" data-wc-action="select-entry" data-id="${wcAttr(e.id)}">
      ${wcFigure(e.image, e.name, "wc-thumb")}
      <span class="wc-row-meta"><strong>${wcEsc(e.name)}</strong><small>${wcEsc(e.subtitle)}</small><em>${wcEsc(c?.name || "Uncategorized")}</em></span>${this.isGM && e.visibility !== "players" ? wcIcon("lock") : wcIcon("chevron-right")}</button>`;
    });
    return `<div class="wc-sidebar-heading"><span class="wc-kicker">WORLD ENCYCLOPEDIA</span><div class="wc-sidebar-title"><h2>${wcIcon("book")} Codex</h2>${this.isGM ? wcBtn("new-entry", "", "plus", "wc-icon-button") : ""}</div></div>
      <label class="wc-search">${wcIcon("search")}<input data-wc-search type="search" placeholder="Search names, history, tags..." value="${wcAttr(this.query)}"></label>
      <select class="wc-category-select" data-wc-category><option value="all">All Categories</option>${categories.map(c => `<option value="${wcAttr(c.id)}" ${this.categoryFilter === c.id ? "selected" : ""}>${wcEsc(c.name)}</option>`).join("")}</select>
      <div class="wc-count"><span>ENTRIES</span><b>${filtered.length} / ${entries.length}</b></div>
      <div class="wc-list">${items.join("") || `<div class="wc-list-empty">${wcIcon("inbox")}<p>No matching entries</p></div>`}</div>
      <div class="wc-sidebar-footer">${this.isGM ? `${wcBtn("categories", "Categories", "layer-group")}${wcBtn("backup", "Backup", "download")}${wcBtn("import", "Import", "file-import")}` : "Published world lore"}</div>`;
  }
  _codexMain(data) {
    if (this.view === "categories" && this.isGM) return this._categoriesView(data);
    if (this.view === "category-form" && this.isGM) return this._categoryForm();
    if (this.view === "entry-form" && this.isGM) return this._entryForm(data);
    const entry = (data.entries || []).find(e => e.id === this.entryId && (this.isGM || e.visibility === "players"));
    if (!entry) return wcEmpty("book-open", "Create your own world encyclopedia", this.isGM ? "Nothing is preconfigured. Create a category, then add cities, NPCs, PCs, factions, locations, or any other lore you want." : "No published entries have been shared yet.", this.isGM ? "categories" : "", "Manage Categories");
    const category = data.categories.find(x => x.id === entry.categoryId);
    return `<section class="wc-profile">
      <div class="wc-profile-head">
        <div class="wc-profile-art">${wcFigure(entry.image, entry.name)}${wcImage(entry.image) ? `<div class="wc-image-actions">${wcBtn("open-entry-image", "View Art", "image")}</div>` : ""}</div>
        <div class="wc-profile-overview"><div class="wc-kicker">${wcEsc(category?.name || "UNCATEGORIZED")} ${entry.visibility === "gm" && this.isGM ? "◆ GM ONLY" : "◆ PUBLIC"}</div><h1>${wcEsc(entry.name)}</h1>
        <h3>${wcEsc(entry.subtitle || "World Record")}</h3>
        <div class="wc-pill-group">${(entry.tags || []).map(t => `<span class="wc-pill">${wcEsc(t)}</span>`).join("")}</div>
        ${this.isGM ? `<div class="wc-toolbar">${wcBtn("edit-entry", "Edit", "pen", "wc-primary")}${wcBtn("duplicate-entry", "Duplicate", "copy")}${entry.visibility === "players" ? wcBtn("show-entry", "Show Players", "users") : ""}${wcBtn("delete-entry", "", "trash", "wc-danger")}</div>` : ""}</div>
      </div>
      <div class="wc-profile-reading">${entry.summary ? `<div class="wc-summary">${wcMarkdown(entry.summary)}</div>` : ""}
      <h2>History & Details</h2><div class="wc-rich-text">${wcMarkdown(entry.body)}</div>
      ${(entry.fields || []).length ? `<div class="wc-profile-fields"><h2>Additional Information</h2><div class="wc-detail-grid">${entry.fields.filter(f => f.label || f.value).map(f => `<div class="wc-detail"><span>${wcEsc(f.label)}</span><strong>${wcEsc(f.value)}</strong></div>`).join("")}</div></div>` : ""}
      </div></section>`;
  }
  _categoriesView(data) {
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">ORGANIZE YOUR WORLD</div><h1>Categories</h1><p>Create your own categories. No fixed types or presets.</p></div>${wcBtn("new-category", "New Category", "plus", "wc-primary")}</div>
      <div class="wc-categories-grid">${data.categories.map(c => `<div class="wc-cat-card" style="--wc-cat:${wcColor(c.color)}"><div class="wc-cat-mark">${wcIcon("bookmark")}</div><h3>${wcEsc(c.name)}</h3><p>${wcEsc(c.description || "Custom category")}</p><small>${data.entries.filter(e => e.categoryId === c.id).length} entries</small><div>${wcBtn("edit-category", "Edit", "pen", "", `data-id="${wcAttr(c.id)}"`)}${wcBtn("delete-category", "Delete", "trash", "wc-danger", `data-id="${wcAttr(c.id)}"`)}</div></div>`).join("") || `<div class="wc-wide">${wcEmpty("layer-group", "No categories yet", "Create a category such as Cities, NPCs, PCs, or anything you like.", "new-category", "Create Category")}</div>`}</div>
      <div class="wc-edit-bottom">${wcBtn("back", "Back to Codex", "arrow-left")}</div></section>`;
  }
  _categoryForm() {
    const d = this.draft;
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">WORLD ORGANIZATION</div><h1>${this.editedId ? "Edit Category" : "Create Category"}</h1></div></div>
      <div class="wc-form-grid">${wcTextField("name", d.name, "Category Name", "Cities, NPCs, PCs...")}${wcTextField("color", d.color, "Accent Color", "#d8ad68")}${wcArea("description", d.description, "Description (optional)", "What belongs here?", 3)}</div>
      <div class="wc-edit-bottom">${wcBtn("save-category", "Save Category", "save", "wc-primary")}${wcBtn("categories", "Cancel", "times")}</div></section>`;
  }
  _entryForm(data) {
    const d = this.draft;
    const fields = d.fields || [];
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">WORLD RECORD</div><h1>${this.editedId ? "Edit Entry" : "New Entry"}</h1><p>Document a place, person, creature, event, or any kind of world lore.</p></div></div>
    <div class="wc-form-grid">${wcSelect("categoryId", d.categoryId, "Category", data.categories.map(c => [c.id, c.name]))}
    ${wcSelect("visibility", d.visibility, "Who can read this?", [["gm", "GM only"], ["players", "Players (published)"]])}
    ${wcTextField("name", d.name, "Name", "The Imperial Capital")}${wcTextField("subtitle", d.subtitle, "Subtitle", "Heart of the Empire")}
    <div class="wc-media-field">${wcTextField("image", d.image, "Image Path / URL", "worlds/my-world/art/capital.webp")}${wcBtn("pick-image", "Browse", "image", "", 'data-field="image"')}</div>
    ${wcTextField("tags", (d.tags || []).join(", "), "Tags (comma separated)", "Capital, Trade, Political")}
    ${wcArea("summary", d.summary, "Featured Summary", "A short introduction highlighted below the image.", 4)}
    ${wcArea("body", d.body, "History, Lore & Description", "Use blank lines for paragraphs, **bold** and *italic* for emphasis.", 13)}</div>
    <section class="wc-form-section"><div class="wc-section-heading"><h2>Custom Information Fields</h2>${wcBtn("add-field", "Add Field", "plus")}</div>
    ${fields.map((f, i) => `<div class="wc-custom-field">${wcTextField(`fields.${i}.label`, f.label, "Label", "Leader / Population / Affiliation")}${wcTextField(`fields.${i}.value`, f.value, "Value", "Field value")}${wcBtn("remove-field", "", "trash", "wc-danger", `data-index="${i}"`)}</div>`).join("") || `<p class="wc-muted">Optional: add details specific to this entry.</p>`}</section>
    <div class="wc-edit-bottom">${wcBtn("save-entry", "Save Entry", "save", "wc-primary")}${wcBtn("back", "Cancel", "times")}</div></section>`;
  }
  _gazetteSidebar(data) {
    const issues = (data.issues || []).filter(i => this.isGM || i.published).slice().reverse();
    return `<div class="wc-sidebar-heading"><span class="wc-kicker">THE PRINTING PRESS</span><div class="wc-sidebar-title"><h2>${wcIcon("newspaper")} Gazette</h2>${this.isGM ? wcBtn("new-issue", "", "plus", "wc-icon-button") : ""}</div></div>
      <div class="wc-gazette-tip">Create multi-page editions with headlines, reports, portraits, and maps.</div>
      <div class="wc-count"><span>ISSUE ARCHIVE</span><b>${issues.length}</b></div>
      <div class="wc-list">${issues.map(i => `<button type="button" class="wc-issue-row ${i.id === this.issueId ? "wc-active" : ""}" data-wc-action="select-issue" data-id="${wcAttr(i.id)}">
      <span class="wc-issue-icon">${wcIcon("newspaper")}</span><span class="wc-row-meta"><strong>${wcEsc(i.paperName || "The Gazette")}</strong><small>${wcEsc(i.title)}</small><em>${wcEsc(i.date || i.edition || "Undated")}</em></span><span class="wc-publish-indicator ${i.published ? "is-live" : ""}" title="${i.published ? "Published" : "Draft"}"></span></button>`).join("") || `<div class="wc-list-empty">${wcIcon("newspaper")}<p>No editions yet</p></div>`}</div>
      <div class="wc-sidebar-footer">${this.isGM ? `${wcBtn("new-issue", "New Issue", "plus", "wc-primary")}${wcBtn("backup", "Backup", "download")}${wcBtn("import", "Import", "file-import")}` : "Published issues only"}</div>`;
  }
  _gazetteMain(data) {
    if (this.view === "issue-form" && this.isGM) return this._issueForm();
    if (this.view === "page-form" && this.isGM) return this._pageForm();
    if (this.view === "article-form" && this.isGM) return this._articleForm();
    const issue = data.issues.find(i => i.id === this.issueId && (this.isGM || i.published));
    if (!issue) return wcEmpty("newspaper", "Build your own newspaper", this.isGM ? "Create an edition, add pages and articles, place illustrations and maps, then publish it for your players." : "The newspaper archive is empty. Published editions will appear here.", this.isGM ? "new-issue" : "", "Create First Issue");
    const pageIndex = Math.max(0, issue.pages.findIndex(p => p.id === this.pageId));
    const page = issue.pages[pageIndex];
    return `<section class="wc-gazette-reading"><div class="wc-issue-controls"><div><div class="wc-kicker">${wcEsc(issue.edition || "NEWSPAPER EDITION")}</div><h2>${wcEsc(issue.title)}</h2><small>${wcEsc(issue.date || "No date")} · ${issue.pages.length} page${issue.pages.length === 1 ? "" : "s"} · ${issue.published ? "Published" : "Draft"}</small></div>
       <div class="wc-toolbar">${this.isGM ? `${wcBtn("edit-issue", "Edit Issue", "pen")}${wcBtn("toggle-publish", issue.published ? "Unpublish" : "Publish", issue.published ? "eye-slash" : "check-circle", issue.published ? "" : "wc-primary")}${issue.published ? wcBtn("share-issue", "Show Players", "users") : ""}${wcBtn("announce-issue", "Chat Notice", "comment", "", issue.published ? "" : "disabled")}${wcBtn("delete-issue", "", "trash", "wc-danger")}` : ""}${wcBtn("print-issue", "Print", "print")}${wcBtn("export-html", "HTML", "file-code")}</div>
     </div>
     <div class="wc-page-switcher"><span>PAGES</span>${issue.pages.map((p, i) => `<button type="button" class="wc-page-tab ${i === pageIndex ? "wc-selected" : ""}" data-wc-action="select-page" data-id="${wcAttr(p.id)}">${i + 1}. ${wcEsc(p.title || `Page ${i + 1}`)}</button>`).join("")}${this.isGM ? wcBtn("add-page", "", "plus", "wc-icon-button") : ""}</div>
     ${this.isGM ? `<div class="wc-page-actions">${wcBtn("rename-page", "Page Settings", "pen")}${wcBtn("add-article", "Add Article", "plus", "wc-primary")}${pageIndex > 0 ? wcBtn("page-left", "Move Left", "arrow-left") : ""}${pageIndex < issue.pages.length - 1 ? wcBtn("page-right", "Move Right", "arrow-right") : ""}${issue.pages.length > 1 ? wcBtn("delete-page", "Delete Page", "trash", "wc-danger") : ""}</div>` : ""}
     <div class="wc-paper-view">${wcPaperPage(issue, page, pageIndex)}</div>
     ${this.isGM ? `<div class="wc-article-manager"><div class="wc-section-heading"><h3>Articles on this Page</h3><span>${page.articles.length} story${page.articles.length === 1 ? "" : "ies"}</span></div>
      ${page.articles.map((a, i) => `<div class="wc-article-row"><span class="wc-article-number">${i + 1}</span><span class="wc-row-meta"><strong>${wcEsc(a.headline || "Untitled Article")}</strong><small>${wcEsc(a.kicker || a.layout || "Story")}</small></span>${wcBtn("edit-article", "Edit", "pen", "", `data-id="${wcAttr(a.id)}"`)}${i ? wcBtn("article-up", "↑", "", "wc-tight", `data-id="${wcAttr(a.id)}"`) : ""}${i < page.articles.length - 1 ? wcBtn("article-down", "↓", "", "wc-tight", `data-id="${wcAttr(a.id)}"`) : ""}${wcBtn("delete-article", "", "trash", "wc-danger", `data-id="${wcAttr(a.id)}"`)}</div>`).join("") || `<p class="wc-muted">Add your first article to start filling this page.</p>`}</div>` : ""}</section>`;
  }
  _issueForm() {
    const d = this.draft;
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">NEWSPAPER EDITOR</div><h1>${this.editedId ? "Edit Newspaper Issue" : "Create an Issue"}</h1><p>Choose the masthead, edition details and visual theme.</p></div></div>
     <div class="wc-form-grid">${wcTextField("paperName", d.paperName, "Newspaper Name", "Izmet Times")}${wcTextField("motto", d.motto, "Masthead Motto", "The voice of the Empire")}
     ${wcTextField("title", d.title, "Front Page Headline", "A Continent Has Vanished!")}${wcTextField("subtitle", d.subtitle, "Front Page Subheadline", "Witnesses report an impossible event...")}
     ${wcTextField("date", d.date, "In-World Date", "06/06/602")}${wcTextField("edition", d.edition, "Edition Label", "VOL. 3 • SPECIAL")}
     ${wcTextField("price", d.price, "Price / Status", "2 CP / FREE")}${wcTextField("kicker", d.kicker, "Topline", "BREAKING NEWS")}
     ${wcSelect("theme", d.theme, "Paper Theme", [["parchment", "Aged Parchment"], ["ivory", "Classic Ivory"], ["noir", "Midnight Press"]])}
     <div class="wc-media-field">${wcTextField("coverImage", d.coverImage, "Front Cover Image (optional)", "worlds/my-world/art/map.webp")}${wcBtn("pick-image", "Browse", "image", "", 'data-field="coverImage"')}</div></div>
     <div class="wc-edit-bottom">${wcBtn("save-issue", "Save Issue", "save", "wc-primary")}${wcBtn("back", "Cancel", "times")}</div></section>`;
  }
  _pageForm() {
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">PAGE EDITOR</div><h1>Page Settings</h1></div></div>
     <div class="wc-form-grid">${wcTextField("title", this.draft.title, "Page Title", "City News / Wanted / Announcements")}</div>
     <div class="wc-edit-bottom">${wcBtn("save-page", "Save Page", "save", "wc-primary")}${wcBtn("back", "Cancel", "times")}</div></section>`;
  }
  _articleForm() {
    const d = this.draft;
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">REPORTER'S DESK</div><h1>${this.editedId ? "Edit Article" : "Write an Article"}</h1><p>Long-form text will flow into a multi-column newspaper layout.</p></div></div>
     <div class="wc-form-grid">${wcTextField("headline", d.headline, "Headline", "The Emperor Addresses the Nation")}${wcTextField("kicker", d.kicker, "Section / Kicker", "FRONT PAGE / POLITICS")}
     ${wcTextField("byline", d.byline, "Author / Byline", "Izmet Times Editorial")}
     ${wcSelect("layout", d.layout, "Layout", [["lead", "Lead Story — Full Width"], ["standard", "Regular Story — Column"], ["notice", "Short Notice — Compact"]])}
     ${wcArea("body", d.body, "Article Text", "Write your report here. Use a blank line for a new paragraph; **bold** and *italic* are supported.", 15)}
     <div class="wc-media-field">${wcTextField("image", d.image, "Illustration / Map Path", "worlds/my-world/art/image.webp")}${wcBtn("pick-image", "Browse", "image", "", 'data-field="image"')}</div>
     ${wcTextField("caption", d.caption, "Image Caption", "The missing continent, as last mapped")}</div>
     <div class="wc-edit-bottom">${wcBtn("save-article", "Save Article", "save", "wc-primary")}${wcBtn("back", "Cancel", "times")}</div></section>`;
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", "[data-wc-action]", (ev) => { ev.preventDefault(); this._onAction(ev).catch(e => this._error(e)); });
    html.on("input", "[data-wc-search]", (ev) => {
      this.query = ev.currentTarget.value;
      // Preserve focus and cursor by updating just the list / count instead of re-rendering the window.
      const fresh = $(this._codexSidebar(this.store));
      html.find(".wc-list").html(fresh.find(".wc-list").html());
      html.find(".wc-count").html(fresh.find(".wc-count").html());
    });
    html.on("change", "[data-wc-category]", (ev) => { this.categoryFilter = ev.currentTarget.value; this.render(); });
    html.on("input change", "[data-wc-field]", (ev) => this._updateDraft(ev));
  }
  _updateDraft(ev) {
    if (!this.draft) return;
    const path = ev.currentTarget.dataset.wcField;
    if (!path) return;
    const value = ev.currentTarget.value;
    if (path === "tags") { this.draft.tags = value.split(",").map(t => t.trim()).filter(Boolean); return; }
    const parts = path.split(".");
    let target = this.draft;
    for (let i = 0; i < parts.length - 1; i++) {
      if (target[parts[i]] == null) return;
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
  }
  _checkGM() { if (!this.isGM) throw new Error("GM permission is required."); }
  _error(e) { console.error(`${WC_ID} |`, e); ui.notifications.error(`World Codex: ${e.message || e}`); }
  _issue(data) { return data.issues.find(i => i.id === this.issueId); }
  _page(issue) { return issue?.pages.find(p => p.id === this.pageId) || issue?.pages[0]; }
  _clearEditor() { this.view = "browse"; this.draft = null; this.editedId = null; this.editingPageId = null; }
  async _confirm(title, message) {
    return Dialog.confirm({ title, content: `<p>${wcEsc(message)}</p>`, yes: () => true, no: () => false, defaultYes: false });
  }
  async _persist(data) {
    this._checkGM();
    if (this._saving) { ui.notifications.warn("A save is already in progress."); return false; }
    this._saving = true;
    try {
      const cleaned = wcSafeImport(data);
      let journal = wcFindStorage();
      if (!journal) {
        journal = await JournalEntry.create({
          name: "World Codex - Private Data (do not delete)",
          ownership: {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE},
          flags: {[WC_ID]: {storage: true, [WC_STORAGE_FLAG]: cleaned}}
        });
      } else {
        await journal.setFlag(WC_ID, WC_STORAGE_FLAG, cleaned);
      }
      const publicEntries = cleaned.entries.filter(e => e.visibility === "players");
      const publicCategories = cleaned.categories.filter(c => publicEntries.some(e => e.categoryId === c.id));
      const publicIssues = cleaned.issues.filter(i => i.published);
      await game.settings.set(WC_ID, "publicData", {
        schema: 1, categories: publicCategories, entries: publicEntries, issues: publicIssues, preferences: cleaned.preferences
      });
      return true;
    } finally { this._saving = false; }
  }
  _startCategory(cat = null) {
    this.tab = "codex"; this.view = "category-form"; this.editedId = cat?.id || null;
    this.draft = cat ? wcClone(cat) : {id:wcId(),name:"",description:"",color:"#d8ad68"};
  }
  _startEntry(entry = null, data = this.store) {
    this.tab = "codex"; this.view = "entry-form"; this.editedId = entry?.id || null;
    this.draft = entry ? wcClone(entry) : {id:wcId(),categoryId:this.categoryFilter !== "all" ? this.categoryFilter : (data.categories[0]?.id || ""), name:"", subtitle:"", image:"",summary:"",body:"",tags:[],fields:[],visibility:"gm",updatedAt:""};
  }
  _startIssue(issue = null, data = this.store) {
    this.tab = "gazette"; this.view = "issue-form"; this.editedId = issue?.id || null;
    this.draft = issue ? wcClone(issue) : {id:wcId(),paperName:data.preferences.paperName || "The Gazette", motto:data.preferences.paperMotto || "",title:"",subtitle:"",date:"",edition:"SPECIAL EDITION",price:"",kicker:"LATEST NEWS",theme:"parchment",coverImage:"",published:false,pages:[{id:wcId(),title:"Front Page",articles:[]}]};
  }
  _startArticle(article = null) {
    this.tab = "gazette"; this.view = "article-form"; this.editedId = article?.id || null;
    this.draft = article ? wcClone(article) : {id:wcId(),headline:"",kicker:"",byline:"",body:"",image:"",caption:"",layout:"standard"};
  }
  async _onAction(ev) {
    const button = ev.currentTarget;
    const action = button.dataset.wcAction;
    const id = button.dataset.id;
    const data = this.store;
    const gm = this.isGM;
    let issue = this._issue(data);
    let page = this._page(issue);
    if (["tab-codex","tab-gazette"].includes(action)) {
      this.tab = action === "tab-codex" ? "codex" : "gazette"; this._clearEditor(); this.render(); return;
    }
    if (action === "back") { this._clearEditor(); this.render(); return; }
    if (action === "select-entry") { this.entryId = id; this._clearEditor(); this.render(); return; }
    if (action === "select-issue") { this.issueId = id; this.pageId = data.issues.find(i => i.id === id)?.pages[0]?.id || null; this._clearEditor(); this.render(); return; }
    if (action === "select-page") { this.pageId = id; this._clearEditor(); this.render(); return; }
    if (action === "open-entry-image") {
      const entry = data.entries.find(e => e.id === this.entryId);
      const src = wcImage(entry?.image);
      if (src) new ImagePopout(src, {title:entry.name, shareable:gm}).render(true);
      return;
    }
    if (action === "print-issue" || action === "export-html") {
      if (!issue) return;
      const markup = wcStandalonePaper(issue);
      if (action === "export-html") wcDownload(`${wcFileName(issue.paperName)}-${wcFileName(issue.date || issue.title)}.html`, markup, "text/html;charset=utf-8");
      else {
        const blob = new Blob([markup], {type:"text/html;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank");
        if (!win) { wcDownload(`${wcFileName(issue.paperName)}-print.html`, markup, "text/html;charset=utf-8"); ui.notifications.warn("Popup blocked. Downloaded a printable HTML file instead."); }
        else setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      return;
    }
    if (action === "pick-image") {
      this._checkGM();
      const field = button.dataset.field;
      if (!field || !this.draft) return;
      const picker = new FilePicker({ type:"image", current:this.draft[field] || "", callback: (path) => {
        if (!this.draft) return;
        this.draft[field] = path;
        this.element.find(`[data-wc-field="${field}"]`).val(path);
      }});
      picker.render(true); return;
    }
    if (!gm) return;
    if (action === "categories") { this.view = "categories"; this.render(); return; }
    if (action === "new-category") { this._startCategory(); this.render(); return; }
    if (action === "edit-category") { this._startCategory(data.categories.find(c => c.id === id)); this.render(); return; }
    if (action === "save-category") {
      const d = this.draft;
      if (!d.name.trim()) throw new Error("Enter a category name.");
      d.name = d.name.trim(); d.color = wcColor(d.color);
      if (this.editedId) data.categories = data.categories.map(c => c.id === this.editedId ? d : c);
      else data.categories.push(d);
      if (await this._persist(data)) { this.view = "categories"; this.draft = null; this.render(); }
      return;
    }
    if (action === "delete-category") {
      const cat = data.categories.find(c => c.id === id);
      const count = data.entries.filter(e => e.categoryId === id).length;
      if (!cat || !await this._confirm("Delete Category", `Delete ${cat.name}? ${count} entr${count === 1 ? "y" : "ies"} will become uncategorized but will not be deleted.`)) return;
      data.categories = data.categories.filter(c => c.id !== id);
      data.entries.forEach(e => {if (e.categoryId === id) e.categoryId = "";});
      if (this.categoryFilter === id) this.categoryFilter = "all";
      await this._persist(data); this.render(); return;
    }
    if (action === "new-entry") {
      if (!data.categories.length) { ui.notifications.warn("Create at least one category first."); this.view = "categories"; this.render(); return; }
      this._startEntry(null, data); this.render(); return;
    }
    if (action === "edit-entry") { this._startEntry(data.entries.find(e => e.id === this.entryId), data); this.render(); return; }
    if (action === "add-field") { this.draft.fields.push({label:"",value:""}); this.render(); return; }
    if (action === "remove-field") { this.draft.fields.splice(Number(button.dataset.index), 1); this.render(); return; }
    if (action === "save-entry") {
      const d = this.draft;
      if (!d.name.trim()) throw new Error("Enter an entry name.");
      if (!data.categories.some(c => c.id === d.categoryId)) throw new Error("Select a category.");
      d.name = d.name.trim(); d.image = wcImage(d.image); d.updatedAt = new Date().toISOString();
      d.fields = d.fields.filter(f => f.label?.trim() || f.value?.trim());
      if (this.editedId) data.entries = data.entries.map(e => e.id === this.editedId ? d : e);
      else data.entries.push(d);
      if (await this._persist(data)) { this.entryId = d.id; this._clearEditor(); this.render(); }
      return;
    }
    if (action === "duplicate-entry") {
      const original = data.entries.find(e => e.id === this.entryId);
      if (!original) return;
      const dupe = wcClone(original); dupe.id = wcId(); dupe.name += " (Copy)"; dupe.visibility = "gm";
      data.entries.push(dupe); await this._persist(data); this.entryId = dupe.id; this.render(); return;
    }
    if (action === "delete-entry") {
      const entry = data.entries.find(e => e.id === this.entryId);
      if (!entry || !await this._confirm("Delete Entry", `Permanently delete ${entry.name}?`)) return;
      data.entries = data.entries.filter(e => e.id !== entry.id);
      await this._persist(data); this.entryId = null; this.render(); return;
    }
    if (action === "show-entry") {
      const entry = data.entries.find(e => e.id === this.entryId);
      if (entry?.visibility === "players") { game.socket.emit(WC_SOCKET, {type:"open-entry", id:entry.id}); ui.notifications.info(`Shared ${entry.name} with connected players.`); }
      return;
    }
    if (action === "new-issue") { this._startIssue(null, data); this.render(); return; }
    if (action === "edit-issue") { if (!issue) return; this._startIssue(issue, data); this.render(); return; }
    if (action === "save-issue") {
      const d = this.draft;
      if (!d.title.trim() || !d.paperName.trim()) throw new Error("Newspaper name and front headline are required.");
      d.coverImage = wcImage(d.coverImage);
      if (this.editedId) data.issues = data.issues.map(i => i.id === this.editedId ? d : i);
      else data.issues.push(d);
      data.preferences = {paperName:d.paperName,paperMotto:d.motto};
      if (await this._persist(data)) { this.issueId = d.id; this.pageId = d.pages[0].id; this._clearEditor(); this.render(); }
      return;
    }
    if (action === "delete-issue") {
      if (!issue || !await this._confirm("Delete Issue", `Delete ${issue.title} and all of its pages and articles?`)) return;
      data.issues = data.issues.filter(i => i.id !== issue.id);
      await this._persist(data); this.issueId = null; this.pageId = null; this.render(); return;
    }
    if (action === "toggle-publish") {
      if (!issue) return;
      issue.published = !issue.published;
      if (await this._persist(data)) { this.render(); ui.notifications.info(issue.published ? "Issue published to the player archive." : "Issue unpublished from the player archive."); }
      return;
    }
    if (action === "share-issue") {
      if (issue?.published) { game.socket.emit(WC_SOCKET, {type:"open-issue",id:issue.id}); ui.notifications.info("Opened the edition for connected players."); }
      return;
    }
    if (action === "announce-issue") {
      if (!issue?.published) throw new Error("Publish this issue before announcing it.");
      await ChatMessage.create({content:`<div class="wc-chat-notice"><strong>${wcIcon("newspaper")} ${wcEsc(issue.paperName)}</strong><p>${wcEsc(issue.title)} — ${wcEsc(issue.date)}</p><button type="button" class="wc-chat-open" data-issue-id="${wcAttr(issue.id)}">Read this Issue</button></div>`});
      return;
    }
    if (action === "add-page") {
      if (!issue) return;
      const newPage = {id:wcId(),title:`Page ${issue.pages.length + 1}`,articles:[]};
      issue.pages.push(newPage); if (await this._persist(data)) { this.pageId = newPage.id; this.render(); } return;
    }
    if (action === "rename-page") {
      if (!page) return;
      this.view = "page-form"; this.editingPageId = page.id; this.draft = {title:page.title}; this.render(); return;
    }
    if (action === "save-page") {
      const p = issue.pages.find(p => p.id === this.editingPageId);
      if (!p) return;
      p.title = this.draft.title.trim() || "Untitled Page";
      if (await this._persist(data)) { this._clearEditor(); this.render(); } return;
    }
    if (action === "delete-page") {
      if (!issue || issue.pages.length < 2 || !await this._confirm("Delete Page", `Delete ${page.title} and all articles on it?`)) return;
      issue.pages = issue.pages.filter(p => p.id !== page.id);
      if (await this._persist(data)) { this.pageId = issue.pages[0].id; this.render(); } return;
    }
    if (action === "page-left" || action === "page-right") {
      const index = issue.pages.findIndex(p => p.id === page.id);
      const other = index + (action === "page-left" ? -1 : 1);
      if (other < 0 || other >= issue.pages.length) return;
      [issue.pages[index], issue.pages[other]] = [issue.pages[other], issue.pages[index]];
      await this._persist(data); this.render(); return;
    }
    if (action === "add-article") { this._startArticle(); this.render(); return; }
    if (action === "edit-article") { this._startArticle(page.articles.find(a => a.id === id)); this.render(); return; }
    if (action === "save-article") {
      const d = this.draft;
      if (!d.headline.trim()) throw new Error("Enter an article headline.");
      d.image = wcImage(d.image);
      if (this.editedId) page.articles = page.articles.map(a => a.id === this.editedId ? d : a);
      else page.articles.push(d);
      if (await this._persist(data)) { this._clearEditor(); this.render(); } return;
    }
    if (action === "delete-article") {
      const article = page.articles.find(a => a.id === id);
      if (!article || !await this._confirm("Delete Article", `Delete ${article.headline}?`)) return;
      page.articles = page.articles.filter(a => a.id !== id); await this._persist(data); this.render(); return;
    }
    if (action === "article-up" || action === "article-down") {
      const index = page.articles.findIndex(a => a.id === id);
      const other = index + (action === "article-up" ? -1 : 1);
      if (index < 0 || other < 0 || other >= page.articles.length) return;
      [page.articles[index], page.articles[other]] = [page.articles[other], page.articles[index]];
      await this._persist(data); this.render(); return;
    }
    if (action === "backup") {
      wcDownload(`world-codex-backup-${wcDate()}.json`, JSON.stringify({module:WC_ID, exportedAt:new Date().toISOString(), ...data}, null, 2), "application/json");
      return;
    }
    if (action === "import") {
      const input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json";
      input.addEventListener("change", async () => {
        try {
          const file = input.files?.[0]; if (!file) return;
          if (file.size > 15_000_000) throw new Error("The backup is too large (15 MB maximum).");
          const imported = wcSafeImport(JSON.parse(await file.text()));
          if (!await this._confirm("Replace Entire Codex?", "This will replace ALL current categories, entries and newspaper issues. Back up your existing content first.")) return;
          if (await this._persist(imported)) {
            this.categoryFilter = "all"; this.entryId = null; this.issueId = null; this.pageId = null; this._clearEditor(); this.render();
            ui.notifications.info("World Codex backup imported.");
          }
        } catch (e) { this._error(e); }
      }, {once:true});
      input.click(); return;
    }
  }
}

function wcFileName(str) { return String(str ?? "issue").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 45) || "issue"; }
function wcDownload(name, content, mime) {
  const blob = new Blob([content], {type:mime}); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function wcStandalonePaper(issue) {
  const css = `*{box-sizing:border-box}body{margin:0;background:#d8d2c8;color:#231d16;font-family:Georgia,'Times New Roman',serif}
  .tools{position:sticky;top:0;padding:10px;text-align:center;background:#222;color:#fff;z-index:5}.tools button{padding:8px 18px;cursor:pointer}
  .wc-paper{background:#f5eddd;color:#241b15;max-width:210mm;min-height:275mm;padding:14mm;margin:15mm auto;box-shadow:0 4px 20px #999;page-break-after:always;break-after:page}
  .wc-paper-ivory{background:#fffef6}.wc-paper-noir{background:#26252b;color:#f6e5cf}.wc-paper:last-child{page-break-after:auto;break-after:auto}
  .wc-paper-topline{display:flex;justify-content:space-between;border-top:2px solid;border-bottom:1px solid;font-size:10px;font-weight:bold;padding:6px 0;letter-spacing:1px}
  .wc-paper-masthead{text-align:center;border-bottom:5px double;margin-bottom:12px;padding:9px 0}.wc-paper-masthead h1{font-size:42px;margin:0;font-variant:small-caps;line-height:1.1}.wc-paper-masthead p{margin:3px 0;font-style:italic;font-size:12px}
  .wc-paper-banner{text-align:center;margin:14px 0}.wc-paper-banner span,.wc-story-kicker{font:bold 11px Georgia;color:#a24024;letter-spacing:1.4px}.wc-paper-banner h2{font-size:32px;line-height:1.1;margin:4px 0}.wc-paper-banner p{font-style:italic;margin:4px}
  .wc-paper-section{text-align:center;border-bottom:2px solid;margin:16px 0}.wc-paper-section h2{margin:5px}
  .wc-paper-cover{margin:13px auto}.wc-paper-cover img{width:100%;max-height:75mm;object-fit:cover;display:block;filter:saturate(.8)}
  .wc-paper-articles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 21px;margin-top:18px}
  .wc-paper-story{min-width:0;break-inside:avoid}.wc-paper-story h3{font-size:19px;margin:4px 0 7px;line-height:1.1}.wc-story-lead{grid-column:1/-1}.wc-story-lead h3{font-size:28px}
  .wc-story-lead .wc-story-copy{columns:2;column-gap:20px}.wc-story-copy p{font-size:12px;line-height:1.6;margin:0 0 10px;text-align:justify}.wc-story-copy h3,.wc-story-copy h4,.wc-story-copy h5{margin:8px 0}
  .wc-story-byline{font-size:9px;font-weight:bold;letter-spacing:1px;border-bottom:1px solid #9b8772;padding-bottom:5px;margin:5px 0}.wc-article-figure{margin:8px 0}.wc-article-figure img{width:100%;max-height:75mm;object-fit:cover}.wc-article-figure figcaption{font-size:10px;font-style:italic}
  .wc-story-notice{border:1px solid currentColor;padding:10px}.wc-paper-footer{display:flex;justify-content:space-between;border-top:2px solid;margin-top:35px;padding-top:8px;font-size:10px;font-weight:bold}
  @media print{body{background:none}.tools{display:none}.wc-paper{margin:0;box-shadow:none;width:210mm;min-height:277mm;padding:12mm}@page{size:A4;margin:0}}`;
  const pages = wcAllPaperPages(issue);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${wcEsc(issue.paperName)} — ${wcEsc(issue.title)}</title><style>${css}</style></head><body><div class="tools"><button onclick="window.print()">Print / Save as PDF</button></div>${pages}</body></html>`;
}
function wcFindStorage() {
  if (!game.user?.isGM) return null;
  return game.journal.find(j => j.getFlag(WC_ID, "storage") === true) || null;
}
let wcApp;
let wcPendingOpen = null;
function wcCanOpenShared(msg) {
  const data = game.settings.get(WC_ID, "publicData") || WC_DEFAULT();
  return msg?.type === "open-issue" ? data.issues.some(i => i.published && i.id === msg.id)
    : msg?.type === "open-entry" ? data.entries.some(e => e.visibility === "players" && e.id === msg.id) : false;
}
function wcOpen(tab = "codex", id = null) {
  if (!wcApp) wcApp = new WorldCodex();
  wcApp.tab = tab;
  wcApp._clearEditor();
  if (tab === "gazette" && id) {
    wcApp.issueId = id; wcApp.pageId = wcApp.store.issues.find(i => i.id === id)?.pages[0]?.id || null;
  }
  if (tab === "codex" && id) wcApp.entryId = id;
  wcApp.render(true);
  return wcApp;
}
Hooks.once("init", () => {
  game.settings.register(WC_ID, "publicData", {
    name:"Published World Codex Data", scope:"world", config:false, type:Object,
    default:WC_DEFAULT(), onChange: () => {
      if (!game.user?.isGM && wcPendingOpen && wcCanOpenShared(wcPendingOpen)) {
        const msg = wcPendingOpen; wcPendingOpen = null;
        wcOpen(msg.type === "open-issue" ? "gazette" : "codex", msg.id);
      } else if (wcApp?.rendered && !game.user?.isGM) wcApp.render();
    }
  });
});
Hooks.once("ready", () => {
  game.modules.get(WC_ID).api = { open:wcOpen };
  game.socket.on(WC_SOCKET, (msg) => {
    if (!msg || game.user.isGM) return;
    if (!(["open-issue", "open-entry"].includes(msg.type)) || typeof msg.id !== "string") return;
    if (wcCanOpenShared(msg)) wcOpen(msg.type === "open-issue" ? "gazette" : "codex", msg.id);
    else wcPendingOpen = msg;
  });
  Hooks.on("updateJournalEntry", (journal) => {
    if (game.user.isGM && journal.getFlag(WC_ID, "storage") && wcApp?.rendered && !wcApp.draft) wcApp.render();
  });
  Hooks.on("renderChatMessage", (message, html) => {
    html.find(".wc-chat-open").on("click", (ev) => {
      const issueId = ev.currentTarget.dataset.issueId;
      const source = game.user.isGM ? (wcApp || new WorldCodex()).store : game.settings.get(WC_ID, "publicData");
      if (source.issues.some(i => i.id === issueId && (game.user.isGM || i.published))) wcOpen("gazette", issueId);
      else ui.notifications.warn("This edition is no longer published.");
    });
  });
});
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControl = controls.find(c => c.name === "token");
  if (!tokenControl) return;
  tokenControl.tools.push({name:"world-codex-open",title:"World Codex & Gazette",icon:"fas fa-book-open",button:true,onClick:() => wcOpen()});
});
Hooks.on("renderSettings", (app, html) => {
  const target = html.find("#settings-game");
  if (!target.length || target.find(".wc-settings-open").length) return;
  const btn = $(`<button type="button" class="wc-settings-open"><i class="fas fa-book-open"></i> World Codex & Gazette</button>`);
  btn.on("click", () => wcOpen()); target.append(btn);
});
