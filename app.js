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
let mode = 'sentence', passageIndex = 0, startedAt = null, timerInterval = null, soundOn = false, audioContext;

rows.forEach((row, rowIndex) => {
  const rowEl = document.createElement('div'); rowEl.className = 'key-row';
  row.forEach(([latin, hangul]) => {
    const key = document.createElement('div'); key.className = 'key'; key.dataset.key = latin;
    key.innerHTML = `<span class="latin">${latin}</span><span class="hangul">${hangul}</span>`; rowEl.appendChild(key);
  });
  if (rowIndex === 2) { const space = document.createElement('div'); space.className = 'key space'; space.dataset.key = 'space'; space.innerHTML = '<span class="latin">SPACE</span>'; rowEl.appendChild(space); }
  keyboard.appendChild(rowEl);
});

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
function setPassage(next = true) { if (next) passageIndex++; resetStats(); input.value = ''; input.dataset.lastValue = ''; renderPrompt(); input.focus(); }
function beep() { if (!soundOn) return; audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); const osc = audioContext.createOscillator(), gain = audioContext.createGain(); osc.frequency.value = 740; gain.gain.value = .025; osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .025); }
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1500); }

input.addEventListener('keydown', (event) => {
  const key = event.code === 'Space' ? 'space' : event.code.startsWith('Key') ? event.code.slice(3).toLowerCase() : null;
  if (key) { document.querySelector(`.key[data-key="${key}"]`)?.classList.add('active'); setTimeout(() => document.querySelector(`.key[data-key="${key}"]`)?.classList.remove('active'), 140); }
  if (event.key === 'Enter') { event.preventDefault(); if (input.value === passages[mode][passageIndex % passages[mode].length]) setPassage(); }
});
input.addEventListener('input', () => {
  const target = passages[mode][passageIndex % passages[mode].length];
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
document.querySelector('.prompt-wrap').addEventListener('click', () => input.focus());
input.dataset.lastValue = ''; renderPrompt();
