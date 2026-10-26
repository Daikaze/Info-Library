# World Codex & Gazette v0.1.0

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

## Formatting

Article and lore text accepts plain text paragraphs (separated by blank lines), `**bold**`, `*italic*`, and `# Heading` / `## Heading` / `### Heading`. Image assets are linked from your Foundry filesystem or an external HTTP(S) URL, **not bundled in the backup**.

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
