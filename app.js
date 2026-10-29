'use strict';
(() => {
const data = window.STUDY_DATA;
const $ = id => document.getElementById(id);
if (!data?.cards?.length) { $('question').textContent = 'Не удалось загрузить колоду. Обнови страницу.'; return; }
const cards = data.cards;
const key = 'manifolds-study-progress-v1';
let progress = {};
try { const stored = JSON.parse(localStorage.getItem(key) || '{}'); if (stored && typeof stored === 'object' && !Array.isArray(stored)) progress = stored; } catch (_) {}
let mode = 'cards', queue = [], index = 0, revealed = false, selectedTicket = null;
const statusNames = {known:'✓ Уже знаешь', repeat:'↺ Стоит повторить'};
const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'карточка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'карточки' : 'карточек';
function announce(text) { $('announcement').textContent = text; }
function save() { try { localStorage.setItem(key, JSON.stringify(progress)); } catch (_) { announce('Браузер не разрешил сохранить прогресс. Отметки сохранятся только до закрытия страницы.'); } }
// The source only contains line breaks, not structural HTML. Text nodes retain
// literal less-than signs and prevent source fields from executing any markup.
function mathText(element, text) {
 element.replaceChildren();
 const token = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|(?:\\[a-zA-Z]+(?:\{[^{}]*\})?|[A-Za-zΑ-ω])(?:(?:[_^](?:\{[^{}]*\}|[^\s,.;:(){}+\-−=<>/·]))|\{[^{}]*\})+/g;
 let last = 0;
 for (const match of text.matchAll(token)) {
   element.append(document.createTextNode(text.slice(last,match.index)));
   const span=document.createElement('span');
   let tex=match[0], display=false;
   if(tex.startsWith('\\(')||tex.startsWith('\\[')){display=tex.startsWith('\\[');tex=tex.slice(2,-2);}
   else if(tex.startsWith('$$')){display=true;tex=tex.slice(2,-2);}
   else if(tex.startsWith('$')) tex=tex.slice(1,-1);
   tex=tex.replaceAll('−','-');
   try { window.katex.render(tex,span,{throwOnError:false,strict:'ignore',trust:false,displayMode:display,output:'htmlAndMathml'}); }
   catch (_) { span.textContent=match[0]; }
   element.append(span); last=match.index+match[0].length;
 }
 element.append(document.createTextNode(text.slice(last)));
}
function matches(card) {
 const query=$('search').value.trim().toLocaleLowerCase('ru');
 const state=progress[card.id] || 'new';
 return (!$('deck').value || card.deckId===$('deck').value) && (!$('topic').value || card.section===$('topic').value) && ($('status').value==='all'||$('status').value===state) && (!query || `${card.questionText} ${card.answerText}`.toLocaleLowerCase('ru').includes(query));
}
function updateProgress() {
 const known=cards.filter(c=>progress[c.id]==='known').length;
 $('progress-number').textContent=`${known} / ${cards.length}`;
 $('progress-bar').style.width=`${100*known/cards.length}%`;
}
function rebuild(){queue=cards.filter(matches);index=0;revealed=false;selectedTicket=null;render();}
function render(){
 updateProgress();
 $('cards-mode').classList.toggle('active',mode==='cards');$('tickets-mode').classList.toggle('active',mode==='tickets');
 $('cards-mode').setAttribute('aria-current',mode==='cards'?'page':'false');$('tickets-mode').setAttribute('aria-current',mode==='tickets'?'page':'false');
 $('mode-title').textContent=mode==='cards'?'Практика по карточкам':'Билеты из твоей колоды';
 $('result-count').textContent=`${queue.length} ${plural(queue.length)}`;
 $('card-view').hidden=mode!=='cards'||!queue.length;
 $('ticket-view').hidden=mode!=='tickets'||!queue.length;
 $('empty').hidden=!!queue.length;
 $('shuffle').innerHTML=mode==='cards'?'⇄ <span>Перемешать</span>':'↗ <span>Случайный билет</span>';
 if(!queue.length) return;
 if(mode==='tickets'){renderTickets();return;}
 index=Math.max(0,Math.min(index,queue.length-1));
 const card=queue[index];
 $('card-topic').textContent=card.section?`Билет ${card.ticket} / Раздел ${card.section}`:card.deck;
 $('card-position').textContent=`${String(index+1).padStart(2,'0')} / ${String(queue.length).padStart(2,'0')}`;
 mathText($('question'),card.title || card.questionText);
 mathText($('answer'),card.answerText);
 $('card-status').textContent=statusNames[progress[card.id]]||'Ещё не отмечена';
 $('answer-area').hidden=!revealed;$('reveal').hidden=revealed;$('rating').hidden=!revealed;
 $('reveal-hint').textContent=revealed?'Оцени ответ, чтобы сохранить прогресс':'Попробуй сначала ответить самостоятельно';
 $('prev').disabled=index===0;$('next').disabled=index===queue.length-1;
}
function reveal(){if(mode!=='cards'||!queue.length||revealed)return;revealed=true;render();$('known').focus({preventScroll:true});announce('Ответ открыт. Исходный ответ из Anki, не проверен.');}
function move(delta){if(!queue.length)return;index=Math.max(0,Math.min(index+delta,queue.length-1));revealed=false;render();}
function rate(value){
 if(mode!=='cards'||!queue.length||!revealed)return;
 const oldId=queue[index].id;progress[oldId]=value;save();
 if($('status').value!=='all')queue=cards.filter(matches);else if(index<queue.length-1)index++;
 revealed=false;render();announce(value==='known'?'Отмечено: знаю.':'Отмечено: ещё повторить.');
 if(queue.length)$('reveal').focus({preventScroll:true});
}
function shuffled(list){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function button(text,className,fn){const b=document.createElement('button');b.textContent=text;b.className=className;b.addEventListener('click',fn);return b;}
function renderTickets(){
 const container=$('ticket-view');container.replaceChildren();
 const tickets=data.tickets.filter(t=>queue.some(c=>c.ticket===t.id));
 if(!selectedTicket){
  const grid=document.createElement('div');grid.className='ticket-grid';
  for(const ticket of tickets){
   const items=queue.filter(c=>c.ticket===ticket.id);
   const b=button('', 'ticket-tile',()=>{selectedTicket=ticket.id;renderTickets();});
   const label=document.createElement('span');label.className='tiny-label';label.textContent='ИЗ ИСХОДНОЙ КОЛОДЫ';
   const title=document.createElement('span');title.className='ticket-number';title.textContent=`Билет ${ticket.id} ↗`;
   const info=document.createElement('span');info.className='ticket-description';info.textContent=`${items.length} ${plural(items.length)} · ${new Set(items.map(c=>c.section)).size} разделов`;
   b.append(label,title,info);grid.append(b);
  }container.append(grid);return;
 }
 const items=queue.filter(c=>c.ticket===selectedTicket);
 if(!items.length){selectedTicket=null;renderTickets();return;}
 const panel=document.createElement('div');panel.className='ticket-details';
 panel.append(button('← Все билеты','text-button',()=>{selectedTicket=null;renderTickets();}));
 const title=document.createElement('h3');title.textContent=`Билет ${selectedTicket}`;panel.append(title);
 const info=document.createElement('p');info.textContent='Вопросы сгруппированы по номерам в Anki. Открой вопрос, чтобы свериться с исходным ответом. Ответы не проверены.';panel.append(info);
 const actions=document.createElement('div');actions.className='ticket-actions';
 actions.append(button('Учить карточками →','primary',()=>{queue=[...items];index=0;mode='cards';revealed=false;render();}));
 actions.append(button('Открыть все ответы','secondary',e=>{const all=[...panel.querySelectorAll('details')];const open=all.some(d=>!d.open);for(const d of all)d.open=open;e.currentTarget.textContent=open?'Скрыть все ответы':'Открыть все ответы';}));panel.append(actions);
 for(const card of items){
  const details=document.createElement('details');details.className='ticket-question';
  const summary=document.createElement('summary');const section=document.createElement('small');section.textContent=`РАЗДЕЛ ${card.section}`;
  const question=document.createElement('span');mathText(question,card.title||card.questionText);summary.append(section,question);
  const answer=document.createElement('div');answer.className='answer-content';mathText(answer,card.answerText);
  details.append(summary,answer);panel.append(details);
 }container.append(panel);
}
$('card-count').textContent=cards.length;$('ticket-count').textContent=data.tickets.length;
for(const deck of data.decks.filter(d=>cards.some(c=>c.deckId===String(d.id)))){const o=document.createElement('option');o.value=String(deck.id);o.textContent=deck.name[0].toUpperCase()+deck.name.slice(1);$('deck').append(o);}
const sections=[...new Set(cards.map(c=>c.section).filter(Boolean))];
for(const section of sections){const o=document.createElement('option');o.value=section;const card=cards.find(c=>c.section===section);o.textContent=`${section} · ${card.title.replace(/\.\s*$/,'')}`;$('topic').append(o);}
$('cards-mode').onclick=()=>{mode='cards';selectedTicket=null;render();};$('tickets-mode').onclick=()=>{mode='tickets';selectedTicket=null;render();};
$('search').addEventListener('input',rebuild);for(const id of ['topic','deck','status'])$(id).addEventListener('change',rebuild);
$('reveal').onclick=reveal;$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('repeat').onclick=()=>rate('repeat');$('known').onclick=()=>rate('known');
$('shuffle').onclick=()=>{if(!queue.length)return;if(mode==='cards'){queue=shuffled(queue);index=0;revealed=false;render();announce('Карточки перемешаны.');}else{const tickets=data.tickets.filter(t=>queue.some(c=>c.ticket===t.id));selectedTicket=tickets[Math.floor(Math.random()*tickets.length)].id;renderTickets();}};
$('source-toggle').onclick=()=>{$('source-note').hidden=!$('source-note').hidden;$('source-toggle').setAttribute('aria-expanded',String(!$('source-note').hidden));};
$('reset').onclick=()=>{if(window.confirm('Сбросить все отметки «Знаю» и «Повторить» на этом устройстве?')){progress={};save();rebuild();announce('Отметки сброшены.');}};
$('clear-filters').onclick=()=>{$('topic').value='';$('status').value='all';$('search').value='';rebuild();};
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;if(mode!=='cards')return;if(e.code==='Space'&&!/^(BUTTON|SUMMARY|A)$/.test(e.target.tagName)){e.preventDefault();reveal();}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='1')rate('repeat');if(e.key==='2')rate('known');});
rebuild();
})();
