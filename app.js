'use strict';

/* ═══════════════════════════════════════════════════════════
   Password lock
   ═══════════════════════════════════════════════════════════ */

const PASSWORD = 'JulienPPL';
const UNLOCK_KEY = 'ppl_unlocked';

function checkPassword() {
  const input = document.getElementById('password-input');
  const error = document.getElementById('lock-error');

  if (input.value === PASSWORD) {
    localStorage.setItem(UNLOCK_KEY, '1');
    showScreen('home');
  } else {
    input.classList.add('error');
    error.classList.remove('hidden');
    input.value = '';
    input.focus();
    setTimeout(() => input.classList.remove('error'), 600);
  }
}

// On page load: skip lock if already unlocked
if (localStorage.getItem(UNLOCK_KEY) === '1') {
  showScreen('home');
}

/* ═══════════════════════════════════════════════════════════
   Config
   ═══════════════════════════════════════════════════════════ */

const EXAMS = {
  met1: { label: 'MET 1', file: 'data/met1.json' },
  met2: { label: 'MET 2', file: 'data/met2.json' },
  met3: { label: 'MET 3', file: 'data/met3.json' },
};

const PASS_AUTHORITY = 75;  // %
const PASS_SCHOOL    = 90;  // %
const NOTES_KEY      = 'ppl_met_notes';

/* ═══════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════ */

let state = {
  examKey:    null,
  questions:  [],
  current:    0,
  score:      0,
  answered:   false,
  selected:   null,
};

/* ═══════════════════════════════════════════════════════════
   Notes (localStorage)
   ═══════════════════════════════════════════════════════════ */

function loadNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getNote(examKey, questionId) {
  const notes = loadNotes();
  return (notes[examKey] && notes[examKey][questionId]) || '';
}

function saveNote(examKey, questionId, text) {
  const notes = loadNotes();
  if (!notes[examKey]) notes[examKey] = {};
  notes[examKey][questionId] = text.trim();
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

/* ═══════════════════════════════════════════════════════════
   Screen switching
   ═══════════════════════════════════════════════════════════ */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

/* ═══════════════════════════════════════════════════════════
   Start exam
   ═══════════════════════════════════════════════════════════ */

async function startExam(examKey) {
  const exam = EXAMS[examKey];

  let data;
  try {
    const resp = await fetch(exam.file);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    data = await resp.json();
  } catch (err) {
    alert('Fehler beim Laden der Fragen: ' + err.message);
    return;
  }

  state = {
    examKey,
    questions: data.questions,
    current:   0,
    score:     0,
    answered:  false,
    selected:  null,
  };

  document.getElementById('exam-label-display').textContent = exam.label;
  document.getElementById('total-display').textContent = data.questions.length;

  showScreen('quiz');
  renderQuestion();
}

/* ═══════════════════════════════════════════════════════════
   Render question
   ═══════════════════════════════════════════════════════════ */

function renderQuestion() {
  const { examKey, questions, current, score } = state;
  const q = questions[current];
  const total = questions.length;

  // Header
  document.getElementById('progress-text').textContent =
    `Frage ${current + 1} von ${total}`;
  document.getElementById('score-display').textContent = score;

  // Progress bar
  document.getElementById('progress-fill').style.width =
    (current / total * 100) + '%';

  // Existing note → show as hint BEFORE answering
  const existingNote = getNote(examKey, q.id);
  const hintBox  = document.getElementById('hint-box');
  const hintText = document.getElementById('hint-text');
  if (existingNote) {
    hintText.textContent = existingNote;
    hintBox.classList.remove('hidden');
  } else {
    hintBox.classList.add('hidden');
  }

  // Question text
  document.getElementById('question-text').textContent = q.question;

  // Options
  const container = document.getElementById('options-container');
  container.innerHTML = '';
  ['a', 'b', 'c', 'd'].forEach(letter => {
    if (!q.options[letter]) return;

    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.letter = letter;
    btn.onclick = () => selectOption(letter);
    btn.innerHTML = `
      <span class="option-letter">${letter}</span>
      <span class="option-text">${q.options[letter]}</span>
    `;
    container.appendChild(btn);
  });

  // Reset feedback
  const feedbackArea = document.getElementById('feedback-area');
  feedbackArea.classList.add('hidden');
  document.getElementById('note-area').classList.add('hidden');
  document.getElementById('note-input').value = '';

  // Buttons
  document.getElementById('btn-submit').classList.remove('hidden');
  document.getElementById('btn-submit').disabled = true;
  document.getElementById('btn-next').classList.add('hidden');

  state.answered = false;
  state.selected = null;
}

/* ═══════════════════════════════════════════════════════════
   Select option
   ═══════════════════════════════════════════════════════════ */

function selectOption(letter) {
  if (state.answered) return;

  state.selected = letter;

  // Update visual selection
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.letter === letter);
  });

  document.getElementById('btn-submit').disabled = false;
}

/* ═══════════════════════════════════════════════════════════
   Submit answer
   ═══════════════════════════════════════════════════════════ */

function submitAnswer() {
  if (state.answered || !state.selected) return;

  state.answered = true;

  const q         = state.questions[state.current];
  const isCorrect = state.selected === q.correct;

  if (isCorrect) state.score++;

  // Highlight options
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    const letter = btn.dataset.letter;
    if (letter === q.correct) {
      btn.classList.add('correct');
    } else if (letter === state.selected && !isCorrect) {
      btn.classList.add('wrong');
    }
    btn.classList.remove('selected');
  });

  // Feedback banner
  const feedbackArea   = document.getElementById('feedback-area');
  const feedbackBanner = document.getElementById('feedback-banner');
  feedbackArea.classList.remove('hidden');

  if (isCorrect) {
    feedbackBanner.className = 'correct';
    feedbackBanner.textContent = '✓ Richtig!';
  } else {
    feedbackBanner.className = 'wrong';
    const correctText = q.options[q.correct];
    feedbackBanner.textContent = `✗ Falsch — Richtig wäre: (${q.correct.toUpperCase()}) ${correctText}`;
  }

  // Note area — show when wrong so user can write/update their mnemonic
  if (!isCorrect) {
    const noteArea  = document.getElementById('note-area');
    const noteInput = document.getElementById('note-input');
    noteArea.classList.remove('hidden');

    // Pre-fill with existing note (if any)
    const existing = getNote(state.examKey, q.id);
    noteInput.value = existing;
    noteInput.focus();

    // Auto-save on blur/change
    noteInput.onblur  = () => persistNote();
    noteInput.onchange = () => persistNote();
  }

  // Update score display
  document.getElementById('score-display').textContent = state.score;

  // Swap buttons
  document.getElementById('btn-submit').classList.add('hidden');
  document.getElementById('btn-next').classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════════════
   Persist note (called on blur, change, and before next)
   ═══════════════════════════════════════════════════════════ */

function persistNote() {
  const noteInput = document.getElementById('note-input');
  const text = noteInput.value.trim();
  const q = state.questions[state.current];
  saveNote(state.examKey, q.id, text);

  // Update hint box so it's ready for the results review (not shown on this question anymore)
}

/* ═══════════════════════════════════════════════════════════
   Next question
   ═══════════════════════════════════════════════════════════ */

function nextQuestion() {
  // Save note if note area was visible
  const noteArea = document.getElementById('note-area');
  if (!noteArea.classList.contains('hidden')) {
    persistNote();
  }

  state.current++;

  if (state.current >= state.questions.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

/* ═══════════════════════════════════════════════════════════
   Results screen
   ═══════════════════════════════════════════════════════════ */

function showResults() {
  const total   = state.questions.length;
  const score   = state.score;
  const percent = Math.round(score / total * 100);

  const passAuth   = percent >= PASS_AUTHORITY;
  const passSchool = percent >= PASS_SCHOOL;

  // Progress bar full
  document.getElementById('progress-fill').style.width = '100%';

  showScreen('results');

  // Exam label
  document.getElementById('results-exam-label').textContent =
    EXAMS[state.examKey].label;

  // Score circle
  const percentEl = document.getElementById('results-percent');
  percentEl.textContent = percent + '%';
  percentEl.style.color = passSchool ? '#4ade80' : passAuth ? '#fbbf24' : '#f87171';

  document.getElementById('results-fraction').textContent =
    `${score} / ${total} richtig`;

  // Pass table
  document.getElementById('cell-authority').innerHTML = passAuth
    ? `<span class="cell-pass">✓ ${percent}%</span>`
    : `<span class="cell-fail">✗ ${percent}%</span>`;

  document.getElementById('cell-school').innerHTML = passSchool
    ? `<span class="cell-pass">✓ ${percent}%</span>`
    : `<span class="cell-fail">✗ ${percent}%</span>`;

  // Icon + message
  const icon = document.getElementById('results-icon');
  const msg  = document.getElementById('results-message');

  if (passSchool) {
    icon.textContent = '🏆';
    msg.textContent =
      'Hervorragend! Du hast beide Prüfungen bestanden — ' +
      'sowohl den Mock Exam der Flugschule als auch die Flugbehörden-Prüfung.';
  } else if (passAuth) {
    icon.textContent = '✅';
    msg.textContent =
      `Du hast die Flugbehörden-Prüfung bestanden! ` +
      `Für den Mock Exam der Flugschule brauchst du noch ` +
      `${Math.ceil(total * PASS_SCHOOL / 100) - score} Frage(n) mehr.`;
  } else {
    const needAuth   = Math.ceil(total * PASS_AUTHORITY / 100) - score;
    icon.textContent = '📚';
    msg.textContent =
      `Noch nicht bestanden. Du brauchst ${needAuth} weitere richtige Antwort(en) ` +
      `(≥ ${PASS_AUTHORITY}%) für die Flugbehörde. Weiter üben — du schaffst das!`;
  }
}

/* ═══════════════════════════════════════════════════════════
   Navigation helpers
   ═══════════════════════════════════════════════════════════ */

function goHome() {
  showScreen('home');
}

function confirmGoHome() {
  if (state.current === 0 && !state.answered) {
    goHome();
    return;
  }
  if (confirm('Quiz abbrechen und zur Auswahl zurückkehren?')) {
    goHome();
  }
}

function retryExam() {
  startExam(state.examKey);
}
