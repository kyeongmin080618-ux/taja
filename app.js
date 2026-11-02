const passages = {
  sentence: [
    '작은 습관이 모여 단단한 하루를 만듭니다.',
    '천천히 걷는 길에도 나만의 풍경이 있어요.',
    '따뜻한 차 한 잔에 마음을 잠시 놓아봅니다.',
    '오늘의 바람은 내일의 나를 조금 더 자라게 해요.',
    '좋아하는 일을 오래도록 좋아할 수 있기를 바랍니다.',
    '창문을 열면 새로운 계절의 냄새가 들어옵니다.',
    '서두르지 않아도 괜찮아요, 우리는 잘 가고 있어요.',
    '고요한 아침에는 작은 소리도 선명하게 들립니다.'
  ],
  word: ['나무','햇살','다정함','산책','초록빛','구름','마음','고요한 오후','반짝이다','새로운 시작']
};
const rows = [
  [['q','ㅂ'],['w','ㅈ'],['e','ㄷ'],['r','ㄱ'],['t','ㅅ'],['y','ㅛ'],['u','ㅕ'],['i','ㅑ'],['o','ㅐ'],['p','ㅔ']],
  [['a','ㅁ'],['s','ㄴ'],['d','ㅇ'],['f','ㄹ'],['g','ㅎ'],['h','ㅗ'],['j','ㅓ'],['k','ㅏ'],['l','ㅣ']],
  [['z','ㅋ'],['x','ㅌ'],['c','ㅊ'],['v','ㅍ'],['b','ㅠ'],['n','ㅜ'],['m','ㅡ']]
];
const keyboard = document.querySelector('#keyboard');
const promptEl = document.querySelector('#prompt');
const input = document.querySelector('#typingInput');
const inputWrap = document.querySelector('#inputWrap');
const touchDevice = window.matchMedia('(pointer: coarse)').matches;
if (touchDevice) {
  input.readOnly = true;
  input.setAttribute('inputmode', 'none');
  document.querySelector('#inputHint').textContent = '아래 화면 키보드를 눌러 입력하세요';
}
let mode = 'sentence', passageIndex = 0, startedAt = null, timerInterval = null, soundOn = false, audioContext;

let virtualSequence = [], virtualPrefix = '', shifted = false, virtualUpdate = false;
function addKey(row, id, label, hangul = '', extraClass = '') {
  const key = document.createElement('button'); key.type = 'button'; key.className = `key ${extraClass}`.trim(); key.dataset.key = id;
  key.setAttribute('aria-label', hangul ? `${label}, ${hangul}` : label);
  key.innerHTML = `<span class="latin">${label}</span>${hangul ? `<span class="hangul">${hangul}</span>` : ''}`;
  key.addEventListener('click', () => virtualPress(id)); row.appendChild(key);
}
rows.forEach((row) => {
  const rowEl = document.createElement('div'); rowEl.className = 'key-row';
  row.forEach(([latin, hangul]) => addKey(rowEl, latin, latin, hangul));
  keyboard.appendChild(rowEl);
});
const controlRow = document.createElement('div'); controlRow.className = 'key-row control-row';
addKey(controlRow, 'shift', 'SHIFT', '', 'wide');
addKey(controlRow, 'space', 'SPACE', '', 'space');
addKey(controlRow, 'backspace', '⌫', '', 'wide');
keyboard.appendChild(controlRow);

const consonants = {
  q:[7,17], Q:[8,0], w:[12,22], W:[13,0], e:[3,7], E:[4,0], r:[0,1], R:[1,2], t:[9,19], T:[10,20],
  a:[6,16], s:[2,4], d:[11,21], f:[5,8], g:[18,27], z:[15,24], x:[16,25], c:[14,23], v:[17,26]
};
const vowels = {k:0,o:1,i:2,O:3,j:4,p:5,u:6,P:7,h:8,y:12,n:13,b:17,m:18,l:20};
const initialIndex = {0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,11:11,12:12,13:13,14:14,15:15,16:16,17:17,18:18};
const finalIndex = Object.fromEntries(Object.entries(consonants).map(([key, pair]) => [key, pair[1]]));
const compoundVowels = {'8,0':9,'8,1':10,'8,20':11,'13,4':14,'13,5':15,'13,20':16,'18,20':19};
const finalClusters = {'1,19':3,'4,22':5,'4,27':6,'8,1':9,'8,16':10,'8,17':11,'8,19':12,'8,25':13,'8,26':14,'8,27':15,'17,19':18};
const splitClusters = {3:[1,19],5:[4,22],6:[4,27],9:[8,1],10:[8,16],11:[8,17],12:[8,19],13:[8,25],14:[8,26],15:[8,27],18:[17,19]};
const doubledInitial = {'0,0':1,'3,3':4,'7,7':8,'9,9':10,'12,12':13};
function composeKorean(sequence) {
  const out = []; let L = null, V = null, T = 0;
  const syllable = () => String.fromCharCode(0xac00 + (L * 21 + V) * 28 + T);
  const compat = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const flush = () => { if (L !== null && V !== null) out.push(syllable()); else if (L !== null) out.push(compat[L]); L = null; V = null; T = 0; };
  for (const token of sequence) {
    if (token === ' ') { flush(); out.push(' '); continue; }
    const lowerToken = token.toLowerCase();
    if (Object.hasOwn(vowels, token) || Object.hasOwn(vowels, lowerToken)) {
      const vowel = vowels[token] ?? vowels[lowerToken];
      if (L === null) L = 11;
      if (V === null) { V = vowel; continue; }
      if (!T) { const combined = compoundVowels[`${V},${vowel}`]; if (combined !== undefined) V = combined; else { out.push(syllable()); L = 11; V = vowel; } continue; }
      const split = splitClusters[T];
      if (split) { out.push(String.fromCharCode(0xac00 + (L * 21 + V) * 28 + split[0])); L = consonantsForFinal(split[1]); }
      else { out.push(String.fromCharCode(0xac00 + (L * 21 + V) * 28)); L = consonantsForFinal(T); }
      V = vowel; T = 0; continue;
    }
    if (Object.hasOwn(consonants, token) || Object.hasOwn(consonants, lowerToken)) {
      const [initial, final] = consonants[token] ?? consonants[lowerToken];
      if (L === null) { L = initial; continue; }
      if (V === null) { const doubled = doubledInitial[`${L},${initial}`]; if (doubled !== undefined) L = doubled; else { out.push(compat[L]); L = initial; } continue; }
      if (!T) { if (final) T = final; else { out.push(syllable()); L = initial; V = null; } continue; }
      const cluster = finalClusters[`${T},${final}`];
      if (cluster) T = cluster; else { out.push(syllable()); L = initial; V = null; T = 0; }
      continue;
    }
  }
  flush(); return out.join('');
}
function consonantsForFinal(final) { return ({1:0,2:1,4:2,7:3,8:5,16:6,17:7,19:9,20:10,21:11,22:12,23:14,24:15,25:16,26:17,27:18})[final] ?? 11; }
function updateVirtualInput() { virtualUpdate = true; input.value = virtualPrefix + composeKorean(virtualSequence); input.dispatchEvent(new Event('input', {bubbles:true})); virtualUpdate = false; }
function virtualPress(key) {
  if (key === 'shift') { shifted = !shifted; document.querySelector('[data-key="shift"]').classList.toggle('active', shifted); return; }
  if (key === 'backspace') {
    if (virtualSequence.length) virtualSequence.pop(); else { virtualPrefix = [...virtualPrefix].slice(0,-1).join(''); }
    updateVirtualInput(); return;
  }
  if (key === 'space') { virtualSequence.push(' '); updateVirtualInput(); virtualPrefix = input.value; virtualSequence = []; return; }
  virtualSequence.push(shifted ? key.toUpperCase() : key); shifted = false;
  document.querySelector('[data-key="shift"]').classList.remove('active');
  updateVirtualInput();
}

function renderPrompt(value = '') {
  const target = passages[mode][passageIndex % passages[mode].length];
  promptEl.innerHTML = [...target].map((char, i) => {
    let cls = 'pending';
    if (i < value.length) cls = value[i] === char ? 'done' : 'error';
    if (i === value.length) cls = 'current';
    return `<span class="char ${cls}">${char === ' ' ? '&nbsp;' : char}</span>`;
  }).join('');
  const correct = [...value].reduce((n, char, i) => n + (char === target[i] ? 1 : 0), 0);
  const accuracy = value.length ? Math.round(correct / value.length * 100) : 100;
  const progress = Math.min(100, Math.round(value.length / target.length * 100));
  document.querySelector('#accuracy').innerHTML = `${accuracy}<span class="stat-unit">%</span>`;
  document.querySelector('#progressStat').innerHTML = `${progress}<span class="stat-unit">%</span>`;
  document.querySelector('#speed').innerHTML = `${startedAt ? Math.round(correct / Math.max(1, (Date.now() - startedAt) / 60000)) : 0}<span class="stat-unit">타/분</span>`;
  inputWrap.classList.toggle('has-value', value.length > 0);
}
function resetStats() { startedAt = null; clearInterval(timerInterval); timerInterval = null; document.querySelector('#timer').textContent = '00:00'; }
function startTimer() { if (startedAt) return; startedAt = Date.now(); timerInterval = setInterval(() => { const sec = Math.floor((Date.now()-startedAt)/1000); document.querySelector('#timer').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; renderPrompt(input.value); }, 1000); }
function setPassage(next = true) { if (next) passageIndex++; resetStats(); input.value = ''; input.dataset.lastValue = ''; virtualPrefix = ''; virtualSequence = []; shifted = false; document.querySelector('[data-key="shift"]')?.classList.remove('active'); renderPrompt(); if (!touchDevice) input.focus(); }
function beep() { if (!soundOn) return; audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); const osc = audioContext.createOscillator(), gain = audioContext.createGain(); osc.frequency.value = 740; gain.gain.value = .025; osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .025); }
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1500); }

input.addEventListener('keydown', (event) => {
  const key = event.code === 'Space' ? 'space' : event.code.startsWith('Key') ? event.code.slice(3).toLowerCase() : null;
  if (key) { document.querySelector(`.key[data-key="${key}"]`)?.classList.add('active'); setTimeout(() => document.querySelector(`.key[data-key="${key}"]`)?.classList.remove('active'), 140); }
  if (event.key === 'Enter') { event.preventDefault(); if (input.value === passages[mode][passageIndex % passages[mode].length]) setPassage(); }
});
input.addEventListener('input', () => {
  const target = passages[mode][passageIndex % passages[mode].length];
  if (!virtualUpdate) { virtualSequence = []; virtualPrefix = input.value; }
  if (input.value.length && !startedAt) startTimer();
  const previous = input.dataset.lastValue || '';
  if (input.value.length > previous.length) beep();
  input.dataset.lastValue = input.value;
  if (input.value.length < previous.length) input.dataset.lastValue = input.value;
  renderPrompt(input.value);
  if (input.value === target) { showToast('잘했어요! 다음 문장으로 넘어갈게요.'); setTimeout(() => setPassage(), 700); }
});
document.querySelectorAll('.mode-tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.mode-tab').forEach(item => { item.classList.remove('active'); item.setAttribute('aria-selected','false'); });
  tab.classList.add('active'); tab.setAttribute('aria-selected','true'); mode = tab.dataset.mode; passageIndex = 0; input.dataset.lastValue = ''; setPassage(false);
}));
document.querySelector('#newText').addEventListener('click', () => { passageIndex++; input.dataset.lastValue = ''; setPassage(false); });
document.querySelector('#resetButton').addEventListener('click', () => { input.dataset.lastValue = ''; setPassage(false); });
document.querySelector('#soundToggle').addEventListener('click', (event) => { soundOn = !soundOn; document.querySelector('#soundIcon').textContent = soundOn ? '♫' : '♪'; event.currentTarget.querySelector('.sound-label').textContent = soundOn ? '소리 끄기' : '소리 켜기'; event.currentTarget.setAttribute('aria-label', soundOn ? '타자 소리 끄기' : '타자 소리 켜기'); });
document.querySelector('.prompt-wrap').addEventListener('click', () => { if (!touchDevice) input.focus(); });
input.dataset.lastValue = ''; renderPrompt();

