const ASSETS = 'assets/';
const resources = [
  {key:'mythic', label:'Mythic Gear', icon:'materials/mythic.png'},
  {key:'mithril', label:'Mithril', icon:'materials/mithril.png'},
  {key:'exp', label:'Enhancement XP', icon:'materials/exp.png'},
  {key:'hammers', label:'Forge Hammers', icon:'materials/hammers.png'},
];

const troops = [
  {key:'archer', label:'Archer', emoji:'🏹'},
  {key:'infantry', label:'Infantry', emoji:'🛡️'},
  {key:'cavalry', label:'Cavalry', emoji:'🐎'},
];

const slots = [
  {key:'helmet', label:'Helmet', path:'attack', specialty:'lethality'},
  {key:'gloves', label:'Gloves', path:'defense', specialty:'health'},
  {key:'chest', label:'Chest', path:'attack', specialty:'health'},
  {key:'boots', label:'Boots', path:'defense', specialty:'lethality'},
];

const stageValues = [1,19,39,59,79,99,100];
const forgeValues = Array.from({length:11}, (_,i)=>10+i);
const stageLabels = {1:'Base',19:'+19',39:'+39',59:'+59',79:'+79',99:'+99',100:'+100'};

const expReqs = {
  19:{mithril:0,mythic:2,exp:52650,hammers:0},
  39:{mithril:10,mythic:5,exp:75050,hammers:0},
  59:{mithril:20,mythic:5,exp:93100,hammers:0},
  79:{mithril:30,mythic:5,exp:121600,hammers:0},
  99:{mithril:40,mythic:10,exp:159600,hammers:0},
  100:{mithril:50,mythic:10,exp:0,hammers:0},
};
const forgeReqs = Object.fromEntries(Array.from({length:10}, (_,i)=>{
  const lvl = 11+i;
  return [lvl, {hammers:lvl*10, mythic:lvl-10, mithril:0, exp:0}];
}));

const fmt = new Intl.NumberFormat('en-US');
const emptyCost = () => ({mythic:0,mithril:0,exp:0,hammers:0});
const addCost = (a,b) => ({mythic:a.mythic+b.mythic,mithril:a.mithril+b.mithril,exp:a.exp+b.exp,hammers:a.hammers+b.hammers});
const clone = obj => JSON.parse(JSON.stringify(obj));
const num = v => Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0;
const isUnlimited = available => available === 0;
const enough = (available, required) => isUnlimited(available) || available >= required;
const displayRemaining = (available, required) => isUnlimited(available) ? '∞' : fmt.format(available-required);
const stageLabel = v => stageLabels[v] || `+${v}`;
const shortRes = key => ({mythic:'MG',mithril:'Mithril',exp:'XP',hammers:'Hammer'}[key]);

function gearAsset(troopKey, slotKey) {
  return `${ASSETS}gears/${troopKey}_${slotKey}.png`;
}
function stageClass(stage) {
  if(stage === 100) return 'imbue-100';
  if(stage >= 99) return 'imbue-99';
  if(stage >= 79) return 'imbue-79';
  if(stage >= 59) return 'imbue-59';
  if(stage >= 39) return 'imbue-39';
  if(stage >= 19) return 'imbue-19';
  return 'imbue-base';
}
function defaultGear(){
  const gear = {};
  for(const t of troops){
    gear[t.key]={};
    for(const s of slots){
      gear[t.key][s.key] = {currentExp:1,currentForge:10,targetExp:1,targetForge:10};
    }
  }
  return gear;
}
const defaultState = () => ({
  backpack:{mythic:0,mithril:0,exp:0,hammers:0},
  activeTroop:'archer',
  gear:defaultGear(),
  version:4,
});

let state = loadActive() || defaultState();
let pendingSuggestion = null;

/* ---- Current-gear edit guard ----
   Target steppers are always editable (planning is the common action).
   Current steppers are locked by default so they can't be nudged by accident.
   They can be unlocked per-card (unlockedCards) or all at once (editCurrentMode).
   This UI state is intentionally ephemeral and never persisted. */
let editCurrentMode = false;
let backpackOpen = false;
const unlockedCards = new Set();
function cardKey(troopKey, slotKey){return troopKey + '/' + slotKey;}
function isCurrentEditable(troopKey, slotKey){return editCurrentMode || unlockedCards.has(cardKey(troopKey, slotKey));}

function validStage(v){v=+v; return stageValues.includes(v)?v:1}
function validForge(v){v=+v; return forgeValues.includes(v)?v:10}
function normalizeState(st){
  const base = defaultState();
  st = st || base;
  st.backpack = {...base.backpack, ...(st.backpack||{})};
  st.gear = st.gear || base.gear;
  for(const t of troops){
    st.gear[t.key] = st.gear[t.key] || {};
    for(const s of slots){
      st.gear[t.key][s.key] = {...base.gear[t.key][s.key], ...(st.gear[t.key][s.key]||{})};
      const g = st.gear[t.key][s.key];
      g.currentExp = validStage(g.currentExp);
      g.targetExp = validStage(g.targetExp);
      g.currentForge = validForge(g.currentForge);
      g.targetForge = validForge(g.targetForge);
      if(g.targetExp < g.currentExp) g.targetExp = g.currentExp;
      if(g.targetForge < g.currentForge) g.targetForge = g.currentForge;
    }
  }
  st.activeTroop = st.activeTroop || 'archer';
  return st;
}
function saveActive(){localStorage.setItem('ksGearPlanner.active', JSON.stringify(state));}
function loadActive(){try{return normalizeState(JSON.parse(localStorage.getItem('ksGearPlanner.active')))}catch(e){return null}}

/* ---- Named configurations ---- */
let activeConfigId = localStorage.getItem('ksGearPlanner.activeConfig') || null;
let savedSnapshot = null;

function fingerprint(st=state){return JSON.stringify({backpack:st.backpack, gear:st.gear});}
function isDirty(){return !!(activeConfigId && savedSnapshot !== null && fingerprint() !== savedSnapshot);}
function genId(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

function loadConfigIndex(){
  try{const arr=JSON.parse(localStorage.getItem('ksGearPlanner.configs')); return Array.isArray(arr)?arr:[];}
  catch(e){return [];}
}
function saveConfigIndex(list){localStorage.setItem('ksGearPlanner.configs', JSON.stringify(list));}
function configName(id){const c=loadConfigIndex().find(c=>c.id===id); return c?c.name:'';}

// One-time migration from the old fixed numbered slots.
function migrateLegacySlots(){
  if(loadConfigIndex().length) return;
  const list=[];
  for(let i=1;i<=5;i++){
    const raw=localStorage.getItem('ksGearPlanner.slot.'+i);
    if(!raw) continue;
    const id=genId();
    localStorage.setItem('ksGearPlanner.config.'+id, raw);
    list.push({id, name:'Slot '+i});
    localStorage.removeItem('ksGearPlanner.slot.'+i);
  }
  if(list.length) saveConfigIndex(list);
}
migrateLegacySlots();

function renderSlotOptions(){
  const sel=document.getElementById('slotSelect');
  if(!sel) return;
  const prev=sel.value;
  sel.textContent='';
  const newOpt=document.createElement('option');
  newOpt.value='__new__';
  newOpt.textContent='➕ New configuration';
  sel.appendChild(newOpt);
  for(const c of loadConfigIndex()){
    const opt=document.createElement('option');
    opt.value=c.id;            // value set as attribute, name only via textContent (XSS-safe)
    opt.textContent=c.name;
    sel.appendChild(opt);
  }
  const wanted = activeConfigId || prev;
  sel.value = [...sel.options].some(o=>o.value===wanted) ? wanted : '__new__';
}

function updateConfigHeader(){
  const name = activeConfigId ? configName(activeConfigId) : '';
  const title=document.getElementById('backpackTitle');
  if(title) title.textContent = name ? 'Backpack — '+name : 'Backpack';
  const pill=document.getElementById('dirtyPill');
  if(pill) pill.hidden = !isDirty();
}

// Load a saved config into state and make it active. Returns true on success.
function applyConfig(id){
  const raw=localStorage.getItem('ksGearPlanner.config.'+id);
  if(!raw){flash('Configuration is empty', true); return false;}
  try{
    state=normalizeState(JSON.parse(raw));
    activeConfigId=id;
    editCurrentMode=false;
    backpackOpen=false;
    unlockedCards.clear();
    localStorage.setItem('ksGearPlanner.activeConfig', id);
    savedSnapshot=fingerprint();
    document.getElementById('slotName').value=configName(id);
    render();
    renderSlotOptions();
    return true;
  }catch(e){flash('Could not load configuration', true); return false;}
}


function rangeCost(table, current, target){
  let c = emptyCost();
  for(const lvl of Object.keys(table).map(Number).sort((a,b)=>a-b)){
    if(lvl > current && lvl <= target) c = addCost(c, table[lvl]);
  }
  return c;
}
function enhancementCost(cur,tgt){return tgt<=cur ? emptyCost() : rangeCost(expReqs, cur, tgt)}
function forgeCost(cur,tgt){return tgt<=cur ? emptyCost() : rangeCost(forgeReqs, cur, tgt)}
function gearCost(g){return addCost(enhancementCost(g.currentExp,g.targetExp), forgeCost(g.currentForge,g.targetForge))}
function totalCost(gear=state.gear){
  let total = emptyCost();
  for(const t of troops) for(const s of slots) total = addCost(total, gearCost(gear[t.key][s.key]));
  return total;
}
function planEnough(cost=totalCost(), backpack=state.backpack){
  return resources.every(r=>enough(num(backpack[r.key]), cost[r.key]));
}

function boostFor(slotKey, troopKey){
  const troopLabel = troops.find(t=>t.key===troopKey).label;
  const isAttack = slots.find(s=>s.key===slotKey).path === 'attack';
  if(isAttack){
    return [
      {unlock:39, badge:'+20', type:'troopAttack', label:`${troopLabel} Attack`, mode:'Expedition', value:20.0},
      {unlock:59, badge:'+40', type:'heroHealth', label:'Hero Health Up', mode:'Conquest', value:7.5},
      {unlock:79, badge:'+60', type:'troopDefense', label:`${troopLabel} Defense`, mode:'Expedition', value:30.0},
      {unlock:99, badge:'+80', type:'heroAttack', label:'Hero Attack Up', mode:'Conquest', value:15.0},
      {unlock:100, badge:'+100', type:'troopAttack', label:`${troopLabel} Attack`, mode:'Expedition', value:50.0},
    ];
  }
  return [
    {unlock:39, badge:'+20', type:'troopDefense', label:`${troopLabel} Defense`, mode:'Expedition', value:20.0},
    {unlock:59, badge:'+40', type:'heroHealth', label:'Hero Health Up', mode:'Conquest', value:7.5},
    {unlock:79, badge:'+60', type:'troopAttack', label:`${troopLabel} Attack`, mode:'Expedition', value:30.0},
    {unlock:99, badge:'+80', type:'heroDefense', label:'Hero Defense Up', mode:'Conquest', value:15.0},
    {unlock:100, badge:'+100', type:'troopDefense', label:`${troopLabel} Defense`, mode:'Expedition', value:50.0},
  ];
}
function gainedBoosts(troopKey, slotKey, cur, tgt){
  return boostFor(slotKey,troopKey).filter(b=>b.unlock>cur && b.unlock<=tgt);
}

/* ---- Specialty-stat model (drives the suggestion engine + specialty card) ----
   Each gear piece has a specialty stat: Lethality (helmet/boots = offense) or
   Health (gloves/chest = defense). The milestone imbue stage (1..100) maps to the
   in-game gear level 101..200, giving 50.5%..100% of the piece's specialty stat.
   The forge level (10..20) multiplies that specialty stat by 100%..200%.
   Effective contribution = imbueFrac(stage) * forgeMult(forge). */
const imbueFrac = stage => (50 + 0.5*stage) / 100;     // 0.505 (base) .. 1.0 (+100)
const forgeMult = level => (100 + 10*(level-10)) / 100; // 1.0 (Lv.10) .. 2.0 (Lv.20)
const specialtyOf = slotKey => slots.find(s=>s.key===slotKey).specialty;
const slotBucket = slotKey => specialtyOf(slotKey)==='lethality' ? 'offense' : 'defense';
const effectiveSpecialty = (stage, forge) => imbueFrac(stage) * forgeMult(forge) * 100;

function aggregateGains(gear=state.gear){
  const map = new Map();
  for(const t of troops) for(const s of slots){
    const g = gear[t.key][s.key];
    for(const b of gainedBoosts(t.key,s.key,g.currentExp,g.targetExp)){
      const key = `${b.mode}|${b.type}|${b.label}`;
      map.set(key, (map.get(key)||0)+b.value);
    }
    // Specialty stat (Lethality/Health) effective gain, including the forge multiplier.
    const gain = effectiveSpecialty(g.targetExp, g.targetForge) - effectiveSpecialty(g.currentExp, g.currentForge);
    if(gain > 0.05){
      const spec = specialtyOf(s.key);
      const type = spec==='lethality' ? 'troopLethality' : 'troopHealth';
      const label = `${t.label} ${spec==='lethality'?'Lethality':'Health'}`;
      const key = `Gear Specialty|${type}|${label}`;
      map.set(key, (map.get(key)||0)+gain);
    }
  }
  return [...map.entries()].map(([k,v])=>{const [mode,type,label]=k.split('|'); return {mode,type,label,value:v}});
}

// Builds one troop card: all 4 gears (current → new when changed) grouped together,
// followed by the troop's combined material cost as pills. getFromTo(troop,slot)
// returns {fromExp,fromForge,toExp,toForge}. Shared by overview and the suggestion modal.
function troopOverviewCard(troopKey, getFromTo){
  const t = troops.find(x=>x.key===troopKey);
  let cost = emptyCost();
  const cells = slots.map(s=>{
    const ft = getFromTo(troopKey, s.key);
    const cellChanged = ft.fromExp!==ft.toExp || ft.fromForge!==ft.toForge;
    cost = addCost(cost, addCost(enhancementCost(ft.fromExp,ft.toExp), forgeCost(ft.fromForge,ft.toForge)));
    return `<div class="troop-gear-cell">
      <div class="overview-preview">
        ${tileHtml(troopKey, s.key, ft.fromExp, ft.fromForge, true)}
        ${cellChanged ? `<div class="upgrade-arrow">➜</div>${tileHtml(troopKey, s.key, ft.toExp, ft.toForge, true)}` : ''}
      </div>
    </div>`;
  }).join('');
  const pills = resources.filter(r=>cost[r.key]>0).map(r=>resourceChip(r, cost[r.key])).join('');
  return `<div class="overview-card troop-overview-card">
    <div class="overview-header">${t.emoji} ${t.label}</div>
    <div class="troop-gear-grid">${cells}</div>
    <div class="troop-cost-pills">${pills || '<span class="muted">No upgrades planned</span>'}</div>
  </div>`;
}

// Consolidated bonus stats card: grouped by game mode, color-coded per stat type.
function statsCard(gains){
  let body;
  if(!gains.length){
    body = '<div class="stat-empty">No bonus stats yet — plan some upgrades.</div>';
  } else {
    const modeOrder = ['Gear Specialty','Conquest','Expedition'];
    const modes = [...new Set(gains.map(g=>g.mode))]
      .sort((a,b)=>modeOrder.indexOf(a)-modeOrder.indexOf(b));
    body = modes.map(mode=>{
      const lines = gains.filter(g=>g.mode===mode).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>
        `<div class="stat-line stat-${g.type}"><span class="stat-label">${g.label}</span><span class="stat-value">+${g.value.toFixed(1)}%</span></div>`
      ).join('');
      return `<div class="stat-group"><div class="stat-group-head">${mode}</div>${lines}</div>`;
    }).join('');
  }
  return `<div class="overview-card stats-overview-card">
    <div class="overview-header">✨ Total imbuement bonuses</div>
    ${body}
  </div>`;
}

function render(){
  normalizeState(state);
  renderResources();
  renderTabs();
  renderTroops();
  renderOverview();
  updateConfigHeader();
  updateEditCurrentBtn();
  updateBackpackBtn();
  saveActive();
}

function updateEditCurrentBtn(){
  const btn=document.getElementById('editCurrentBtn');
  if(!btn) return;
  btn.textContent = editCurrentMode ? '✏️ Editing current — done' : '🔒 Edit current';
  btn.classList.toggle('active', editCurrentMode);
  document.body.classList.toggle('editing-current', editCurrentMode);
}

function renderResources(){
  const cost = totalCost();
  const strip = document.getElementById('resourceStrip');
  strip.innerHTML = resources.map(r=>{
    const av=num(state.backpack[r.key]);
    const cls = isUnlimited(av) ? 'unlimited' : enough(av,cost[r.key]) ? 'ok' : 'bad';
    return `<span class="mat-chip ${cls}" data-chip="${r.key}" title="${r.label} — remaining">
      <img src="${ASSETS+r.icon}" alt="${r.label}">
      <span class="mat-chip-val">${displayRemaining(av,cost[r.key])}</span>
    </span>`;
  }).join('');

  const grid = document.getElementById('resourceGrid');
  grid.innerHTML = resources.map(r=>{
    const av=num(state.backpack[r.key]);
    const ok=enough(av,cost[r.key]);
    const cls = isUnlimited(av) ? 'unlimited' : ok ? 'ok' : 'bad';
    const status = isUnlimited(av) ? 'Unlimited' : ok ? 'Enough' : 'Missing';
    return `<div class="material-card ${cls}" data-card="${r.key}">
      <div class="material-top">
        <div class="material-icon"><img src="${ASSETS+r.icon}" alt="${r.label}"></div>
        <div>
          <div class="material-name">${r.label}</div>
          <div class="material-status">${status}</div>
        </div>
      </div>
      <input type="number" min="0" step="1" inputmode="numeric" value="${av}" data-resource="${r.key}" aria-label="${r.label}">
      <div class="material-meta">
        <div class="mini-stat"><span>Cost</span><strong>${fmt.format(cost[r.key])}</strong></div>
        <div class="mini-stat"><span>Left</span><strong>${displayRemaining(av,cost[r.key])}</strong></div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-resource]').forEach(input=>{
    input.addEventListener('change', e=>{state.backpack[e.target.dataset.resource]=num(e.target.value); render();});
    input.addEventListener('input', e=>{state.backpack[e.target.dataset.resource]=num(e.target.value); refreshResourceStatuses(); renderOverview(); updateConfigHeader(); saveActive();});
  });

  refreshResourceStatuses(cost);
}

// Updates resource card statuses in place without rebuilding the grid,
// so a focused input is never destroyed while the user is typing.
function refreshResourceStatuses(cost=totalCost()){
  const grid = document.getElementById('resourceGrid');
  resources.forEach(r=>{
    const card = grid.querySelector(`[data-card="${r.key}"]`);
    if(!card) return;
    const av=num(state.backpack[r.key]);
    const ok=enough(av,cost[r.key]);
    const cls = isUnlimited(av) ? 'unlimited' : ok ? 'ok' : 'bad';
    const status = isUnlimited(av) ? 'Unlimited' : ok ? 'Enough' : 'Missing';
    card.className = `material-card ${cls}`;
    const statusEl = card.querySelector('.material-status');
    if(statusEl) statusEl.textContent = status;
    const leftEl = card.querySelector('.mini-stat:last-child strong');
    if(leftEl) leftEl.textContent = displayRemaining(av,cost[r.key]);

    const chip = document.querySelector(`[data-chip="${r.key}"]`);
    if(chip){
      chip.className = `mat-chip ${cls}`;
      const chipVal = chip.querySelector('.mat-chip-val');
      if(chipVal) chipVal.textContent = displayRemaining(av,cost[r.key]);
    }
  });

  const ok = planEnough(cost);
  document.getElementById('overallStatus').className = 'pill ' + (ok ? 'ok' : 'bad');
  document.getElementById('overallStatus').textContent = ok ? '✅ Enough materials' : '⚠️ Missing materials';
}

function renderTabs(){
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = troops.map(t=>`<button class="troop-tab ${state.activeTroop===t.key?'active':''}" data-tab="${t.key}">${t.emoji} ${t.label}</button>`).join('');
  tabs.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{state.activeTroop=btn.dataset.tab; render();}));
}

function renderTroops(){
  const wrap = document.getElementById('troopWrap');
  wrap.innerHTML = troops.map(t=>`
    <section class="troop-panel ${state.activeTroop===t.key?'active':''}">
      <div class="troop-title">
        <div>
          <h2>${t.emoji} ${t.label}</h2>
          <small class="muted">Helmet · Gloves · Chest · Boots</small>
        </div>
      </div>
      <div class="gear-list">${slots.map(s=>gearCard(t,s)).join('')}</div>
    </section>
  `).join('');

  wrap.querySelectorAll('[data-step]').forEach(btn=>btn.addEventListener('click', onStepClick));
  wrap.querySelectorAll('[data-lock]').forEach(btn=>btn.addEventListener('click', onLockToggle));
}

function tileHtml(troopKey, slotKey, exp, forge, small=false){
  return `<div class="game-tile ${small ? 'small' : ''}">
    <img class="tile-img" src="${gearAsset(troopKey, slotKey)}" alt="">
    <div class="imbue-pill ${stageClass(exp)}">${stageLabel(exp)}</div>
    <div class="forge-label">Lv.${forge}</div>
  </div>`;
}

function changed(g){return g.currentExp!==g.targetExp || g.currentForge!==g.targetForge;}

function gearCard(t,s){
  const g = state.gear[t.key][s.key];
  const c = gearCost(g);
  const boosts = gainedBoosts(t.key,s.key,g.currentExp,g.targetExp);
  const isChanged = changed(g);
  return `<article class="gear-card">
    <div class="gear-main">
      <div class="gear-summary">
        <div class="gear-header">
          <div>
            <h3>${t.label} ${s.label}</h3>
          </div>
        </div>

        <div class="upgrade-preview">
          ${tileHtml(t.key, s.key, g.currentExp, g.currentForge)}
          ${isChanged ? `<div class="upgrade-arrow">➜</div>${tileHtml(t.key, s.key, g.targetExp, g.targetForge)}` : ''}
        </div>
      </div>

      <div class="level-controls">
        ${levelRow('Current', t.key, s.key, g, 'current')}
        ${levelRow('Target', t.key, s.key, g, 'target')}
      </div>
    </div>

    <div class="gain-list">
      ${boosts.length ? boosts.map(b=>`<div class="gain-row stat-${b.type}"><span><b>${b.badge}</b> (${b.mode}) ${b.label}</span><span class="gain-badge">+${b.value.toFixed(1)}%</span></div>`).join('') : '<div class="gain-row empty">No new imbuement bonus at this target.</div>'}
    </div>

    <details>
      <summary>Cost breakdown</summary>
      <div class="details-body">
        ${breakdownHtml('Enhancement ' + stageLabel(g.currentExp) + ' → ' + stageLabel(g.targetExp), enhancementCost(g.currentExp,g.targetExp))}
        ${breakdownHtml('Forge Lv.' + g.currentForge + ' → Lv.' + g.targetForge, forgeCost(g.currentForge,g.targetForge))}
      </div>
    </details>
  </article>`;
}

function resourceChip(resource, value){
  return `<div class="resource-chip"><img src="${ASSETS+resource.icon}" alt=""><span>${fmt.format(value)}</span></div>`;
}

function levelRow(label, troopKey, slotKey, g, mode){
  const expField = mode === 'current' ? 'currentExp' : 'targetExp';
  const forgeField = mode === 'current' ? 'currentForge' : 'targetForge';

  const expMinIndex = mode === 'target' ? stageValues.indexOf(g.currentExp) : 0;
  const expMaxIndex = stageValues.length - 1;
  const expIndex = stageValues.indexOf(g[expField]);

  const forgeMinIndex = mode === 'target' ? forgeValues.indexOf(g.currentForge) : 0;
  const forgeMaxIndex = forgeValues.length - 1;
  const forgeIndex = forgeValues.indexOf(g[forgeField]);

  const locked = mode === 'current' && !isCurrentEditable(troopKey, slotKey);
  const lockBtn = mode === 'current'
    ? `<button class="current-lock-btn" data-lock="${cardKey(troopKey, slotKey)}" title="${locked ? 'Unlock to edit your current gear for this piece' : 'Lock current gear for this piece'}" aria-pressed="${locked ? 'false' : 'true'}">${locked ? '🔒' : '✏️'}</button>`
    : '';

  return `<div class="level-row ${mode}${locked ? ' locked' : ''}">
    <div class="level-label">${label}${lockBtn}</div>
    <div class="stepper-group">
      ${stepper('Imbue', troopKey, slotKey, expField, stageLabel(g[expField]), expIndex > expMinIndex, expIndex < expMaxIndex, locked)}
      ${stepper('Forge', troopKey, slotKey, forgeField, g[forgeField], forgeIndex > forgeMinIndex, forgeIndex < forgeMaxIndex, locked)}
    </div>
  </div>`;
}

function stepper(title, troopKey, slotKey, field, value, canMinus, canPlus, locked=false){
  return `<div class="stepper">
    <button class="step-btn" data-step="-1" data-troop="${troopKey}" data-slot="${slotKey}" data-field="${field}" ${(locked || !canMinus)?'disabled':''}>−</button>
    <div class="step-value">${value}</div>
    <button class="step-btn" data-step="1" data-troop="${troopKey}" data-slot="${slotKey}" data-field="${field}" ${(locked || !canPlus)?'disabled':''}>+</button>
    <div class="stepper-title">${title}</div>
  </div>`;
}

function onStepClick(e){
  const btn = e.currentTarget;
  const {troop, slot, field} = btn.dataset;
  const dir = Number(btn.dataset.step);
  const g = state.gear[troop][slot];

  // Current steppers are locked unless explicitly unlocked, so a stray tap
  // can't silently rewrite the planned target.
  if(field.startsWith('current') && !isCurrentEditable(troop, slot)) return;

  const isExp = field.includes('Exp');
  const values = isExp ? stageValues : forgeValues;
  let idx = values.indexOf(g[field]);
  idx = Math.max(0, Math.min(values.length - 1, idx + dir));
  let next = values[idx];

  if(field === 'targetExp' && next < g.currentExp) next = g.currentExp;
  if(field === 'targetForge' && next < g.currentForge) next = g.currentForge;

  g[field] = next;

  if(field === 'currentExp' && g.targetExp < g.currentExp) g.targetExp = g.currentExp;
  if(field === 'currentForge' && g.targetForge < g.currentForge) g.targetForge = g.currentForge;

  render();
}

function onLockToggle(e){
  const key = e.currentTarget.dataset.lock;
  if(unlockedCards.has(key)) unlockedCards.delete(key); else unlockedCards.add(key);
  render();
}

function onEditCurrentToggle(){
  editCurrentMode = !editCurrentMode;
  if(!editCurrentMode) unlockedCards.clear();
  render();
}

/* ---- Backpack drawer: draggable full-screen bottom-sheet (mobile) ---- */
const isDesktop = () => window.matchMedia('(min-width: 720px)').matches;
const BP_BOTTOM_GAP = 12;   // px gap left below the open sheet
let bpFloating = false;     // section lifted into a fixed overlay
let bpDragging = false;     // finger currently down on the handle
let bpSpacer = null;        // flow placeholder while floating
let bpBaseHeight = 0;       // closed section height (header + pills + handle)
let bpFloatTop = 0, bpFloatLeft = 0, bpFloatWidth = 0;
let bpOpenHeight = 0;       // target drawer height when fully open
let bpAnimating = false;    // open/close transition in progress
let bpAnimTimer = 0;        // fallback timer to settle the animation

function bpEls(){
  return {
    section: document.getElementById('backpackSection'),
    drawer: document.getElementById('backpackDrawer'),
    handle: document.getElementById('backpackHandle'),
  };
}

function updateBackpackBtn(){
  const {section, handle} = bpEls();
  if(section) section.classList.toggle('open', backpackOpen);
  if(handle){
    handle.setAttribute('aria-expanded', backpackOpen ? 'true' : 'false');
    handle.setAttribute('aria-label', backpackOpen ? 'Collapse backpack editor' : 'Expand backpack editor');
  }
  const editBtn = document.getElementById('backpackEditBtn');
  if(editBtn){
    editBtn.setAttribute('aria-expanded', backpackOpen ? 'true' : 'false');
    editBtn.textContent = backpackOpen ? '✕ Hide materials' : '✏️ Edit materials';
  }
  syncDrawerHeight();
}

function setScrollLock(on){
  document.documentElement.classList.toggle('bp-scroll-lock', on);
  document.body.classList.toggle('bp-scroll-lock', on);
}

function setStuck(stuck){
  const {section} = bpEls();
  if(section) section.classList.toggle('stuck', stuck);
}

// Lift the section out of flow into a fixed overlay anchored exactly where it
// currently sits, leaving a placeholder so the page below never moves.
function floatSection(){
  const {section} = bpEls();
  if(!section || bpFloating) return;
  const rect = section.getBoundingClientRect();
  bpBaseHeight = rect.height;          // drawer is collapsed here, so this is the closed height
  bpFloatTop = rect.top;
  bpFloatLeft = rect.left;
  bpFloatWidth = rect.width;

  const cs = getComputedStyle(section);
  bpSpacer = document.createElement('div');
  bpSpacer.setAttribute('aria-hidden', 'true');
  bpSpacer.style.height = rect.height + 'px';
  bpSpacer.style.marginTop = cs.marginTop;
  bpSpacer.style.marginBottom = cs.marginBottom;
  section.parentNode.insertBefore(bpSpacer, section);

  section.classList.add('floating');
  section.style.top = bpFloatTop + 'px';
  section.style.left = bpFloatLeft + 'px';
  section.style.width = bpFloatWidth + 'px';
  setStuck(bpFloatTop <= 0.5);
  setScrollLock(true);
  bpFloating = true;
}

function unfloatSection(){
  const {section} = bpEls();
  if(!section || !bpFloating) return;
  section.classList.remove('floating');
  section.style.top = section.style.left = section.style.width = '';
  if(bpSpacer){ bpSpacer.remove(); bpSpacer = null; }
  setScrollLock(false);
  bpFloating = false;
  setStuck(section.getBoundingClientRect().top <= 0.5);
}

// Drawer height that makes the sheet fill the screen down to the bottom gap.
function computeOpenHeight(){
  return Math.max(0, window.innerHeight - BP_BOTTOM_GAP - bpFloatTop - bpBaseHeight);
}

function syncDrawerHeight(){
  const {drawer} = bpEls();
  if(!drawer) return;
  if(isDesktop()){ drawer.style.height = ''; return; }
  if(bpDragging || bpAnimating) return;
  drawer.classList.remove('dragging');
  if(backpackOpen){
    if(!bpFloating) floatSection();
    bpOpenHeight = computeOpenHeight();
    drawer.style.height = bpOpenHeight + 'px';
  } else {
    drawer.style.height = '0px';
    if(bpFloating) unfloatSection();
  }
}

function animateDrawerTo(open){
  const {drawer} = bpEls();
  if(!drawer) return;
  if(open && !bpFloating) floatSection();
  bpOpenHeight = computeOpenHeight();
  const start = parseFloat(drawer.style.height) || 0;
  const target = open ? bpOpenHeight : 0;
  // Establish an explicit starting height so the transition can run.
  drawer.style.height = start + 'px';
  drawer.classList.remove('dragging');
  void drawer.offsetHeight;                 // force reflow
  backpackOpen = open;
  bpAnimating = (start !== target);
  drawer.style.height = target + 'px';
  updateBackpackBtn();
  clearTimeout(bpAnimTimer);
  if(!bpAnimating){
    if(!open) unfloatSection();
  } else {
    bpAnimTimer = setTimeout(()=>{
      bpAnimating = false;
      if(!backpackOpen && !bpDragging) unfloatSection();
    }, 520);
  }
}

function setBackpackOpen(open){
  if(isDesktop()){ backpackOpen = open; updateBackpackBtn(); return; }
  animateDrawerTo(open);
}

function initBackpackDrawer(){
  const {handle, drawer, section} = bpEls();
  if(!handle || !drawer || !section) return;

  let startY = 0, startHeight = 0;
  let lastY = 0, lastT = 0, velocity = 0, moved = 0, downT = 0;
  const TAP_MOVE = 8;       // px of movement still counts as a tap
  const TAP_TIME = 250;     // ms under which a small move is a tap
  const FLICK_VEL = 0.5;    // px/ms flick threshold

  function onMove(e){
    if(!bpDragging) return;
    const y = e.clientY;
    const now = e.timeStamp || performance.now();
    const dt = now - lastT;
    if(dt > 0) velocity = (y - lastY) / dt;
    lastY = y; lastT = now;
    const dy = y - startY;
    moved = Math.max(moved, Math.abs(dy));
    let h = startHeight + dy;
    if(h < 0) h = 0;
    if(h > bpOpenHeight) h = bpOpenHeight;
    drawer.style.height = h + 'px';
    e.preventDefault();
  }

  function onUp(e){
    if(!bpDragging) return;
    bpDragging = false;
    drawer.classList.remove('dragging');
    handle.releasePointerCapture?.(e.pointerId);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);

    const elapsed = (e.timeStamp || performance.now()) - downT;
    const isTap = moved < TAP_MOVE && elapsed < TAP_TIME;
    if(isTap){ animateDrawerTo(!backpackOpen); return; }

    const h = parseFloat(drawer.style.height) || 0;
    let open;
    if(Math.abs(velocity) > FLICK_VEL) open = velocity > 0;  // flick down opens, up closes
    else open = h > bpOpenHeight / 2;                        // otherwise nearest
    animateDrawerTo(open);
  }

  handle.addEventListener('pointerdown', (e)=>{
    if(isDesktop()) return;
    clearTimeout(bpAnimTimer);
    bpAnimating = false;
    if(!bpFloating) floatSection();
    bpOpenHeight = computeOpenHeight();
    bpDragging = true;
    moved = 0;
    startY = lastY = e.clientY;
    downT = lastT = e.timeStamp || performance.now();
    velocity = 0;
    startHeight = backpackOpen ? bpOpenHeight : 0;
    drawer.classList.add('dragging');
    drawer.style.height = startHeight + 'px';
    handle.setPointerCapture?.(e.pointerId);
    document.addEventListener('pointermove', onMove, {passive:false});
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    e.preventDefault();
  });

  // Keyboard activation (Enter / Space).
  handle.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
      e.preventDefault();
      setBackpackOpen(!backpackOpen);
    }
  });

  // Desktop toggle button for the material edit boxes.
  const editBtn = document.getElementById('backpackEditBtn');
  if(editBtn) editBtn.addEventListener('click', ()=> setBackpackOpen(!backpackOpen));

  // Once a close finishes, drop back into normal flow.
  drawer.addEventListener('transitionend', (e)=>{
    if(e.propertyName !== 'height' || isDesktop()) return;
    clearTimeout(bpAnimTimer);
    bpAnimating = false;
    if(!backpackOpen && !bpDragging) unfloatSection();
  });

  // Square the top corners once the section is pinned to the top edge.
  const onScroll = ()=>{ if(!bpFloating) setStuck(section.getBoundingClientRect().top <= 0.5); };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  window.addEventListener('resize', ()=>{
    if(isDesktop()){
      if(bpFloating) unfloatSection();
      updateBackpackBtn();
      return;
    }
    if(bpFloating && bpSpacer){
      const r = bpSpacer.getBoundingClientRect();
      bpFloatTop = r.top; bpFloatLeft = r.left; bpFloatWidth = r.width;
      section.style.top = bpFloatTop + 'px';
      section.style.left = bpFloatLeft + 'px';
      section.style.width = bpFloatWidth + 'px';
      setStuck(bpFloatTop <= 0.5);
    }
    syncDrawerHeight();
  });

  syncDrawerHeight();
}

function onBackpackToggle(){
  setBackpackOpen(!backpackOpen);
}

function breakdownHtml(title,c){
  return `<div class="breakdown">
    <h4>${title}</h4>
    <ul>${resources.map(r=>`<li><span>${r.label}</span><strong>${fmt.format(c[r.key])}</strong></li>`).join('')}</ul>
  </div>`;
}

function renderOverview(){
  const body = document.getElementById('overviewBody');
  const cards = troops.map(t=>troopOverviewCard(t.key, (tk,sk)=>{
    const g = state.gear[tk][sk];
    return {fromExp:g.currentExp, fromForge:g.currentForge, toExp:g.targetExp, toForge:g.targetForge};
  }));
  cards.push(statsCard(aggregateGains(state.gear)));
  body.innerHTML = cards.join('');

  let changedCount = 0;
  for(const t of troops) for(const s of slots) if(changed(state.gear[t.key][s.key])) changedCount++;
  document.getElementById('overviewCount').textContent = changedCount ? `${changedCount} gear change${changedCount>1?'s':''} planned` : 'No planned changes';
}

document.getElementById('editCurrentBtn').addEventListener('click', onEditCurrentToggle);
document.getElementById('resetTargetsBtn').addEventListener('click',()=>{
  for(const t of troops) for(const s of slots){
    const g=state.gear[t.key][s.key];
    g.targetExp=g.currentExp;
    g.targetForge=g.currentForge;
  }
  render();
});
document.getElementById('resetGearsBtn').addEventListener('click',()=>{
  if(!confirm('Reset ALL gears to base (stage 1 / forge 10)? This clears current and target levels for every piece.')) return;
  for(const t of troops) for(const s of slots){
    state.gear[t.key][s.key] = {currentExp:1, currentForge:10, targetExp:1, targetForge:10};
  }
  render();
  flash('Reset all gears to base');
});
document.getElementById('slotSelect').addEventListener('change',e=>{
  const id=e.target.value;
  if(id==='__new__'){
    // Start a fresh, unnamed config without touching current gear.
    activeConfigId=null; savedSnapshot=null;
    localStorage.removeItem('ksGearPlanner.activeConfig');
    document.getElementById('slotName').value='';
    updateConfigHeader();
    return;
  }
  if(id===activeConfigId) return;
  if(isDirty() && !confirm('Discard unsaved changes and load this configuration?')){
    e.target.value = activeConfigId || '__new__';   // revert selection
    return;
  }
  if(applyConfig(id)) flash(`Loaded “${configName(id)}”`);
});
document.getElementById('saveSlotBtn').addEventListener('click',()=>{
  const sel=document.getElementById('slotSelect');
  const nameInput=document.getElementById('slotName');
  const typed=nameInput.value.trim();
  const list=loadConfigIndex();
  let id=sel.value;
  if(id==='__new__' || !list.some(c=>c.id===id)){
    id=genId();
    list.push({id, name: typed || ('Config '+(list.length+1))});
  }else if(typed){
    const c=list.find(c=>c.id===id); if(c) c.name=typed;
  }
  saveConfigIndex(list);
  localStorage.setItem('ksGearPlanner.config.'+id, JSON.stringify(state));
  activeConfigId=id;
  localStorage.setItem('ksGearPlanner.activeConfig', id);
  savedSnapshot=fingerprint();
  nameInput.value=configName(id);
  renderSlotOptions();
  updateConfigHeader();
  flash(`Saved “${configName(id)}”`);
});
document.getElementById('loadSlotBtn').addEventListener('click', revertToSaved);
function revertToSaved(){
  if(!activeConfigId){flash('No saved configuration is active', true); return;}
  if(!isDirty()){flash('No unsaved changes to revert'); return;}
  if(!confirm('Revert to the last saved version? Unsaved changes will be lost.')) return;
  if(applyConfig(activeConfigId)) flash(`Reverted “${configName(activeConfigId)}”`);
}
const revertSavedBtn = document.getElementById('revertSavedBtn');
if(revertSavedBtn) revertSavedBtn.addEventListener('click', revertToSaved);
document.getElementById('deleteSlotBtn').addEventListener('click',()=>{
  const id=document.getElementById('slotSelect').value;
  if(id==='__new__'){flash('Select a saved configuration first', true); return;}
  const name=configName(id);
  if(!confirm(`Delete configuration “${name}”?`)) return;
  saveConfigIndex(loadConfigIndex().filter(c=>c.id!==id));
  localStorage.removeItem('ksGearPlanner.config.'+id);
  if(activeConfigId===id){
    activeConfigId=null; savedSnapshot=null;
    localStorage.removeItem('ksGearPlanner.activeConfig');
    document.getElementById('slotName').value='';
  }
  renderSlotOptions();
  updateConfigHeader();
  flash(`Deleted “${name}”`);
});
function buildExportPayload(){
  return {...state, configName: activeConfigId ? configName(activeConfigId) : (document.getElementById('slotName').value.trim() || undefined)};
}
// Shared import routine for the manual textarea and the clipboard paste button.
// After loading, preselect the matching saved slot (by name) so Save overwrites it,
// otherwise fall back to "➕ New configuration".
function importFromText(text){
  let parsed;
  try{ parsed=JSON.parse(text); }
  catch(e){ flash('Import failed: invalid JSON', true); return false; }
  state=normalizeState(parsed);
  activeConfigId=null; savedSnapshot=null;
  localStorage.removeItem('ksGearPlanner.activeConfig');
  const name = (parsed && typeof parsed.configName==='string') ? parsed.configName : '';
  document.getElementById('slotName').value = name;
  renderSlotOptions();
  const sel=document.getElementById('slotSelect');
  if(sel){
    const match = name ? loadConfigIndex().find(c=>c.name.trim().toLowerCase()===name.trim().toLowerCase()) : null;
    sel.value = match ? match.id : '__new__';
  }
  render();
  flash('Imported setup — Save to keep it');
  return true;
}
function revealManualIO(){
  document.querySelector('.backup').open=true;
  const manual=document.querySelector('.manual-io'); if(manual) manual.open=true;
  document.getElementById('jsonArea').classList.add('show');
}
document.getElementById('copyClipBtn').addEventListener('click',async()=>{
  const text=JSON.stringify(buildExportPayload(),null,2);
  try{
    await navigator.clipboard.writeText(text);
    flash('Copied setup to clipboard');
  }catch(e){
    revealManualIO();
    document.getElementById('jsonText').value=text;
    document.getElementById('jsonText').select();
    flash('Clipboard blocked — copy from the box', true);
  }
});
document.getElementById('pasteClipBtn').addEventListener('click',async()=>{
  let text;
  try{ text=await navigator.clipboard.readText(); }
  catch(e){
    revealManualIO();
    document.getElementById('jsonText').value='';
    document.getElementById('jsonText').focus();
    flash('Clipboard blocked — paste into the box', true);
    return;
  }
  importFromText(text);
});
document.getElementById('exportBtn').addEventListener('click',()=>{
  revealManualIO();
  document.getElementById('jsonText').value=JSON.stringify(buildExportPayload(),null,2);
  document.getElementById('jsonText').select();
});
document.getElementById('showImportBtn').addEventListener('click',()=>{
  document.querySelector('.backup').open=true;
  document.getElementById('jsonArea').classList.toggle('show');
  document.getElementById('jsonText').value='';
});
document.getElementById('importBtn').addEventListener('click',()=>{
  importFromText(document.getElementById('jsonText').value);
});
function flash(text,bad=false){
  const el=document.getElementById('overallStatus');
  const old=el.textContent;
  const cls=el.className;
  el.textContent=(bad?'⚠️ ':'✅ ')+text;
  el.className='pill '+(bad?'bad':'ok');
  setTimeout(()=>{el.textContent=old; el.className=cls}, 1500);
}

document.querySelectorAll('[data-suggest]').forEach(btn=>btn.addEventListener('click',()=>showSuggestion(btn.dataset.suggest)));
document.getElementById('closeSuggestBtn').addEventListener('click',closeSuggest);
document.getElementById('cancelSuggestBtn').addEventListener('click',closeSuggest);
document.getElementById('applySuggestBtn').addEventListener('click',()=>{
  if(pendingSuggestion){state.gear=pendingSuggestion.gear; render();}
  closeSuggest();
});
function closeSuggest(){document.getElementById('suggestModal').classList.remove('show'); pendingSuggestion=null;}

const presetNames={balanced:'Balanced',attack:'Attack Focus',defense:'Defense Focus',bear:'Bear / Damage',castle:'Castle / PvP'};
const troopWeights={
  balanced:{archer:1, cavalry:1, infantry:1},
  attack:{archer:1.35, cavalry:1.15, infantry:.9},
  defense:{infantry:1.35, cavalry:1.1, archer:.85},
  bear:{archer:1.7, cavalry:.2, infantry:.15},
  castle:{infantry:1.4, cavalry:1, archer:1},
};
// Scoring collapses to two buckets: offense (Lethality, helmet/boots) and defense
// (Health, gloves/chest). Attack rides with Lethality and Defense with Health equally,
// and Conquest hero stats are ignored entirely.
const statWeights={
  balanced:{offense:1, defense:1},
  attack:{offense:1.5, defense:.3},
  defense:{offense:.3, defense:1.5},
  bear:{offense:1.7, defense:.1},
  castle:{offense:.5, defense:1.4},
};

function showSuggestion(preset){
  pendingSuggestion = makeSuggestion(preset);
  document.getElementById('suggestTitle').textContent = presetNames[preset]+' suggestion';
  const cost=totalCost(pendingSuggestion.gear);
  const ok=planEnough(cost,state.backpack);
  document.getElementById('suggestResourceStatus').innerHTML = `<span class="pill ${ok?'ok':'bad'}">${ok?'✅ Enough materials':'⚠️ Missing materials'}</span>` + resources.map(r=>{
    const av=num(state.backpack[r.key]);
    return `<span class="pill ${enough(av,cost[r.key])?'info':'bad'}">${shortRes(r.key)} cost ${fmt.format(cost[r.key])}, left ${displayRemaining(av,cost[r.key])}</span>`;
  }).join('');
  document.getElementById('suggestSummary').innerHTML = overviewHtmlForGear(pendingSuggestion.gear);
  document.getElementById('suggestModal').classList.add('show');
}
function makeSuggestion(preset){
  const gear=clone(state.gear);
  for(const t of troops) for(const s of slots){const g=gear[t.key][s.key]; g.targetExp=g.currentExp; g.targetForge=g.currentForge;}
  let remain={};
  for(const r of resources){const av=num(state.backpack[r.key]); remain[r.key]=isUnlimited(av)?Infinity:av;}
  let guard=0;
  while(guard++<300){
    const candidates=[];
    for(const t of troops) for(const s of slots){
      const g=gear[t.key][s.key];
      for(const target of stageValues.filter(v=>v>g.targetExp)){
        const c=enhancementCost(g.targetExp,target);
        if(canAfford(c,remain)){
          const val=enhancementValue(t.key,s.key,g.targetExp,target,g.targetForge,preset);
          if(val>0) candidates.push({kind:'exp',troop:t.key,slot:s.key,target,cost:c,value:val,score:scoreCandidate(val,c,remain)});
        }
      }
      for(const target of forgeValues.filter(v=>v>g.targetForge)){
        const c=forgeCost(g.targetForge,target);
        if(canAfford(c,remain)){
          const val=forgeValue(t.key,s.key,g.targetForge,target,g.targetExp,preset);
          if(val>0) candidates.push({kind:'forge',troop:t.key,slot:s.key,target,cost:c,value:val,score:scoreCandidate(val,c,remain)});
        }
      }
    }
    if(!candidates.length) break;
    candidates.sort((a,b)=>b.score-a.score || b.value-a.value);
    const best=candidates[0];
    const g=gear[best.troop][best.slot];
    if(best.kind==='exp') g.targetExp=best.target; else g.targetForge=best.target;
    remain=pay(best.cost,remain);
  }
  return {preset,gear,remain};
}
function canAfford(c,rem){return resources.every(r=>rem[r.key]===Infinity || rem[r.key]>=c[r.key])}
function pay(c,rem){const next={...rem}; for(const r of resources){if(next[r.key]!==Infinity) next[r.key]-=c[r.key]} return next;}
function scoreCandidate(value,cost,remain){
  let pressure=0;
  const constants={mythic:100,mithril:250,exp:1200000,hammers:2600};
  for(const r of resources){
    if(cost[r.key]<=0) continue;
    if(remain[r.key]===Infinity) pressure += (cost[r.key]/constants[r.key])*.12;
    else pressure += cost[r.key]/Math.max(1,remain[r.key]);
  }
  return value/(pressure+.05);
}
// Imbuing a piece raises its specialty fraction; that gain is multiplied by the
// piece's current forge multiplier (the two stack multiplicatively in-game).
function enhancementValue(troopKey,slotKey,cur,tgt,forge,preset){
  const tw=(troopWeights[preset]||troopWeights.balanced)[troopKey] || 1;
  const sw=statWeights[preset]||statWeights.balanced;
  const gain=(imbueFrac(tgt)-imbueFrac(cur)) * forgeMult(forge) * 100;
  return gain * (sw[slotBucket(slotKey)]||1) * tw;
}
// Forging a piece raises its multiplier; that gain is scaled by the piece's current
// imbue fraction (forging a high-imbue piece is worth more).
function forgeValue(troopKey,slotKey,cur,tgt,stage,preset){
  const tw=(troopWeights[preset]||troopWeights.balanced)[troopKey] || 1;
  const sw=statWeights[preset]||statWeights.balanced;
  const gain=imbueFrac(stage) * (forgeMult(tgt)-forgeMult(cur)) * 100;
  return gain * (sw[slotBucket(slotKey)]||1) * tw;
}

function overviewHtmlForGear(gear){
  const cards = troops.map(t=>troopOverviewCard(t.key, (tk,sk)=>{
    const cur = state.gear[tk][sk];
    const g = gear[tk][sk];
    return {fromExp:cur.currentExp, fromForge:cur.currentForge, toExp:g.targetExp, toForge:g.targetForge};
  }));
  cards.push(statsCard(aggregateGains(gear)));
  return cards.join('');
}

// Initialize named-config UI before first render.
if(activeConfigId && loadConfigIndex().some(c=>c.id===activeConfigId)){
  document.getElementById('slotName').value=configName(activeConfigId);
  savedSnapshot=fingerprint();
}else{
  activeConfigId=null;
  localStorage.removeItem('ksGearPlanner.activeConfig');
}
renderSlotOptions();
render();
initBackpackDrawer();

// Keep the troop tab bar pinned just below the sticky backpack. The backpack's
// height changes (e.g. toggling "Edit backpack" swaps the material strip for the
// grid), so measure it live into --backpack-h, which drives the tab bar's sticky top.
function setupStickyTabs(){
  const backpack=document.getElementById('backpackSection');
  if(!backpack || typeof ResizeObserver==='undefined') return;
  const sync=()=>document.documentElement.style.setProperty('--backpack-h', (bpFloating ? bpBaseHeight : backpack.offsetHeight)+'px');
  new ResizeObserver(sync).observe(backpack);
  sync();
}
setupStickyTabs();
