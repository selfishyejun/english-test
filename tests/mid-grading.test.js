const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function loadApp(realSources = false) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      let text = '';
      elements.set(id, {
        style: {}, hidden: false, disabled: false, innerHTML: '',
        focusCalls: [], events: {},
        get textContent() { return text; },
        set textContent(value) { text = String(value); },
        classList: {
          toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
          add(name) { classes.add(name); },
          remove(name) { classes.delete(name); },
          contains(name) { return classes.has(name); }
        },
        focus(options) { this.focusCalls.push(options); },
        addEventListener(name, handler) { this.events[name] = handler; }
      });
    }
    return elements.get(id);
  }
  const window = {
    scrollX: 0, scrollY: 0,
    scrollTo({left = 0, top = 0}) { this.scrollX = left; this.scrollY = top; },
    matchMedia() { return {matches: false}; }
  };
  const context = vm.createContext({
    window,
    document: {getElementById: element, querySelectorAll: () => [], body: element('body')},
    setTimeout() {}
  });
  if (realSources) {
    for (let i = 1; i <= 6; i++) {
      vm.runInContext(fs.readFileSync(path.join(root, `data${i}.js`), 'utf8'), context);
    }
    vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
  } else {
    vm.runInContext('const SOURCE_DATA = [];', context);
  }
  vm.runInContext(appSource + '\nglobalThis.app = {state, hasCompleteAnswer, answerMatches, gradingSummary, grade, resumeQuiz, mainAction, buildSession, questionKey, eligible, SOURCE_DATA};', context);
  return {...context.app, element, window};
}

const modes = [
  ['order', 'easy'], ['order', 'hard'],
  ['insertion', 'easy'], ['insertion', 'hard'],
  ['word-order', 'easy'], ['word-order', 'hard'],
  ['context-vocab', 'easy'], ['context-vocab', 'hard'],
  ['connective', 'standard']
];

function question(kind, difficulty, id) {
  const q = {kind, source: {id, label: id, title: '', lesson: 1}, user: ''};
  if (kind === 'order') Object.assign(q, {
    blocks: ['A', 'B', 'C', 'D'].map(label => ({label})),
    answer: 'BCAD', touchOrder: '',
    options: difficulty === 'easy' ? ['BCAD', 'ABCD', 'DCBA', 'CBAD', 'BDAC'] : null
  });
  if (kind === 'insertion') Object.assign(q, {answer: '2', gaps: [1, 2, 3]});
  if (kind === 'word-order') Object.assign(q, {
    sentenceIndex: 0, user: [], answer: [0, 1, 2],
    tokens: ['We', 'practise', 'daily.'].map((text, id) => ({id, text}))
  });
  if (kind === 'context-vocab') Object.assign(q, {
    targetKey: 'practice', targetIndex: 0, answer: 'practice',
    choices: difficulty === 'easy' ? ['practice', 'example', 'study', 'write', 'read'] : null
  });
  if (kind === 'connective') Object.assign(q, {
    pairIndex: 0, answer: 'however||therefore', correctValues: ['however', 'therefore'],
    options: [
      {key: 'however||therefore', values: ['however', 'therefore']},
      {key: 'therefore||however', values: ['therefore', 'however']}
    ]
  });
  return q;
}

function answer(q, correct) {
  if (q.kind === 'word-order') q.user = correct ? [...q.answer] : [...q.answer].reverse();
  else if (q.kind === 'order') q.user = correct ? q.answer.toLowerCase() : 'ABCD';
  else if (q.kind === 'context-vocab') q.user = correct ? q.answer.toUpperCase() : 'example';
  else if (q.kind === 'insertion') q.user = correct ? q.answer : '1';
  else q.user = correct ? q.answer : 'therefore||however';
  if (q.kind === 'order' && q.options) q.user = q.user.toUpperCase();
}

for (const [kind, difficulty] of modes) {
  test(`${kind}/${difficulty}: partial grading, resume and final grading`, () => {
    const app = loadApp();
    const {state, element, window} = app;
    state.type = kind;
    state.difficulty = difficulty;
    const right = question(kind, difficulty, 'right');
    const wrong = question(kind, difficulty, 'wrong');
    const untouched = question(kind, difficulty, 'UNANSWERED');
    const incomplete = question(kind, difficulty, 'INCOMPLETE');
    answer(right, true);
    answer(wrong, false);
    if (kind === 'order') { incomplete.user = 'A'; incomplete.touchOrder = 'A'; }
    else if (kind === 'word-order') incomplete.user = [0];
    else incomplete.user = '   ';
    assert.equal(app.hasCompleteAnswer(right), true);
    assert.equal(app.hasCompleteAnswer(wrong), true);
    assert.equal(app.hasCompleteAnswer(untouched), false);
    assert.equal(app.hasCompleteAnswer(incomplete), false);

    state.session = [right, wrong, untouched, incomplete];
    state.index = 3;
    state.lastSelection = ['keep-selection'];
    state.lastWrong = ['keep-retry-keys'];
    const session = state.session;
    const before = JSON.stringify(state.session);
    element('quizPaper').innerHTML = 'keep-existing-question-and-handlers';
    window.scrollTo({left: 2, top: 640});
    element('midGradeBtn').onclick();

    assert.equal(element('resultTitle').textContent, '중간 채점');
    assert.equal(element('score').textContent, '50%');
    assert.equal(element('statTotal').textContent, '2');
    assert.equal(element('statCorrect').textContent, '1');
    assert.equal(element('statWrong').textContent, '1');
    assert.match(element('midGradeNote').textContent, /2문제 남음/);
    assert.equal(element('resumeActions').hidden, false);
    assert.equal(element('resultActions').hidden, true);
    assert.equal(element('resultView').classList.contains('active'), true);
    assert.deepEqual(state.lastWrong, ['keep-retry-keys']);
    assert.equal(JSON.stringify(state.session), before);
    assert.equal(app.gradingSummary(session, true).wrong[0], wrong);
    assert.equal((element('wrongList').innerHTML.match(/class="wrong /g) || []).length, 1);

    element('resumeQuiz').onclick();
    assert.equal(state.session, session);
    assert.equal(state.index, 3);
    assert.equal(window.scrollY, 640);
    assert.equal(window.scrollX, 2);
    assert.equal(element('quizPaper').innerHTML, 'keep-existing-question-and-handlers');
    assert.equal(element('quizView').classList.contains('active'), true);
    assert.equal(element('midGradeBtn').focusCalls[0].preventScroll, true);
    assert.equal(element('orderInput').focusCalls.length, 0);
    assert.equal(element('contextInput').focusCalls.length, 0);
    assert.equal(state.resumeScroll, null);
    assert.deepEqual(state.lastSelection, ['keep-selection']);

    answer(wrong, true);
    element('midGradeBtn').onclick();
    assert.equal(element('score').textContent, '100%');
    assert.equal(element('statTotal').textContent, '2');
    assert.match(element('wrongList').innerHTML, /푼 문제는 모두 맞았습니다/);
    element('resumeQuiz').onclick();
    answer(untouched, true);
    answer(incomplete, true);
    app.mainAction();
    assert.equal(element('resultTitle').textContent, '채점 결과');
    assert.equal(element('statTotal').textContent, '4');
    assert.equal(element('score').textContent, '100%');
    assert.equal(element('midGradeNote').hidden, true);
    assert.equal(element('resumeActions').hidden, true);
    assert.equal(element('resultActions').hidden, false);
    assert.equal(element('retryWrong').disabled, true);
    assert.equal(state.lastWrong.length, 0);
    assert.equal(state.resumeScroll, null);
  });
}

test('empty partial check reveals no answers and is not displayed as 0% or 100%', () => {
  const app = loadApp();
  app.state.type = 'context-vocab';
  app.state.difficulty = 'hard';
  const q = question('context-vocab', 'hard', 'secret-source');
  q.answer = 'UNREVEALED_SECRET';
  app.state.session = [q];
  app.element('midGradeBtn').onclick();
  assert.equal(app.element('score').textContent, '—');
  assert.equal(app.element('statTotal').textContent, '0');
  assert.equal(app.element('statWrong').textContent, '0');
  assert.match(app.element('scoreSub').textContent, /아직 채점할 답안이 없습니다/);
  assert.doesNotMatch(app.element('wrongList').innerHTML, /UNREVEALED_SECRET|secret-source/);
  app.element('resumeQuiz').onclick();
  assert.equal(app.element('quizView').classList.contains('active'), true);
});

test('incomplete order selections and duplicate word cards are not submitted answers', () => {
  const app = loadApp();
  const q = question('order', 'easy', 'touch');
  q.touchOrder = 'ACDB'; // A full touch order with no corresponding multiple-choice option.
  assert.equal(app.hasCompleteAnswer(q), false);
  q.user = 'AAAA';
  assert.equal(app.hasCompleteAnswer(q), false);
  const w = question('word-order', 'hard', 'cards');
  w.user = [0, 0, 0];
  assert.equal(app.hasCompleteAnswer(w), false);
});

test('all real source types retain generation, grading and question-specific retry behavior', () => {
  const app = loadApp(true);
  for (const [kind, difficulty] of modes) {
    app.state.type = kind;
    app.state.difficulty = difficulty;
    const ids = app.SOURCE_DATA.filter(app.eligible).map(item => item.id);
    const questions = app.buildSession(ids);
    assert.ok(questions.length > 0, kind);
    assert.equal(app.gradingSummary(questions, true).total, 0);
    questions.forEach(q => answer(q, true));
    assert.equal(app.gradingSummary(questions, true).correct, questions.length);
    questions[0].user = kind === 'word-order' ? [] : '';
    assert.equal(app.gradingSummary(questions, true).total, questions.length - 1);
    app.state.session = questions;
    app.grade();
    assert.equal(app.state.lastWrong.length, 1);
    const retry = app.buildSession(app.state.lastWrong);
    assert.equal(retry.length, 1);
    assert.equal(app.questionKey(retry[0]), app.questionKey(questions[0]));
    if (kind === 'insertion') assert.ok(questions.every(q => q.gaps.every(g => g > 0)));
  }
});

test('the intermediate controls exist and remain hidden when required', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  for (const id of ['midGradeBtn', 'resultTitle', 'statTotalLabel', 'midGradeNote', 'resumeActions', 'resumeQuiz', 'resultActions']) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
  }
  assert.match(html, /id="resumeActions"[^>]*hidden/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});
