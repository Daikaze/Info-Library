# World Codex & Gazette v0.1.4

A self-contained **Foundry VTT v11** module for **D&D 5e 3.3.1**, inspired by the two-column presentation of Divine Codex. This is a **new, independent module**; it does not overwrite or require Gods — Divine Codex.

## Installation via manifest

In Foundry V11 → Add-on Modules → Install Module, paste:

`https://raw.githubusercontent.com/Daikaze/Info-Library/main/module.json`

## Installation (manual)

1. Extract the ZIP so the folder is exactly `Data/modules/world-codex/` (not `Data/modules/world-codex/world-codex/`).
2. Restart Foundry, enter your D&D 5e world and enable **World Codex & Gazette** under Manage Modules.
3. Open via the **book icon in Token controls** or **Game Settings → World Codex & Gazette**.
4. Everything is blank at first. In **Codex → Categories**, create your own categories (e.g. Cities, NPCs, PCs, Factions, Events, Regions, Magic, or anything else).

## Codex

- GM-defined categories; **no predetermined categories or entries**.
- Search by names, subtitle, summary and tags; filter via category drop-down.
- Each entry supports a title, subtitle, artwork, featured summary, lore, tags and any number of custom label/value fields.
- Images can be selected with the Foundry FilePicker; you can also enter an image URL/path manually.
- GM can mark each record **GM only** (default) or **Players (published)**, edit, duplicate and delete.
- Published records are readable by players. "Show Players" opens the selected public profile for connected players.

## Gazette

1. Click **New Issue** and fill in the newspaper name, front-page headline, in-world date, edition label, optional cover image and visual theme.
2. Select a page, click **Add Article** and write a headline, kicker, byline, text, image and caption. Choose **Lead Story**, **Regular Story** or **Short Notice**.
3. Use **Add Page** to create as many pages as required. Rename/delete/reorder pages or articles from the UI.
4. Preview each page within the Foundry window. Once ready, click **Publish**.
5. Use **Show Players** to open it for connected players, **Chat Notice** to place a clickable read-link in chat, **Print** to open a printable layout, or **HTML** to export the entire issue as a standalone HTML file. The printable HTML has a **Print / Save as PDF** button.
6. The newspaper **archive** stores published editions for players, while unfinished issues remain GM-only.

## Rich text and images (v0.1.3)

- Open **Edit Entry** or **Edit Article**. The Summary, Lore, and Article Body fields now use an inline visual rich-text editor. Use **Insert Image** to browse Foundry's images or **Image URL** to paste an HTTPS URL or Foundry file path. You can place **multiple** images between paragraphs, in any order.
- **Click an embedded image** and drag its orange lower-right handle to resize, or adjust the **10–100% Size** slider. Align selected illustrations left/center/right; remove them with the trash button. Changes persist when you save and are reflected in player previews and printable HTML.
- Original single-picture controls remain: each Entry main artwork, Issue front cover and Article illustration now has an optional **Size (%)** input (10–100%).
- The existing Markdown/paragraph text of older entries and editions remains readable; opening an old record in the editor converts it to formatted rich text on save. Stored HTML is sanitized to a small allowlist (no scripts, iframes, arbitrary CSS, unsafe image URLs).
- All dropdowns including Category, Visibility, Paper Theme and Article Layout now use explicit contrasting dark popup colors with white text in Foundry V11.

Image assets are linked from your Foundry filesystem or an external HTTP(S) URL, **not bundled in the backup**. Editors require GM access. Larger images and image-rich editions can increase world-setting payload size; prefer optimized WebP images. 

## Dividers and grouped categories (v0.1.3)

- In the Newspaper Article, Entry Summary or Lore editor, type `---` on its own line and press **Enter** to create a full-width horizontal rule. Alternatively use the **Divider** toolbar button at the cursor. Existing older plain-text Markdown records with `---` on a line display dividers automatically. Dividers survive save/reopen, backups, printing and player publication.
- **All Categories** in Codex now groups visible records under headers for each GM-created category in the order the GM created them, with a count and a collapse/expand arrow. Records whose category has been deleted appear in **Uncategorized**. Searching preserves the group headers only where matches remain; selecting a single category still shows its entries directly.
- Native dropdown menus are replaced with high-contrast dark custom popups with visible selected values, keyboard navigation (arrows, Home/End, Escape) and readable hover states in Foundry V11. This covers All Categories and the Entry/Issue/Article form dropdowns.

## Privacy and storage

- Private material is kept in a GM-owned, no-player-permission Journal Entry named `World Codex - Private Data (do not delete)`.
- A **separate world-setting snapshot** carries ONLY public entries and published issues to player clients. Do not manually change permissions of the private storage Journal.
- All writes are GM-only. If multiple GMs are editing simultaneously, coordinate to avoid last-write-wins edits.
- Use **Backup** to download the entire encyclopedia and newspaper archive as JSON. **Import** REPLACES the current data and asks for confirmation; create a backup first.
- Backup JSON and exported HTML may include NPC secrets, so share only what you intend.

## Compatibility and testing

- Manifest restricted to **Foundry core v11** and system **dnd5e** (verified target **3.3.1**). Not tested against later system versions, or v12-v14.
- JavaScript syntax checked using Node 22 and standalone smoke tests available at `tests/smoke.test.cjs` (`node tests/smoke.test.cjs`).
- **Live in-Foundry UI testing was not available** in this environment. If you encounter V11-specific UI/runtime issues, report the Foundry console error.

## Notes

- This release is a deliberately lightweight page and article builder. **Page breaks are managed manually**. Extremely long articles may extend beyond one printable A4 page; divide them over multiple pages for best results.
- Chat notifications and live "Show Players" need connected clients. Published content remains available after they reconnect.
- No generated sample categories or sample content is shipped; content starts empty by design.
- All interface labels are in English. You can write content in Bulgarian or any other language supported by your browser fonts.

## Drag records and move illustrations (v0.1.3)

- **GM-only drag & drop:** in **Codex → All Categories**, grab any entry in the left sidebar and drop it onto another category heading. Empty categories remain visible as targets. The destination is saved in the private Journal and replicated to players for published entries. You can also drop onto category cards in **Categories**, if navigating there with an active drag.
- Category groups expand automatically after a move. Only an existing GM-created category can be used as a destination; drops on the current category are ignored. Dragging is disabled for players.
- **Freely position inserted pictures:** while editing a Codex summary, lore or newspaper article, click and hold an inserted image, drag it horizontally or vertically to adjust its location, and release. The 2D offset is saved alongside its size and alignment, survives save, reopen, JSON backup/import, printing and published views. Use **Reset position** to put it back at its normal place in the text.
- Free positioning is a *visual offset* from the image's location in the text, so it can overlap nearby words if moved too far. Use smaller image size or create a new paragraph to leave enough space.
- Save the record/article as usual. When using browser/Foundry zoom or a different window width, pixel offsets may look slightly different.


## Live Page Designer (v0.1.4)

- In **Newspapers → open an issue → select a page**, click **Design Page**. Edit the visual newspaper page *in place*. Add **Heading**, **Text**, **Image** (Foundry FilePicker), **Image URL**, or **Divider**. Each item is independently movable and resizable.
- Drag a block from the dark **top handle**; resize using its **bottom-right gold square**. Click text to type directly into the page. Use the right inspector to set exact X/Y/width/height in percent, text size/alignment, image crop/contain, duplicate, delete, and arrange stacking order. Standard bold, italic, heading, and list formatting is available for selected text.
- Click **Save Page** when done. Saving stores a per-page `canvas` with relative block positions. **Published player views, HTML export, and Print** use the same geometry. The designer is **GM-only**. **Cancel** discards changes since the last save.
- Opening the designer on an old newspaper page copies existing article headings, bodies, illustrations and the front cover into editable canvas blocks. Original articles are **not deleted**. From the designer use **Use Classic Layout** to restore the original article grid without erasing the saved canvas. Existing old imports/backups without canvas still work.
- **Note:** A canvas is an absolutely positioned page. Blocks do *not* push neighboring blocks out of the way; use the resize/position handles to avoid overlaps, and ensure text fits into its box before printing. A4 print uses a scaled version of the page canvas.
- Keep a backup before large layout changes; the old article forms and earlier published content remain available.
