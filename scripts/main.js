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
// Selected-reader issues live in Foundry JournalEntries with OBSERVER ownership,
// never in the world-wide publicData setting (which every player receives).
const WC_SHARED_ISSUE = "sharedIssueId";
const WC_SHARED_COPY = "sharedIssueData";
const wcReaders = (raw) => Array.isArray(raw) ? [...new Set(raw.filter(id => typeof id === "string" && id.length <= 128))].slice(0, 100) : [];
const wcAudience = (issue) => issue?.audience === "selected" ? "selected" : "all";
const wcPublishedToEveryone = issue => !!issue?.published && wcAudience(issue) === "all";
function wcVisibleJournalIssues() {
  return Array.from(game.journal || []).filter(j => j.getFlag?.(WC_ID, WC_SHARED_ISSUE) &&
    (game.user.isGM || j.testUserPermission?.(game.user, "OBSERVER")))
    .map(j => j.getFlag(WC_ID, WC_SHARED_COPY)).filter(i => i?.published && wcAudience(i) === "selected" &&
      wcReaders(i.allowedUserIds).includes(game.user.id));
}
const wcDateDisplay = (x) => {
  if (!x) return "Undated";
  // A date is author-provided, so retain fantasy calendar strings without reinterpretation.
  return String(x);
};
// Markdown-style horizontal rules work in old plain-text records as well as in rich editor content.
const wcIsDivider = text => /^\s*-{3,}\s*$/.test(String(text ?? ""));
function wcMarkdown(raw) {
  const txt = String(raw ?? "").replace(/\r/g, "");
  if (!txt.trim()) return `<p class="wc-muted">No content yet.</p>`;
  // Preserve paragraph/heading formatting while supporting --- on a line of its own,
  // even when the author didn't add blank lines on either side.
  return txt.split(/\n\s*\n/).flatMap(block => {
    let lines = [];
    const result = [];
    const flush = () => {
      if (!lines.length) return;
      if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
        const level = Math.min(3, lines[0].match(/^#+/)[0].length);
        result.push(`<h${level + 2}>${wcInline(lines[0].replace(/^#{1,3} /, ""))}</h${level + 2}>`);
      } else result.push(`<p>${lines.map(wcInline).join("<br>")}</p>`);
      lines = [];
    };
    for (const line of block.split("\n")) {
      if (wcIsDivider(line)) { flush(); result.push("<hr>"); }
      else lines.push(line);
    }
    flush();
    return result;
  }).join("");
}
function wcInline(s) {
  return wcEsc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}
// Explicit marker distinguishes new rich HTML from older Markdown/plain-text records.
const WC_RICH_PREFIX = "wc-rich-v1:";
const wcWidth = (value) => {
  const n = Number.parseInt(String(value ?? "100"), 10);
  return Number.isFinite(n) ? Math.max(10, Math.min(100, n)) : 100;
};
const wcAlign = (value) => ["left", "center", "right"].includes(value) ? value : "center";
// Safe, bounded offsets for user-positioned pictures. These survive HTML sanitizing,
// import/export, player display and print without accepting arbitrary inline CSS.
const wcOffset = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(Math.min(1200, Math.max(-1200, n))) : 0;
};
function wcSanitizeRich(html) {
  // Never render raw imported HTML. Strip tags/attributes outside this allowlist,
  // including events, arbitrary styles, scripts, iframes and executable URLs.
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const allowed = new Set(["p", "div", "span", "h2", "h3", "h4", "h5", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "br", "hr", "a", "img"]);
  const walk = (node) => {
    if (node.nodeType === 3) return wcEsc(node.nodeValue);
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "svg", "math", "form", "template"].includes(tag)) return "";
    // Existing rich entries containing a standalone --- paragraph also render as dividers.
    if (["p", "div"].includes(tag) && !node.querySelector("img,hr,ul,ol,table") && wcIsDivider(node.textContent)) return "<hr>";
    if (tag === "img") {
      const src = wcImage(node.getAttribute("src"));
      if (!src) return "";
      const width = wcWidth(node.getAttribute("data-wc-width") || node.getAttribute("width") || node.style.width);
      const align = wcAlign(node.getAttribute("data-wc-align"));
      const x = wcOffset(node.getAttribute("data-wc-offset-x"));
      const y = wcOffset(node.getAttribute("data-wc-offset-y"));
      return `<img src="${wcAttr(src)}" alt="${wcAttr(node.getAttribute("alt") || "Illustration")}" data-wc-width="${width}" data-wc-align="${align}" data-wc-offset-x="${x}" data-wc-offset-y="${y}" style="width:${width}%;max-width:100%;height:auto;display:block;margin-left:${align === "left" ? "0" : "auto"};margin-right:${align === "right" ? "0" : "auto"};transform:translate(${x}px,${y}px)">`;
    }
    const children = Array.from(node.childNodes).map(walk).join("");
    if (!allowed.has(tag)) return children;
    if (tag === "a") {
      const href = wcImage(node.getAttribute("href"));
      return href ? `<a href="${wcAttr(href)}" rel="noopener noreferrer">${children}</a>` : children;
    }
    if (["br", "hr"].includes(tag)) return `<${tag}>`;
    return `<${tag}>${children}</${tag}>`;
  };
  return Array.from(doc.body.childNodes).map(walk).join("");
}
function wcContent(raw) {
  const value = String(raw ?? "");
  if (!value.startsWith(WC_RICH_PREFIX)) return wcMarkdown(value);
  const html = wcSanitizeRich(value.slice(WC_RICH_PREFIX.length));
  return html.trim() ? html : `<p class="wc-muted">No content yet.</p>`;
}
function wcEditContent(raw) {
  const value = String(raw ?? "");
  return value.startsWith(WC_RICH_PREFIX) ? wcSanitizeRich(value.slice(WC_RICH_PREFIX.length))
    : value.trim() ? wcMarkdown(value) : "<p></p>";
}
function wcRichField(field, value, label) {
  return `<div class="wc-field wc-wide wc-rich-field"><span>${wcEsc(label)}</span>
    <div class="wc-editor-toolbar" data-wc-editor-tools="${wcAttr(field)}">
    <button type="button" data-wc-format="bold" data-field="${wcAttr(field)}" title="Bold"><b>B</b></button>
    <button type="button" data-wc-format="italic" data-field="${wcAttr(field)}" title="Italic"><em>I</em></button>
    <button type="button" data-wc-format="formatBlock" data-value="p" data-field="${wcAttr(field)}" title="Paragraph">P</button>
    <button type="button" data-wc-format="formatBlock" data-value="h3" data-field="${wcAttr(field)}" title="Heading">H</button>
    <button type="button" data-wc-format="insertUnorderedList" data-field="${wcAttr(field)}" title="Bullet List">${wcIcon("list-ul")}</button>
    <button type="button" data-wc-insert-rule="${wcAttr(field)}" title="Insert horizontal divider">${wcIcon("minus")} Divider</button>
    <button type="button" data-wc-insert-image="${wcAttr(field)}" title="Insert image from Foundry files">${wcIcon("image")} Insert Image</button>
    <button type="button" data-wc-image-url="${wcAttr(field)}" title="Insert image by URL">${wcIcon("link")} Image URL</button>
    </div>
    <div class="wc-editor-shell"><div class="wc-rich-editable" data-wc-rich="${wcAttr(field)}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${wcAttr(label)}">${wcEditContent(value)}</div>
      <div class="wc-image-resize-handle" title="Drag to resize image" hidden></div></div>
    <div class="wc-image-tools" data-wc-image-tools="${wcAttr(field)}" hidden>
      <span>${wcIcon("image")} Selected image</span>
      <label>Size <input type="range" min="10" max="100" step="5" data-wc-image-size="${wcAttr(field)}" value="100"><output>100%</output></label>
      <button type="button" data-wc-image-align="left" title="Align left">${wcIcon("align-left")}</button>
      <button type="button" data-wc-image-align="center" title="Center">${wcIcon("align-center")}</button>
      <button type="button" data-wc-image-align="right" title="Align right">${wcIcon("align-right")}</button>
      <span class="wc-image-position" data-wc-image-position>Position 0, 0</span>
      <button type="button" data-wc-image-reset title="Reset the picture position">${wcIcon("undo")} Reset position</button>
      <button type="button" data-wc-remove-image title="Remove image">${wcIcon("trash")}</button>
    </div>
    <small class="wc-editor-hint">Type --- on a separate line and press Enter to insert a divider, or click Divider. Click and drag an inserted image to position it freely, use the orange corner to resize, or Reset position to return it to the normal text flow. Saved positions appear in newspapers and profiles.</small>
  </div>`;
}
function wcPercentField(field, value, label) {
  return `<label class="wc-field"><span>${wcEsc(label)}</span><input type="number" min="10" max="100" step="5" data-wc-field="${wcAttr(field)}" value="${wcWidth(value)}" title="10–100%"></label>`;
}
function wcTextField(field, value, label, placeholder = "", more = "") {
  return `<label class="wc-field"><span>${wcEsc(label)}</span><input type="text" data-wc-field="${wcAttr(field)}" value="${wcAttr(value)}" placeholder="${wcAttr(placeholder)}" ${more}></label>`;
}
function wcArea(field, value, label, placeholder = "", rows = 6) {
  return `<label class="wc-field wc-wide"><span>${wcEsc(label)}</span><textarea rows="${rows}" data-wc-field="${wcAttr(field)}" placeholder="${wcAttr(placeholder)}">${wcEsc(value)}</textarea></label>`;
}
// Accessible custom menu: native select remains the source of truth but is visually
// hidden so Windows/Firefox and Foundry V11 can't override popup text colors.
function wcDropdown(name, selected, choices, dataset, className = "") {
  const items = choices.length ? choices : [["", "No options yet"]];
  const current = items.find(([value]) => String(value) === String(selected)) || items[0];
  const attrs = dataset === "category" ? "data-wc-category" : `data-wc-field="${wcAttr(name)}"`;
  return `<div class="wc-dropdown ${wcAttr(className)}" data-wc-dropdown>
    <select class="wc-native-select" ${attrs} tabindex="-1" aria-hidden="true">${items.map(([value, text]) => `<option value="${wcAttr(value)}" ${String(value) === String(current[0]) ? "selected" : ""}>${wcEsc(text)}</option>`).join("")}</select>
    <button type="button" class="wc-dropdown-trigger" data-wc-dropdown-trigger aria-haspopup="listbox" aria-expanded="false" aria-label="${wcAttr(name === "category" ? "Filter categories" : name)}"><span class="wc-dropdown-label">${wcEsc(current[1])}</span>${wcIcon("chevron-down")}</button>
    <div class="wc-dropdown-menu" role="listbox" hidden>${items.map(([value, text]) => `<button type="button" role="option" data-wc-dropdown-option="${wcAttr(value)}" aria-selected="${String(value) === String(current[0])}">${wcEsc(text)}</button>`).join("")}</div>
  </div>`;
}
function wcSelect(field, selected, label, choices) {
  return `<div class="wc-field"><span>${wcEsc(label)}</span>${wcDropdown(field, selected, choices, "field")}</div>`;
}
function wcEmpty(icon, title, text, action = "", button = "") {
  return `<section class="wc-empty"><div class="wc-empty-icon">${wcIcon(icon)}</div><h2>${wcEsc(title)}</h2><p>${wcEsc(text)}</p>${action ? wcBtn(action, button, "plus", "wc-primary") : ""}</section>`;
}
function wcFigure(src, alt, cls = "") {
  const valid = wcImage(src);
  return valid ? `<img class="${wcAttr(cls)}" src="${wcAttr(valid)}" alt="${wcAttr(alt)}" loading="lazy">` : `<div class="wc-art-empty ${wcAttr(cls)}">${wcIcon("book-open")}</div>`;
}
// Freeform newspaper pages are stored as positioned, bounded blocks (percentages
// rather than pixels) so player view and printable export use the same layout.
const wcCanvasNumber = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(max, Math.max(min, number)) * 10) / 10 : fallback;
};
const wcCanvasTypes = new Set(["text", "image", "rule"]);
function wcCanvasCleanBlock(raw = {}) {
  const type = wcCanvasTypes.has(raw.type) ? raw.type : "text";
  const w = wcCanvasNumber(raw.w, 44, 8, 100);
  const h = wcCanvasNumber(raw.h, type === "rule" ? 3 : 24, 3, 100);
  const x = wcCanvasNumber(raw.x, 4, 0, 100 - w);
  const y = wcCanvasNumber(raw.y, 4, 0, 100 - h);
  return {
    id: String(raw.id || wcId()).slice(0, 80), type, x, y, w, h,
    z: wcCanvasNumber(raw.z, 1, 0, 999),
    html: String(raw.html || "").slice(0, 120000),
    src: wcImage(raw.src),
    fit: raw.fit === "cover" ? "cover" : "contain",
    size: wcCanvasNumber(raw.size, type === "text" ? 15 : 13, 9, 52),
    align: ["left", "center", "right"].includes(raw.align) ? raw.align : "left"
  };
}
function wcCanvasClean(raw) {
  if (!raw || typeof raw !== "object") return null;
  return { enabled: !!raw.enabled,
    blocks: (Array.isArray(raw.blocks) ? raw.blocks : []).slice(0, 180).map(wcCanvasCleanBlock) };
}
function wcCanvasBlockHTML(block, editable = false, selected = false) {
  const b = wcCanvasCleanBlock(block);
  const coordinates = `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;z-index:${b.z}`;
  const controls = editable ? `<div class="wc-canvas-drag" title="Drag to move block" data-wc-canvas-drag>${wcIcon("grip-lines")} <span>${b.type === "text" ? "Text" : b.type === "image" ? "Image" : "Divider"}</span></div>
    <span class="wc-canvas-size-handle" title="Drag to resize" data-wc-canvas-resize></span>` : "";
  const body = b.type === "image" ? (b.src ? `<img src="${wcAttr(b.src)}" alt="Newspaper picture" draggable="false" style="object-fit:${b.fit}">` : '<span class="wc-canvas-missing">Choose an image</span>')
    : b.type === "rule" ? `<hr>`
    : `<div class="wc-canvas-text" style="font-size:${b.size}px;text-align:${b.align}" ${editable ? 'tabindex="0" title="Select to edit text in the large editor on the right"' : ""}>${wcContent(b.html)}</div>`;
  return `<div class="wc-canvas-block wc-canvas-${b.type} ${selected ? "wc-canvas-selected" : ""}" data-wc-canvas-block="${wcAttr(b.id)}" style="${coordinates}">${controls}<div class="wc-canvas-block-body">${body}</div></div>`;
}
function wcPaperCanvas(canvas, editable = false, selectedId = null) {
  return `<div class="wc-paper-canvas ${editable ? "wc-canvas-editing" : ""}" data-wc-canvas="true">${(canvas?.blocks || []).map(b => wcCanvasBlockHTML(b, editable, b.id === selectedId)).join("")}</div>`;
}
function wcInitialPageCanvas(page, issue, isCover) {
  // Conversion is nondestructive and avoids placing images over story text.
  // Existing article data remains available under Use Classic Layout.
  const blocks = [];
  const coverPhoto = isCover && wcImage(issue?.coverImage);
  if (coverPhoto) blocks.push(wcCanvasCleanBlock({
    id:wcId(),type:"image",src:issue.coverImage,x:10,y:3,w:80,h:24,z:1
  }));
  const articles = page.articles || [];
  const top = coverPhoto ? 32 : 5;
  const available = Math.max(16, 94-top);
  const slot = Math.min(34, available / Math.max(1, articles.length));
  articles.forEach((a,index) => {
    const y=Math.min(94, top + index*slot);
    const h=Math.max(4,Math.min(slot-3,94-y));
    const picture=wcImage(a.image);
    const heading=`<h3>${wcEsc(a.headline || "Untitled Article")}</h3>`;
    const meta=`${a.kicker ? `<h5>${wcEsc(a.kicker)}</h5>` : ""}${a.byline ? `<p><em>${wcEsc(a.byline)}</em></p>` : ""}`;
    blocks.push(wcCanvasCleanBlock({id:wcId(),type:"text",x:4,y,w:picture ? 52 : 92,h,
      html:WC_RICH_PREFIX+heading+meta+wcContent(a.body),size:14}));
    if (picture) blocks.push(wcCanvasCleanBlock({id:wcId(),type:"image",x:60,y,w:36,h,src:picture,z:2}));
  });
  return {enabled:true,blocks};
}
function wcPaperArticle(article = {}) {
  const style = ["lead", "standard", "notice"].includes(article.layout) ? article.layout : "standard";
  const picture = wcImage(article.image);
  const pictureHTML = picture ? `<figure class="wc-article-figure">${wcFigure(picture, article.headline, "wc-article-photo").replace("<img ", `<img style="width:${wcWidth(article.imageWidth)}%" `)}${article.caption ? `<figcaption>${wcEsc(article.caption)}</figcaption>` : ""}</figure>` : "";
  return `<article class="wc-paper-story wc-story-${style}">
    ${article.kicker ? `<div class="wc-story-kicker">${wcEsc(article.kicker)}</div>` : ""}
    <h3>${wcEsc(article.headline || "Untitled Article")}</h3>
    ${article.byline ? `<div class="wc-story-byline">BY ${wcEsc(article.byline)}</div>` : ""}
    ${pictureHTML}
    <div class="wc-story-copy">${wcContent(article.body)}</div>
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
    ${cover && wcImage(issue.coverImage) && !page.canvas?.enabled ? `<figure class="wc-paper-cover">${wcFigure(issue.coverImage, issue.title).replace("<img ", `<img style="width:${wcWidth(issue.coverWidth)}%" `)}</figure>` : ""}
    ${page.canvas?.enabled ? wcPaperCanvas(page.canvas) : `<div class="wc-paper-articles">${articles.map(wcPaperArticle).join("") || `<p class="wc-paper-empty">No articles on this page yet.</p>`}</div>`}
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
    name: String(e.name || "Untitled"), subtitle: String(e.subtitle || ""), image: wcImage(e.image), imageWidth: wcWidth(e.imageWidth),
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
    coverImage: wcImage(issue.coverImage), coverWidth: wcWidth(issue.coverWidth), published: !!issue.published,
    audience: wcAudience(issue), allowedUserIds: wcReaders(issue.allowedUserIds),
    pages: (Array.isArray(issue.pages) ? issue.pages : []).slice(0, 100).map(page => ({
      id: String(page.id || wcId()), title: String(page.title || ""), canvas: wcCanvasClean(page.canvas),
      articles: (Array.isArray(page.articles) ? page.articles : []).slice(0, 100).map(a => ({
        id: String(a.id || wcId()), headline: String(a.headline || ""), kicker: String(a.kicker || ""),
        byline: String(a.byline || ""), body: String(a.body || ""), image: wcImage(a.image), imageWidth: wcWidth(a.imageWidth),
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
    this.collapsedGroups = new Set();
    this._dragEntryId = null;
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
    if (!this.isGM) {
      const publicCopy = wcClone(game.settings.get(WC_ID, "publicData") || WC_DEFAULT());
      const restricted = wcVisibleJournalIssues();
      publicCopy.issues = [...(publicCopy.issues || []), ...restricted.filter(i => !publicCopy.issues.some(j => j.id === i.id))];
      return publicCopy;
    }
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
    const isDesign = this.tab === "gazette" && this.view === "page-designer" && this.isGM;
    return `${rootHeader}<div class="wc-body ${isDesign ? "wc-body-design" : ""}">${!isDesign ? `<aside class="wc-sidebar">${this.tab === "codex" ? this._codexSidebar(data) : this._gazetteSidebar(data)}</aside>` : ""}<main class="wc-content">${this.tab === "codex" ? this._codexMain(data) : this._gazetteMain(data)}</main></div>`;
  }
  _codexSidebar(data) {
    const categories = data.categories || [];
    const entries = (data.entries || []).filter(x => this.isGM || x.visibility === "players");
    const filtered = entries.filter(e => (this.categoryFilter === "all" || e.categoryId === this.categoryFilter) &&
      `${e.name} ${e.subtitle} ${e.summary} ${(e.tags || []).join(" ")}`.toLowerCase().includes(this.query.toLowerCase()));
    const entryRow = e => {
      const c = categories.find(c => c.id === e.categoryId);
      return `<button type="button" class="wc-entry-row ${e.id === this.entryId ? "wc-active" : ""}" data-wc-action="select-entry" data-id="${wcAttr(e.id)}" ${this.isGM ? `draggable="true" data-wc-entry-drag="${wcAttr(e.id)}" title="Drag to move ${wcAttr(e.name)} to another category"` : ""}>
        ${this.isGM ? `<span class="wc-grip" aria-hidden="true">${wcIcon("grip-vertical")}</span>` : ""}${wcFigure(e.image, e.name, "wc-thumb")}
        <span class="wc-row-meta"><strong>${wcEsc(e.name)}</strong><small>${wcEsc(e.subtitle)}</small><em>${wcEsc(c?.name || "Uncategorized")}</em></span>${this.isGM && e.visibility !== "players" ? wcIcon("lock") : wcIcon("chevron-right")}</button>`;
    };
    // In All Categories, preserve the DM's category ordering and group records
    // under distinct headers. Orphan entries remain accessible as Uncategorized.
    const groups = this.categoryFilter === "all"
      ? [...categories.map(c => ({id:c.id, name:c.name, color:wcColor(c.color), entries:filtered.filter(e => e.categoryId === c.id)})),
        {id:"", name:"Uncategorized", color:"#8995a7", entries:filtered.filter(e => !categories.some(c => c.id === e.categoryId))}]
        .filter(g => g.entries.length || (this.isGM && g.id))
      : [];
    const items = this.categoryFilter === "all"
      ? groups.map(g => `<section class="wc-entry-group" style="--wc-group-accent:${g.color}">
        <button type="button" class="wc-group-heading" data-wc-group-toggle="${wcAttr(g.id)}" ${this.isGM ? `data-wc-drop-category="${wcAttr(g.id)}"` : ""} aria-expanded="${!this.collapsedGroups?.has(g.id)}" title="${this.isGM ? `Drop an entry here to move it into ${wcAttr(g.name)}; ` : ""}Toggle ${wcAttr(g.name)}">
          ${wcIcon(this.collapsedGroups?.has(g.id) ? "chevron-right" : "chevron-down")}
          <span>${wcEsc(g.name)}</span><b>${g.entries.length}</b></button>
        <div class="wc-group-entries" ${this.collapsedGroups?.has(g.id) ? "hidden" : ""}>${g.entries.map(entryRow).join("")}${this.isGM && !g.entries.length ? `<div class="wc-group-drop-hint">Drop an entry here</div>` : ""}</div>
      </section>`).join("")
      : filtered.map(entryRow).join("");
    return `<div class="wc-sidebar-heading"><span class="wc-kicker">WORLD ENCYCLOPEDIA</span><div class="wc-sidebar-title"><h2>${wcIcon("book")} Codex</h2>${this.isGM ? wcBtn("new-entry", "", "plus", "wc-icon-button") : ""}</div></div>
      <label class="wc-search">${wcIcon("search")}<input data-wc-search type="search" placeholder="Search names, history, tags..." value="${wcAttr(this.query)}"></label>
      ${wcDropdown("category", this.categoryFilter, [["all", "All Categories"], ...categories.map(c => [c.id, c.name])], "category", "wc-category-dropdown")}
      <div class="wc-count"><span>ENTRIES</span><b>${filtered.length} / ${entries.length}</b></div>
      ${this.isGM && this.categoryFilter === "all" && categories.length > 1 ? `<p class="wc-drag-hint">${wcIcon("arrows-alt")} Drag a record onto another category heading to move it.</p>` : ""}
      <div class="wc-list">${items || `<div class="wc-list-empty">${wcIcon("inbox")}<p>No matching entries</p></div>`}</div>
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
        <div class="wc-profile-art">${wcFigure(entry.image, entry.name).replace("<img ", `<img style="width:${wcWidth(entry.imageWidth)}%" `)}${wcImage(entry.image) ? `<div class="wc-image-actions">${wcBtn("open-entry-image", "View Art", "image")}</div>` : ""}</div>
        <div class="wc-profile-overview"><div class="wc-kicker">${wcEsc(category?.name || "UNCATEGORIZED")} ${entry.visibility === "gm" && this.isGM ? "◆ GM ONLY" : "◆ PUBLIC"}</div><h1>${wcEsc(entry.name)}</h1>
        <h3>${wcEsc(entry.subtitle || "World Record")}</h3>
        <div class="wc-pill-group">${(entry.tags || []).map(t => `<span class="wc-pill">${wcEsc(t)}</span>`).join("")}</div>
        ${this.isGM ? `<div class="wc-toolbar">${wcBtn("edit-entry", "Edit", "pen", "wc-primary")}${wcBtn("duplicate-entry", "Duplicate", "copy")}${entry.visibility === "players" ? wcBtn("show-entry", "Show Players", "users") : ""}${wcBtn("delete-entry", "", "trash", "wc-danger")}</div>` : ""}</div>
      </div>
      <div class="wc-profile-reading">${entry.summary ? `<div class="wc-summary">${wcContent(entry.summary)}</div>` : ""}
      <h2>History & Details</h2><div class="wc-rich-text">${wcContent(entry.body)}</div>
      ${(entry.fields || []).length ? `<div class="wc-profile-fields"><h2>Additional Information</h2><div class="wc-detail-grid">${entry.fields.filter(f => f.label || f.value).map(f => `<div class="wc-detail"><span>${wcEsc(f.label)}</span><strong>${wcEsc(f.value)}</strong></div>`).join("")}</div></div>` : ""}
      </div></section>`;
  }
  _categoriesView(data) {
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">ORGANIZE YOUR WORLD</div><h1>Categories</h1><p>Create your own categories. No fixed types or presets.</p></div>${wcBtn("new-category", "New Category", "plus", "wc-primary")}</div>
      <div class="wc-categories-grid">${data.categories.map(c => `<div class="wc-cat-card" data-wc-drop-category="${wcAttr(c.id)}" style="--wc-cat:${wcColor(c.color)}" title="Drop Codex entries here to change their category"><div class="wc-cat-mark">${wcIcon("bookmark")}</div><h3>${wcEsc(c.name)}</h3><p>${wcEsc(c.description || "Custom category")}</p><small>${data.entries.filter(e => e.categoryId === c.id).length} entries</small><div>${wcBtn("edit-category", "Edit", "pen", "", `data-id="${wcAttr(c.id)}"`)}${wcBtn("delete-category", "Delete", "trash", "wc-danger", `data-id="${wcAttr(c.id)}"`)}</div></div>`).join("") || `<div class="wc-wide">${wcEmpty("layer-group", "No categories yet", "Create a category such as Cities, NPCs, PCs, or anything you like.", "new-category", "Create Category")}</div>`}</div>
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
    ${wcPercentField("imageWidth", d.imageWidth, "Main Artwork Size (%)")}
    ${wcTextField("tags", (d.tags || []).join(", "), "Tags (comma separated)", "Capital, Trade, Political")}
    ${wcRichField("summary", d.summary, "Featured Summary")}
    ${wcRichField("body", d.body, "History, Lore & Description")}</div>
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
    if (this.view === "page-designer" && this.isGM) return this._pageDesigner(data);
    if (this.view === "article-form" && this.isGM) return this._articleForm();
    const issue = data.issues.find(i => i.id === this.issueId && (this.isGM || i.published));
    if (!issue) return wcEmpty("newspaper", "Build your own newspaper", this.isGM ? "Create an edition, add pages and articles, place illustrations and maps, then publish it for your players." : "The newspaper archive is empty. Published editions will appear here.", this.isGM ? "new-issue" : "", "Create First Issue");
    const pageIndex = Math.max(0, issue.pages.findIndex(p => p.id === this.pageId));
    const page = issue.pages[pageIndex];
    return `<section class="wc-gazette-reading"><div class="wc-issue-controls"><div><div class="wc-kicker">${wcEsc(issue.edition || "NEWSPAPER EDITION")}</div><h2>${wcEsc(issue.title)}</h2><small>${wcEsc(issue.date || "No date")} · ${issue.pages.length} page${issue.pages.length === 1 ? "" : "s"} · ${issue.published ? "Published" : "Draft"}</small></div>
       <div class="wc-toolbar">${this.isGM ? `${wcBtn("edit-issue", "Edit Issue", "pen")}${wcBtn("issue-permissions", "Permissions", "user-shield")}${wcBtn("toggle-publish", issue.published ? "Unpublish" : "Publish", issue.published ? "eye-slash" : "check-circle", issue.published ? "" : "wc-primary")}${issue.published ? wcBtn("share-issue", "Show Players", "users") : ""}${wcBtn("announce-issue", "Chat Notice", "comment", "", issue.published ? "" : "disabled")}${wcBtn("delete-issue", "", "trash", "wc-danger")}` : ""}${wcBtn("print-issue", "Print", "print")}${wcBtn("export-html", "HTML", "file-code")}</div>
     </div>
     <div class="wc-page-switcher"><span>PAGES</span>${issue.pages.map((p, i) => `<button type="button" class="wc-page-tab ${i === pageIndex ? "wc-selected" : ""}" data-wc-action="select-page" data-id="${wcAttr(p.id)}">${i + 1}. ${wcEsc(p.title || `Page ${i + 1}`)}</button>`).join("")}${this.isGM ? wcBtn("add-page", "", "plus", "wc-icon-button") : ""}</div>
     ${this.isGM ? `<div class="wc-page-actions">${wcBtn("design-page", "Design Page", "object-group", "wc-primary")}${wcBtn("rename-page", "Page Settings", "pen")}${wcBtn("add-article", "Add Article", "plus")}${pageIndex > 0 ? wcBtn("page-left", "Move Left", "arrow-left") : ""}${pageIndex < issue.pages.length - 1 ? wcBtn("page-right", "Move Right", "arrow-right") : ""}${issue.pages.length > 1 ? wcBtn("delete-page", "Delete Page", "trash", "wc-danger") : ""}</div>` : ""}
     <div class="wc-paper-view">${wcPaperPage(issue, page, pageIndex)}</div>
     ${this.isGM ? `<div class="wc-article-manager"><div class="wc-section-heading"><h3>Articles on this Page</h3><span>${page.articles.length} story${page.articles.length === 1 ? "" : "ies"}</span>${page.canvas?.enabled ? `<small>Canvas layout is active. Original articles remain as backup.</small>` : ""}</div>
      ${page.articles.map((a, i) => `<div class="wc-article-row"><span class="wc-article-number">${i + 1}</span><span class="wc-row-meta"><strong>${wcEsc(a.headline || "Untitled Article")}</strong><small>${wcEsc(a.kicker || a.layout || "Story")}</small></span>${wcBtn("edit-article", "Edit", "pen", "", `data-id="${wcAttr(a.id)}"`)}${i ? wcBtn("article-up", "↑", "", "wc-tight", `data-id="${wcAttr(a.id)}"`) : ""}${i < page.articles.length - 1 ? wcBtn("article-down", "↓", "", "wc-tight", `data-id="${wcAttr(a.id)}"`) : ""}${wcBtn("delete-article", "", "trash", "wc-danger", `data-id="${wcAttr(a.id)}"`)}</div>`).join("") || `<p class="wc-muted">Add your first article to start filling this page.</p>`}</div>` : ""}</section>`;
  }
  _pageDesigner(data) {
    const issue = this._issue(data);
    const page = this._page(issue);
    if (!issue || !page || !this.draft?.canvas) return wcEmpty("newspaper", "Page not available", "Return to the newspaper and choose a page.");
    const canvas = this.draft.canvas;
    const index = issue.pages.indexOf(page);
    const current = canvas.blocks.find(b => b.id === this._canvasSelectedId);
    this._inspectorForId = current?.id || null;
    const items = wcPaperCanvas(canvas, true, this._canvasSelectedId);
    const pageMarkup = `<div class="wc-paper wc-paper-${wcAttr(issue.theme)} wc-designer-paper">
      <div class="wc-paper-topline"><span>${wcEsc(issue.edition || "SPECIAL EDITION")}</span><span>${wcEsc(wcDateDisplay(issue.date))}</span><span>${wcEsc(issue.price || "FREE")}</span></div>
      <header class="wc-paper-masthead"><h1>${wcEsc(issue.paperName)}</h1>${issue.motto ? `<p>${wcEsc(issue.motto)}</p>` : ""}</header>
      ${index === 0 ? `<div class="wc-paper-banner"><span>${wcEsc(issue.kicker || "LATEST NEWS")}</span><h2>${wcEsc(issue.title)}</h2>${issue.subtitle ? `<p>${wcEsc(issue.subtitle)}</p>` : ""}</div>` : `<div class="wc-paper-section"><h2>${wcEsc(page.title || `Page ${index+1}`)}</h2></div>`}
      ${items}<footer class="wc-paper-footer"><span>${wcEsc(issue.paperName)}</span><span>${wcEsc(issue.edition || "")}</span><span>PAGE ${index+1} / ${issue.pages.length}</span></footer>
    </div>`;
    return `<section class="wc-designer">
      <div class="wc-designer-header"><div><div class="wc-kicker">LIVE PAGE DESIGNER</div><h2>${wcEsc(page.title || `Page ${index+1}`)}</h2><p>Click a text block to write comfortably in the large editor on the right. Drag the blue handle to move an element and the orange corner to resize it.</p></div>
      <div class="wc-toolbar">${wcBtn("save-canvas", "Save Page", "save", "wc-primary")}${wcBtn("cancel-canvas", "Cancel", "times")}</div></div>
      <div class="wc-designer-toolbar">${wcBtn("canvas-add-heading", "Heading", "heading")}${wcBtn("canvas-add-text", "Text", "font")}${wcBtn("canvas-add-image", "Image", "image")}${wcBtn("canvas-add-url", "Image URL", "link")}${wcBtn("canvas-add-rule", "Divider", "minus")}</div>
      <div class="wc-designer-workspace"><div class="wc-designer-stage"><div class="wc-designer-stage-caption">${wcIcon("expand")} Full-size page preview · Select a block to edit</div>${pageMarkup}</div>
       <aside class="wc-designer-inspector"><h3>Selected element</h3>
       ${current ? `<strong>${current.type === "image" ? "Image" : current.type === "rule" ? "Divider" : "Text Block"}</strong>
       <div class="wc-inspector-grid"><label>X (%)<input type="number" min="0" max="100" step="0.5" data-wc-canvas-coordinate="x" value="${current.x}"></label>
       <label>Y (%)<input type="number" min="0" max="100" step="0.5" data-wc-canvas-coordinate="y" value="${current.y}"></label>
       <label>Width (%)<input type="number" min="8" max="100" step="0.5" data-wc-canvas-coordinate="w" value="${current.w}"></label>
       <label>Height (%)<input type="number" min="3" max="100" step="0.5" data-wc-canvas-coordinate="h" value="${current.h}"></label></div>
       ${current.type === "text" ? `<div class="wc-compose-wrap"><label for="wc-page-compose">WRITE YOUR TEXT HERE</label>
       <div id="wc-page-compose" class="wc-page-compose" data-wc-canvas-compose contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true">${wcEditContent(current.html)}</div>
       <p class="wc-compose-hint">The text updates on the page while you type. The block can still be moved and resized separately.</p></div>
       <label class="wc-inspector-full">Text size <input data-wc-canvas-prop="size" type="number" min="9" max="52" value="${current.size}"></label>
       <label class="wc-inspector-full">Align <select data-wc-canvas-prop="align"><option value="left" ${current.align === "left" ? "selected" : ""}>Left</option><option value="center" ${current.align === "center" ? "selected" : ""}>Center</option><option value="right" ${current.align === "right" ? "selected" : ""}>Right</option></select></label>
       <div class="wc-designer-format"><button type="button" data-wc-canvas-format="bold" title="Bold"><b>B</b></button><button type="button" data-wc-canvas-format="italic" title="Italic"><em>I</em></button><button type="button" data-wc-canvas-format="formatBlock" data-value="h3" title="Heading">H</button><button type="button" data-wc-canvas-format="insertUnorderedList" title="Bullets">${wcIcon("list-ul")}</button><button type="button" data-wc-canvas-format="insertHorizontalRule" title="Divider">${wcIcon("minus")}</button></div>` : ""}
       ${current.type === "image" ? `<label class="wc-inspector-full">Fit <select data-wc-canvas-prop="fit"><option value="contain" ${current.fit === "contain" ? "selected" : ""}>Contain (whole image)</option><option value="cover" ${current.fit === "cover" ? "selected" : ""}>Cover (crop)</option></select></label>${wcBtn("canvas-replace-image", "Replace Picture", "image")}` : ""}
       <div class="wc-inspector-actions">${wcBtn("canvas-bring-front", "To Front", "layer-group")}${wcBtn("canvas-send-back", "To Back", "clone")}${wcBtn("canvas-duplicate", "Duplicate", "copy")}${wcBtn("canvas-delete", "Delete", "trash", "wc-danger")}</div>`
       : `<p class="wc-muted">Click a block on the page to edit it here. Text editing is kept separate from dragging so you can write normally.</p>`}
       <hr><h3>Layout mode</h3><p class="wc-muted">The canvas replaces the classic article grid when you save. Your original articles remain stored.</p>
       ${wcBtn("canvas-classic", "Use Classic Layout", "columns", "", canvas.enabled ? "" : "disabled")}
       </aside></div><p class="wc-designer-footnote">The design is saved to this page only. The player view, PDF print, and HTML export use the same positions.</p>
    </section>`;
  }
  _issueForm() {
    const d = this.draft;
    return `<section class="wc-edit-wrap"><div class="wc-edit-top"><div><div class="wc-kicker">NEWSPAPER EDITOR</div><h1>${this.editedId ? "Edit Newspaper Issue" : "Create an Issue"}</h1><p>Choose the masthead, edition details and visual theme.</p></div></div>
     <div class="wc-form-grid">${wcTextField("paperName", d.paperName, "Newspaper Name", "Izmet Times")}${wcTextField("motto", d.motto, "Masthead Motto", "The voice of the Empire")}
     ${wcTextField("title", d.title, "Front Page Headline", "A Continent Has Vanished!")}${wcTextField("subtitle", d.subtitle, "Front Page Subheadline", "Witnesses report an impossible event...")}
     ${wcTextField("date", d.date, "In-World Date", "06/06/602")}${wcTextField("edition", d.edition, "Edition Label", "VOL. 3 • SPECIAL")}
     ${wcTextField("price", d.price, "Price / Status", "2 CP / FREE")}${wcTextField("kicker", d.kicker, "Topline", "BREAKING NEWS")}
     ${wcSelect("theme", d.theme, "Paper Theme", [["parchment", "Aged Parchment"], ["ivory", "Classic Ivory"], ["noir", "Midnight Press"]])}
     <div class="wc-media-field">${wcTextField("coverImage", d.coverImage, "Front Cover Image (optional)", "worlds/my-world/art/map.webp")}${wcBtn("pick-image", "Browse", "image", "", 'data-field="coverImage"')}</div>
     ${wcPercentField("coverWidth", d.coverWidth, "Cover Image Size (%)")}</div>
     <div class="wc-newspaper-permissions"><h3>${wcIcon("user-shield")} Newspaper Permissions</h3>
       <p>Only published editions can be read by players. Restrict this edition to specific Foundry users, or share with everyone.</p>
       ${wcSelect("audience", wcAudience(d), "Who can read this newspaper?", [["all","All Players"],["selected","Selected Players Only"]])}
       <div class="wc-permission-users" data-wc-audience-users ${wcAudience(d) !== "selected" ? "hidden" : ""}>
       ${Array.from(game.users || []).filter(u => !u.isGM).map(u => `<label class="wc-permission-user"><input type="checkbox" data-wc-issue-reader="${wcAttr(u.id)}" ${wcReaders(d.allowedUserIds).includes(u.id) ? "checked" : ""}><span>${wcEsc(u.name)}</span></label>`).join("") || `<p class="wc-muted">Create player accounts in Foundry to assign permissions.</p>`}
       </div><small>Selected editions use Foundry Journal ownership so their content is not copied into public world settings. Players have read-only access.</small>
     </div>
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
     ${wcRichField("body", d.body, "Article Text & Images")}
     <div class="wc-media-field">${wcTextField("image", d.image, "Illustration / Map Path", "worlds/my-world/art/image.webp")}${wcBtn("pick-image", "Browse", "image", "", 'data-field="image"')}</div>
     ${wcPercentField("imageWidth", d.imageWidth, "Illustration Size (%)")}
     ${wcTextField("caption", d.caption, "Image Caption", "The missing continent, as last mapped")}</div>
     <div class="wc-edit-bottom">${wcBtn("save-article", "Save Article", "save", "wc-primary")}${wcBtn("back", "Cancel", "times")}</div></section>`;
  }
  _restoreRichCaret(editor, field) {
    const saved = this._richCaret?.field === field ? this._richCaret.range : null;
    const selection = window.getSelection();
    if (saved && editor.contains(saved.commonAncestorContainer)) {
      selection.removeAllRanges(); selection.addRange(saved);
      return saved;
    }
    const range = document.createRange();
    range.selectNodeContents(editor); range.collapse(false);
    selection.removeAllRanges(); selection.addRange(range);
    return range;
  }
  _insertDivider(editor, replaceMarkdown = false) {
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    let block = range.startContainer;
    while (block && block.parentNode !== editor) block = block.parentNode;
    const hr = document.createElement("hr");
    const next = document.createElement("p");
    if (replaceMarkdown) {
      // Enter after --- transforms that entire line without affecting neighbors.
      if (!block || block === editor || !wcIsDivider(block.textContent)) return;
      next.appendChild(document.createElement("br"));
      block.replaceWith(hr, next);
    } else if (block && block !== editor && block.nodeType === 1 && /^(P|DIV|H2|H3|H4|H5)$/.test(block.tagName)) {
      // A toolbar rule splits the current paragraph at the caret, so we do not
      // end up storing invalid <p><hr> nesting or deleting neighboring text.
      const after = range.cloneRange();
      after.selectNodeContents(block);
      after.setStart(range.startContainer, range.startOffset);
      next.appendChild(after.extractContents());
      if (!next.textContent.trim() && !next.querySelector("img")) next.replaceChildren(document.createElement("br"));
      block.after(hr, next);
      if (!block.textContent.trim() && !block.querySelector("img")) block.remove();
    } else if (block && block !== editor) {
      // When editing inside lists/quotes, insert after that top-level block.
      next.appendChild(document.createElement("br"));
      block.after(hr, next);
    } else {
      range.deleteContents();
      next.appendChild(document.createElement("br"));
      range.insertNode(next); range.insertNode(hr);
    }
    const caret = document.createRange();
    caret.setStart(next, 0); caret.collapse(true);
    selection.removeAllRanges(); selection.addRange(caret);
    this._syncRich(editor); this._rememberCaret(editor);
    this._chooseImage(null);
  }
  _closeDropdowns(except = null) {
    this.element?.find?.("[data-wc-dropdown]")?.each?.((_, el) => {
      if (el === except) return;
      el.classList.remove("wc-open");
      const menu = el.querySelector(".wc-dropdown-menu");
      if (menu) menu.hidden = true;
      el.querySelector("[data-wc-dropdown-trigger]")?.setAttribute("aria-expanded", "false");
    });
  }
  _syncRich(element) {
    if (!this.draft || !element) return;
    const field = element.dataset.wcRich;
    if (!field || !["body", "summary"].includes(field)) return;
    this.draft[field] = WC_RICH_PREFIX + wcSanitizeRich(element.innerHTML);
  }
  _syncAllRich() {
    this.element?.find?.("[data-wc-rich]")?.each?.((_, element) => this._syncRich(element));
  }
  _rememberCaret(editor) {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
      this._richCaret = {field:editor.dataset.wcRich, range:selection.getRangeAt(0).cloneRange()};
    }
  }
  _editorFor(field) { return this.element?.find?.(`[data-wc-rich="${field}"]`)?.[0] || null; }
  _insertRichImage(path, field) {
    const url = wcImage(path);
    const editor = this._editorFor(field);
    if (!url || !editor || !this.draft) return;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    const saved = this._richCaret?.field === field ? this._richCaret.range : null;
    if (saved && editor.contains(saved.commonAncestorContainer)) {
      range.setStart(saved.startContainer, saved.startOffset);
      range.setEnd(saved.endContainer, saved.endOffset);
    } else { range.selectNodeContents(editor); range.collapse(false); }
    range.deleteContents();
    const img = document.createElement("img");
    img.src = url; img.alt = "Illustration";
    img.dataset.wcWidth = "70"; img.dataset.wcAlign = "center";
    img.dataset.wcOffsetX = "0"; img.dataset.wcOffsetY = "0";
    this._applyImageStyle(img);
    range.insertNode(img);
    range.setStartAfter(img); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    this._syncRich(editor);
    this._chooseImage(img);
  }
  _applyImageStyle(img) {
    const width = wcWidth(img.dataset.wcWidth);
    const align = wcAlign(img.dataset.wcAlign);
    img.dataset.wcWidth = String(width);
    img.dataset.wcAlign = align;
    img.style.width = `${width}%`;
    img.style.maxWidth = "100%"; img.style.height = "auto"; img.style.display = "block";
    img.style.marginLeft = align === "left" ? "0" : "auto";
    img.style.marginRight = align === "right" ? "0" : "auto";
    const x = wcOffset(img.dataset.wcOffsetX);
    const y = wcOffset(img.dataset.wcOffsetY);
    img.dataset.wcOffsetX = String(x);
    img.dataset.wcOffsetY = String(y);
    img.style.transform = `translate(${x}px, ${y}px)`;
  }
  _setImagePosition(img, x, y) {
    if (!img?.isConnected) return;
    img.dataset.wcOffsetX = String(wcOffset(x));
    img.dataset.wcOffsetY = String(wcOffset(y));
    this._applyImageStyle(img);
    this._positionHandle();
    const editor = img.closest("[data-wc-rich]");
    const tools = this.element?.find?.(`[data-wc-image-tools="${editor?.dataset.wcRich}"]`);
    tools?.find("[data-wc-image-position]").text(`Position ${img.dataset.wcOffsetX}, ${img.dataset.wcOffsetY}`);
    this._syncRich(editor);
  }
  _chooseImage(img) {
    this.element?.find?.(".wc-rich-editable img.wc-image-selected")?.removeClass("wc-image-selected");
    this._selectedImage = img || null;
    this.element?.find?.(".wc-image-tools")?.attr("hidden", true);
    this.element?.find?.(".wc-image-resize-handle")?.attr("hidden", true);
    if (!img || !img.isConnected) return;
    img.classList.add("wc-image-selected");
    const field = img.closest("[data-wc-rich]")?.dataset.wcRich;
    const tools = this.element?.find?.(`[data-wc-image-tools="${field}"]`);
    tools?.removeAttr("hidden");
    tools?.find("[data-wc-image-size]").val(wcWidth(img.dataset.wcWidth));
    tools?.find("output").text(`${wcWidth(img.dataset.wcWidth)}%`);
    tools?.find("[data-wc-image-position]").text(`Position ${wcOffset(img.dataset.wcOffsetX)}, ${wcOffset(img.dataset.wcOffsetY)}`);
    this._positionHandle();
  }
  _positionHandle() {
    const img = this._selectedImage;
    if (!img?.isConnected) return;
    const shell = img.closest(".wc-editor-shell");
    const handle = shell?.querySelector(".wc-image-resize-handle");
    if (!handle) return;
    const rect = img.getBoundingClientRect();
    const parent = shell.getBoundingClientRect();
    handle.style.left = `${rect.right - parent.left - 8}px`;
    handle.style.top = `${rect.bottom - parent.top - 8}px`;
    handle.hidden = false;
  }
  _setImageSize(value) {
    const img = this._selectedImage;
    if (!img?.isConnected) return;
    img.dataset.wcWidth = String(wcWidth(value));
    this._applyImageStyle(img);
    const editor = img.closest("[data-wc-rich]");
    const tools = this.element.find(`[data-wc-image-tools="${editor.dataset.wcRich}"]`);
    tools.find("[data-wc-image-size]").val(wcWidth(value));
    tools.find("output").text(`${wcWidth(value)}%`);
    this._positionHandle(); this._syncRich(editor);
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", "[data-wc-action]", (ev) => { ev.preventDefault(); this._onAction(ev).catch(e => this._error(e)); });
    // Direct page editing: selection / text editing / precise fields.
    html.on("pointerdown", "[data-wc-canvas-block]", ev => {
      if (this.view !== "page-designer" || !this.isGM) return;
      const node=ev.currentTarget;
      const id=node.dataset.wcCanvasBlock;
      if (id !== this._canvasSelectedId) {this._selectCanvasBlock(id);}
    });
    // Write in a comfortably sized, independent editor; update page preview
    // live without replacing the editor DOM or disturbing the typing caret.
    html.on("keydown", "[data-wc-canvas-compose]", ev => {
      if (ev.key !== "Enter" || ev.shiftKey || ev.isComposing || ev.originalEvent?.isComposing) return;
      const editor=ev.currentTarget;
      const selection=window.getSelection();
      if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
      let line=selection.anchorNode;
      while (line && line.parentNode !== editor) line=line.parentNode;
      if (line && line!==editor && wcIsDivider(line.textContent)) {
        ev.preventDefault();
        this._insertDivider(editor,true);
        editor.dispatchEvent(new Event("input",{bubbles:true}));
      }
    });
    html.on("input blur", "[data-wc-canvas-compose]", ev => {
      const b = this._canvasBlock();
      if (!b || b.type !== "text") return;
      b.html = WC_RICH_PREFIX + wcSanitizeRich(ev.currentTarget.innerHTML);
      const preview=this.element?.find?.(`[data-wc-canvas-block="${b.id}"] .wc-canvas-text`)?.[0];
      if (preview) preview.innerHTML=wcContent(b.html);
    });
    html.on("change", "[data-wc-issue-reader]", ev => {
      if (this.view !== "issue-form" || !this.draft) return;
      const id = ev.currentTarget.dataset.wcIssueReader;
      const ids = new Set(wcReaders(this.draft.allowedUserIds));
      if (ev.currentTarget.checked) ids.add(id); else ids.delete(id);
      this.draft.allowedUserIds=[...ids];
    });
    html.on("change", '[data-wc-field="audience"]', ev => {
      this.element?.find?.('[data-wc-audience-users]')?.prop?.('hidden', ev.currentTarget.value !== 'selected');
    });
    html.on("change", "[data-wc-canvas-coordinate]", ev => {
      if (this.view !== "page-designer") return;
      this._setCanvasCoords(this._canvasBlock(),{[ev.currentTarget.dataset.wcCanvasCoordinate]: Number(ev.currentTarget.value)});
    });
    html.on("change", "[data-wc-canvas-prop]", ev => {
      const selected=this._canvasBlock();
      if (!selected) return;
      const key=ev.currentTarget.dataset.wcCanvasProp;
      if (key === "size") selected.size=wcCanvasNumber(ev.currentTarget.value, 15, 9, 52);
      else if (key === "fit") selected.fit=ev.currentTarget.value === "cover" ? "cover" : "contain";
      else if (key === "align") selected.align=["left","center","right"].includes(ev.currentTarget.value)?ev.currentTarget.value:"left";
      const node=this.element.find(`[data-wc-canvas-block="${selected.id}"]`)[0];
      if (node) {
        const text=node.querySelector(".wc-canvas-text");
        if (text) {text.style.fontSize=`${selected.size}px`;text.style.textAlign=selected.align;}
        const img=node.querySelector("img");if(img)img.style.objectFit=selected.fit;
      }
    });
    html.on("mousedown", "[data-wc-canvas-format]", ev => ev.preventDefault());
    html.on("click", "[data-wc-canvas-format]", ev => {
      const active=this.element?.find?.("[data-wc-canvas-compose]")?.[0];
      if (!active) return;
      active.focus();
      document.execCommand(ev.currentTarget.dataset.wcCanvasFormat,false,ev.currentTarget.dataset.value||null);
      this._syncCanvasDOM();
    });
    html.on("pointerdown", "[data-wc-canvas-drag], [data-wc-canvas-resize]", ev => {
      if (this.view !== "page-designer" || !this.isGM || ev.button !== 0) return;
      const blockEl=ev.currentTarget.closest("[data-wc-canvas-block]");
      const block=this._canvasBlock(blockEl?.dataset.wcCanvasBlock);
      const canvas=blockEl?.closest("[data-wc-canvas]");
      if (!block || !canvas) return;
      this._syncCanvasDOM(); this._canvasSelectedId=block.id;
      ev.preventDefault();ev.stopPropagation();
      const resize=!!ev.currentTarget.hasAttribute("data-wc-canvas-resize");
      const original=ev.originalEvent || ev;
      const startX=original.clientX,startY=original.clientY;
      const start={x:block.x,y:block.y,w:block.w,h:block.h};
      const bounds=canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const move=(event)=>{
        if (!blockEl.isConnected) {done();return;}
        const dx=(event.clientX-startX)*100/bounds.width;
        const dy=(event.clientY-startY)*100/bounds.height;
        this._setCanvasCoords(block, resize ? {w:start.w+dx,h:start.h+dy} : {x:start.x+dx,y:start.y+dy});
      };
      const done=()=>{
        window.removeEventListener("pointermove",move);
        window.removeEventListener("pointerup",done);
        window.removeEventListener("pointercancel",done);
        if (this.view === "page-designer") this.render();
      };
      window.addEventListener("pointermove",move);
      window.addEventListener("pointerup",done,{once:true});
      window.addEventListener("pointercancel",done,{once:true});
    });

    // Dragging affects only GM-owned Codex records. The entry id is validated
    // against private storage at drop time; no arbitrary browser payload is trusted.
    html.on("dragstart", "[data-wc-entry-drag]", (ev) => {
      if (!this.isGM) { ev.preventDefault(); return; }
      const id = ev.currentTarget.dataset.wcEntryDrag;
      if (!this.store.entries.some(e => e.id === id)) { ev.preventDefault(); return; }
      this._dragEntryId = id;
      const dt = ev.originalEvent?.dataTransfer || ev.dataTransfer;
      if (dt) {
        dt.effectAllowed = "move";
        dt.setData("application/x-world-codex-entry", id);
        dt.setData("text/plain", id);
      }
      ev.currentTarget.classList.add("wc-dragging");
    });
    html.on("dragover", "[data-wc-drop-category]", (ev) => {
      if (!this.isGM || !this._dragEntryId) return;
      ev.preventDefault();
      const dt = ev.originalEvent?.dataTransfer || ev.dataTransfer;
      if (dt) dt.dropEffect = "move";
      html.find(".wc-drop-active").removeClass("wc-drop-active");
      ev.currentTarget.classList.add("wc-drop-active");
    });
    html.on("drop", "[data-wc-drop-category]", (ev) => {
      if (!this.isGM || !this._dragEntryId) return;
      ev.preventDefault(); ev.stopPropagation();
      const id = this._dragEntryId;
      const target = ev.currentTarget.dataset.wcDropCategory;
      this._dragEntryId = null;
      html.find(".wc-drop-active, .wc-dragging").removeClass("wc-drop-active wc-dragging");
      this._moveEntryToCategory(id, target).catch(e => this._error(e));
    });
    html.on("dragend", "[data-wc-entry-drag]", () => {
      this._dragEntryId = null;
      html.find(".wc-drop-active, .wc-dragging").removeClass("wc-drop-active wc-dragging");
    });
    html.on("input", "[data-wc-search]", (ev) => {
      this.query = ev.currentTarget.value;
      // Preserve focus and cursor by updating just the list / count instead of re-rendering the window.
      const fresh = $(`<div>${this._codexSidebar(this.store)}</div>`);
      html.find(".wc-list").html(fresh.find(".wc-list").html());
      html.find(".wc-count").html(fresh.find(".wc-count").html());
    });
    html.on("change", "[data-wc-category]", (ev) => { this.categoryFilter = ev.currentTarget.value; this.render(); });
    html.on("click", "[data-wc-group-toggle]", (ev) => {
      const id = ev.currentTarget.dataset.wcGroupToggle;
      if (this.collapsedGroups.has(id)) this.collapsedGroups.delete(id);
      else this.collapsedGroups.add(id);
      const section = ev.currentTarget.closest(".wc-entry-group");
      const expanded = !this.collapsedGroups.has(id);
      ev.currentTarget.setAttribute("aria-expanded", String(expanded));
      ev.currentTarget.querySelector("i")?.classList.toggle("fa-chevron-right", !expanded);
      ev.currentTarget.querySelector("i")?.classList.toggle("fa-chevron-down", expanded);
      if (section) section.querySelector(".wc-group-entries").hidden = !expanded;
    });
    html.on("click", "[data-wc-dropdown-trigger]", (ev) => {
      const root = ev.currentTarget.closest("[data-wc-dropdown]");
      const expanded = root.classList.contains("wc-open");
      this._closeDropdowns();
      root.classList.toggle("wc-open", !expanded);
      root.querySelector(".wc-dropdown-menu").hidden = expanded;
      ev.currentTarget.setAttribute("aria-expanded", String(!expanded));
      if (!expanded) root.querySelector('[aria-selected="true"]')?.scrollIntoView({block:"nearest"});
    });
    html.on("click", "[data-wc-dropdown-option]", (ev) => {
      const root = ev.currentTarget.closest("[data-wc-dropdown]");
      const select = root.querySelector("select");
      select.value = ev.currentTarget.dataset.wcDropdownOption;
      root.querySelector(".wc-dropdown-label").textContent = ev.currentTarget.textContent;
      root.querySelectorAll("[data-wc-dropdown-option]").forEach(o => o.setAttribute("aria-selected", String(o === ev.currentTarget)));
      this._closeDropdowns();
      select.dispatchEvent(new Event("change", {bubbles:true}));
    });
    html.on("keydown", "[data-wc-dropdown-trigger], [data-wc-dropdown-option]", (ev) => {
      const root = ev.currentTarget.closest("[data-wc-dropdown]");
      if (ev.key === "Escape") { this._closeDropdowns(); root.querySelector("[data-wc-dropdown-trigger]").focus(); ev.preventDefault(); }
      else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) {
        ev.preventDefault();
        if (!root.classList.contains("wc-open")) root.querySelector("[data-wc-dropdown-trigger]").click();
        const options = Array.from(root.querySelectorAll("[data-wc-dropdown-option]"));
        const current = options.indexOf(ev.currentTarget);
        const selected = options.findIndex(o => o.getAttribute("aria-selected") === "true");
        const index = ev.key === "Home" ? 0 : ev.key === "End" ? options.length - 1 :
          (current >= 0 ? current : selected) + (ev.key === "ArrowDown" ? 1 : -1);
        options[Math.max(0, Math.min(options.length - 1, index))]?.focus();
      }
    });
    html.on("click", (ev) => { if (!ev.target.closest("[data-wc-dropdown]")) this._closeDropdowns(); });
    html.on("keydown", "[data-wc-rich]", (ev) => {
      if (ev.key !== "Enter" || ev.shiftKey || ev.isComposing || ev.originalEvent?.isComposing) return;
      const editor = ev.currentTarget;
      const selection = window.getSelection();
      if (!selection?.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return;
      let block = selection.anchorNode;
      while (block && block.parentNode !== editor) block = block.parentNode;
      if (block && block !== editor && wcIsDivider(block.textContent)) {
        ev.preventDefault(); this._insertDivider(editor, true);
      }
    });
    html.on("mousedown", "[data-wc-insert-rule]", ev => ev.preventDefault());
    html.on("click", "[data-wc-insert-rule]", (ev) => {
      const field = ev.currentTarget.dataset.wcInsertRule;
      const editor = this._editorFor(field);
      if (!editor) return;
      editor.focus(); this._restoreRichCaret(editor, field);
      this._insertDivider(editor);
    });

    html.on("input change", "[data-wc-field]", (ev) => this._updateDraft(ev));
    html.on("input blur", "[data-wc-rich]", (ev) => this._syncRich(ev.currentTarget));
    html.on("mouseup keyup", "[data-wc-rich]", (ev) => this._rememberCaret(ev.currentTarget));
    html.on("click", "[data-wc-rich] img", (ev) => { ev.stopPropagation(); this._chooseImage(ev.currentTarget); });
    html.on("click", "[data-wc-rich]", (ev) => { if (ev.target.tagName !== "IMG") this._chooseImage(null); });
    html.on("mousedown", "[data-wc-format], [data-wc-insert-image], [data-wc-image-url]", (ev) => ev.preventDefault());
    html.on("click", "[data-wc-format]", (ev) => {
      const btn = ev.currentTarget;
      const editor = this._editorFor(btn.dataset.field);
      if (!editor) return;
      editor.focus();
      const selected = window.getSelection();
      if (this._richCaret?.field === btn.dataset.field && editor.contains(this._richCaret.range.commonAncestorContainer)) {
        selected.removeAllRanges(); selected.addRange(this._richCaret.range);
      }
      document.execCommand(btn.dataset.wcFormat, false, btn.dataset.value || null);
      this._syncRich(editor); this._rememberCaret(editor);
    });
    html.on("click", "[data-wc-insert-image]", (ev) => {
      const field = ev.currentTarget.dataset.wcInsertImage;
      const editor = this._editorFor(field); if (!editor) return;
      this._rememberCaret(editor);
      new FilePicker({type:"image", callback:(path) => this._insertRichImage(path, field)}).render(true);
    });
    html.on("click", "[data-wc-image-url]", async (ev) => {
      const field = ev.currentTarget.dataset.wcImageUrl;
      const editor = this._editorFor(field); if (!editor) return;
      this._rememberCaret(editor);
      const url = await Dialog.prompt({title:"Insert Image URL", content:'<label>Image path or HTTPS URL <input type="text" name="image" style="width:100%"></label>', callback:html => html.find('[name="image"]').val()});
      if (url) { if (!wcImage(url)) ui.notifications.warn("Invalid image path or URL."); else this._insertRichImage(url, field); }
    });
    html.on("input change", "[data-wc-image-size]", (ev) => this._setImageSize(ev.currentTarget.value));
    html.on("click", "[data-wc-image-align]", (ev) => {
      if (!this._selectedImage?.isConnected) return;
      this._selectedImage.dataset.wcAlign = ev.currentTarget.dataset.wcImageAlign;
      this._applyImageStyle(this._selectedImage);
      this._positionHandle(); this._syncRich(this._selectedImage.closest("[data-wc-rich]"));
    });
    html.on("click", "[data-wc-remove-image]", () => {
      const img = this._selectedImage; if (!img?.isConnected) return;
      const editor = img.closest("[data-wc-rich]"); img.remove(); this._chooseImage(null); this._syncRich(editor);
    });
    html.on("click", "[data-wc-image-reset]", () => {
      if (this._selectedImage?.isConnected) this._setImagePosition(this._selectedImage, 0, 0);
    });
    html.on("pointerdown", "[data-wc-rich] img", (ev) => {
      if (!this.isGM || ev.button !== 0 || ev.originalEvent?.isPrimary === false) return;
      const img = ev.currentTarget;
      this._chooseImage(img);
      ev.preventDefault(); ev.stopPropagation();
      const originX = wcOffset(img.dataset.wcOffsetX);
      const originY = wcOffset(img.dataset.wcOffsetY);
      const startX = ev.originalEvent?.clientX ?? ev.clientX;
      const startY = ev.originalEvent?.clientY ?? ev.clientY;
      let moved = false;
      const move = (event) => {
        if (!img.isConnected) { end(); return; }
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        img.classList.add("wc-image-moving");
        this._setImagePosition(img, originX + dx, originY + dy);
      };
      const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        img.classList.remove("wc-image-moving");
        if (img.isConnected) this._syncRich(img.closest("[data-wc-rich]"));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end, {once:true});
      window.addEventListener("pointercancel", end, {once:true});
    });
    html.on("pointerdown", ".wc-image-resize-handle", (ev) => {
      if (!this._selectedImage?.isConnected) return;
      ev.preventDefault(); ev.stopPropagation();
      const editor = this._selectedImage.closest("[data-wc-rich]");
      const startX = ev.originalEvent?.clientX ?? ev.clientX;
      const startWidth = wcWidth(this._selectedImage.dataset.wcWidth);
      const editorWidth = editor.getBoundingClientRect().width;
      const move = (event) => this._setImageSize(startWidth + (event.clientX - startX) * 100 / editorWidth);
      const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end, {once:true});
      window.addEventListener("pointercancel", end, {once:true});
    });
  }
  async _moveEntryToCategory(entryId, categoryId) {
    this._checkGM();
    if (!["browse", "categories"].includes(this.view)) {
      ui.notifications.warn("Save or cancel your current edit before moving an entry.");
      return false;
    }
    const data = this.store;
    const entry = data.entries.find(e => e.id === entryId);
    const target = data.categories.find(c => c.id === categoryId);
    if (!entry || !target || entry.categoryId === target.id) return false;
    entry.categoryId = target.id;
    entry.updatedAt = new Date().toISOString();
    if (!await this._persist(data)) return false;
    this.collapsedGroups.delete(target.id);
    // Keep a moved entry visible when dragging from a single-category filter.
    if (this.categoryFilter !== "all") this.categoryFilter = target.id;
    await this.render();
    ui.notifications.info(`${entry.name} moved to ${target.name}.`);
    return true;
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
      // Each restricted issue gets its own Foundry JournalEntry, accessible only
      // to selected players at OBSERVER level. Public data never contains it.
      // This also works when the GM is offline after the issue is published.
      const mirrors=Array.from(game.journal || []).filter(j=>j.getFlag?.(WC_ID, WC_SHARED_ISSUE));
      const privateIssues=cleaned.issues.filter(i=>i.published && wcAudience(i)==="selected");
      for (const old of mirrors) {
        if (!privateIssues.some(i=>i.id === old.getFlag(WC_ID, WC_SHARED_ISSUE))) await old.delete();
      }
      for (const restricted of privateIssues) {
        const owner = {default:CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE};
        for (const id of wcReaders(restricted.allowedUserIds)) {
          if (game.users?.get?.(id) && !game.users.get(id).isGM) owner[id]=CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
        }
        const content = {name:`Gazette • ${restricted.paperName} — ${restricted.title}`,
          ownership:owner,flags:{[WC_ID]:{[WC_SHARED_ISSUE]:restricted.id,[WC_SHARED_COPY]:restricted}}};
        const existing=mirrors.find(j=>j.getFlag(WC_ID, WC_SHARED_ISSUE) === restricted.id);
        if (existing) await existing.update(content);
        else await JournalEntry.create(content);
      }
      const publicIssues = cleaned.issues.filter(wcPublishedToEveryone);
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
    this.draft = entry ? wcClone(entry) : {id:wcId(),categoryId:this.categoryFilter !== "all" ? this.categoryFilter : (data.categories[0]?.id || ""), name:"", subtitle:"", image:"",imageWidth:100,summary:"",body:"",tags:[],fields:[],visibility:"gm",updatedAt:""};
  }
  _startPageDesigner(issue, page) {
    this._checkGM();
    this.tab = "gazette";
    this.view = "page-designer";
    this.editingPageId = page.id;
    this._canvasSelectedId = null;
    this.draft = { canvas: page.canvas?.blocks ? wcClone(page.canvas) : wcInitialPageCanvas(page, issue, issue.pages[0]?.id === page.id) };
    this.draft.canvas.enabled = true;
  }
  _canvasBlock(id = this._canvasSelectedId) {
    return this.draft?.canvas?.blocks?.find(block => block.id === id) || null;
  }
  _syncCanvasDOM() {
    if (this.view !== "page-designer") return;
    const textEditor = this.element?.find?.("[data-wc-canvas-compose]")?.[0];
    const selected = this._canvasBlock();
    if (textEditor && selected?.type === "text") {
      selected.html = WC_RICH_PREFIX + wcSanitizeRich(textEditor.innerHTML);
    }
  }
  _addCanvasBlock(type, opts = {}) {
    this._syncCanvasDOM();
    const list = this.draft?.canvas?.blocks;
    if (!list) return;
    if (list.length >= 180) {ui.notifications.warn("This page already has 180 blocks."); return;}
    const index = list.length;
    const w = type === "rule" ? 88 : type === "image" ? 55 : 88;
    const h = type === "rule" ? 4 : type === "image" ? 28 : 18;
    let spot = null;
    for (let y = 4; y <= 96 - h && !spot; y += 4) {
      const x = type === "image" ? 20 : 6;
      const collides = list.some(b => x < b.x+b.w+2 && x+w+2 > b.x && y < b.y+b.h+2 && y+h+2 > b.y);
      if (!collides) spot = {x,y};
    }
    if (!spot) spot={x:6,y:Math.max(0,96-h)};
    const block = wcCanvasCleanBlock({id:wcId(),type,x:spot.x,y:spot.y,
      w, h,
      z:Math.min(999, 1 + Math.max(0,...list.map(b=>b.z))),
      html:type === "text" ? WC_RICH_PREFIX + (opts.heading ? "<h3>New Headline</h3>" : "<p>Write here...</p>") : "",
      src:opts.src || "",size:opts.heading ? 26 : 15});
    list.push(block);
    this._canvasSelectedId = block.id;
    this.render();
  }
  _selectCanvasBlock(id) {
    if (!this._canvasBlock(id)) return;
    // A full render would drop text focus, so only update selection styling;
    // rerender on pointer end / click when appropriate.
    this._syncCanvasDOM();
    this._canvasSelectedId = id;
    this.element?.find?.(".wc-canvas-block")?.removeClass("wc-canvas-selected");
    this.element?.find?.(`[data-wc-canvas-block="${id}"]`)?.addClass("wc-canvas-selected");
    // Only update properties panel: re-rendering the full window here would
    // steal contenteditable focus/caret and make in-place writing difficult.
    const inspector=this.element?.find?.(".wc-designer-inspector")?.[0];
    if (inspector) {
      const template=document.createElement("div");
      template.innerHTML=this._pageDesigner(this.store);
      const next=template.querySelector(".wc-designer-inspector");
      if (next) inspector.replaceWith(next);
    }
  }
  _setCanvasCoords(block, updates) {
    if (!block) return;
    Object.assign(block, updates);
    const clean = wcCanvasCleanBlock(block);
    Object.assign(block, {x:clean.x,y:clean.y,w:clean.w,h:clean.h});
    const el = this.element?.find?.(`[data-wc-canvas-block="${block.id}"]`)?.[0];
    if (el) Object.assign(el.style, {left:`${block.x}%`,top:`${block.y}%`,width:`${block.w}%`,height:`${block.h}%`});
    for (const key of ["x","y","w","h"]) this.element?.find?.(`[data-wc-canvas-coordinate="${key}"]`)?.val?.(block[key]);
  }
  _startIssue(issue = null, data = this.store) {
    this.tab = "gazette"; this.view = "issue-form"; this.editedId = issue?.id || null;
    this.draft = issue ? wcClone(issue) : {id:wcId(),paperName:data.preferences.paperName || "The Gazette", motto:data.preferences.paperMotto || "",title:"",subtitle:"",date:"",edition:"SPECIAL EDITION",price:"",kicker:"LATEST NEWS",theme:"parchment",coverImage:"",coverWidth:100,published:false,audience:"all",allowedUserIds:[],pages:[{id:wcId(),title:"Front Page",articles:[]}]};
  }
  _startArticle(article = null) {
    this.tab = "gazette"; this.view = "article-form"; this.editedId = article?.id || null;
    this.draft = article ? wcClone(article) : {id:wcId(),headline:"",kicker:"",byline:"",body:"",image:"",imageWidth:100,caption:"",layout:"standard"};
  }
  async _onAction(ev) {
    const button = ev.currentTarget;
    const action = button.dataset.wcAction;
    if (action.startsWith("save-")) this._syncAllRich();
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
    if (action === "edit-issue" || action === "issue-permissions") {
      if (!issue) return;
      this._startIssue(issue, data); this.render();
      if (action === "issue-permissions") this.element?.find?.(".wc-newspaper-permissions")?.[0]?.scrollIntoView?.({block:"center"});
      return;
    }
    if (action === "save-issue") {
      const d = this.draft;
      if (!d.title.trim() || !d.paperName.trim()) throw new Error("Newspaper name and front headline are required.");
      d.coverImage = wcImage(d.coverImage);
      d.audience = wcAudience(d); d.allowedUserIds = wcReaders(d.allowedUserIds);
      if (d.audience === "selected" && !d.allowedUserIds.length) throw new Error("Select at least one player for restricted newspaper access.");
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
      if (!issue.published && wcAudience(issue) === "selected" && !wcReaders(issue.allowedUserIds).length) throw new Error("Choose at least one reader under Permissions first.");
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
      const whisper = wcAudience(issue) === "selected" ? [...wcReaders(issue.allowedUserIds), ...Array.from(game.users || []).filter(u=>u.isGM).map(u=>u.id)] : [];
      await ChatMessage.create({content:`<div class="wc-chat-notice"><strong>${wcIcon("newspaper")} ${wcEsc(issue.paperName)}</strong><p>${wcEsc(issue.title)} — ${wcEsc(issue.date)}</p><button type="button" class="wc-chat-open" data-issue-id="${wcAttr(issue.id)}">Read this Issue</button></div>`, ...(whisper.length ? {whisper} : {})});
      return;
    }
    if (action === "design-page") {
      if (!page) return;
      this._startPageDesigner(issue, page); this.render(); return;
    }
    if (action === "cancel-canvas") { this._clearEditor(); this.render(); return; }
    if (action === "save-canvas") {
      if (!page || this.view !== "page-designer" || page.id !== this.editingPageId) return;
      this._syncCanvasDOM();
      page.canvas = wcCanvasClean(this.draft.canvas);
      if (await this._persist(data)) { this._clearEditor(); this.render(); ui.notifications.info("Newspaper page layout saved."); }
      return;
    }
    if (action === "canvas-classic") {
      if (!page || this.view !== "page-designer") return;
      if (!await this._confirm("Return to Classic Layout?", "Your canvas blocks will be saved but hidden; existing original articles will be displayed. You may return to the canvas any time.")) return;
      this._syncCanvasDOM();
      page.canvas = wcCanvasClean({...this.draft.canvas,enabled:false});
      if (await this._persist(data)) {this._clearEditor(); this.render();}
      return;
    }
    if (action === "canvas-add-text") {this._addCanvasBlock("text"); return;}
    if (action === "canvas-add-heading") {this._addCanvasBlock("text",{heading:true}); return;}
    if (action === "canvas-add-rule") {this._addCanvasBlock("rule"); return;}
    if (action === "canvas-add-image" || action === "canvas-replace-image") {
      const targetId = action === "canvas-replace-image" ? this._canvasSelectedId : null;
      new FilePicker({type:"image", callback:(path) => {
        if (this.view !== "page-designer" || !wcImage(path)) return;
        if (targetId) {const b=this._canvasBlock(targetId); if (b?.type === "image") {this._syncCanvasDOM(); b.src=path; this.render();}}
        else this._addCanvasBlock("image",{src:path});
      }}).render(true);
      return;
    }
    if (action === "canvas-add-url") {
      const url = await Dialog.prompt({title:"Insert Image",content:'<label>Foundry path or HTTPS image URL <input name="image" type="text" style="width:100%"></label>',callback:html=>html.find('[name="image"]').val()});
      if (url && wcImage(url)) this._addCanvasBlock("image",{src:url});
      else if(url) ui.notifications.warn("Invalid image path or URL.");
      return;
    }
    if (["canvas-delete","canvas-duplicate","canvas-bring-front","canvas-send-back"].includes(action)) {
      this._syncCanvasDOM();
      const list = this.draft?.canvas?.blocks;
      const selected = this._canvasBlock();
      if (!list || !selected) return;
      if (action === "canvas-delete") {this.draft.canvas.blocks = list.filter(b=>b.id!==selected.id); this._canvasSelectedId=null;}
      if (action === "canvas-duplicate") {
        if (list.length>=180) {ui.notifications.warn("This page already has 180 blocks.");return;}
        const b=wcCanvasCleanBlock({...selected,id:wcId(),x:Math.min(100-selected.w,selected.x+4),y:Math.min(100-selected.h,selected.y+4)});
        list.push(b); this._canvasSelectedId=b.id;
      }
      if (action === "canvas-bring-front") selected.z=Math.min(999,Math.max(...list.map(b=>b.z))+1);
      if (action === "canvas-send-back") selected.z=Math.max(0,Math.min(...list.map(b=>b.z))-1);
      this.render(); return;
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
  .wc-paper-cover{margin:13px auto}.wc-paper-cover img{max-width:100%;height:auto;max-height:75mm;object-fit:contain;display:block;margin:auto;filter:saturate(.8)}
  .wc-paper-articles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 21px;margin-top:18px}
  .wc-paper-story{min-width:0;break-inside:avoid}.wc-paper-story h3{font-size:19px;margin:4px 0 7px;line-height:1.1}.wc-story-lead{grid-column:1/-1}.wc-story-lead h3{font-size:28px}
  .wc-story-lead .wc-story-copy{columns:2;column-gap:20px}.wc-story-copy p{font-size:12px;line-height:1.6;margin:0 0 10px;text-align:justify}.wc-story-copy h3,.wc-story-copy h4,.wc-story-copy h5{margin:8px 0}
  .wc-story-byline{font-size:9px;font-weight:bold;letter-spacing:1px;border-bottom:1px solid #9b8772;padding-bottom:5px;margin:5px 0}.wc-article-figure{margin:8px 0}.wc-article-figure img{max-width:100%;height:auto;max-height:75mm;object-fit:contain;display:block;margin:auto}.wc-article-figure figcaption{font-size:10px;font-style:italic}
  .wc-story-copy img{max-width:100%;height:auto;object-fit:contain;break-inside:avoid}.wc-story-copy ul,.wc-story-copy ol{padding-left:20px}.wc-story-copy a{color:inherit;text-decoration:underline}
  .wc-story-copy hr{display:block;border:0;border-top:1px solid currentColor;opacity:.65;margin:12px 0;break-inside:avoid}
  .wc-paper-canvas{position:relative;width:100%;height:auto;aspect-ratio:7/8;overflow:hidden;isolation:isolate;margin:10px 0 12px;box-sizing:border-box}
  .wc-canvas-block{position:absolute;box-sizing:border-box;min-width:0;min-height:0;overflow:hidden}
  .wc-canvas-block-body{width:100%;height:100%;overflow:hidden;position:relative}
  .wc-canvas-text{font-family:Georgia,serif;line-height:1.35;overflow:hidden;height:100%;overflow-wrap:anywhere;padding:2px;box-sizing:border-box}
  .wc-canvas-text p{margin:0 0 7px;line-height:1.4}.wc-canvas-text h3,.wc-canvas-text h4{font-family:Georgia,serif;font-size:1.45em;margin:3px 0 8px;line-height:1.12}
  .wc-canvas-text h5{font-size:.84em;margin:4px 0}.wc-canvas-text ul,.wc-canvas-text ol{padding-left:19px;margin:6px 0}
  .wc-canvas-text img{max-width:100%;height:auto;object-fit:contain}.wc-canvas-text hr{border:0;border-top:1px solid currentColor;margin:12px 0}
  .wc-canvas-image img{width:100%;height:100%;display:block;object-position:center}
  .wc-canvas-rule .wc-canvas-block-body{display:flex;align-items:center}.wc-canvas-rule hr{border:0;border-top:2px solid currentColor;width:100%;opacity:.7}
  .wc-story-notice{border:1px solid currentColor;padding:10px}.wc-paper-footer{display:flex;justify-content:space-between;border-top:2px solid;margin-top:35px;padding-top:8px;font-size:10px;font-weight:bold}
  @media print{body{background:none}.tools{display:none}.wc-paper{margin:0;box-shadow:none;width:210mm;min-height:277mm;padding:12mm}@page{size:A4;margin:0}}`;
  const pages = wcAllPaperPages(issue);
  // Printed/downloaded HTML needs an absolute base for Foundry-relative artwork.
  const base = typeof document !== "undefined" && document.baseURI ? `<base href="${wcAttr(new URL("./", document.baseURI).href)}">` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${base}<meta name="viewport" content="width=device-width,initial-scale=1"><title>${wcEsc(issue.paperName)} — ${wcEsc(issue.title)}</title><style>${css}</style></head><body><div class="tools"><button onclick="window.print()">Print / Save as PDF</button></div>${pages}</body></html>`;
}
function wcFindStorage() {
  if (!game.user?.isGM) return null;
  return game.journal.find(j => j.getFlag(WC_ID, "storage") === true) || null;
}
let wcApp;
let wcPendingOpen = null;
function wcCanOpenShared(msg) {
  const data = game.settings.get(WC_ID, "publicData") || WC_DEFAULT();
  return msg?.type === "open-issue" ? (new WorldCodex()).store.issues.some(i => i.published && i.id === msg.id)
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
  for (const evt of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry"]) {
    Hooks.on(evt, journal => {
      if (journal.getFlag?.(WC_ID, "storage") && game.user.isGM && wcApp?.rendered && !wcApp.draft) wcApp.render();
      if (journal.getFlag?.(WC_ID, WC_SHARED_ISSUE) && !game.user.isGM && wcApp?.rendered) wcApp.render();
    });
  }
  Hooks.on("renderChatMessage", (message, html) => {
    html.find(".wc-chat-open").on("click", (ev) => {
      const issueId = ev.currentTarget.dataset.issueId;
      const source = (wcApp || new WorldCodex()).store;
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
