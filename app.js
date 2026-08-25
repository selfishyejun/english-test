const LETTERS=['A','B','C','D','E'];
const state={type:null,difficulty:null,selected:new Set(),sort:'ordered',orderBlocks:'auto',openMocks:new Set(),openLessons:new Set(),session:[],index:0,lastSelection:[],lastWrong:[]};
const byId=new Map(SOURCE_DATA.map(x=>[x.id,x]));
const views=['landingView','difficultyView','setupView','quizView','resultView'];
const $=id=>document.getElementById(id);
function show(id){views.forEach(v=>$(v).classList.toggle('active',v===id));document.body.classList.toggle('quiz-mode',id==='quizView');window.scrollTo({top:0,behavior:'instant'});}
function wordCount(s){return (s.match(/[A-Za-zÀ-ÿ0-9]+(?:['’\-][A-Za-zÀ-ÿ0-9]+)*/g)||[]).length;}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function sanitizeOrderInput(value,allowed){let out='',seen=new Set();for(const char of String(value)){const upper=char.toUpperCase();if(allowed.includes(upper)&&!seen.has(upper)){out+=char;seen.add(upper);}}return out.slice(0,allowed.length);}
function normalizedOrder(value){return String(value||'').toUpperCase();}
function pickedOrder(q){return normalizedOrder(q.options?q.touchOrder:q.user);}
function toggleOrderPick(q,label){const current=pickedOrder(q).split('');const index=current.indexOf(label);if(index>=0)current.splice(index,1);else if(current.length<q.blocks.length)current.push(label);const value=current.join('');if(q.options){q.touchOrder=value;q.user=value.length===q.blocks.length&&q.options.includes(value)?value:'';}else q.user=value;}
function touchOrderSlots(value,count){const order=normalizedOrder(value);return Array.from({length:count},(_,i)=>`<span class="touch-slot ${order[i]?'filled':''}"><i>${i+1}</i><b>${order[i]||'?'}</b></span>`).join('');}
function syncOrderPickUI(q){const order=pickedOrder(q);document.querySelectorAll('.order-part.touch-enabled').forEach(part=>{const label=part.dataset.label,rank=order.indexOf(label)+1;part.classList.toggle('selected',rank>0);part.setAttribute('aria-pressed',String(rank>0));part.setAttribute('aria-label',`${label} 블록${rank?` ${rank}번째 선택`:''}`);const picker=part.querySelector('.order-pick');picker?.classList.toggle('selected',rank>0);const badge=part.querySelector('.order-rank');if(badge)badge.textContent=rank||'';});const sequence=$('touchOrderSequence');if(sequence)sequence.innerHTML=touchOrderSlots(order,q.blocks.length);const clear=$('clearOrder');if(clear)clear.disabled=!order;}
function touchOrderMessage(q){const order=pickedOrder(q);if(!order)return `위의 (A)~(${LETTERS[q.blocks.length-1]})를 답 순서대로 누르거나 아래 선택지를 고르세요.`;if(order.length<q.blocks.length)return `${q.blocks.length-order.length}개를 더 선택하세요.`;if(q.options&&!q.options.includes(order))return '아래 선택지에 없는 순서입니다. 문자를 다시 눌러 수정하세요.';return '선택한 순서가 아래 선택지에 반영되었습니다.';}
function sourceSort(a,b){if(a.sourceType!==b.sourceType)return a.sourceType==='mock'?-1:1;if(a.sourceType==='mock')return a.year-b.year||a.questionNumber-b.questionNumber;return a.lesson-b.lesson||(SOURCE_DATA.filter(x=>x.sourceType==='textbook'&&x.lesson===a.lesson).findIndex(x=>x.id===a.id)-SOURCE_DATA.filter(x=>x.sourceType==='textbook'&&x.lesson===b.lesson).findIndex(x=>x.id===b.id));}
const CONTEXT_STOP_WORDS=new Set(`the a an and or but if then than that this these those it its they them their he him his she her hers we us our ours you your yours i me my mine is am are was were be been being do does did have has had having can could may might must will would shall should to of in on at for from with by as into onto about over under after before during through between among up down out off not no nor so too very more most much many few some any all each every both either neither other another same such own just only even also still already yet ever never here there when where why how what which who whom whose because although though while since until unless whether against within without around across behind beyond near per via`.split(/\s+/));
const CONNECTOR_TERMS=['on the other hand','as a result','for example','for instance','in addition','in contrast','in fact','rather than','instead of','even though','however','therefore','thus','moreover','furthermore','nevertheless','instead','otherwise','meanwhile','finally','eventually','consequently','accordingly','although','though','whereas','while','because','since','but','so','yet','then','also','still'];
function normalizeVocab(value){return String(value||'').trim().toLowerCase().replace(/’/g,"'");}
function contextTargets(item){
  if(item.sourceType!=='textbook'||!Array.isArray(item.sentences))return [];
  const found=new Map();let order=0;
  item.sentences.forEach((sentence,sentenceIndex)=>{
    for(const match of sentence.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)){
      const raw=match[0],key=normalizeVocab(raw);
      if(key.length<4||CONTEXT_STOP_WORDS.has(key))continue;
      if(!found.has(key))found.set(key,[]);
      found.get(key).push({sentenceIndex,start:match.index,end:match.index+raw.length,raw,order:order++});
    }
  });
  return [...found.entries()].filter(([,occurrences])=>occurrences.length>=2).filter(([,occurrences])=>!(occurrences.every(o=>/^[A-Z]/.test(o.raw))&&occurrences.some(o=>o.start>0))).map(([key,occurrences])=>({key,occurrences,blank:occurrences[1],count:occurrences.length,order:occurrences[1].order})).sort((a,b)=>a.order-b.order);
}
function escapeRegex(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function connectorOccurrences(item){
  if(item.sourceType!=='textbook'||!Array.isArray(item.sentences))return [];
  const found=[];
  item.sentences.forEach((sentence,sentenceIndex)=>{
    const claimed=[];
    [...CONNECTOR_TERMS].sort((a,b)=>b.length-a.length).forEach(key=>{
      const pattern=escapeRegex(key).replace(/ /g,'\\s+');
      for(const match of sentence.matchAll(new RegExp(`\\b${pattern}\\b`,'gi'))){
        const start=match.index,end=start+match[0].length;
        if(claimed.some(range=>start<range.end&&end>range.start))continue;
        claimed.push({start,end});found.push({key,sentenceIndex,start,end,raw:match[0]});
      }
    });
  });
  return found.sort((a,b)=>a.sentenceIndex-b.sentenceIndex||a.start-b.start);
}
function connectivePairs(item){const occurrences=connectorOccurrences(item),pairs=[];for(let i=0;i+1<occurrences.length;i+=2)pairs.push([occurrences[i],occurrences[i+1]]);if(occurrences.length>=3&&occurrences.length%2===1)pairs.push([occurrences.at(-2),occurrences.at(-1)]);return pairs;}
function textbookOnlyType(){return ['word-order','context-vocab','connective'].includes(state.type);}
function generatedQuestionCount(item){if(state.type==='word-order')return item.sentences.filter(s=>String(s||'').trim()).length;if(state.type==='context-vocab')return contextTargets(item).length;if(state.type==='connective')return connectivePairs(item).length;return 1;}
function eligible(item){if(!Array.isArray(item.sentences))return false;if(state.type==='word-order')return item.sourceType==='textbook'&&item.sentences.length>=1;if(state.type==='context-vocab'||state.type==='connective')return item.sourceType==='textbook'&&generatedQuestionCount(item)>0;return item.sentences.length>=3;}
function typeName(type,short=false){if(type==='order')return short?'순서':'순서 문제';if(type==='insertion')return short?'문장 삽입':'문장 삽입';if(type==='word-order')return short?'단어 배열':'본문 단어 배열';if(type==='context-vocab')return '문맥 어휘';return '연결어 조합';}
function renderDifficulty(){const isWord=state.type==='word-order',isVocab=state.type==='context-vocab';$('difficultyTypeLabel').textContent=typeName(state.type);if(isWord){$('difficultyGuide').textContent='쉬움은 2~3단어 덩어리, 어려움은 낱말 카드를 배열합니다.';$('easyDesc').textContent='한국어 구간 제목을 보며 2~3단어씩 묶인 덩어리를 배열합니다.';$('hardDesc').textContent='한국어 제목 없이 영어 단어를 하나씩 배열합니다.';}else if(isVocab){$('difficultyGuide').textContent='정답을 고를지 직접 쓸지 선택하세요.';$('easyDesc').textContent='본문에서 두 번 이상 나온 단어를 5지선다로 고릅니다.';$('hardDesc').textContent='보기 없이 본문에서 단어를 찾아 직접 입력합니다.';}else if(state.type==='insertion'){$('difficultyGuide').textContent='한국어 주제 표시 여부를 고르세요.';$('easyDesc').textContent='한국어 주제를 함께 보며 문장이 들어갈 위치를 선택합니다.';$('hardDesc').textContent='한국어 주제 없이 영어 지문의 단서만으로 위치를 선택합니다.';}else{$('difficultyGuide').textContent='학교식 선택형과 기존 직접 풀이형 중에서 고르세요.';$('easyDesc').textContent='한국어 주제를 표시하고, 학교 시험처럼 단서 중심으로 나누어 선택지를 제시합니다.';$('hardDesc').textContent='기존 생성·답안 방식 그대로 풀되 한국어 주제는 표시하지 않습니다.';}}
function renderSetup(){
  const isOrder=state.type==='order',isWord=state.type==='word-order',isVocab=state.type==='context-vocab',isConnective=state.type==='connective',textbookOnly=textbookOnlyType();
  const difficultyName=state.difficulty==='hard'?'어려움':'쉬움';
  $('setupTitle').textContent=isConnective?typeName(state.type):`${typeName(state.type)} · ${difficultyName}`;
  $('changeDifficulty').textContent=isConnective?'← 유형 선택':'← 난이도 선택';
  $('sumType').textContent=typeName(state.type,true);$('sumDifficulty').textContent=difficultyName;$('sumDifficultyRow').style.display=isConnective?'none':'flex';
  $('mockSourceSection').style.display=textbookOnly?'none':'block';$('lessonSourceSection').querySelector('.section-title').style.marginTop=textbookOnly?'0':'24px';
  $('lessonNote').textContent=isWord?'선택한 구간의 각 문장이 한 문제씩 출제됩니다.':isVocab?'두 번 이상 나온 의미 있는 단어가 각각 한 문제씩 출제됩니다.':isConnective?'본문에 연결어가 두 개 이상 있는 구간만 선택할 수 있습니다.':'1과·2과 전체 또는 본문 안의 자연스러운 구간별로 선택합니다.';
  $('orderedOption').textContent=textbookOnly?'본문 순서':'연도·번호 순';$('blockOption').style.display=isOrder?'block':'none';$('sumBlocksRow').style.display=isOrder?'flex':'none';
  document.querySelectorAll('[data-blocks]').forEach(btn=>btn.classList.toggle('active',btn.dataset.blocks===state.orderBlocks));renderMockGroups();renderLessonGroups();syncSummary();
}
function renderMockGroups(){const root=$('mockGroups');root.innerHTML='';[2022,2023,2024,2025,2026].forEach(year=>{const items=SOURCE_DATA.filter(x=>x.sourceType==='mock'&&x.year===year);const group=document.createElement('div');group.className='group'+(state.openMocks.has(year)?' open':'');const head=document.createElement('div');head.className='group-head';const left=document.createElement('div');left.className='group-left';const toggle=document.createElement('button');toggle.className='toggle';toggle.innerHTML=`<span class="arrow">▶</span><span>${year}</span><span class="status">${year===2026?'9모 미시행':items.length+'개 지문'}</span>`;toggle.onclick=()=>{if(state.openMocks.has(year))state.openMocks.delete(year);else state.openMocks.add(year);group.classList.toggle('open');};left.append(toggle);const all=document.createElement('label');all.className='all-check';const allCb=document.createElement('input');allCb.type='checkbox';allCb.disabled=!items.some(eligible);const eligibleItems=items.filter(eligible);allCb.checked=eligibleItems.length>0&&eligibleItems.every(x=>state.selected.has(x.id));allCb.indeterminate=!allCb.checked&&eligibleItems.some(x=>state.selected.has(x.id));allCb.onchange=()=>{eligibleItems.forEach(x=>allCb.checked?state.selected.add(x.id):state.selected.delete(x.id));state.openMocks.add(year);renderSetup();};all.append(allCb,document.createTextNode('전체'));head.append(left,all);group.append(head);const body=document.createElement('div');body.className='group-body';const grid=document.createElement('div');grid.className='q-grid';for(let q=21;q<=40;q++){const item=items.find(x=>x.questionNumber===q);const label=document.createElement('label');label.className='q-item';const cb=document.createElement('input');cb.type='checkbox';const ok=item&&eligible(item);cb.disabled=!ok;cb.checked=!!item&&state.selected.has(item.id);cb.onchange=()=>{if(cb.checked)state.selected.add(item.id);else state.selected.delete(item.id);state.openMocks.add(year);renderSetup();};const span=document.createElement('span');span.innerHTML=item?`${q}번${ok?'':`<span class="tiny">${'출제 가능한 문장 부족'}</span>`}`:`${q}번<span class="tiny">자료 없음</span>`;label.append(cb,span);grid.append(label);}body.append(grid);group.append(body);root.append(group);});}
function renderLessonGroups(){const root=$('lessonGroups');root.innerHTML='';[1,2].forEach(lesson=>{const items=SOURCE_DATA.filter(x=>x.sourceType==='textbook'&&x.lesson===lesson);const group=document.createElement('div');group.className='group'+(state.openLessons.has(lesson)?' open':'');const head=document.createElement('div');head.className='group-head';const left=document.createElement('div');left.className='group-left';const toggle=document.createElement('button');toggle.className='toggle';toggle.innerHTML=`<span class="arrow">▶</span><span>${lesson}과</span><span class="status">${items[0]?.lessonTitle||''}</span>`;toggle.onclick=()=>{if(state.openLessons.has(lesson))state.openLessons.delete(lesson);else state.openLessons.add(lesson);group.classList.toggle('open');};left.append(toggle);const elig=items.filter(eligible);const all=document.createElement('label');all.className='all-check';const cbAll=document.createElement('input');cbAll.type='checkbox';cbAll.checked=elig.length>0&&elig.every(x=>state.selected.has(x.id));cbAll.indeterminate=!cbAll.checked&&elig.some(x=>state.selected.has(x.id));cbAll.onchange=()=>{elig.forEach(x=>cbAll.checked?state.selected.add(x.id):state.selected.delete(x.id));state.openLessons.add(lesson);renderSetup();};all.append(cbAll,document.createTextNode(`${lesson}과 전체`));head.append(left,all);group.append(head);const body=document.createElement('div');body.className='group-body';const list=document.createElement('div');list.className='section-list';items.forEach(item=>{const ok=eligible(item),count=generatedQuestionCount(item);const row=document.createElement('label');row.className='section-row'+(ok?'':' disabled');const cb=document.createElement('input');cb.type='checkbox';cb.disabled=!ok;cb.checked=state.selected.has(item.id);cb.onchange=()=>{if(cb.checked)state.selected.add(item.id);else state.selected.delete(item.id);state.openLessons.add(lesson);renderSetup();};const txt=document.createElement('span');const amount=['context-vocab','connective'].includes(state.type)?`${count}문제`:`${item.sentences.length}문장`;const reason=state.type==='connective'?'연결어 2개 미만':state.type==='context-vocab'?'반복 핵심어 없음':'출제 가능한 문장 부족';txt.innerHTML=`<strong>${item.sectionTitle}</strong><small>${amount}${ok?'':` · ${reason}`}</small>`;row.append(cb,txt);list.append(row)});body.append(list);group.append(body);root.append(group);});}
function syncSummary(){const valid=[...state.selected].map(id=>byId.get(id)).filter(Boolean).filter(eligible);for(const id of [...state.selected]){const item=byId.get(id);if(!item||!eligible(item))state.selected.delete(id)}const isWord=state.type==='word-order',generated=['word-order','context-vocab','connective'].includes(state.type),questionTotal=valid.reduce((sum,item)=>sum+generatedQuestionCount(item),0);$('sumCount').textContent=generated?`${valid.length}구간 · ${questionTotal}${isWord?'문장':'문제'}`:valid.length+'개';$('sumOrder').textContent=state.sort==='ordered'?(textbookOnlyType()?'본문 순서':'연도·번호 순'):'랜덤';$('sumBlocks').textContent=state.orderBlocks==='auto'?'자동 (가능한 범위)':state.orderBlocks+'개 우선';$('startBtn').disabled=valid.length===0;$('startNote').textContent=valid.length?(generated?`${questionTotal}${isWord?'문장':'문제'}을 ${state.sort==='ordered'?'본문 순서대로':'랜덤으로'} 출제합니다.`:`${valid.length}문제를 ${state.sort==='ordered'?'순서대로':'랜덤으로'} 출제합니다.`):'문제를 하나 이상 선택하세요.';}
const DEPENDENT_START=/^(?:Then|So|However|Therefore|Thus|Yet|And|But|Otherwise|Indeed|Moreover|Furthermore|Instead|This|That|These|Those|Such|It|They|He|She|The former|The latter|In other words|For example|For instance|On the other hand|As a result)\b/i;
const SCHOOL_CUE_START=/^(?:Then|Now|Later|Meanwhile|Soon|Eventually|Finally|Next|After|Before|Previously|Once|When|While|Just before|At (?:first|last|that time|the time|night|noon|dawn)|On (?:the next|that|this)|In (?:the beginning|the end|the early|those days|the meantime)|All through|However|Therefore|Thus|Yet|But|Moreover|Furthermore|Instead|Indeed|For example|For instance|For a start|In contrast|On the other hand|As a result|This|That|These|Those|Such|It|They|He|She|The former|The latter|Other)\b/i;
function partitionCandidates(sentences,k,relaxed=false,preferCueStarts=false){
  const rest=sentences.slice(1),n=rest.length;
  if(k<2||n<k)return [];
  const total=rest.reduce((sum,x)=>sum+wordCount(x),0),target=total/k,cands=[];
  function evaluate(cuts){
    const points=[0,...cuts,n],groups=[];
    for(let i=0;i<points.length-1;i++)groups.push(rest.slice(points[i],points[i+1]));
    const wc=groups.map(g=>g.reduce((sum,x)=>sum+wordCount(x),0));
    if(!relaxed&&groups.some((g,i)=>wc[i]<9||(g.length===1&&wordCount(g[0])<12)))return;
    let score=0;
    wc.forEach(w=>{score+=Math.abs(w-target);if(w<12)score+=(12-w)*8;if(w>target*2.05)score+=(w-target*2.05)*1.8;});
    groups.forEach(g=>{
      if(preferCueStarts)score+=SCHOOL_CUE_START.test(g[0])?-36:10;
      else if(DEPENDENT_START.test(g[0]))score+=7;
      if(g.length===1)score+=4;
    });
    const sentenceCounts=groups.map(g=>g.length),avg=sentenceCounts.reduce((a,b)=>a+b,0)/k;
    score+=sentenceCounts.reduce((sum,c)=>sum+Math.abs(c-avg)*2,0);
    cands.push({groups,score,k});
  }
  function chooseCuts(next,remain,cuts){
    if(remain===0){evaluate(cuts);return;}
    for(let c=next;c<=n-remain;c++)chooseCuts(c+1,remain-1,[...cuts,c]);
  }
  chooseCuts(1,k-1,[]);
  return cands.sort((a,b)=>a.score-b.score).slice(0,10);
}
function autoBlockCounts(item){const n=item.sentences.length;if(n>=9)return [5,4,3];if(n>=7)return [4,5,3];if(n>=5)return [4,3,5];return [3];}
function makeOrder(item){
  const maxBlocks=Math.min(LETTERS.length,item.sentences.length-1);
  if(maxBlocks<2)return null;
  let counts;
  if(state.orderBlocks==='auto'){
    counts=autoBlockCounts(item).map(k=>Math.min(k,maxBlocks));
    for(let k=maxBlocks;k>=2;k--)counts.push(k);
  }else{
    const preferred=Math.min(Number(state.orderBlocks),maxBlocks);
    counts=[];
    for(let k=preferred;k>=2;k--)counts.push(k);
  }
  counts=[...new Set(counts)].filter(k=>k>=2&&k<=maxBlocks);
  let chosenCandidates=null;
  for(const relaxed of [false,true]){
    for(const k of counts){
      const c=partitionCandidates(item.sentences,k,relaxed,state.difficulty==='easy');
      if(c.length){chosenCandidates=c;break;}
    }
    if(chosenCandidates)break;
  }
  if(!chosenCandidates)return null;
  const chosen=state.difficulty==='easy'?chosenCandidates[0]:chosenCandidates[Math.floor(Math.random()*Math.min(5,chosenCandidates.length))];
  const originals=chosen.groups.map((g,i)=>({orig:i,text:g.join(' ')}));
  let shown=shuffle(originals);
  if(shown.every((x,i)=>x.orig===i)&&shown.length>1)[shown[0],shown[1]]=[shown[1],shown[0]];
  shown=shown.map((x,i)=>({...x,label:LETTERS[i]}));
  const answer=[...shown].sort((a,b)=>a.orig-b.orig).map(x=>x.label).join('');
  const options=state.difficulty==='easy'?makeOrderOptions(answer,shown.map(x=>x.label)):null;
  return{kind:'order',source:item,lead:item.sentences[0],blocks:shown,answer,user:'',touchOrder:'',blockCount:shown.length,options};
}

function makeOrderOptions(answer,letters){
  const all=[];
  function permute(rest,built=''){
    if(!rest.length){all.push(built);return;}
    rest.forEach((letter,i)=>permute([...rest.slice(0,i),...rest.slice(i+1)],built+letter));
  }
  permute(letters);
  const wrong=shuffle(all.filter(x=>x!==answer)).slice(0,4);
  return shuffle([answer,...wrong]);
}

const CUE=/^(?:However|Therefore|Thus|Nevertheless|Moreover|Furthermore|Indeed|For example|For instance|In contrast|On the other hand|As a result|Instead|Otherwise|Then|This|That|These|Those|Such|They|It|The former|The latter|Rather|Consequently|Accordingly|In other words)\b/i;
function candidateScore(s,i,n){let sc=0;if(CUE.test(s))sc+=40;if(/\b(?:this|these|those|such|former|latter|another|also|too|instead|however|therefore|thus|then)\b/i.test(s))sc+=18;const w=wordCount(s);if(w>=10&&w<=42)sc+=10;if(i===1||i===n-2)sc+=3;return sc;}
function makeInsertion(item){
  const s=item.sentences;
  if(s.length<3)return null;
  let cand=[];
  for(let i=1;i<s.length-1;i++){
    if(String(s[i]||'').trim())cand.push({i,score:candidateScore(s[i],i,s.length)});
  }
  if(!cand.length)return null;
  cand.sort((a,b)=>b.score-a.score);
  const pool=cand.slice(0,Math.min(4,cand.length));
  const chosen=pool[Math.floor(Math.random()*pool.length)];
  const idx=chosen.i,target=s[idx],remaining=s.filter((_,i)=>i!==idx);
  const allGaps=Array.from({length:remaining.length+1},(_,i)=>i);
  const correctGap=idx;
  let selected=[correctGap];
  const distract=shuffle(allGaps.filter(g=>g!==correctGap));
  selected.push(...distract.slice(0,4));
  selected=selected.sort((a,b)=>a-b);
  const correctNum=selected.indexOf(correctGap)+1;
  return{kind:'insertion',source:item,target,remaining,gaps:selected,answer:String(correctNum),user:''};
}

function wordQuestionKey(q){return `${q.source.id}::${q.sentenceIndex}`;}
function makeWordUnits(words){
  if(state.difficulty!=='easy')return words.map(word=>[word]);
  if(words.length===1)return [words];
  const groupCount=Math.ceil(words.length/3);
  let twoCount=groupCount*3-words.length,threeCount=groupCount-twoCount;
  const sizes=[];
  while(twoCount||threeCount){
    if(threeCount&&(sizes.length%2===0||!twoCount)){sizes.push(3);threeCount--;}
    else{sizes.push(2);twoCount--;}
  }
  let index=0;
  return sizes.map(size=>{const unit=words.slice(index,index+size);index+=size;return unit;});
}
function makeWordOrder(item,sentenceIndex){
  const sentence=String(item.sentences[sentenceIndex]||'').trim();
  const words=sentence.split(/\s+/).filter(Boolean);
  if(!words.length)return null;
  const tokens=makeWordUnits(words).map((unit,id)=>({id,text:unit.join(' '),wordCount:unit.length}));
  const bank=shuffle(tokens);
  if(bank.length>1&&bank.every((token,i)=>token.id===i))[bank[0],bank[1]]=[bank[1],bank[0]];
  return{kind:'word-order',source:item,sentenceIndex,tokens,bank,answer:tokens.map(token=>token.id),user:[]};
}
function buildWordSession(ids){
  let specs=[];
  ids.forEach(id=>{
    const marker=id.lastIndexOf('::');
    if(marker>0){
      const item=byId.get(id.slice(0,marker));
      const sentenceIndex=Number(id.slice(marker+2));
      if(item&&Number.isInteger(sentenceIndex)&&String(item.sentences[sentenceIndex]||'').trim())specs.push({item,sentenceIndex});
      return;
    }
    const item=byId.get(id);
    if(item&&eligible(item))item.sentences.forEach((sentence,sentenceIndex)=>{if(String(sentence||'').trim())specs.push({item,sentenceIndex});});
  });
  if(state.sort==='ordered')specs.sort((a,b)=>sourceSort(a.item,b.item)||a.sentenceIndex-b.sentenceIndex);
  else specs=shuffle(specs);
  return specs.map(({item,sentenceIndex})=>makeWordOrder(item,sentenceIndex)).filter(Boolean);
}
function contextQuestionKey(q){return `${q.source.id}::vocab::${q.targetKey}`;}
function allContextKeys(){return [...new Set(SOURCE_DATA.filter(item=>item.sourceType==='textbook').flatMap(item=>contextTargets(item).map(target=>target.key)))];}
function makeVocabChoices(answer,item){const local=contextTargets(item).map(target=>target.key).filter(key=>key!==answer),global=allContextKeys().filter(key=>key!==answer&&!local.includes(key));return shuffle([answer,...shuffle([...local,...global]).slice(0,4)]);}
function makeContextVocab(item,targetKey){const targets=contextTargets(item),target=targets.find(candidate=>candidate.key===targetKey);if(!target)return null;return{kind:'context-vocab',source:item,targetKey,targetIndex:targets.indexOf(target),blank:target.blank,answer:target.key,user:'',choices:state.difficulty==='easy'?makeVocabChoices(target.key,item):null};}
function contextSpecOrder(spec){return spec.order??contextTargets(spec.item).find(target=>target.key===spec.targetKey)?.order??0;}
function buildContextSession(ids){
  let specs=[];
  ids.forEach(id=>{
    const match=id.match(/^(.*)::vocab::(.+)$/);
    if(match){const item=byId.get(match[1]);if(item&&contextTargets(item).some(target=>target.key===match[2]))specs.push({item,targetKey:match[2]});return;}
    const item=byId.get(id);if(item&&eligible(item))contextTargets(item).forEach(target=>specs.push({item,targetKey:target.key,order:target.order}));
  });
  if(state.sort==='ordered')specs.sort((a,b)=>sourceSort(a.item,b.item)||contextSpecOrder(a)-contextSpecOrder(b));else specs=shuffle(specs);
  return specs.map(({item,targetKey})=>makeContextVocab(item,targetKey)).filter(Boolean);
}
function connectorValuesKey(values){return values.join('||');}
function makeConnectorOptions(correctValues){
  const correctKey=connectorValuesKey(correctValues),options=new Map([[correctKey,{key:correctKey,values:correctValues}]]),pool=shuffle(CONNECTOR_TERMS.filter(term=>!correctValues.includes(term)));
  const add=values=>{const key=connectorValuesKey(values);if(key!==correctKey)options.set(key,{key,values});};
  if(correctValues[0]!==correctValues[1])add([correctValues[1],correctValues[0]]);
  for(let i=0;options.size<5&&i<pool.length;i++){add([pool[i],correctValues[1]]);add([correctValues[0],pool[(i+1)%pool.length]]);add([pool[i],pool[(i+2)%pool.length]]);}
  return shuffle([...options.values()].slice(0,5));
}
function connectiveQuestionKey(q){return `${q.source.id}::connective::${q.pairIndex}`;}
function makeConnective(item,pairIndex){const pairs=connectivePairs(item),pair=pairs[pairIndex];if(!pair)return null;const values=pair.map(blank=>blank.key),options=makeConnectorOptions(values);return{kind:'connective',source:item,pairIndex,blanks:pair.map((blank,i)=>({...blank,label:LETTERS[i]})),correctValues:values,options,answer:connectorValuesKey(values),user:''};}
function buildConnectiveSession(ids){
  let specs=[];
  ids.forEach(id=>{
    const match=id.match(/^(.*)::connective::(\d+)$/);
    if(match){const item=byId.get(match[1]),pairIndex=Number(match[2]);if(item&&connectivePairs(item)[pairIndex])specs.push({item,pairIndex});return;}
    const item=byId.get(id);if(item&&eligible(item))connectivePairs(item).forEach((_,pairIndex)=>specs.push({item,pairIndex}));
  });
  if(state.sort==='ordered')specs.sort((a,b)=>sourceSort(a.item,b.item)||a.pairIndex-b.pairIndex);else specs=shuffle(specs);
  return specs.map(({item,pairIndex})=>makeConnective(item,pairIndex)).filter(Boolean);
}
function buildSession(ids){
  if(state.type==='word-order')return buildWordSession(ids);
  if(state.type==='context-vocab')return buildContextSession(ids);
  if(state.type==='connective')return buildConnectiveSession(ids);
  let items=ids.map(id=>byId.get(id)).filter(Boolean).filter(eligible);
  if(state.sort==='ordered')items.sort(sourceSort);else items=shuffle(items);
  return items.map(x=>state.type==='order'?makeOrder(x):makeInsertion(x)).filter(Boolean);
}
function insertionChoiceRange(q){const marks=['','①','②','③','④','⑤'];return `①~${marks[q.gaps.length]||q.gaps.length}`;}
function wordText(q,ids){return ids.map(id=>q.tokens.find(token=>token.id===id)?.text||'').filter(Boolean).join(' ');}
function wordSourceLabel(q){return state.difficulty==='hard'?`Lesson ${q.source.lesson} · Sentence ${q.sentenceIndex+1}`:`${q.source.label} · ${q.sentenceIndex+1}번째 문장`;}
function questionSourceLabel(q){if(q.kind==='word-order')return wordSourceLabel(q);if(q.kind==='context-vocab')return state.difficulty==='hard'?`Lesson ${q.source.lesson} · Vocabulary ${q.targetIndex+1}`:`${q.source.label} · 문맥 어휘 ${q.targetIndex+1}`;if(q.kind==='connective')return `${q.source.label} · 연결어 조합 ${q.pairIndex+1}`;return q.source.label;}
function renderPassageWithBlanks(sentences,blanks){
  const grouped=new Map();blanks.forEach(blank=>{if(!grouped.has(blank.sentenceIndex))grouped.set(blank.sentenceIndex,[]);grouped.get(blank.sentenceIndex).push(blank);});
  return sentences.map((sentence,sentenceIndex)=>{let html='',cursor=0;for(const blank of (grouped.get(sentenceIndex)||[]).sort((a,b)=>a.start-b.start)){html+=escapeHtml(sentence.slice(cursor,blank.start));html+=`<span class="context-blank">${blank.label?`<i>(${blank.label})</i>`:''}<b>________</b></span>`;cursor=blank.end;}html+=escapeHtml(sentence.slice(cursor));return `<span class="context-sentence">${html}</span>`;}).join(' ');
}
function connectorOptionText(values){return `(A) ${values[0]} · (B) ${values[1]}`;}
function renderQuiz(){
  const q=state.session[state.index];
  if(!q)return;
  const p=state.session.length?((state.index+1)/state.session.length*100):0;
  $('progressText').textContent=`${state.index+1} / ${state.session.length}`;
  $('progressBar').style.width=p+'%';
  $('prevBtn').disabled=state.index===0;
  $('mainAction').textContent=state.index===state.session.length-1?'채점하기':'다음';
  const item=q.source;
  const topic=state.difficulty==='easy'?`<div class="topic">${escapeHtml(item.title||'')}</div>`:'';
  const sourceLabel=questionSourceLabel(q);
  let html=`<div class="meta"><div class="source-label">${escapeHtml(sourceLabel)}</div>${topic}</div>`;
  if(q.kind==='order'){
    const currentOrder=pickedOrder(q);
    const blocks=q.blocks.map(b=>{const rank=currentOrder.indexOf(b.label)+1;const label=`<span class="label order-pick ${rank?'selected':''}"><span>(${b.label})</span><i class="order-rank">${rank||''}</i></span>`;return `<div class="order-part touch-enabled ${rank?'selected':''}" data-label="${b.label}" role="button" tabindex="0" aria-pressed="${rank>0}" aria-label="${b.label} 블록${rank?` ${rank}번째 선택`:''}">${label}<div>${escapeHtml(b.text)}</div></div>`;}).join('');
    html+=`<h2 class="question-prompt">주어진 글 다음에 이어질 글의 순서로 가장 적절한 것을 고르시오.</h2><div class="lead">${escapeHtml(q.lead)}</div><div class="order-list">${blocks}</div>`;
    if(state.difficulty==='easy'){
      const marks=['①','②','③','④','⑤'];
      html+=`<div class="answer-zone"><label>정답 선택</label><div class="touch-order-row"><div id="touchOrderSequence" class="touch-order-sequence">${touchOrderSlots(q.touchOrder,q.blocks.length)}</div><button id="clearOrder" class="clear-order" type="button" ${q.touchOrder?'':'disabled'}>초기화</button></div><div class="input-help touch-help">${touchOrderMessage(q)}</div><div class="order-choices">`+q.options.map((option,i)=>`<button class="order-choice ${q.user===option?'selected':''}" data-answer="${option}"><span>${marks[i]}</span><strong>${option.split('').join(' - ')}</strong></button>`).join('')+`</div></div>`;
    }else{
      const allowed=LETTERS.slice(0,q.blocks.length);
      const example=q.blocks.length===5?'CEADB':q.blocks.length===4?'BCAD':'BCA';
      html+=`<div class="answer-zone hard-order-answer"><label>정답 순서</label><div class="touch-order-row"><div id="touchOrderSequence" class="touch-order-sequence">${touchOrderSlots(q.user,q.blocks.length)}</div><button id="clearOrder" class="clear-order" type="button" ${q.user?'':'disabled'}>초기화</button></div><div class="input-help touch-help">위의 (A)~(${allowed.at(-1)})를 답 순서대로 누르세요. 선택된 문자를 다시 누르면 취소됩니다.</div><div class="manual-answer"><label for="orderInput">키보드 입력</label><input id="orderInput" class="manual-input" maxlength="${q.blocks.length}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="예: ${example.toLowerCase()} 또는 ${example}" value="${escapeHtml(q.user||'')}"><div class="input-help">${allowed.join(', ')}를 대·소문자 상관없이 한 번씩 입력할 수도 있습니다.</div></div></div>`;
    }
  }else if(q.kind==='insertion'){
    html+=`<h2 class="question-prompt">주어진 문장이 들어가기에 가장 적절한 곳을 고르시오.</h2><div class="insert-sentence">${escapeHtml(q.target)}</div><div class="insertion-text">${renderInsertion(q)}</div><div class="answer-zone"><label>선택한 위치</label><div class="input-help" style="font-size:12px">${q.user?q.user+'번':insertionChoiceRange(q)+' 중 하나를 클릭하세요.'}</div></div>`;
  }else if(q.kind==='context-vocab'){
    html+=`<h2 class="question-prompt">${state.difficulty==='easy'?'빈칸에 들어갈 본문 단어로 가장 적절한 것을 고르시오.':'빈칸에 들어갈 단어를 본문에서 찾아 쓰시오.'}</h2><div class="context-passage">${renderPassageWithBlanks(item.sentences,[q.blank])}</div>`;
    if(state.difficulty==='easy'){
      const marks=['①','②','③','④','⑤'];
      html+=`<div id="answerChoices" class="order-choices vocab-choices">${q.choices.map((choice,i)=>`<button class="order-choice vocab-choice ${q.user===choice?'selected':''}" type="button" data-answer="${escapeHtml(choice)}"><span>${marks[i]}</span><strong>${escapeHtml(choice)}</strong></button>`).join('')}</div>`;
    }else{
      html+=`<div class="context-answer"><label for="contextInput">정답 입력</label><input id="contextInput" class="context-input" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="영어 단어 입력" value="${escapeHtml(q.user||'')}"><div class="input-help">대·소문자는 구분하지 않습니다. 본문에 쓰인 형태 그대로 입력하세요.</div></div>`;
    }
  }else if(q.kind==='connective'){
    const marks=['①','②','③','④','⑤'];
    html+=`<h2 class="question-prompt">빈칸 (A), (B)에 들어갈 본문의 연결어 조합으로 가장 적절한 것을 고르시오.</h2><div class="context-passage">${renderPassageWithBlanks(item.sentences,q.blanks)}</div><div id="answerChoices" class="connector-choices">${q.options.map((option,i)=>`<button class="connector-choice ${q.user===option.key?'selected':''}" type="button" data-answer="${escapeHtml(option.key)}"><span>${marks[i]}</span><strong><i>(A)</i>${escapeHtml(option.values[0])}</strong><b>···</b><strong><i>(B)</i>${escapeHtml(option.values[1])}</strong></button>`).join('')}</div>`;
  }else if(q.kind==='word-order'){
    const chosen=new Set(q.user);
    const selected=q.user.map(id=>q.tokens.find(token=>token.id===id)).filter(Boolean);
    const remaining=q.bank.filter(token=>!chosen.has(token.id));
    const selectedHtml=selected.length?selected.map(token=>`<button class="word-chip chosen" type="button" data-token="${token.id}" aria-label="${escapeHtml(token.text)} 선택 취소">${escapeHtml(token.text)}</button>`).join(''):'<span class="word-placeholder">아래 단어를 순서대로 누르세요.</span>';
    const bankHtml=remaining.length?remaining.map(token=>`<button class="word-chip bank" type="button" data-token="${token.id}" aria-label="${escapeHtml(token.text)} 선택">${escapeHtml(token.text)}</button>`).join(''):'<span class="word-bank-empty">모든 단어를 사용했습니다.</span>';
    const unitName=state.difficulty==='easy'?'2~3단어 덩어리':'단어';
    html+=`<h2 class="question-prompt">보기의 ${unitName}를 올바른 순서로 배열하여 문장을 완성하세요.</h2><div class="word-builder"><div class="word-area-head"><strong>완성 문장</strong><button id="clearWords" class="clear-order" type="button" ${q.user.length?'':'disabled'}>초기화</button></div><div id="wordAnswer" class="word-answer">${selectedHtml}</div><div class="word-bank-label">보기</div><div class="word-bank">${bankHtml}</div><div class="input-help">보기의 ${unitName}를 누르면 문장 뒤에 붙습니다. 완성 문장에서 다시 누르면 보기로 돌아갑니다.</div></div>`;
  }
  $('quizPaper').innerHTML=html;
  if(q.kind==='word-order'){
    document.querySelectorAll('.word-chip.bank').forEach(btn=>btn.onclick=()=>{const id=Number(btn.dataset.token);if(!q.user.includes(id))q.user.push(id);renderQuiz();});
    document.querySelectorAll('.word-chip.chosen').forEach(btn=>btn.onclick=()=>{const index=q.user.indexOf(Number(btn.dataset.token));if(index>=0)q.user.splice(index,1);renderQuiz();});
    $('clearWords').onclick=()=>{q.user=[];renderQuiz();};
  }else if(q.kind==='context-vocab'){
    if(state.difficulty==='easy')document.querySelectorAll('.vocab-choice').forEach(btn=>btn.onclick=()=>{q.user=btn.dataset.answer;renderQuiz();});
    else{const input=$('contextInput');if(!window.matchMedia||!window.matchMedia('(max-width: 560px)').matches)input.focus();input.addEventListener('input',()=>{q.user=input.value;});input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();mainAction();}});}
  }else if(q.kind==='connective'){
    document.querySelectorAll('.connector-choice').forEach(btn=>btn.onclick=()=>{q.user=btn.dataset.answer;renderQuiz();});
  }else if(q.kind==='order'){
    document.querySelectorAll('.order-part.touch-enabled').forEach(part=>{const choose=()=>{toggleOrderPick(q,part.dataset.label);renderQuiz();};part.onclick=choose;part.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});
    $('clearOrder').onclick=()=>{q.user='';q.touchOrder='';renderQuiz();};
  }
  if(q.kind==='order'&&state.difficulty==='easy'){
    document.querySelectorAll('.order-choice').forEach(btn=>btn.onclick=()=>{q.user=btn.dataset.answer;q.touchOrder=btn.dataset.answer;renderQuiz();});
  }else if(q.kind==='order'){
    const inp=$('orderInput'),allowed=LETTERS.slice(0,q.blocks.length);
    inp.addEventListener('input',()=>{inp.value=sanitizeOrderInput(inp.value,allowed);q.user=inp.value;syncOrderPickUI(q);});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();mainAction();}});
  }else if(q.kind==='insertion'){
    document.querySelectorAll('.gap').forEach(btn=>btn.onclick=()=>{q.user=btn.dataset.num;renderQuiz();});
  }
}
function renderInsertion(q){let out='';const gapMap=new Map(q.gaps.map((g,i)=>[g,i+1]));for(let i=0;i<=q.remaining.length;i++){if(gapMap.has(i)){const num=gapMap.get(i);out+=` <button class="gap ${q.user===String(num)?'selected':''}" data-num="${num}">${['','①','②','③','④','⑤'][num]}</button> `}if(i<q.remaining.length)out+=escapeHtml(q.remaining[i])+' ';}return out;}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function markNeedsAnswer(element){element?.classList.add('needs-answer');setTimeout(()=>element?.classList.remove('needs-answer'),500);}
function mainAction(){const q=state.session[state.index];if(q.kind==='word-order'&&q.user.length!==q.tokens.length){markNeedsAnswer($('wordAnswer'));return}if(q.kind==='order'&&q.user.length!==q.blocks.length){if(state.difficulty==='hard'&&(!window.matchMedia||!window.matchMedia('(max-width: 560px)').matches))$('orderInput')?.focus();markNeedsAnswer($('touchOrderSequence'));return}if(!String(q.user||'').trim()){if(q.kind==='context-vocab'&&state.difficulty==='hard')$('contextInput')?.focus();markNeedsAnswer($('answerChoices')||$('contextInput'));return}if(state.index===state.session.length-1)grade();else{state.index++;renderQuiz();}}
function answerMatches(q){if(q.kind==='word-order')return q.user.length===q.answer.length&&q.user.every((id,i)=>id===q.answer[i]);if(q.kind==='context-vocab')return normalizeVocab(q.user)===normalizeVocab(q.answer);return q.kind==='order'?String(q.user||'').toUpperCase()===q.answer:String(q.user||'')===q.answer;}
function displayedUser(q){if(q.kind==='word-order')return q.user.length?wordText(q,q.user):'미입력';if(q.kind==='connective'){const option=q.options.find(candidate=>candidate.key===q.user);return option?connectorOptionText(option.values):'미입력';}return q.user||'미입력';}
function displayedAnswer(q){if(q.kind==='word-order')return wordText(q,q.answer);if(q.kind==='connective')return connectorOptionText(q.correctValues);return q.answer;}
function questionKey(q){if(q.kind==='word-order')return wordQuestionKey(q);if(q.kind==='context-vocab')return contextQuestionKey(q);if(q.kind==='connective')return connectiveQuestionKey(q);return q.source.id;}
function grade(){const total=state.session.length,correct=state.session.filter(answerMatches).length,wrong=state.session.filter(q=>!answerMatches(q));state.lastWrong=wrong.map(questionKey);const pct=total?Math.round(correct/total*100):0;$('score').textContent=pct+'%';$('scoreSub').textContent=`${correct} / ${total} 정답`;$('statTotal').textContent=total;$('statCorrect').textContent=correct;$('statWrong').textContent=total-correct;$('retryWrong').disabled=wrong.length===0;const list=$('wrongList');list.innerHTML=wrong.length?wrong.map(q=>{const label=questionSourceLabel(q),title=state.difficulty==='easy'?`<small>${escapeHtml(q.source.title||'')}</small>`:'';return `<div class="wrong ${q.kind==='word-order'?'word-wrong':''}"><div><strong>${escapeHtml(label)}</strong>${title}</div><div class="ans">내 답 ${escapeHtml(displayedUser(q))}<br>정답 ${escapeHtml(displayedAnswer(q))}</div></div>`;}).join(''):'<div style="text-align:center;color:var(--good);font-weight:900">전부 맞았습니다.</div>';show('resultView');}
document.querySelectorAll('.type-btn[data-type]').forEach(btn=>btn.onclick=()=>{state.type=btn.dataset.type;state.difficulty=null;state.selected.clear();if(state.type==='connective'){state.difficulty='standard';renderSetup();show('setupView');}else{renderDifficulty();show('difficultyView');}});
document.querySelectorAll('.difficulty-btn').forEach(btn=>btn.onclick=()=>{state.difficulty=btn.dataset.difficulty;renderSetup();show('setupView');});
$('backType').onclick=()=>show('landingView');
$('changeDifficulty').onclick=()=>{if(state.type==='connective')show('landingView');else{renderDifficulty();show('difficultyView');}};
document.querySelectorAll('[data-order]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-order]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.sort=btn.dataset.order;syncSummary();});
document.querySelectorAll('[data-blocks]').forEach(btn=>btn.onclick=()=>{state.orderBlocks=btn.dataset.blocks;document.querySelectorAll('[data-blocks]').forEach(x=>x.classList.toggle('active',x===btn));renderSetup();});
$('startBtn').onclick=()=>{state.lastSelection=[...state.selected];state.session=buildSession(state.lastSelection);state.index=0;if(!state.session.length)return;show('quizView');renderQuiz();};
$('prevBtn').onclick=()=>{if(state.index>0){state.index--;renderQuiz();}};$('mainAction').onclick=mainAction;$('quitBtn').onclick=()=>{renderSetup();show('setupView');};$('backSetup').onclick=()=>{renderSetup();show('setupView');};
$('retrySame').onclick=()=>{state.session=buildSession(state.lastSelection);state.index=0;show('quizView');renderQuiz();};
$('retryWrong').onclick=()=>{if(!state.lastWrong.length)return;state.session=buildSession(state.lastWrong);state.index=0;show('quizView');renderQuiz();};
