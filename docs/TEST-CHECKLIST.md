# In-Foundry verification checklist (v11 + dnd5e 3.3.1)

- [ ] Enable module; enter world with GM and player session.
- [ ] Open with Token tools book button and with Game Settings button.
- [ ] First launch: zero categories, entries and issues.
- [ ] Create Cities and NPCs categories; check filter dropdown and add profile images.
- [ ] Create GM-only NPC, public City and private PC; confirm only public City visible as player.
- [ ] Change public entry then verify updates appear in player window.
- [ ] Open public profile on player using "Show Players" even when their Codex was not already open.
- [ ] Create unpublished newspaper: inaccessible to player.
- [ ] Add two pages with one image, lead and regular article layouts. Reorder pages and articles.
- [ ] Publish edition; confirm player archive and chat link; check "Show Players" with player Codex closed.
- [ ] Unpublish edition; confirm player archive no longer shows it.
- [ ] Print as A4 and export HTML. Verify images are referenced properly.
- [ ] Backup JSON; import into a test world, verify the restored image paths and content.
- [ ] Reload the world and confirm the Codex data persists.
- [ ] Drag/resize the window; double-click title bar to minimize (Foundry default Application behavior).

## v0.1.1 rich text regression

- [ ] In an old entry, edit existing Markdown content and save; ensure content remains formatted.
- [ ] In Lore, Summary and an Article, choose **Insert Image** and insert multiple images at distinct cursor positions.
- [ ] Click one image, change its width via the slider and orange corner handle, change left/center/right alignment; save, reopen, verify dimensions.
- [ ] Set Entry main artwork, Issue front cover, Article illustration sizes independently using Size (%) fields.
- [ ] Check Category/Visibility/Theme/Layout dropdown option text in Foundry dark and light desktop themes.
- [ ] Publish and read from a non-GM client, including rich text inline images, sizes and caption.
- [ ] Use Print and HTML export; inspect that linked images load with relative Foundry paths.
- [ ] Backup and import v0.1.1 data; verify formatting and image sizes persist.
- [ ] Check that imported HTML containing unsafe tags/URL schemes never executes or displays them.

## v0.1.2 dividers/category/dropdown regression

- [ ] Type `---` as an entire line then press Enter in Article, Summary and Lore editors; see a horizontal rule and continue writing below.
- [ ] Use the toolbar Divider button mid-article. Save, reopen, Publish, Print, HTML export; divider remains visible.
- [ ] View old Markdown content with a `---` divider, with and without blank lines around it.
- [ ] Create two categories and entries in both; All Categories groups by category header with counts and collapsible entries.
- [ ] Search within All Categories, and filter a single category; no hidden/private entries appear to players.
- [ ] Verify Category, Visibility, Theme and Layout drop-down menus are dark with legible text in Windows Firefox and other V11 clients; test keyboard arrows, Esc and selecting.


## v0.1.4 direct page design regression

- [ ] GM: open a page, click **Design Page**. Existing cover and article text appear as independently editable blocks.
- [ ] Add text, heading, divider, image via FilePicker and via URL. Click inside text, write, select text and apply formatting.
- [ ] Drag from dark top grip, resize from the lower-right handle, edit X/Y/W/H fields, image fit and text size/alignment. Save and reopen.
- [ ] Publish and inspect in a player client: layout unchanged, editing controls absent.
- [ ] Print / Save PDF and export HTML: canvas preserves geometry and safe image paths.
- [ ] Use **Use Classic Layout** to restore original articles; then reopen designer and verify canvas blocks were retained.
- [ ] Check existing newspaper issues, JSON backups, old article editing, legacy Codex rich-text editor and drag-drop categories.
- [ ] Inspect particularly long text blocks in the player view and A4 print; increase their height if content overflows.

## v0.1.5 manual checks (Foundry V11)
- [ ] Open Design Page on a monitor of approximately 1366x768 and 1920x1080; check full-width sheet and editor scrolling.
- [ ] Type a long paragraph in the right text editor; preview updates without losing caret.
- [ ] Drag/resize text and images, save and re-open, then print.
- [ ] Convert an old article with an image, confirm photo doesn't cover story text; switch to Classic to confirm original still intact.
- [ ] Set Permissions to Selected Players and publish. Selected Player can see edition; other player cannot see or inspect its document content.
- [ ] GM offline: permitted player can reopen restricted edition.
- [ ] Unpublish and remove a reader; their JournalEntry access is revoked.
- [ ] Default All Players issues and Codex public entries continue to work.
