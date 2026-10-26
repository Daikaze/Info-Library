/* Minimal standalone behavior smoke test. Run: node tests/smoke.test.cjs */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let seq = 0;
const journals = [];
let publicData;
const regs = {};
class Application { constructor() {this.rendered = false;} static get defaultOptions() {return {}} render() {this.rendered = true; return this;} activateListeners() {} }
class JournalEntry {
  static async create(input) {
    const j = {flags:structuredClone(input.flags),ownership:input.ownership||{default:0},name:input.name,
      getFlag(mod,k){return this.flags[mod]?.[k]},
      testUserPermission(user,level){return this.ownership[user.id] >= 2 || this.ownership.default >= 2},
      async setFlag(mod,k,value){this.flags[mod][k]=structuredClone(value)},
      async update(next){this.flags=structuredClone(next.flags);this.ownership=next.ownership;this.name=next.name},
      async delete(){const i=journals.indexOf(this);if(i>=0)journals.splice(i,1)} };
    journals.push(j); return j;
  }
}
const context = vm.createContext({
  Application, JournalEntry, console, structuredClone, setTimeout,
  Hooks: {once() {}, on() {}},
  CONST: {DOCUMENT_OWNERSHIP_LEVELS:{NONE:0,OBSERVER:2}},
  foundry:{utils:{deepClone:structuredClone,randomID:() => `testid${++seq}`,mergeObject:(a,b)=>({...a,...b})}},
  game:{user:{id:'gm',isGM:true},users:{get(id){return {id,isGM:id==='gm'}},[Symbol.iterator]:function*(){yield {id:'gm',name:'GM',isGM:true};yield {id:'p1',name:'Player One',isGM:false};yield {id:'p2',name:'Player Two',isGM:false}}},journal:{find:fn=>journals.find(fn),filter:fn=>journals.filter(fn),[Symbol.iterator]:function*(){yield* journals}},settings:{
    register(id, k, conf) {regs[k] = conf;},
    get(id, k) {return k === 'publicData' ? publicData : undefined;},
    async set(id, k, value) {publicData = structuredClone(value);}
  },socket:{emit(){}},modules:{get(){return {}}}},
  ui:{notifications:{info(){},warn(){},error(msg){throw Error(msg)}}},
  Dialog:{confirm:async()=>true},
  ImagePopout:class{},ChatMessage:{create:async()=>{}},
});
const src = fs.readFileSync(path.join(__dirname,'../scripts/main.js'),'utf8');
vm.runInContext(src, context, {filename:'main.js'});
async function run() {
  const app = vm.runInContext('new WorldCodex()',context);
  assert.equal(app.store.categories.length,0,'category list starts empty');
  assert.equal(app.store.entries.length,0,'entry list starts empty');
  assert.equal(app.store.issues.length,0,'issue list starts empty');
  assert.match(app._build(), /Create your own world encyclopedia/);
  const action = async (a, id, extra={}) => app._onAction({preventDefault(){},currentTarget:{dataset:{wcAction:a,id,...extra}}});
  await action('new-category'); app.draft.name='Cities'; await action('save-category');
  assert.equal(app.store.categories[0].name,'Cities');
  await action('new-entry'); app.draft.name='Izmet'; app.draft.summary='Capital city'; app.draft.visibility='players'; await action('save-entry');
  assert.equal(publicData.entries[0].name,'Izmet');
  assert.equal(publicData.categories[0].name,'Cities');
  assert.match(app._build(), /Izmet/);
  // All Categories must retain each category header, even with multiple entries.
  const grouped = app._codexSidebar(app.store);
  assert.match(grouped, /wc-entry-group/);
  assert.match(grouped, /wc-group-heading/);
  assert.match(grouped, /Cities/);
  assert.match(grouped, /data-wc-dropdown-trigger/);
  const legacyMarkdown = vm.runInContext('wcMarkdown',context);
  assert.equal(legacyMarkdown('Before\n---\nAfter'), '<p>Before</p><hr><p>After</p>');
  assert.equal(legacyMarkdown('Before\n\n---\n\nAfter'), '<p>Before</p><hr><p>After</p>');
  const richField = vm.runInContext('wcRichField',context);
  assert.match(richField('body', 'text', 'Article'), /data-wc-insert-rule/);
  assert.match(richField('body', '', 'Article'), /data-wc-image-reset/, 'free image reset control exists');
  assert.match(app._codexSidebar(app.store), /data-wc-entry-drag/, 'GM entries are draggable');
  assert.match(app._codexSidebar(app.store), /data-wc-drop-category/, 'category heading is a drop zone');
  // Category moves are persisted through the same storage and public mirror as edits.
  await action('new-category'); app.draft.name='NPCs'; await action('save-category');
  const secondId = app.store.categories.find(c => c.name === 'NPCs').id;
  const entryId = app.store.entries[0].id;
  app.view = 'browse';
  assert.equal(await app._moveEntryToCategory(entryId, secondId), true);
  assert.equal(app.store.entries[0].categoryId, secondId);
  assert.equal(publicData.entries[0].categoryId, secondId);
  assert.equal(await app._moveEntryToCategory(entryId, secondId), false, 'no-op on same category');


  await action('new-entry'); app.draft.name='Hidden NPC'; await action('save-entry');
  assert.equal(publicData.entries.length,1,'private entries not published');
  await action('new-issue'); app.draft.paperName='Izmet Times'; app.draft.title='The Vanishing'; app.draft.date='06/06/602'; await action('save-issue');
  assert.equal(publicData.issues.length,0,'draft editions remain private');
  await action('add-article'); app.draft.headline='A continent is gone!'; app.draft.body='Witnesses report **mystery**.'; app.draft.layout='lead'; await action('save-article');
  assert.equal(app.store.issues[0].pages[0].articles.length,1,'article persisted');
  await action('add-page'); assert.equal(app.store.issues[0].pages.length,2);
  await action('toggle-publish'); assert.equal(publicData.issues.length,1,'published issue reaches public mirror');
  assert.match(vm.runInContext('wcAllPaperPages',context)(publicData.issues[0]),/A continent is gone!/);
  assert.match(vm.runInContext('wcStandalonePaper',context)(publicData.issues[0]),/Print \/ Save as PDF/);
  assert.equal(journals[0].getFlag('world-codex','storage'),true);
  assert.equal(journals[0].getFlag('world-codex','database').entries.length,2);
  await action('toggle-publish'); assert.equal(publicData.issues.length,0);
  await action('categories'); await action('delete-category',app.store.categories.find(c => c.name === 'NPCs').id);
  assert.equal(app.store.entries[0].categoryId,'','deleting category retains entries');
  const unsafe = vm.runInContext('wcImage',context);
  assert.equal(unsafe('javascript:alert(1)'), '');
  const page = vm.runInContext('wcPaperArticle',context)({headline:'<script>fail</script>',body:'**hello** <img src=x>'});
  assert.doesNotMatch(page,/<script>|<img src=x>/);
  assert.match(page,/&lt;script&gt;/);
  // v0.1.4 canvas data model is additive and round-trips via safe import.
  const clean = vm.runInContext('wcCanvasClean',context);
  const draft = clean({enabled:true,blocks:[
    {id:'text1',type:'text',html:'wc-rich-v1:<h3>News</h3>',x:22,y:15,w:54,h:28,size:24},
    {id:'image1',type:'image',src:'worlds/my-world/art.webp',x:64,y:30,w:40,h:35,fit:'cover'},
    {id:'bad',type:'image',src:'javascript:alert(1)',x:-40,y:200,w:400,h:800}
  ]});
  assert.equal(draft.enabled,true);
  assert.equal(draft.blocks[0].size,24);
  assert.equal(draft.blocks[1].src,'worlds/my-world/art.webp');
  assert.equal(draft.blocks[1].x,60,'canvas positions stay inside 0–100% bounds');
  assert.equal(draft.blocks[2].src,'','malicious image scheme rejected');
  const existing = app.store;
  existing.issues[0].pages[0].canvas = draft;
  await app._persist(existing);
  assert.equal(app.store.issues[0].pages[0].canvas.blocks.length,3);
  assert.equal(publicData.issues.length,0,'unpublished canvas private');
  // Restricted editions never enter publicData. Foundry Journal ownership
  // grants observer access only to explicitly selected users.
  const privateEdition=app.store;
  privateEdition.issues[0].audience='selected';
  privateEdition.issues[0].allowedUserIds=['p1'];
  privateEdition.issues[0].published=true;
  await app._persist(privateEdition);
  assert.equal(publicData.issues.length,0,'restricted issue excluded from global publicData');
  assert.equal(journals.length,2,'separate controlled JournalEntry created');
  const mirror=journals.find(j=>j.getFlag('world-codex','sharedIssueId'));
  assert.equal(mirror.ownership.default,0);
  assert.equal(mirror.ownership.p1,2);
  context.game.user={id:'p1',isGM:false};
  assert.equal(app.store.issues.length,1,'selected player can read their newspaper');
  context.game.user={id:'p2',isGM:false};
  assert.equal(app.store.issues.length,0,'unselected player gets no newspaper');
  context.game.user={id:'gm',isGM:true};
  privateEdition.issues[0].published=false;
  await app._persist(privateEdition);
  assert.equal(journals.length,1,'revoking publication deletes shared entry');
  assert.equal(publicData.issues.length,0);
  console.log('PASS: 40+ smoke assertions — storage, legacy and restricted publishing, Journal ownership, category moves, canvas, security');

}
run().catch(err => {console.error(err);process.exitCode=1});
