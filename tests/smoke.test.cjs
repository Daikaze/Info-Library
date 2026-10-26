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
    const j = {flags:input.flags, getFlag(mod, k) {return this.flags[mod]?.[k]},
      async setFlag(mod, k, value) { this.flags[mod][k] = structuredClone(value); }};
    journals.push(j); return j;
  }
}
const context = vm.createContext({
  Application, JournalEntry, console, structuredClone, setTimeout,
  Hooks: {once() {}, on() {}},
  CONST: {DOCUMENT_OWNERSHIP_LEVELS:{NONE:0}},
  foundry:{utils:{deepClone:structuredClone,randomID:() => `testid${++seq}`,mergeObject:(a,b)=>({...a,...b})}},
  game:{user:{isGM:true},journal:{find:fn=>journals.find(fn)},settings:{
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
  await action('categories'); await action('delete-category',app.store.categories[0].id);
  assert.equal(app.store.entries[0].categoryId,'','deleting category retains entries');
  const unsafe = vm.runInContext('wcImage',context);
  assert.equal(unsafe('javascript:alert(1)'), '');
  const page = vm.runInContext('wcPaperArticle',context)({headline:'<script>fail</script>',body:'**hello** <img src=x>'});
  assert.doesNotMatch(page,/<script>|<img src=x>/);
  assert.match(page,/&lt;script&gt;/);
  console.log('PASS: 20+ smoke assertions — fresh state, CRUD, private/public separation, newspaper pages, article display, export, sanitization');
}
run().catch(err => {console.error(err);process.exitCode=1});
