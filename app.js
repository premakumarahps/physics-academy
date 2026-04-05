/* ═══════════════════════════════════════════
   app.js — Paper Taking Logic
   Loads paper from localStorage by URL param
   ═══════════════════════════════════════════ */

// ─── State ───
let questions = [];
let paperData = null;
let config = {};
let timerInterval = null;
let remainingSeconds = 0;
let submitted = false;
let lastSubmittedResult = null;
let currentReviewResult = null;

// ─── DOM refs ───
const welcomeScreen = document.getElementById('welcome-screen');
const appHeader = document.getElementById('app-header');
const appMain = document.getElementById('app-main');
const paperContainer = document.getElementById('paper-container');
const loadingState = document.getElementById('loading-state');
const submitArea = document.getElementById('submit-area');
const btnSubmit = document.getElementById('btn-submit');
const timerEl = document.getElementById('timer');
const timerBadge = document.getElementById('timer-badge');
const progressPill = document.getElementById('progress-pill');
const scoreSummary = document.getElementById('score-summary');

// ═══════════════════════════════════════
// 0. INIT — load paper from URL param
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await DB.seed();
  
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const session = Auth.getSession();

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const isAdminReview = session.role === 'admin' && mode === 'review';
  if (!isAdminReview && session.role !== 'student') {
    window.location.href = 'index.html';
    return;
  }

  let paperId = params.get('paperId') || sessionStorage.getItem('currentPaperId');
  if (!paperId) {
    alert('No activity specified.');
    window.location.href = session.role === 'admin' ? 'admin.html' : 'student.html';
    return;
  }

  // Determine whose result we are looking at
  const targetStudentId = isAdminReview ? params.get('studentId') : session.studentId;

  // Check if already completed
  const resultData = DB.getResult(paperId, targetStudentId);
  if (resultData && mode !== 'review') {
    alert('You have already completed this activity.');
    window.location.href = 'student.html';
    return;
  }

  paperData = DB.getPaper(paperId);
  if (!paperData) {
    alert('Activity not found.');
    window.location.href = session.role === 'admin' ? 'admin.html' : 'student.html';
    return;
  }

  questions = DB.getPaperQuestions(paperId);

  // Load config for instructions
  config = DB.getConfig();

  if (mode === 'review' && resultData) {
    // Review Mode Setup
    appHeader.style.display = 'block';
    appMain.style.display = 'block';
    document.getElementById('welcome-screen').style.display = 'none';

    renderQuestions();

    // Apply previous answers
    Object.entries(resultData.answers).forEach(([qid, ans]) => {
      if (ans) {
        const radio = document.querySelector(`input[name="q${qid}"][value="${ans}"]`);
        if (radio) radio.checked = true;
      }
    });

    submitPaper(true, resultData);
  } else {
    populateWelcome();
  }
});

// ═══════════════════════════════════════
// 1. WELCOME SCREEN
// ═══════════════════════════════════════
function populateWelcome() {
  document.getElementById('paper-id-badge').textContent = paperData.code || '—';
  document.getElementById('welcome-title').textContent = paperData.name || 'Examination';
  document.getElementById('welcome-subject').textContent = config.paperSubject || 'Online Assessment';

  const mins = paperData.timerMinutes || 120;
  const hrs = Math.floor(mins / 60);
  const rm = mins % 60;
  document.getElementById('meta-duration').textContent =
    hrs > 0 ? (rm > 0 ? `${hrs}h ${rm}m` : `${hrs} Hours`) : `${mins} min`;
  document.getElementById('meta-questions').textContent = `${questions.length} MCQ`;
  document.getElementById('meta-marking').textContent = config.markingScheme || '+1 per correct';

  remainingSeconds = mins * 60;
  updateTimerDisplay();

  // Instructions
  const list = document.getElementById('instructions-list');
  list.innerHTML = '';
  const instructions = config.instructions || [
    'This activity contains multiple choice questions (MCQs).',
    'Each question has <strong>five</strong> answer choices.',
    'Select <strong>only one</strong> answer for each question.',
    'There is <strong>no negative marking</strong>.',
    'The activity will auto-submit when time runs out.',
    'After submission, you can review corrections and download as PDF.'
  ];
  instructions.forEach(text => {
    const li = document.createElement('li');
    li.innerHTML = text;
    list.appendChild(li);
  });

  document.getElementById('welcome-hint').textContent = config.welcomeHint || 'Click start when you are ready. Good luck!';
}

// sanitizeHTML() and escapeHTML() are defined in shared.js (loaded before this file)


// ═══════════════════════════════════════
// 2. START PAPER
// ═══════════════════════════════════════
function startPaper() {
  // Confirmation dialog to prevent accidental starts
  if (!confirm('Are you sure you want to start? The timer will begin immediately and cannot be paused.')) {
    return;
  }

  welcomeScreen.style.opacity = '0';
  welcomeScreen.style.transform = 'scale(0.97)';
  welcomeScreen.style.transition = 'opacity .4s ease, transform .4s ease';

  setTimeout(() => {
    welcomeScreen.style.display = 'none';
    appHeader.style.display = 'block';
    appMain.style.display = 'block';
    renderQuestions();
    startTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 400);
}

// ═══════════════════════════════════════
// 3. RENDER QUESTIONS
// ═══════════════════════════════════════
function renderQuestions() {
  let html = '';
  questions.forEach((q, idx) => {
    html += buildQuestionHTML(q, {
      isStudentView: true,
      questionIndex: idx,
      showAdminTags: false
    });
  });

  paperContainer.innerHTML = html;
  loadingState.style.display = 'none';
  paperContainer.style.display = 'block';
  submitArea.style.display = 'block';
  paperContainer.addEventListener('change', updateProgress);
  renderKaTeX(paperContainer);
  updateProgress();
}

// KaTeX is now handled via shared.js

// ═══════════════════════════════════════
// 5. TIMER
// ═══════════════════════════════════════
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      updateTimerDisplay();
      submitPaper();
      return;
    }
    updateTimerDisplay();
    if (remainingSeconds <= 300) {
      timerBadge.classList.remove('warning');
      timerBadge.classList.add('danger');
    } else if (remainingSeconds <= 600) {
      timerBadge.classList.add('warning');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const h = Math.floor(remainingSeconds / 3600);
  const m = Math.floor((remainingSeconds % 3600) / 60);
  const s = remainingSeconds % 60;
  timerEl.textContent =
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0');
}

// ═══════════════════════════════════════
// 6. PROGRESS
// ═══════════════════════════════════════
function updateProgress() {
  const total = questions.length;
  let answered = 0;
  questions.forEach(q => {
    if (document.querySelector(`input[name="q${q.id}"]:checked`)) answered++;
  });
  progressPill.textContent = `${answered} / ${total} answered`;
}

// ═══════════════════════════════════════
// 7. SUBMIT
// ═══════════════════════════════════════
function submitPaper(isReviewMode = false, existingResult = null) {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
    ${isReviewMode ? 'Activity Reviewed' : 'Submitted'}`;

  let correct = 0;
  const total = questions.length;
  const answers = {};

  questions.forEach(q => {
    const block = document.getElementById(`qblock-${q.id}`);
    const optionsRow = document.getElementById(`opts-${q.id}`);
    optionsRow.classList.add('disabled');
    optionsRow.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);

    const correctKey = q.correctAnswer;
    const selected = document.querySelector(`input[name="q${q.id}"]:checked`);

    const correctLabel = optionsRow.querySelector(`.qr-option-item[data-val="${correctKey}"]`);
    if (correctLabel) correctLabel.classList.add('correct');

    let badgeHTML = '';
    if (selected) {
      answers[q.id] = selected.value;
      if (selected.value === correctKey) {
        correct++;
        badgeHTML = `<div class="q-result-badge badge-correct">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          Correct</div>`;
      } else {
        const wrongLabel = optionsRow.querySelector(`.qr-option-item[data-val="${selected.value}"]`);
        if (wrongLabel) wrongLabel.classList.add('wrong');
        badgeHTML = `<div class="q-result-badge badge-wrong">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Wrong — Answer: (${correctKey})</div>`;
      }
    } else {
      answers[q.id] = null;
      badgeHTML = `<div class="q-result-badge badge-skipped">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Skipped — Answer: (${correctKey})</div>`;
    }
    block.insertAdjacentHTML('beforeend', badgeHTML);
  });

  if (!isReviewMode) {
    // CRITICAL: Save result and WAIT for completion before allowing navigation
    const session = Auth.getSession();
    DB.saveResult(paperData.id, session.studentId, answers, correct, total)
      .then(result => {
        lastSubmittedResult = result;
        showScore(correct, total);
        setTimeout(() => {
          scoreSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      })
      .catch(err => {
        console.error('Failed to save result:', err);
        alert('Error saving results. Please try again.');
      });
  } else if (existingResult) {
    // Display existing score and store for PDF
    currentReviewResult = existingResult;
    showScore(existingResult.score, existingResult.total);
    // Add review indicator
    document.getElementById('score-detail').innerHTML += ' <br/><span style="color:var(--orange);font-weight:bold;">(Review Mode)</span>';
    setTimeout(() => {
      scoreSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }
}

function showScore(correct, total) {
  const pct = total > 0 ? (correct / total) * 100 : 0;
  document.getElementById('score-number').textContent = `${correct}/${total}`;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (pct / 100) * circumference;
  const ringFg = document.getElementById('ring-fg');
  ringFg.style.strokeDashoffset = offset;
  if (pct >= 75) ringFg.style.stroke = 'var(--green)';
  else if (pct >= 40) ringFg.style.stroke = 'var(--accent)';
  else ringFg.style.stroke = 'var(--red)';
  document.getElementById('score-detail').textContent =
    `You scored ${correct} out of ${total} (${Math.round(pct)}%)`;
  scoreSummary.style.display = 'block';
}

// ═══════════════════════════════════════
// 8. PDF DOWNLOAD (Q_Render pagination engine)
// ═══════════════════════════════════════
let _pdfFirstPageHtml = '';
let _pdfSecondPageHtml = '';
let _pdfExamTemplate = null;
let _pdfPageCounter = 1;
let _pdfCurrentPageNode = null;
let _pdfCurrentBorderNode = null;

function _el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function _renderFirstPageHeader(template, pageEl, borderEl) {
  if (template.paperRef) {
    const ref = _el('div', 'paper-ref');
    ref.textContent = template.paperRef;
    pageEl.appendChild(ref);
  }
  const copyrightBar = _el('div', 'copyright-bar');
  copyrightBar.textContent = `${template.copyright.si} / ${template.copyright.ta} / ${template.copyright.en}`;
  borderEl.appendChild(copyrightBar);

  const deptExamWrap = _el('div', 'dept-exam-wrap');
  const deptExamBox = _el('div', 'dept-exam-box');
  const wmLines = [];
  const siWm = template.department.si, taWm = template.department.ta, enWm = template.department.en;
  for (let i = 0; i < 12; i++) {
    wmLines.push(Array(15).fill(siWm).join(' '));
    wmLines.push(Array(12).fill(taWm).join(' '));
    wmLines.push(Array(12).fill(enWm).join(' '));
  }
  const watermark = _el('div', 'dept-watermark');
  watermark.innerHTML = wmLines.map(l => `<div>${l}</div>`).join('');
  const deptText = _el('div', 'dept-text');
  deptText.appendChild(watermark);
  const deptTextContent = _el('div', '');
  deptTextContent.style.position = 'relative';
  deptTextContent.style.zIndex = '1';
  deptTextContent.innerHTML = `<div class="si">${template.department.si}</div><div class="ta">${template.department.ta}</div><div class="en">${template.department.en}</div>`;
  deptText.appendChild(deptTextContent);
  deptExamBox.appendChild(deptText);
  const examTitle = _el('div', 'exam-title');
  examTitle.innerHTML = `<div class="si">${template.exam.si}, ${template.exam.year}</div><div class="ta">${template.exam.ta}, ${template.exam.year}</div><div class="en">${template.exam.en}, ${template.exam.year}</div>`;
  deptExamBox.appendChild(examTitle);
  deptExamWrap.appendChild(deptExamBox);
  borderEl.appendChild(deptExamWrap);

  const middleRowWrap = _el('div', 'middle-row-wrap');
  const middleRow = _el('div', 'middle-row');
  const subjectBox = _el('div', 'subject-box');
  subjectBox.innerHTML = `<div class="line"><span>${template.subject.si}</span><span>${template.subject.paper}</span></div><div class="line"><span>${template.subject.ta}</span><span>${template.subject.paper}</span></div><div class="line"><span>${template.subject.en}</span><span>${template.subject.paper}</span></div>`;
  middleRow.appendChild(subjectBox);
  const codesArea = _el('div', 'codes-area');
  template.codes.forEach(code => { const box = _el('div', 'code-box'); box.textContent = code; codesArea.appendChild(box); });
  middleRow.appendChild(codesArea);
  const durationBox = _el('div', 'duration-box');
  durationBox.innerHTML = `<div class="line">${template.duration.si}</div><div class="line">${template.duration.ta}</div><div class="line">${template.duration.en}</div>`;
  middleRow.appendChild(durationBox);
  middleRowWrap.appendChild(middleRow);
  borderEl.appendChild(middleRowWrap);

  const instrBoxWrap = _el('div', 'instructions-box-wrap');
  const instrBox = _el('div', 'instructions-box');
  const instrLabel = _el('div', 'instructions-label');
  instrLabel.textContent = template.instructions.label;
  instrBox.appendChild(instrLabel);
  const ul = _el('ul', 'instructions-list');
  template.instructions.items.forEach(item => { const li = document.createElement('li'); li.innerHTML = item; ul.appendChild(li); });
  instrBox.appendChild(ul);
  const footer = _el('div', 'instructions-footer');
  const noCalc = _el('div', 'no-calc');
  noCalc.textContent = template.footer.notice;
  footer.appendChild(noCalc);
  template.footer.constants.forEach(c => {
    const constDiv = _el('div', 'constant');
    constDiv.innerHTML = `(${c.label} = ${c.value} ${c.unit}<sup>${c.power}</sup>)`;
    footer.appendChild(constDiv);
  });
  instrBox.appendChild(footer);
  instrBoxWrap.appendChild(instrBox);
  borderEl.appendChild(instrBoxWrap);

  const pgNum = _el('div', 'page-number');
  pgNum.textContent = `-${_pdfPageCounter}-`;
  pageEl.appendChild(pgNum);
}

function _renderSecondPageHeader(template, pageEl) {
  if (template.paperRef) {
    const ref = _el('div', 'paper-ref');
    ref.textContent = template.paperRef;
    pageEl.appendChild(ref);
  }
  const pg = _el('div', 'page-number');
  pg.textContent = `-${_pdfPageCounter}-`;
  pageEl.appendChild(pg);
}

function _createNewPage(isFirstPage) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(isFirstPage ? _pdfFirstPageHtml : _pdfSecondPageHtml, 'text/html');
  const pageNode = doc.querySelector('.a4-page');
  const borderNode = pageNode.querySelector('.page-border');
  if (isFirstPage) {
    _renderFirstPageHeader(_pdfExamTemplate, pageNode, borderNode);
  } else {
    _renderSecondPageHeader(_pdfExamTemplate, pageNode);
  }
  document.getElementById('pdf-container').appendChild(pageNode);
  _pdfCurrentPageNode = pageNode;
  _pdfCurrentBorderNode = borderNode;
  _pdfPageCounter++;
}

async function downloadPDF() {
  const btnDl = document.getElementById('btn-download-pdf');
  btnDl.disabled = true;
  btnDl.textContent = 'Generating PDF…';

  try {
    // Get current result data
    let currentResult = null;
    if (typeof currentReviewResult !== 'undefined' && currentReviewResult) {
      currentResult = currentReviewResult;
    } else if (typeof lastSubmittedResult !== 'undefined' && lastSubmittedResult) {
      currentResult = lastSubmittedResult;
    }

    // 1. Fetch templates (cache after first load)
    if (!_pdfFirstPageHtml) {
      btnDl.textContent = 'Loading templates…';
      const [r1, r2, rData] = await Promise.all([
        fetch('first_page_template.html'),
        fetch('second_page_template.html'),
        fetch('exam_template.json')
      ]);
      _pdfFirstPageHtml = await r1.text();
      _pdfSecondPageHtml = await r2.text();
      _pdfExamTemplate = await rData.json();

      // Inject template CSS into our document
      const parser = new DOMParser();
      const doc1 = parser.parseFromString(_pdfFirstPageHtml, 'text/html');
      doc1.querySelectorAll('style').forEach(s => document.head.appendChild(s.cloneNode(true)));
    }

    btnDl.textContent = 'Rendering questions…';

    // 2. Build question blocks using the SAME renderer as the rest of the app
    const questionBlocks = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      let studentAns = null;
      if (currentResult && currentResult.answers && currentResult.answers[q.id]) {
        studentAns = currentResult.answers[q.id];
      }

      // Use the SAME buildQuestionHTML used everywhere in the app
      const htmlStr = buildQuestionHTML(q, {
        isStudentView: true,
        questionIndex: i,
        showAdminTags: false,
        isEditable: false
      });

      // Parse to DOM
      const wrapper = _el('div');
      wrapper.innerHTML = htmlStr;
      const qBlock = wrapper.firstElementChild;

      // Apply answer grading — same logic as submitPaper()
      const optionsRow = qBlock.querySelector(`[id="opts-${q.id}"]`) || qBlock.querySelector('.qr-options-container');
      if (optionsRow) {
        optionsRow.classList.add('disabled');
        optionsRow.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);

        // Check the student's radio button
        if (studentAns) {
          const radio = qBlock.querySelector(`input[name="q${q.id}"][value="${studentAns}"]`);
          if (radio) radio.checked = true;
        }

        // Highlight correct answer
        const correctLabel = optionsRow.querySelector(`.qr-option-item[data-val="${q.correctAnswer}"]`);
        if (correctLabel) correctLabel.classList.add('correct');

        // Build result badge
        let badgeHTML = '';
        if (studentAns) {
          if (studentAns === q.correctAnswer) {
            badgeHTML = `<div class="q-result-badge badge-correct">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Correct</div>`;
          } else {
            const wrongLabel = optionsRow.querySelector(`.qr-option-item[data-val="${studentAns}"]`);
            if (wrongLabel) wrongLabel.classList.add('wrong');
            badgeHTML = `<div class="q-result-badge badge-wrong">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Wrong — Answer: (${q.correctAnswer})</div>`;
          }
        } else {
          badgeHTML = `<div class="q-result-badge badge-skipped">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Skipped — Answer: (${q.correctAnswer})</div>`;
        }
        qBlock.insertAdjacentHTML('beforeend', badgeHTML);
      }

      // Override animation and screen-specific styles for PDF
      qBlock.style.animation = 'none';
      qBlock.style.opacity = '1';
      qBlock.style.transform = 'none';
      qBlock.style.fontSize = '11px';
      qBlock.style.marginBottom = '6px';
      qBlock.style.paddingBottom = '6px';

      questionBlocks.push(qBlock);
    }

    // 3. Render KaTeX math on all question blocks
    const tempContainer = _el('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.visibility = 'hidden';
    tempContainer.style.width = '190mm';
    document.body.appendChild(tempContainer);
    questionBlocks.forEach(b => tempContainer.appendChild(b));
    renderKaTeX(tempContainer);
    await new Promise(resolve => setTimeout(resolve, 300));

    btnDl.textContent = 'Paginating…';

    // 4. Clear pdf-container and start pagination
    const pdfCont = document.getElementById('pdf-container');
    pdfCont.innerHTML = '';
    pdfCont.style.display = 'flex';

    _pdfPageCounter = 1;
    _createNewPage(true);

    // 5. Physical pagination — insert whole question blocks, check overflow
    for (let i = 0; i < questionBlocks.length; i++) {
      const qBlock = questionBlocks[i];
      _pdfCurrentBorderNode.appendChild(qBlock);

      if (_pdfCurrentBorderNode.scrollHeight > _pdfCurrentBorderNode.clientHeight) {
        _pdfCurrentBorderNode.removeChild(qBlock);
        _createNewPage(false);
        _pdfCurrentBorderNode.appendChild(qBlock);
      }
    }

    // Cleanup temp container
    if (tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);

    // 7. Add score summary at the top of the first question page (page 2)
    // Already included in the template header via exam info

    btnDl.textContent = 'Opening print dialog…';
    pdfCont.style.display = 'none'; // Hide from screen, print CSS will show it

    // Fire print dialog
    setTimeout(() => {
      window.print();
      resetDownloadBtn(btnDl);
    }, 500);

  } catch (err) {
    console.error('PDF Download Error:', err);
    resetDownloadBtn(btnDl, 'Error - Retry');
    alert('PDF generation error: ' + err.message);
  }
}

function resetDownloadBtn(btn, text) {
  btn.disabled = false;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    ${text || 'Download Corrected Activity (PDF)'}`;
}

// ═══════════════════════════════════════
// 9. NAVIGATION
// ═══════════════════════════════════════
function backToDashboard() {
  // Add a small delay to ensure any pending operations complete, then navigate
  setTimeout(() => {
    window.location.href = 'student.html';
  }, 500);
}
