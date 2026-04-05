/* ═══════════════════════════════════════════
   student.js — Student Dashboard Logic
   ═══════════════════════════════════════════ */

// escapeHTML() is defined in shared.js (loaded before this file)

document.addEventListener('DOMContentLoaded', async () => {
  await DB.seed();
  if (!Auth.requireStudent()) return;
  initStudentDashboard();
});

function initStudentDashboard() {
  const session = Auth.getSession();
  const studentType = session.studentType || 'guest';

  // Display name and type badge
  document.getElementById('user-name').textContent = session.name;
  document.getElementById('welcome-text').textContent = `Welcome, ${escapeHTML(session.name)}!`;

  const badge = document.getElementById('type-badge');
  if (studentType === 'premium') {
    badge.textContent = '⭐ Premium';
    badge.className = 'student-type-badge premium';
    document.body.classList.add('premium-student');
  } else {
    badge.textContent = 'Guest';
    badge.className = 'student-type-badge guest';
  }

  renderPapers(studentType);
  renderResults();
  renderProgressSummary();
  renderStudentMaterials();
}

function buildPaperCard(paper, result, session) {
  const isCompleted = !!result;
  const escapedName = escapeHTML(paper.name);
  const escapedCode = escapeHTML(paper.code || '');
  const typeIcons = { paper: '📝', quiz: '⚡', homework: '📚', assignment: '📋' };
  const aType = paper.activityType || 'paper';
  const icon = typeIcons[aType] || '📝';
  const timerEnabled = paper.isTimerEnabled !== false && ['paper', 'quiz'].includes(aType);
  const feedback = DB.getFeedback(paper.id, session.studentId);

  let dueBadge = '';
  if (paper.dueDate && !isCompleted) {
    const due = new Date(paper.dueDate);
    const now = new Date();
    const isOverdue = now > due;
    dueBadge = `<div style="font-size:12px;color:${isOverdue ? 'var(--red)' : 'var(--text-muted)'};margin-top:4px;">
      ${isOverdue ? '⚠️ Overdue' : '📅 Due: ' + due.toLocaleDateString()}
    </div>`;
  }

  let feedbackBadge = '';
  if (feedback && feedback.comment) {
    feedbackBadge = `<div style="font-size:12px;color:var(--blue);margin-top:6px;padding:6px 8px;background:var(--blue-bg, #eff6ff);border-radius:6px;">
      💬 ${escapeHTML(feedback.comment)}
    </div>`;
  }

  return `
    <div class="paper-card ${isCompleted ? 'completed' : ''}">
      <div class="paper-card-header">
        <div class="paper-card-name">${icon} ${escapedName}</div>
        ${escapedCode ? `<div class="paper-card-code">${escapedCode}</div>` : ''}
      </div>
      <div class="paper-card-meta">
        <span style="font-size:11px;background:rgba(99,102,241,0.1);color:#6366f1;padding:2px 8px;border-radius:8px;font-weight:600;">${aType}</span>
        ${timerEnabled ? `<span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${paper.timerMinutes} min
        </span>` : ''}
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${paper.questionIds ? paper.questionIds.length : 0} questions
        </span>
      </div>
      ${dueBadge}
      ${isCompleted
      ? `<button class="btn-start-paper" style="background:var(--green);" onclick="reviewPaper('${escapeHTML(paper.id)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Completed — ${result.score}/${result.total} (${result.percentage}%) - Review
          </button>`
      : `<button class="btn-start-paper" onclick="startPaper('${escapeHTML(paper.id)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            Start ${aType.charAt(0).toUpperCase() + aType.slice(1)}
          </button>`
    }
    ${feedbackBadge}
    </div>`;
}

function renderPapers(studentType) {
  const session = Auth.getSession();
  const allAssignments = DB.getStudentAssignments(session.studentId);

  const pendingContainer = document.getElementById('pending-papers');
  const completedContainer = document.getElementById('completed-papers');

  if (studentType === 'premium') {
    // Premium: split into "Your Activities" (direct) and "General Activities" (guest-group)
    document.getElementById('your-papers-section').style.display = '';
    document.getElementById('pending-title').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      📢 General Activities`;

    // Direct assignments = assigned specifically to this student
    const directAssignments = DB._state.assignments.filter(a => a.studentId === session.studentId);
    // Guest assignments = assigned to 'guest' group
    const guestAssignments = DB._state.assignments.filter(a => a.studentId === 'guest');

    let yourPendingHTML = '';
    let yourCompletedHTML = '';
    let generalPendingHTML = '';
    let generalCompletedHTML = '';

    // Your activities (direct)
    directAssignments.forEach(a => {
      const paper = DB.getPaper(a.paperId);
      if (!paper) return;
      const result = DB.getResult(a.paperId, session.studentId);
      const card = buildPaperCard(paper, result, session);
      if (result) yourCompletedHTML += card;
      else yourPendingHTML += card;
    });

    // General activities (guest group)
    guestAssignments.forEach(a => {
      const paper = DB.getPaper(a.paperId);
      if (!paper) return;
      // Skip if also directly assigned (avoid duplicates)
      if (directAssignments.find(d => d.paperId === a.paperId)) return;
      const result = DB.getResult(a.paperId, session.studentId);
      const card = buildPaperCard(paper, result, session);
      if (result) generalCompletedHTML += card;
      else generalPendingHTML += card;
    });

    document.getElementById('your-papers').innerHTML = yourPendingHTML || '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>No activities assigned to you yet — check back soon!</p></div>';
    pendingContainer.innerHTML = generalPendingHTML || '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>No general activities available right now.</p></div>';
    completedContainer.innerHTML = (yourCompletedHTML + generalCompletedHTML) || '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg><p>No completed activities yet — start one above!</p></div>';
  } else {
    // Guest: show all activities normally
    let pendingHTML = '';
    let completedHTML = '';

    allAssignments.forEach(a => {
      const paper = DB.getPaper(a.paperId);
      if (!paper) return;
      const result = DB.getResult(a.paperId, session.studentId);
      const card = buildPaperCard(paper, result, session);
      if (result) completedHTML += card;
      else pendingHTML += card;
    });

    pendingContainer.innerHTML = pendingHTML || '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>No pending activities — your teacher will assign them soon!</p></div>';
    completedContainer.innerHTML = completedHTML || '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg><p>No completed activities yet — start one above!</p></div>';
  }
}

function renderResults() {
  const session = Auth.getSession();
  const results = DB.getStudentResults(session.studentId);
  const tbody = document.getElementById('results-tbody');
  const empty = document.getElementById('results-empty');

  if (results.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const typeIcons = { paper: '📝', quiz: '⚡', homework: '📚', assignment: '📋' };

  let html = '';
  results.slice().reverse().forEach(r => {
    const paper = DB.getPaper(r.paperId);
    const pctClass = r.percentage >= 75 ? 'badge-green' : r.percentage >= 40 ? 'badge-blue' : 'badge-red';
    const paperName = paper ? escapeHTML(paper.name) : '—';
    const aType = paper ? (paper.activityType || 'paper') : 'paper';
    const icon = typeIcons[aType] || '📝';
    const feedback = DB.getFeedback(r.paperId, session.studentId);
    const fbCell = feedback && feedback.comment
      ? `<span style="font-size:12px;color:var(--blue);" title="${escapeHTML(feedback.comment)}">💬 ${escapeHTML(feedback.comment).substring(0, 40)}${feedback.comment.length > 40 ? '…' : ''}</span>`
      : '<span class="text-dim text-sm">—</span>';
    html += `<tr>
      <td class="fw-600">${paperName}</td>
      <td><span style="font-size:11px;color:#6366f1;font-weight:600;">${icon} ${aType}</span></td>
      <td class="result-score">${r.score}/${r.total}</td>
      <td><span class="badge ${pctClass}">${r.percentage}%</span></td>
      <td>${fbCell}</td>
      <td class="text-sm text-dim">${new Date(r.submittedAt).toLocaleString()}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function startPaper(paperId) {
  sessionStorage.setItem('currentPaperId', paperId);
  const isHtml = window.location.pathname.endsWith('.html');
  const target = isHtml ? `paper.html?paperId=${paperId}` : `paper?paperId=${paperId}`;
  window.location.href = target;
}

function reviewPaper(paperId) {
  sessionStorage.setItem('currentPaperId', paperId);
  const isHtml = window.location.pathname.endsWith('.html');
  const target = isHtml ? `paper.html?paperId=${paperId}&mode=review` : `paper?paperId=${paperId}&mode=review`;
  window.location.href = target;
}

function renderProgressSummary() {
  const session = Auth.getSession();
  const results = DB.getStudentResults(session.studentId);
  const allAssignments = DB.getStudentAssignments(session.studentId);
  const summaryEl = document.getElementById('progress-summary');

  if (results.length === 0 && allAssignments.length === 0) {
    summaryEl.style.display = 'none';
    return;
  }

  summaryEl.style.display = '';

  const totalActivities = allAssignments.length;
  const completed = results.length;
  const pending = Math.max(0, totalActivities - completed);
  let avgScore = 0;
  if (results.length > 0) {
    avgScore = Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length);
  }
  const avgCls = avgScore >= 75 ? '#22c55e' : avgScore >= 40 ? '#3b82f6' : '#ef4444';

  const feedbackCount = DB.getStudentFeedback(session.studentId).length;

  summaryEl.innerHTML = `
    <div class="progress-stats">
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:${avgCls};">${results.length > 0 ? avgScore + '%' : '—'}</div>
        <div class="progress-stat-label">Average Score</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:#22c55e;">${completed}</div>
        <div class="progress-stat-label">Completed</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:#f59e0b;">${pending}</div>
        <div class="progress-stat-label">Pending</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:#6366f1;">${feedbackCount}</div>
        <div class="progress-stat-label">Feedback</div>
      </div>
    </div>
  `;
}

function renderStudentMaterials() {
  const session = Auth.getSession();
  const materials = DB.getStudentMaterials(session.studentId);
  const section = document.getElementById('materials-section');
  const grid = document.getElementById('student-materials');

  if (!section || !grid) return;

  if (materials.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  const catIcons = { notes: '📄', pdf: '📕', tutorial: '📖', worksheet: '📝', image: '🖼️', presentation: '📊', other: '📁' };

  let html = '';
  materials.forEach(m => {
    const icon = catIcons[m.category] || '📁';
    const sizeText = m.sizeBytes < 1024 * 1024
      ? (m.sizeBytes / 1024).toFixed(1) + ' KB'
      : (m.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB';

    html += `
      <div class="material-card">
        <div class="material-icon">${icon}</div>
        <div class="material-info">
          <div class="material-name">${escapeHTML(m.name)}</div>
          ${m.description ? `<div class="material-desc">${escapeHTML(m.description)}</div>` : ''}
          <div class="material-meta">
            <span class="badge badge-blue" style="font-size:10px;">${m.category}</span>
            <span class="text-sm text-dim">${sizeText}</span>
          </div>
        </div>
        <a href="${m.url}" target="_blank" class="material-download" title="View / Download">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>`;
  });
  grid.innerHTML = html;
}
