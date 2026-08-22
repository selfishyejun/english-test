const LETTERS=['A','B','C','D','E'];
const state={type:null,difficulty:null,selected:new Set(),sort:'ordered',orderBlocks:'auto',openMocks:new Set(),openLessons:new Set(),session:[],index:0,lastSelection:[],lastWrong:[]};
const byId=new Map(SOURCE_DATA.map(x=>[x.id,x]));
const views=['landingView','difficultyView','setupView','quizView','resultView'];
const $=id=>document.getElementById(id);
function show(id){views.forEach(v=>$(v).classList.toggle('active',v===id));document.body.classList.toggle('quiz-mode',id==='quizView');window.scrollTo({top:0,behavior:'instant'});}
function wordCount(s){return (s.match(/[A-Za-zÀ-ÿ0-9]+(?:['’\-][A-Za-zÀ-ÿ0-9]+)*/g)||[]).length;}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function sourceSort(a,b){if(a.sourceType!==b.sourceType)return a.sourceType==='mock'?-1:1;if(a.sourceType==='mock')return a.year-b.year||a.questionNumber-b.questionNumber;return a.lesson-b.lesson||(SOURCE_DATA.filter(x=>x.sourceType==='textbook'&&x.lesson===a.lesson).findIndex(x=>x.id===a.id)-SOURCE_DATA.filter(x=>x.sourceType==='textbook'&&x.lesson===b.lesson).findIndex(x=>x.id===b.id));}
function eligible(item){return Array.isArray(item.sentences)&&item.sentences.length>=3;}
function renderDifficulty(){$('difficultyTypeLabel').textContent=state.type==='order'?'순서 문제':'문장 삽입';}
function renderSetup(){const typeName=state.type==='order'?'순서 문제':'문장 삽입';const difficultyName=state.difficulty==='hard'?'어려움':'쉬움';$('setupTitle').textContent=`${typeName} · ${difficultyName}`;$('sumType').textContent=state.type==='order'?'순서':'문장 삽입';$('sumDifficulty').textContent=difficultyName;$('blockOption').style.display=state.type==='order'?'block':'none';$('sumBlocksRow').style.display=state.type==='order'?'flex':'none';document.querySelectorAll('[data-blocks]').forEach(btn=>btn.classList.toggle('active',btn.dataset.blocks===state.orderBlocks));renderMockGroups();renderLessonGroups();syncSummary();}
function renderMockGroups(){const root=$('mockGroups');root.innerHTML='';[2022,2023,2024,2025,2026].forEach(year=>{const items=SOURCE_DATA.filter(x=>x.sourceType==='mock'&&x.year===year);const group=document.createElement('div');group.className='group'+(state.openMocks.has(year)?' open':'');const head=document.createElement('div');head.className='group-head';const left=document.createElement('div');left.className='group-left';const toggle=document.createElement('button');toggle.className='toggle';toggle.innerHTML=`<span class="arrow">▶</span><span>${year}</span><span class="status">${year===2026?'9모 미시행':items.length+'개 지문'}</span>`;toggle.onclick=()=>{if(state.openMocks.has(year))state.openMocks.delete(year);else state.openMocks.add(year);group.classList.toggle('open');};left.append(toggle);const all=document.createElement('label');all.className='all-check';const allCb=document.createElement('input');allCb.type='checkbox';allCb.disabled=!items.some(eligible);const eligibleItems=items.filter(eligible);allCb.checked=eligibleItems.length>0&&eligibleItems.every(x=>state.selected.has(x.id));allCb.indeterminate=!allCb.checked&&eligibleItems.some(x=>state.selected.has(x.id));allCb.onchange=()=>{eligibleItems.forEach(x=>allCb.checked?state.selected.add(x.id):state.selected.delete(x.id));state.openMocks.add(year);renderSetup();};all.append(allCb,document.createTextNode('전체'));head.append(left,all);group.append(head);const body=document.createElement('div');body.className='group-body';const grid=document.createElement('div');grid.className='q-grid';for(let q=21;q<=40;q++){const item=items.find(x=>x.questionNumber===q);const label=document.createElement('label');label.className='q-item';const cb=document.createElement('input');cb.type='checkbox';const ok=item&&eligible(item);cb.disabled=!ok;cb.checked=!!item&&state.selected.has(item.id);cb.onchange=()=>{if(cb.checked)state.selected.add(item.id);else state.selected.delete(item.id);state.openMocks.add(year);renderSetup();};const span=document.createElement('span');span.innerHTML=item?`${q}번${ok?'':`<span class="tiny">${'출제 가능한 문장 부족'}</span>`}`:`${q}번<span class="tiny">자료 없음</span>`;label.append(cb,span);grid.append(label);}body.append(grid);group.append(body);root.append(group);});}
function renderLessonGroups(){const root=$('lessonGroups');root.innerHTML='';[1,2].forEach(lesson=>{const items=SOURCE_DATA.filter(x=>x.sourceType==='textbook'&&x.lesson===lesson);const group=document.createElement('div');group.className='group'+(state.openLessons.has(lesson)?' open':'');const head=document.createElement('div');head.className='group-head';const left=document.createElement('div');left.className='group-left';const toggle=document.createElement('button');toggle.className='toggle';toggle.innerHTML=`<span class="arrow">▶</span><span>${lesson}과</span><span class="status">${items[0]?.lessonTitle||''}</span>`;toggle.onclick=()=>{if(state.openLessons.has(lesson))state.openLessons.delete(lesson);else state.openLessons.add(lesson);group.classList.toggle('open');};left.append(toggle);const elig=items.filter(eligible);const all=document.createElement('label');all.className='all-check';const cbAll=document.createElement('input');cbAll.type='checkbox';cbAll.checked=elig.length>0&&elig.every(x=>state.selected.has(x.id));cbAll.indeterminate=!cbAll.checked&&elig.some(x=>state.selected.has(x.id));cbAll.onchange=()=>{elig.forEach(x=>cbAll.checked?state.selected.add(x.id):state.selected.delete(x.id));state.openLessons.add(lesson);renderSetup();};all.append(cbAll,document.createTextNode(`${lesson}과 전체`));head.append(left,all);group.append(head);const body=document.createElement('div');body.className='group-body';const list=document.createElement('div');list.className='section-list';items.forEach(item=>{const row=document.createElement('label');row.className='section-row'+(eligible(item)?'':' disabled');const cb=document.createElement('input');cb.type='checkbox';cb.disabled=!eligible(item);cb.checked=state.selected.has(item.id);cb.onchange=()=>{if(cb.checked)state.selected.add(item.id);else state.selected.delete(item.id);state.openLessons.add(lesson);renderSetup();};const txt=document.createElement('span');txt.innerHTML=`<strong>${item.sectionTitle}</strong><small>${item.sentences.length}문장${eligible(item)?'':' · 출제 가능한 문장 부족'}</small>`;row.append(cb,txt);list.append(row)});body.append(list);group.append(body);root.append(group);});}
function syncSummary(){const valid=[...state.selected].map(id=>byId.get(id)).filter(Boolean).filter(eligible);for(const id of [...state.selected]){const item=byId.get(id);if(!item||!eligible(item))state.selected.delete(id)}$('sumCount').textContent=valid.length+'개';$('sumOrder').textContent=state.sort==='ordered'?'연도·번호 순':'랜덤';$('sumBlocks').textContent=state.orderBlocks==='auto'?'자동 (가능한 범위)':state.orderBlocks+'개 우선';$('startBtn').disabled=valid.length===0;$('startNote').textContent=valid.length?`${valid.length}문제를 ${state.sort==='ordered'?'순서대로':'랜덤으로'} 출제합니다.`:'문제를 하나 이상 선택하세요.';}
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
  return{kind:'order',source:item,lead:item.sentences[0],blocks:shown,answer,user:'',blockCount:shown.length,options};
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

function buildSession(ids){let items=ids.map(id=>byId.get(id)).filter(Boolean).filter(eligible);if(state.sort==='ordered')items.sort(sourceSort);else items=shuffle(items);return items.map(x=>state.type==='order'?makeOrder(x):makeInsertion(x)).filter(Boolean);}
function insertionChoiceRange(q){const marks=['','①','②','③','④','⑤'];return `①~${marks[q.gaps.length]||q.gaps.length}`;}
function renderQuiz(){
  const q=state.session[state.index];
  if(!q)return;
  const p=state.session.length?((state.index+1)/state.session.length*100):0;
  $('progressText').textContent=`${state.index+1} / ${state.session.length}`;
  $('progressBar').style.width=p+'%';
  $('prevBtn').disabled=state.index===0;
  $('nextBtn').disabled=state.index===state.session.length-1;
  $('mainAction').textContent=state.index===state.session.length-1?'채점하기':'답안 저장 · 다음';
  const item=q.source;
  const topic=state.difficulty==='easy'?`<div class="topic">${escapeHtml(item.title||'')}</div>`:'';
  let html=`<div class="meta"><div class="source-label">${escapeHtml(item.label)}</div>${topic}</div>`;
  if(q.kind==='order'){
    html+=`<h2 class="question-prompt">주어진 글 다음에 이어질 글의 순서로 가장 적절한 것을 고르시오.</h2><div class="lead">${escapeHtml(q.lead)}</div><div class="order-list">`+q.blocks.map(b=>`<div class="order-part"><div class="label">(${b.label})</div><div>${escapeHtml(b.text)}</div></div>`).join('')+'</div>';
    if(state.difficulty==='easy'){
      const marks=['①','②','③','④','⑤'];
      html+=`<div class="answer-zone"><label>정답 선택</label><div class="order-choices">`+q.options.map((option,i)=>`<button class="order-choice ${q.user===option?'selected':''}" data-answer="${option}"><span>${marks[i]}</span><strong>${option.split('').join(' - ')}</strong></button>`).join('')+`</div><div class="input-help">가장 자연스럽게 이어지는 순서를 선택하세요.</div></div>`;
    }else{
      const allowed=LETTERS.slice(0,q.blocks.length);
      const example=q.blocks.length===5?'CEADB':q.blocks.length===4?'BCAD':'BCA';
      html+=`<div class="answer-zone"><label for="orderInput">정답 입력</label><input id="orderInput" class="manual-input" maxlength="${q.blocks.length}" autocomplete="off" placeholder="예: ${example}" value="${escapeHtml(q.user||'')}"><div class="input-help">${allowed.join(', ')}를 한 번씩 직접 입력하세요. Enter를 누르면 저장 후 다음 문제로 넘어갑니다.</div></div>`;
    }
  }else{
    html+=`<h2 class="question-prompt">주어진 문장이 들어가기에 가장 적절한 곳을 고르시오.</h2><div class="insert-sentence">${escapeHtml(q.target)}</div><div class="insertion-text">${renderInsertion(q)}</div><div class="answer-zone"><label>선택한 위치</label><div class="input-help" style="font-size:12px">${q.user?q.user+'번':insertionChoiceRange(q)+' 중 하나를 클릭하세요.'}</div></div>`;
  }
  $('quizPaper').innerHTML=html;
  if(q.kind==='order'&&state.difficulty==='easy'){
    document.querySelectorAll('.order-choice').forEach(btn=>btn.onclick=()=>{q.user=btn.dataset.answer;renderQuiz();});
  }else if(q.kind==='order'){
    const inp=$('orderInput'),allowed=LETTERS.slice(0,q.blocks.length);
    inp.focus();
    inp.addEventListener('input',()=>{let v=inp.value.toUpperCase().split('').filter(c=>allowed.includes(c)).join('');let uniq='';for(const c of v)if(!uniq.includes(c))uniq+=c;inp.value=uniq.slice(0,q.blocks.length);q.user=inp.value;});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();mainAction();}});
  }else{
    document.querySelectorAll('.gap').forEach(btn=>btn.onclick=()=>{q.user=btn.dataset.num;renderQuiz();});
  }
}
function renderInsertion(q){let out='';const gapMap=new Map(q.gaps.map((g,i)=>[g,i+1]));for(let i=0;i<=q.remaining.length;i++){if(gapMap.has(i)){const num=gapMap.get(i);out+=` <button class="gap ${q.user===String(num)?'selected':''}" data-num="${num}">${['','①','②','③','④','⑤'][num]}</button> `}if(i<q.remaining.length)out+=escapeHtml(q.remaining[i])+' ';}return out;}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function mainAction(){const q=state.session[state.index];if(q.kind==='order'&&state.difficulty==='hard'&&q.user.length!==q.blocks.length){$('orderInput')?.focus();return}if(!q.user)return;if(state.index===state.session.length-1)grade();else{state.index++;renderQuiz();}}
function grade(){const total=state.session.length,correct=state.session.filter(q=>q.user===q.answer).length,wrong=state.session.filter(q=>q.user!==q.answer);state.lastWrong=wrong.map(q=>q.source.id);const pct=total?Math.round(correct/total*100):0;$('score').textContent=pct+'%';$('scoreSub').textContent=`${correct} / ${total} 정답`;$('statTotal').textContent=total;$('statCorrect').textContent=correct;$('statWrong').textContent=total-correct;$('retryWrong').disabled=wrong.length===0;const list=$('wrongList');list.innerHTML=wrong.length?wrong.map(q=>`<div class="wrong"><div><strong>${escapeHtml(q.source.label)}</strong><small>${escapeHtml(q.source.title||'')}</small></div><div class="ans">내 답 ${escapeHtml(q.user||'미입력')}<br>정답 ${escapeHtml(q.answer)}</div></div>`).join(''):'<div style="text-align:center;color:var(--good);font-weight:900">전부 맞았습니다.</div>';show('resultView');}
document.querySelectorAll('.type-btn[data-type]').forEach(btn=>btn.onclick=()=>{state.type=btn.dataset.type;state.difficulty=null;state.selected.clear();renderDifficulty();show('difficultyView');});
document.querySelectorAll('.difficulty-btn').forEach(btn=>btn.onclick=()=>{state.difficulty=btn.dataset.difficulty;renderSetup();show('setupView');});
$('backType').onclick=()=>show('landingView');
$('changeDifficulty').onclick=()=>{renderDifficulty();show('difficultyView');};
document.querySelectorAll('[data-order]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-order]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.sort=btn.dataset.order;syncSummary();});
document.querySelectorAll('[data-blocks]').forEach(btn=>btn.onclick=()=>{state.orderBlocks=btn.dataset.blocks;document.querySelectorAll('[data-blocks]').forEach(x=>x.classList.toggle('active',x===btn));renderSetup();});
$('startBtn').onclick=()=>{state.lastSelection=[...state.selected];state.session=buildSession(state.lastSelection);state.index=0;if(!state.session.length)return;show('quizView');renderQuiz();};
$('prevBtn').onclick=()=>{if(state.index>0){state.index--;renderQuiz();}};$('nextBtn').onclick=()=>{if(state.index<state.session.length-1){state.index++;renderQuiz();}};$('mainAction').onclick=mainAction;$('quitBtn').onclick=()=>{renderSetup();show('setupView');};$('backSetup').onclick=()=>{renderSetup();show('setupView');};
$('retrySame').onclick=()=>{state.session=buildSession(state.lastSelection);state.index=0;show('quizView');renderQuiz();};
$('retryWrong').onclick=()=>{if(!state.lastWrong.length)return;state.session=buildSession(state.lastWrong);state.index=0;show('quizView');renderQuiz();};
