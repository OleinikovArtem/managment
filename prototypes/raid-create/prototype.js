/* Standalone visual prototype. All mutations stay in memory; no application APIs. */
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name) => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const items = [
  {id:'weapon',name:'Vesper Cutter',meta:'Оружие · S84',file:'weapon_vesper_cutter_i00'},
  {id:'armor',name:'Vesper Noble Breastplate',meta:'Доспех · S84',file:'armor_t94_u_i01'},
  {id:'bews',name:'Blessed Scroll: Enchant Weapon (S-Grade)',meta:'Заточка · S',file:'etc_scroll_of_enchant_weapon_i05'},
  {id:'beas',name:'Blessed Scroll: Enchant Armor (S-Grade)',meta:'Заточка · S',file:'etc_scroll_of_enchant_armor_i05'},
  {id:'stone',name:'High-Grade Life Stone — Lv. 80',meta:'Камень жизни · 80',file:'etc_mineral_rare_i03'},
  {id:'codex',name:"Giant’s Codex",meta:'Улучшение умений',file:'etc_codex_of_giant_i00'},
];
const memberSeed = [
 ['Korsa','Grand Khavatari','grand-khavatari','Duelist','duelist'],
 ['Miva','Cardinal','cardinal','Eva’s Saint','evas-saint'],
 ['Raven','Ghost Hunter','ghost-hunter','Spectral Dancer','spectral-dancer'],
 ['Akira','Sword Muse','sword-muse','Moonlight Sentinel','moonlight-sentinel'],
 ['North','Doomcryer','doomcryer','Titan','titan'],
 ['Shade','Spectral Dancer','spectral-dancer','Ghost Sentinel','ghost-sentinel'],
 ['Vega','Archmage','archmage','Arcana Lord','arcana-lord'],
 ['Storm','Doombringer','doombringer','Judicator','judicator'],
 ['Flint','Titan','titan','Maestro','maestro'],
];
const members = memberSeed.map((data,index) => ({data,present:index<7,profile:0}));
const selected = new Map();
const tileNodes = new Map();
let stage = 3;
let tab = 'recommended';
let forceEmpty = false;
let toastTimer;
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function itemImage(item){return item.file ? `<img class="item-image" src="assets/${item.file}.png" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="item-image">${icon('box')}</span>` : `<span class="item-image">${icon('box')}</span>`;}
function updateSummary(){
 const present=members.filter(m=>m.present).length;
 $('#attendance-count').textContent=`${present} из ${members.length}`;
 $('#loot-count').textContent=`${selected.size} позиций`;
 $('#summary').textContent=`${$('#instance').value || 'Без инстанса'} · Stage ${stage}`;
 $('#summary-detail').textContent=`${present} участников · ${selected.size ? `${selected.size} позиций добычи` : 'без добычи'}`;
 $('#raid-form button[type=submit]').disabled=present===0;
}
function updateMember(index){
 const member=members[index], row=$(`#member-${index}`);
 row.classList.toggle('present',member.present);
 row.querySelector('input').checked=member.present;
 row.querySelector('select').value=String(member.profile);
 const profileIcons=[member.data[2],member.data[4],'cardinal','doombringer','judicator'];
 row.querySelector('.class-icon').src=`/classes/${profileIcons[member.profile]}.png`;
 row.querySelector('.member-status').textContent=member.present?'В рейде':'Отсутствует';
 updateSummary();
}
$('#members').innerHTML=members.map(({data,present},index)=>`<div class="member ${present?'present':''}" id="member-${index}"><div class="member-top"><label><input type="checkbox" ${present?'checked':''} aria-label="Участие: ${data[0]}"><img class="class-icon" src="/classes/${data[2]}.png" alt=""><b>${data[0]}</b></label><span class="member-status">${present?'В рейде':'Отсутствует'}</span></div><select class="profile-select" aria-label="Профиль ${data[0]}"><option value="0">Main · ${data[1]}</option><option value="1">Subclass 1 · ${data[3]}</option><option value="2">Subclass 2 · Cardinal</option><option value="3">Subclass 3 · Doombringer</option><option value="4">Subclass 4 · Judicator</option></select></div>`).join('');
members.forEach((member,index)=>{
 const row=$(`#member-${index}`);
 row.querySelector('input').addEventListener('change',e=>{member.present=e.target.checked;$('#composition').value='manual';updateMember(index);});
 row.querySelector('select').addEventListener('change',e=>{member.profile=Number(e.target.value);const files=[member.data[2],member.data[4],'cardinal','doombringer','judicator'];row.querySelector('img').src=`/classes/${files[member.profile]}.png`;});
});
$('#select-all').onclick=()=>members.forEach((m,i)=>{m.present=true;updateMember(i);});
$('#select-none').onclick=()=>members.forEach((m,i)=>{m.present=false;updateMember(i);});
$('#composition').onchange=e=>{
 if(e.target.value==='manual')return;
 if(!confirm('Заменить выбор участников и профилей выбранным шаблоном?')){e.target.value='manual';return;}
 members.forEach((m,i)=>{m.present=e.target.value==='main'||i<5;m.profile=0;updateMember(i);});
};
$('#last-raid').onclick=()=>{
 if(!confirm('Повторить демонстрационный состав прошлого рейда?'))return;
 members.forEach((m,i)=>{m.present=i<7;updateMember(i);});$('#composition').value='manual';
};
function addItem(item){if(selected.has(item.id)){tileNodes.get(item.id)?.querySelector('.quantity input')?.focus();return;}selected.set(item.id,{quantity:1,comment:''});renderLoot();}
function tileFor(item){
 let node=tileNodes.get(item.id);
 if(!node){
  node=document.createElement('article');node.className='loot-tile';node.dataset.item=item.id;
  node.innerHTML=`${itemImage(item)}<h3>${escapeHtml(item.name)}</h3><span class="item-meta">${escapeHtml(item.meta)}</span><div class="tile-controls"></div>`;
  tileNodes.set(item.id,node);
 }
 const isSelected=selected.has(item.id);
 if(node.classList.contains('selected')!==isSelected || !node.querySelector('.tile-controls').children.length){
  node.classList.toggle('selected',isSelected);
  const controls=node.querySelector('.tile-controls');
  if(isSelected){
   controls.innerHTML=`<button type="button" class="remove" aria-label="Удалить ${escapeHtml(item.name)}">${icon('trash')}</button><div class="quantity"><button type="button" class="decrease" aria-label="Уменьшить ${escapeHtml(item.name)}">−</button><input type="number" min="1" max="1000000" step="1" aria-label="Количество ${escapeHtml(item.name)}"><button type="button" class="increase" aria-label="Увеличить ${escapeHtml(item.name)}">+</button></div><details class="item-note"><summary>Комментарий</summary><input maxlength="500" aria-label="Комментарий ${escapeHtml(item.name)}" placeholder="Заметка к предмету"></details>`;
   controls.querySelector('.remove').onclick=()=>{selected.delete(item.id);renderLoot();$('#add-loot').focus();};
   controls.querySelector('.decrease').onclick=()=>{const entry=selected.get(item.id);entry.quantity=Math.max(1,entry.quantity-1);renderLoot();};
   controls.querySelector('.increase').onclick=()=>{const entry=selected.get(item.id);entry.quantity=Math.min(1000000,entry.quantity+1);renderLoot();};
   controls.querySelector('.quantity input').oninput=e=>{selected.get(item.id).quantity=e.target.value;};
   controls.querySelector('.item-note input').oninput=e=>{selected.get(item.id).comment=e.target.value;};
  }else{
   controls.innerHTML=`<button class="tile-add" type="button" aria-label="Добавить ${escapeHtml(item.name)}">${icon('plus')}</button>`;
   controls.querySelector('button').onclick=()=>addItem(item);
  }
 }
 // Reuse selected DOM nodes so quantity/comment drafts and disclosure state survive Stage changes.
 if(isSelected){const input=node.querySelector('.quantity input');if(document.activeElement!==input)input.value=selected.get(item.id).quantity;node.querySelector('.item-note input').value=selected.get(item.id).comment;}
 return node;
}
function renderLoot(){
 const recommendations=forceEmpty||stage===3?[]:stage===1?items.slice(2,4):items.slice(0,4);
 const visible=tab==='all'?items:tab==='quick'?items.slice(2):recommendations;
 const ids=[...selected.keys(),...visible.map(item=>item.id)].filter((id,index,array)=>array.indexOf(id)===index);
 const grid=$('#loot-grid');
 const nodes=ids.map(id=>tileFor(items.find(item=>item.id===id)));
 let add=$('#add-loot');
 if(!add){add=document.createElement('button');add.type='button';add.id='add-loot';add.className='add-tile';add.innerHTML=`${icon('plus')}<span>Добавить предмет</span>`;add.onclick=openCatalog;}
 const desired=[...nodes,add];
 [...grid.children].forEach(child=>{if(!desired.includes(child))child.remove();});
 desired.forEach((node,index)=>{if(grid.children[index]!==node)grid.insertBefore(node,grid.children[index]??null);});
 grid.classList.toggle('empty-grid',ids.length===0);
 $('#loot-hint').textContent=tab==='recommended'?(recommendations.length?'Демонстрация расположения плиток. Состав предметов условный.':'Для этой стадии рекомендации ещё не заполнены. Добавьте предмет из каталога.') : 'Демонстрационные предметы. Нажмите +, чтобы добавить выпавший предмет.';
 updateSummary();
}
function chooseStage(value){stage=value;$('#stage-label').textContent=`Stage ${stage}`;$('#stage-button').setAttribute('aria-label',`Стадия черновика: Stage ${stage}`);document.querySelectorAll('[data-stage]').forEach(button=>{const active=Number(button.dataset.stage)===stage;button.setAttribute('aria-pressed',String(active));button.querySelector('span').textContent=active?'✓':'';});renderLoot();}
document.querySelectorAll('[data-stage]').forEach(button=>button.onclick=()=>{chooseStage(Number(button.dataset.stage));$('#stage-popover').hidePopover();$('#stage-button').focus();});
$('#instance').addEventListener('change',()=>{renderLoot();});
document.querySelectorAll('[data-tab]').forEach(button=>{
 button.onclick=()=>{tab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1;});$('#loot-panel').setAttribute('aria-labelledby',button.id);renderLoot();};
 button.onkeydown=e=>{const tabs=[...document.querySelectorAll('[data-tab]')];const index=tabs.indexOf(button);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();}};
});
function renderCatalog(){const query=$('#catalog-search').value.trim().toLowerCase();const filtered=items.filter(item=>item.name.toLowerCase().includes(query));$('#catalog-items').innerHTML=filtered.length?filtered.map(item=>`<button type="button" class="catalog-item" data-add="${item.id}">${item.file?`<img src="assets/${item.file}.png" alt="">`:icon('box')}<span>${escapeHtml(item.name)}</span><small>${selected.has(item.id)?'Добавлено':'+'}</small></button>`).join(''):'<p class="loot-hint">Предмет не найден. Можно создать свой ниже.</p>';$('#catalog-items').querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{addItem(items.find(item=>item.id===button.dataset.add));$('#catalog-dialog').close();});}
function openCatalog(){renderCatalog();$('#catalog-dialog').showModal();$('#catalog-search').focus();}
$('#catalog-search').oninput=renderCatalog;
document.querySelectorAll('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('#custom-item-form').onsubmit=e=>{e.preventDefault();const name=$('#custom-item-name').value.trim();if(!name)return;const found=items.find(item=>item.name.toLowerCase()===name.toLowerCase());if(found){addItem(found);}else{const item={id:`custom-${Date.now()}`,name,meta:'Свой предмет · демо',file:null};items.push(item);addItem(item);}$('#catalog-dialog').close();$('#custom-item-name').value='';};
$('#add-instance').onclick=()=>$('#instance-dialog').showModal();
$('#custom-instance-form').onsubmit=e=>{e.preventDefault();const name=$('#custom-instance-name').value.trim();if(!name)return;const option=document.createElement('option');option.value=name;$('#instances').append(option);$('#instance').value=name;$('#instance-dialog').close();renderLoot();};
$('#empty-demo').onclick=()=>{forceEmpty=true;$('#tab-recommended').click();notify('Рекомендации пустые. Выбранный дроп сохранён.');};
function fillDemo(){[['weapon',1],['bews',2],['stone',3],['codex',1]].forEach(([id,quantity])=>{if(!selected.has(id))selected.set(id,{quantity,comment:''});});renderLoot();}
$('#filled-demo').onclick=()=>{fillDemo();notify('Добавлены демонстрационные предметы. В БД ничего не записано.');};
$('#raid-form').onsubmit=e=>{e.preventDefault();const invalid=[...selected.values()].some(item=>!Number.isInteger(Number(item.quantity))||Number(item.quantity)<1||Number(item.quantity)>1000000);if(invalid){notify('Количество должно быть целым от 1 до 1 000 000.');return;}notify('Предпросмотр готов. Это прототип — рейд не записывается в БД.');};
// Read-only inspection seam for local browser verification, not an application endpoint.
window.prototypeSnapshot=()=>({stage,instance:$('#instance').value,name:$('#raid-name').value,date:$('#raid-date').value,comment:$('#raid-comment').value,members:members.map(m=>({name:m.data[0],present:m.present,profile:m.profile})),loot:[...selected.entries()].map(([id,value])=>({id,...value})),partyDefaultStage:3});
if(new URLSearchParams(location.search).get('example')==='filled')fillDemo();
chooseStage(stage);
