/* ═══════════════════════════════════════════
   admin.js — Admin Dashboard Logic v2
   Question Manager + Advanced Filters
   ═══════════════════════════════════════════ */

// sanitizeHTML() and escapeHTML() are defined in shared.js (loaded before this file)

// ─── State ───
let paperSelectedIds = [];  // Array to preserve ordering
let uploadedQuestionData = null;

// Auth guard
document.addEventListener('DOMContentLoaded', async () => {
    await DB.seed();
    if (!Auth.requireAdmin()) return;
    initDashboard();
});

function initDashboard() {
    renderOverview();
    renderQuestionBank();
    renderQuestionManager();
    renderQuestionPicker();
    renderPapersList();
    renderStudents();
    renderAssignPaperSelect();
    renderAssignmentsOverview();
    renderResults();
    renderGradebook();
    renderMaterialBank();
}

// ═══════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════
function showTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`panel-${tab}`).classList.add('active');
    document.getElementById(`nav-${tab}`).classList.add('active');

    if (tab === 'overview') renderOverview();
    if (tab === 'questions') renderQuestionBank();
    if (tab === 'qmanager') renderQuestionManager();
    if (tab === 'papers') { renderQuestionPicker(); renderPapersList(); }
    if (tab === 'students') renderStudents();
    if (tab === 'assignments') { renderAssignPaperSelect(); renderAssignmentsOverview(); renderResults(); }
    if (tab === 'gradebook') renderGradebook();
    if (tab === 'materials') renderMaterialBank();
}

// ═══════════════════════════════════════
// HELPER: Populate filter dropdowns
// ═══════════════════════════════════════
function populateFilterDropdowns(prefix, includeSubUnit = true) {
    const opts = DB.getDropdownOptions();

    const typeEl = document.getElementById(`${prefix}-filter-type`);
    const sourceEl = document.getElementById(`${prefix}-filter-source`);
    const examTypeEl = document.getElementById(`${prefix}-filter-examType`);
    const unitEl = document.getElementById(`${prefix}-filter-unit`);
    const subUnitEl = includeSubUnit ? document.getElementById(`${prefix}-filter-subUnit`) : null;

    if (typeEl) {
        const val = typeEl.value;
        typeEl.innerHTML = '<option value="">All Types</option>';
        opts.questionType.forEach(t => typeEl.innerHTML += `<option value="${t}" ${val === t ? 'selected' : ''}>${t}</option>`);
    }
    if (sourceEl) {
        const val = sourceEl.value;
        sourceEl.innerHTML = '<option value="">All Sources</option>';
        opts.source.forEach(s => sourceEl.innerHTML += `<option value="${s}" ${val === s ? 'selected' : ''}>${s}</option>`);
    }
    if (examTypeEl) {
        const val = examTypeEl.value;
        examTypeEl.innerHTML = '<option value="">All Exam Types</option>';
        opts.examType.forEach(e => examTypeEl.innerHTML += `<option value="${e}" ${val === e ? 'selected' : ''}>${e}</option>`);
    }
    if (unitEl) {
        const val = unitEl.value;
        unitEl.innerHTML = '<option value="">All Units</option>';
        opts.unit.forEach(u => unitEl.innerHTML += `<option value="${u}" ${val === u ? 'selected' : ''}>${u}</option>`);
    }
    if (subUnitEl) {
        const selectedUnit = unitEl ? unitEl.value : '';
        const val = subUnitEl.value;
        subUnitEl.innerHTML = '<option value="">All Sub-Units</option>';
        if (selectedUnit && opts.subUnit[selectedUnit]) {
            opts.subUnit[selectedUnit].forEach(su => subUnitEl.innerHTML += `<option value="${su}" ${val === su ? 'selected' : ''}>${su}</option>`);
        }
    }
}

// Helper: populate a single dropdown select element
function populateSelectFromOptions(selectId, category, includeEmpty = true, selectedValue = '') {
    const el = document.getElementById(selectId);
    if (!el) return;
    const opts = DB.getDropdownOptions();
    const items = category === 'subUnit' ? [] : (opts[category] || []);
    el.innerHTML = includeEmpty ? `<option value="">— Select —</option>` : '';
    items.forEach(item => {
        el.innerHTML += `<option value="${item}" ${item === selectedValue ? 'selected' : ''}>${item}</option>`;
    });
}

// Helper: populate sub-unit based on selected unit
function populateSubUnitSelect(unitSelectId, subUnitSelectId, selectedValue = '') {
    const unitEl = document.getElementById(unitSelectId);
    const subEl = document.getElementById(subUnitSelectId);
    if (!unitEl || !subEl) return;
    const opts = DB.getDropdownOptions();
    const unit = unitEl.value;
    subEl.innerHTML = '<option value="">— Select —</option>';
    if (unit && opts.subUnit[unit]) {
        opts.subUnit[unit].forEach(su => {
            subEl.innerHTML += `<option value="${su}" ${su === selectedValue ? 'selected' : ''}>${su}</option>`;
        });
    }
}

// Rendering functions now handled by shared.js (buildQuestionHTML, renderKaTeX, sanitizeHTML)



// ─── Delete Question ───
async function deleteQuestionConfirm(id) {
    if (!confirm('Are you sure you want to permanently delete this question? This cannot be undone.')) return;
    try {
        if (await DB.deleteQuestion(id)) {
            showToast('Question deleted successfully', 'success');
            // Remove from paper selection if present
            paperSelectedIds = paperSelectedIds.filter(qid => qid !== id);
            filterQuestionBank();
            initDashboard();
        } else {
            showToast('Failed to delete question', 'error');
        }
    } catch (e) {
        showToast('Error deleting question: ' + e.message, 'error');
        console.error(e);
    }
}

// ─── Edit Question ───
function editQuestion(id) {
    const q = DB.getQuestion(id);
    if (!q) return;

    document.getElementById('edit-q-id').value = q.id;

    populateSelectFromOptions('edit-q-type', 'questionType', true, q.type || '');
    populateSelectFromOptions('edit-q-source', 'source', true, q.source || '');
    populateSelectFromOptions('edit-q-examType', 'examType', true, q.examType || '');
    populateSelectFromOptions('edit-q-unit', 'unit', true, q.unit || '');

    document.getElementById('edit-q-year').value = (q.location && q.location.year) ? q.location.year : '';
    document.getElementById('edit-q-qnum').value = (q.location && q.location.questionNumber) ? q.location.questionNumber : '';

    // Populate correctAnswer dropdown
    const correctEl = document.getElementById('edit-q-correctAnswer');
    correctEl.innerHTML = '<option value="">- Not Set -</option>';
    if (q.options && typeof q.options === 'object') {
        Object.keys(q.options).forEach(key => {
            const selected = (key === q.correctAnswer) ? 'selected' : '';
            correctEl.innerHTML += `<option value="${key}" ${selected}>(${key}) ${escapeHTML(q.options[key]).substring(0, 40)}</option>`;
        });
    }

    populateEditSubUnits(q.subUnit || '');
    document.getElementById('edit-question-modal').classList.add('active');
}

function populateEditSubUnits(selectedValue = '') {
    populateSubUnitSelect('edit-q-unit', 'edit-q-subUnit', selectedValue);
}

function closeEditQuestionModal() {
    document.getElementById('edit-question-modal').classList.remove('active');
}

async function saveEditQuestion() {
    const oldId = document.getElementById('edit-q-id').value;
    const q = DB.getQuestion(oldId);
    if (!q) return;

    // Create a copy of the question with updated properties
    const updatedQ = { ...q };
    updatedQ.type = document.getElementById('edit-q-type').value || undefined;
    updatedQ.source = document.getElementById('edit-q-source').value || undefined;
    updatedQ.examType = document.getElementById('edit-q-examType').value || undefined;
    updatedQ.unit = document.getElementById('edit-q-unit').value || undefined;
    updatedQ.subUnit = document.getElementById('edit-q-subUnit').value || undefined;

    // Save correct answer
    const correctVal = document.getElementById('edit-q-correctAnswer').value;
    if (correctVal) updatedQ.correctAnswer = correctVal;

    const yearVal = document.getElementById('edit-q-year').value.trim();
    const qnumVal = document.getElementById('edit-q-qnum').value.trim();

    if (yearVal || qnumVal) {
        updatedQ.location = updatedQ.location || {};
        updatedQ.location.year = yearVal ? parseInt(yearVal) || undefined : undefined;
        updatedQ.location.questionNumber = qnumVal ? parseInt(qnumVal) || undefined : undefined;
    } else {
        delete updatedQ.location;
    }

    try {
        // The updateQuestion function will handle old file deletion if ID changed
        if (await DB.updateQuestion(updatedQ, oldId)) {
            showToast('Question updated successfully', 'success');
            closeEditQuestionModal();
            filterQuestionBank();
            initDashboard();
        } else {
            showToast('Failed to update question', 'error');
        }
    } catch (e) {
        showToast('Error updating question: ' + e.message, 'error');
        console.error(e);
    }
}

// ═══════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════
function renderOverview() {
    const questions = DB.getQuestions();
    const papers = DB.getPapers();
    const students = DB.getStudents();
    const results = DB.getResults();

    document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div><div class="stat-value">${questions.length}</div><div class="stat-label">Questions</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/></svg></div>
      <div><div class="stat-value">${papers.length}</div><div class="stat-label">Activities</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
      <div><div class="stat-value">${students.length}</div><div class="stat-label">Students</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
      <div><div class="stat-value">${results.length}</div><div class="stat-label">Submissions</div></div>
    </div>`;

    const recentResults = results.slice(-5).reverse();
    if (recentResults.length === 0) {
        document.getElementById('recent-results').innerHTML = '<div class="empty-state"><p>No submissions yet.</p></div>';
        return;
    }
    let html = '<table class="data-table"><thead><tr><th>Student</th><th>Paper</th><th>Score</th><th>Date</th></tr></thead><tbody>';
    recentResults.forEach(r => {
        const student = DB.getStudent(r.studentId);
        const paper = DB.getPaper(r.paperId);
        html += `<tr>
      <td>${student ? student.name : '—'}</td>
      <td>${paper ? paper.name : '—'}</td>
      <td><span class="badge ${r.percentage >= 50 ? 'badge-green' : 'badge-red'}">${r.score}/${r.total} (${r.percentage}%)</span></td>
      <td class="text-sm text-dim">${new Date(r.submittedAt).toLocaleDateString()}</td>
    </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('recent-results').innerHTML = html;
}

// ═══════════════════════════════════════
// QUESTION BANK (Full view + filters)
// ═══════════════════════════════════════
function renderQuestionBank() {
    populateFilterDropdowns('qbank'); // Initialize the Filter dropdowns
    filterQuestionBank(); // Render the list
}

function onQBankUnitChange() {
    const opts = DB.getDropdownOptions();
    const unit = document.getElementById('qbank-filter-unit').value;
    const subEl = document.getElementById('qbank-filter-subUnit');
    subEl.innerHTML = '<option value="">All Sub-Units</option>';
    if (unit && opts.subUnit[unit]) {
        opts.subUnit[unit].forEach(su => subEl.innerHTML += `<option value="${su}">${su}</option>`);
    }
}

function filterQuestionBank() {
    const filters = {
        type: document.getElementById('qbank-filter-type').value,
        source: document.getElementById('qbank-filter-source').value,
        examType: document.getElementById('qbank-filter-examType').value,
        unit: document.getElementById('qbank-filter-unit').value,
        subUnit: document.getElementById('qbank-filter-subUnit').value,
        search: document.getElementById('qbank-filter-search').value
    };

    const questions = DB.getFilteredQuestions(filters);
    const total = DB.getQuestions().length;
    document.getElementById('q-count-badge').textContent = `${questions.length}${questions.length !== total ? ` / ${total}` : ''} questions`;

    if (questions.length === 0) {
        document.getElementById('question-list').innerHTML = '<div class="empty-state"><p>No questions match the filters.</p></div>';
        return;
    }

    let html = '';
    questions.forEach(q => {
        // Show edit/export/delete actions on the main view now
        html += buildQuestionHTML(q, { showActions: true, showAdminTags: true });
    });
    document.getElementById('question-list').innerHTML = html;

    renderKaTeX(document.getElementById('question-list'));
    attachQuestionCardHandlers();
}

// Attach event listeners to question card buttons
function attachQuestionCardHandlers() {
    document.querySelectorAll('.btn-edit-question').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editQuestion(btn.dataset.questionId);
        });
    });


    document.querySelectorAll('.btn-delete-question').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteQuestionConfirm(btn.dataset.questionId);
        });
    });
}

function clearQBankFilters() {
    document.getElementById('qbank-filter-type').value = '';
    document.getElementById('qbank-filter-source').value = '';
    document.getElementById('qbank-filter-examType').value = '';
    document.getElementById('qbank-filter-unit').value = '';
    document.getElementById('qbank-filter-subUnit').innerHTML = '<option value="">All Sub-Units</option>';
    document.getElementById('qbank-filter-search').value = '';
    filterQuestionBank();
}

// ═══════════════════════════════════════
// QUESTION MANAGER
// ═══════════════════════════════════════
function renderQuestionManager() {
    renderAddSection();
}

function renderAddSection() {
    const opts = DB.getDropdownOptions();

    populateSelectFromOptions('qm-add-type', 'questionType', true);
    populateSelectFromOptions('qm-add-source', 'source', true);
    populateSelectFromOptions('qm-add-examType', 'examType', true);
    populateSelectFromOptions('qm-add-unit', 'unit', true);
    populateSubUnitSelect('qm-add-unit', 'qm-add-subUnit');

    // Reset upload
    uploadedQuestionData = null;
    uploadedImageFiles = [];
    document.getElementById('qm-add-btn').disabled = true;
    document.getElementById('qm-preview').style.display = 'none';
    document.getElementById('folder-files-info').style.display = 'none';
}

function toggleLocationFields() {
    const source = document.getElementById('qm-add-source').value;
    const isPastPaper = source === 'Past Paper';
    document.getElementById('qm-location-year-group').style.display = isPastPaper ? '' : 'none';
    document.getElementById('qm-location-qnum-group').style.display = isPastPaper ? '' : 'none';
}

function populateAddSubUnits() {
    populateSubUnitSelect('qm-add-unit', 'qm-add-subUnit');
}

// ─── Folder upload handling ───
let uploadedImageFiles = [];

async function handleFolderSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Separate JSON and image files
    const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    // Show file info
    const infoEl = document.getElementById('folder-files-info');
    infoEl.style.display = '';

    if (jsonFiles.length === 0) {
        infoEl.innerHTML = `<span class="text-sm" style="color:var(--red);">⚠ No JSON file found in folder.</span>`;
        showToast('No JSON file found in the selected folder', 'error');
        return;
    }
    if (jsonFiles.length > 1) {
        infoEl.innerHTML = `<span class="text-sm" style="color:var(--orange);">⚠ Multiple JSON files found — using "${jsonFiles[0].name}".</span>`;
    }

    // Build file summary
    let filesHTML = `<div class="folder-info-row"><span class="badge badge-blue">📄 ${jsonFiles[0].name}</span>`;
    if (imageFiles.length > 0) {
        filesHTML += imageFiles.map(f => `<span class="badge badge-green">🖼 ${f.name}</span>`).join('');
    } else {
        filesHTML += `<span class="text-xs text-muted">No images</span>`;
    }
    filesHTML += '</div>';
    infoEl.innerHTML = filesHTML;

    // Read the JSON file
    try {
        const jsonText = await readFileAsText(jsonFiles[0]);
        const data = JSON.parse(jsonText);

        // ─── Bridge Q_Render field names to AL_Physics field names ───
        // Q_Render uses: question_text, question_id, correct_answer, options (array), file_name
        // AL_Physics uses: question, id, correctAnswer, options (object {1: text, ...}), name+data
        if (data.question_text && !data.question) data.question = data.question_text;
        if (data.question_id && !data.id) data.id = data.question_id;
        if (data.correct_answer !== undefined && data.correctAnswer === undefined) {
            // Q_Render uses 0-based index, AL_Physics uses key string ("1","2",...)
            data.correctAnswer = data.correct_answer !== null ? String(data.correct_answer + 1) : '';
        }
        // Convert array options to object {"1": text, "2": text, ...}
        if (Array.isArray(data.options)) {
            const optObj = {};
            data.options.forEach((text, i) => { optObj[String(i + 1)] = text; });
            data.options = optObj;
        }

        // Validate required fields
        if (!data.question) {
            showToast('JSON must contain a "question" or "question_text" field', 'error');
            return;
        }
        if (!data.options || typeof data.options !== 'object') {
            showToast('JSON must contain an "options" object or array', 'error');
            return;
        }

        uploadedQuestionData = data;
        uploadedImageFiles = imageFiles;
        document.getElementById('qm-add-btn').disabled = false;

        // Generate temporary object urls for preview, preserving Q_Render image props
        if (imageFiles.length > 0) {
            // Build lookup from JSON image definitions (match by file_name or name)
            const uploadedImagesMap = {};
            if (data.images && data.images.length > 0) {
                data.images.forEach(imgDef => {
                    const key = imgDef.file_name || imgDef.name;
                    if (key) uploadedImagesMap[key] = imgDef;
                });
            }

            data.images = imageFiles.map(f => {
                const imgRef = uploadedImagesMap[f.name] || {};
                return {
                    name: f.name,
                    data: URL.createObjectURL(f),
                    position: imgRef.position || 'bottom-center',
                    width: imgRef.width || 'auto',
                    marginTop: imgRef.marginTop || '0px',
                    marginRight: imgRef.marginRight || '0px',
                    marginLeft: imgRef.marginLeft || '0px'
                };
            });
        } else {
            data.images = [];
        }

        renderEditablePreview();
        showToast(`Folder loaded: 1 JSON + ${imageFiles.length} image(s)`, 'success');
    } catch (err) {
        showToast('Invalid JSON file: ' + err.message, 'error');
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// ═══════════════════════════════════════
// Q_RENDER EDITOR — Interactive Preview
// ═══════════════════════════════════════

function renderEditablePreview() {
    const preview = document.getElementById('qm-preview');
    preview.style.display = '';
    preview.innerHTML = `
        <h4 class="text-sm fw-700 mb-8">Preview <span style="font-weight:400; color:var(--text-muted); font-size:12px;">— drag images to reposition, resize from corner</span></h4>
        ${buildQuestionHTML(uploadedQuestionData, { showAdminTags: false, isEditable: true })}
    `;
    renderKaTeX(preview);
    attachEditorDraggables();
}

function updateImageProp(qId, imgIndex, prop, value) {
    if (!uploadedQuestionData || !uploadedQuestionData.images) return;
    if (uploadedQuestionData.images[imgIndex]) {
        uploadedQuestionData.images[imgIndex][prop] = value;
        renderEditablePreview();
    }
}

function updateQuestionProp(qId, prop, value) {
    if (!uploadedQuestionData) return;
    uploadedQuestionData[prop] = value;
    renderEditablePreview();
}

let _editorAbortController = null;

function attachEditorDraggables() {
    // Clean up previous document-level listeners to prevent leaks
    if (_editorAbortController) _editorAbortController.abort();
    _editorAbortController = new AbortController();
    const signal = _editorAbortController.signal;

    const draggables = document.querySelectorAll('.question-diagram.draggable');
    draggables.forEach(el => {
        const qId = el.dataset.qid;
        const idx = parseInt(el.dataset.idx);

        // ─── Resize handle ───
        const resizer = el.querySelector('.resize-handle');
        if (resizer) {
            let isResizing = false;
            let startX, startW;
            resizer.addEventListener('mousedown', function(e) {
                isResizing = true;
                startX = e.clientX;
                startW = el.offsetWidth;
                document.body.style.cursor = 'nwse-resize';
                e.preventDefault();
                e.stopPropagation();
            });
            const resizeMove = function(e) {
                if (!isResizing) return;
                let dx = e.clientX - startX;
                el.style.width = Math.max(50, startW + dx) + 'px';
            };
            const resizeUp = function(e) {
                if (!isResizing) return;
                isResizing = false;
                document.body.style.cursor = '';
                if (uploadedQuestionData && uploadedQuestionData.images && uploadedQuestionData.images[idx]) {
                    uploadedQuestionData.images[idx].width = el.style.width;
                }
            };
            document.addEventListener('mousemove', resizeMove, { signal });
            document.addEventListener('mouseup', resizeUp, { signal });
        }

        // ─── Drag to reposition ───
        let isDragging = false;
        let dragStartX, dragStartY, offsetX, offsetY;

        el.addEventListener('mousedown', function(e) {
            if (e.target.tagName.toLowerCase() === 'select' || e.target.tagName.toLowerCase() === 'option') return;
            if (e.target.classList.contains('resize-handle')) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            document.body.style.cursor = 'grabbing';
            const rect = el.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            e.preventDefault();
        });

        const dragMove = function(e) {
            if (!isDragging) return;
            const parentRect = el.parentElement.getBoundingClientRect();
            const isRight = (el.classList.contains('float-right') || el.classList.contains('block-right'));
            const isLeft = (el.classList.contains('float-left') || el.classList.contains('block-left'));

            let newMarginTop = e.clientY - parentRect.top - offsetY;
            el.style.marginTop = Math.max(0, newMarginTop) + 'px';

            if (isRight) {
                let newMarginRight = parentRect.right - e.clientX - (el.offsetWidth - offsetX);
                el.style.marginRight = Math.max(0, newMarginRight) + 'px';
            } else if (isLeft) {
                let newMarginLeft = e.clientX - parentRect.left - offsetX;
                el.style.marginLeft = Math.max(0, newMarginLeft) + 'px';
            }
        };

        const dragUp = function(e) {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.cursor = '';
            const isRight = (el.classList.contains('float-right') || el.classList.contains('block-right'));
            const isLeft = (el.classList.contains('float-left') || el.classList.contains('block-left'));

            if (uploadedQuestionData && uploadedQuestionData.images && uploadedQuestionData.images[idx]) {
                uploadedQuestionData.images[idx].marginTop = el.style.marginTop;
                if (isRight) uploadedQuestionData.images[idx].marginRight = el.style.marginRight;
                if (isLeft) uploadedQuestionData.images[idx].marginLeft = el.style.marginLeft;
            }
        };

        document.addEventListener('mousemove', dragMove, { signal });
        document.addEventListener('mouseup', dragUp, { signal });
    });
}

async function addQuestionFromUpload() {
    if (!uploadedQuestionData) {
        showToast('Please load a question folder first', 'error');
        return;
    }

    const type = document.getElementById('qm-add-type').value;
    const source = document.getElementById('qm-add-source').value;
    const examType = document.getElementById('qm-add-examType').value;
    const unit = document.getElementById('qm-add-unit').value;
    const subUnit = document.getElementById('qm-add-subUnit').value;
    const year = document.getElementById('qm-add-year') ? document.getElementById('qm-add-year').value : '';
    const qnum = document.getElementById('qm-add-qnum') ? document.getElementById('qm-add-qnum').value : '';

    // Robust Validation
    if (!type) return showToast('Please select a Question Type', 'error');
    if (!source) return showToast('Please select a Source', 'error');
    if (!examType) return showToast('Please select an Exam Type', 'error');
    if (!unit) return showToast('Please select a Unit', 'error');

    const btn = document.getElementById('qm-add-btn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Saving...';

        const questionData = {
            type,
            source,
            examType,
            location: { year, questionNumber: qnum },
            unit,
            subUnit,
            question: uploadedQuestionData.question,
            options: uploadedQuestionData.options,
            correctAnswer: uploadedQuestionData.correctAnswer,
            options_layout: uploadedQuestionData.options_layout || 'horizontal',
            images: (uploadedQuestionData.images || []).map(img => ({
                name: img.name,
                data: img.data || '',
                position: img.position || 'bottom-center',
                width: img.width || 'auto',
                marginTop: img.marginTop || '0px',
                marginRight: img.marginRight || '0px',
                marginLeft: img.marginLeft || '0px'
            }))
        };

        const saved = await DB.addQuestion(questionData, uploadedImageFiles);
        showToast(`Question saved successfully!`, 'success');

        // Reset form
        uploadedQuestionData = null;
        uploadedImageFiles = [];
        const folderInput = document.getElementById('qm-folder-input');
        if (folderInput) folderInput.value = '';
        
        btn.disabled = true;
        btn.innerHTML = originalHTML;
        
        document.getElementById('qm-preview').style.display = 'none';
        document.getElementById('folder-files-info').style.display = 'none';

        initDashboard(); // Refresh all stats and lists
    } catch (e) {
        showToast('Failed to save: ' + e.message, 'error');
        console.error(e);
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Auto-compress large images to bypass localStorage limits
                const maxWidth = 1200;
                const maxHeight = 1200;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                // Create white background in case of transparent PNGs
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Export as compressed JPEG (0.8 quality handles text/diagrams well)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                resolve(compressedBase64);
            };
            img.onerror = () => reject(new Error("Failed to load image for compression"));
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ─── Manage Section ───
function renderManageSection() {
    const typeFilter = document.getElementById('qm-manage-filter-type').value;
    const unitFilter = document.getElementById('qm-manage-filter-unit').value;
    const search = document.getElementById('qm-manage-search').value;

    // Populate filter selects
    const opts = DB.getDropdownOptions();
    const typeEl = document.getElementById('qm-manage-filter-type');
    const unitEl = document.getElementById('qm-manage-filter-unit');
    // Only populate if empty (first render)
    if (typeEl.options.length <= 1) {
        opts.questionType.forEach(t => typeEl.innerHTML += `<option value="${t}">${t}</option>`);
    }
    if (unitEl.options.length <= 1) {
        opts.unit.forEach(u => unitEl.innerHTML += `<option value="${u}">${u}</option>`);
    }

    const filters = {};
    if (typeFilter) filters.type = typeFilter;
    if (unitFilter) filters.unit = unitFilter;
    if (search) filters.search = search;

    const questions = DB.getFilteredQuestions(filters);
    document.getElementById('qm-manage-count').textContent = `${questions.length}`;

    if (questions.length === 0) {
        document.getElementById('qm-manage-list').innerHTML = '<div class="empty-state"><p>No questions found.</p></div>';
        return;
    }

    let html = '';
    questions.forEach(q => {
        html += buildQuestionHTML(q, { showActions: true, showAdminTags: true });
    });
    document.getElementById('qm-manage-list').innerHTML = html;
    renderKaTeX(document.getElementById('qm-manage-list'));
    attachQuestionCardHandlers();
}

// ═══════════════════════════════════════
// DROPDOWN MANAGER
// ═══════════════════════════════════════
let currentDDTab = 'questionType';

function openDropdownManager() {
    document.getElementById('dropdown-manager-modal').classList.add('active');
    switchDDTab('questionType');
}

function closeDropdownManager() {
    document.getElementById('dropdown-manager-modal').classList.remove('active');
    // Refresh everything that uses dropdowns
    initDashboard();
}

function switchDDTab(tab) {
    currentDDTab = tab;
    document.querySelectorAll('.dd-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderDDContent(tab);
}

function renderDDContent(category) {
    const opts = DB.getDropdownOptions();
    const container = document.getElementById('dd-manager-content');

    if (category === 'subUnit') {
        // Special: show unit → sub-unit hierarchy
        let html = '<div class="dd-subunit-section">';
        html += '<div class="form-group"><label class="form-label">Select Unit</label>';
        html += '<select class="form-select" id="dd-subunit-parent" onchange="renderDDSubUnitList()">';
        html += '<option value="">— Choose Unit —</option>';
        opts.unit.forEach(u => html += `<option value="${escapeHTML(u)}">${escapeHTML(u)}</option>`);
        html += '</select></div>';
        html += '<div id="dd-subunit-list"></div>';
        html += '<div class="dd-add-row mt-16">';
        html += '<input class="form-input" id="dd-new-subunit" placeholder="New sub-unit name…" />';
        html += '<button class="btn btn-sm btn-success" onclick="addDDSubUnit()">+ Add</button>';
        html += '</div>';
        html += '</div>';
        container.innerHTML = html;
        return;
    }

    const items = opts[category] || [];
    let html = '<div class="dd-items-list">';
    items.forEach((item, idx) => {
        const escapedItem = escapeHTML(item);
        html += `<div class="dd-item" data-category="${category}" data-idx="${idx}" data-value="${escapedItem}">
            <input class="dd-item-input" value="${escapedItem}" id="dd-item-${idx}" />
            <button class="btn btn-sm btn-outline" onclick="renameDDOptionHandler(this)">Rename</button>
            <button class="btn btn-sm btn-danger" onclick="removeDDOptionHandler(this)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        </div>`;
    });
    html += '</div>';
    html += `<div class="dd-add-row mt-16">
        <input class="form-input" id="dd-new-option" placeholder="New option name…" />
        <button class="btn btn-sm btn-success" onclick="addDDOption('${category}')">+ Add</button>
    </div>`;
    container.innerHTML = html;
}

async function addDDOption(category) {
    const input = document.getElementById('dd-new-option');
    const value = input.value.trim();
    if (!value) { showToast('Enter a name', 'error'); return; }
    if (await DB.addDropdownOption(category, value)) {
        showToast(`"${value}" added`, 'success');
        renderDDContent(category);
    } else {
        showToast('Already exists', 'error');
    }
}

async function renameDDOption(category, oldValue, idx) {
    const input = document.getElementById(`dd-item-${idx}`);
    const newValue = input.value.trim();
    if (!newValue || newValue === oldValue) return;
    if (await DB.renameDropdownOption(category, oldValue, newValue)) {
        showToast(`Renamed "${oldValue}" → "${newValue}" (cascade applied)`, 'success');
        renderDDContent(category);
        initDashboard(); // Refresh filters across the app
    } else {
        showToast('Rename failed', 'error');
    }
}

function renameDDOptionHandler(button) {
    const item = button.closest('.dd-item');
    const category = item.dataset.category;
    const idx = item.dataset.idx;
    const oldValue = item.dataset.value;
    renameDDOption(category, oldValue, idx);
}

async function removeDDOption(category, value) {
    if (!confirm(`Remove "${value}"? This will clear this property on all questions using it.`)) return;
    await DB.removeDropdownOption(category, value);
    showToast(`"${value}" removed (cascade applied)`, 'info');
    renderDDContent(category);
    initDashboard(); // Refresh everywhere
}

function removeDDOptionHandler(button) {
    const item = button.closest('.dd-item');
    const category = item.dataset.category;
    const value = item.dataset.value;
    removeDDOption(category, value);
}

function renderDDSubUnitList() {
    const parent = document.getElementById('dd-subunit-parent').value;
    const container = document.getElementById('dd-subunit-list');
    if (!parent) { container.innerHTML = ''; return; }

    const opts = DB.getDropdownOptions();
    const subs = opts.subUnit[parent] || [];

    let html = '<div class="dd-items-list">';
    subs.forEach((item, idx) => {
        const escapedItem = escapeHTML(item);
        const escapedParent = escapeHTML(parent);
        html += `<div class="dd-item" data-category="subUnit" data-parent="${escapedParent}" data-idx="${idx}" data-value="${escapedItem}">
            <input class="dd-item-input" value="${escapedItem}" id="dd-sub-${idx}" />
            <button class="btn btn-sm btn-outline" onclick="renameDDSubUnitHandler(this)">Rename</button>
            <button class="btn btn-sm btn-danger" onclick="removeDDSubUnitHandler(this)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function addDDSubUnit() {
    const parent = document.getElementById('dd-subunit-parent').value;
    const input = document.getElementById('dd-new-subunit');
    const value = input.value.trim();
    if (!parent) { showToast('Select a unit first', 'error'); return; }
    if (!value) { showToast('Enter a name', 'error'); return; }
    if (await DB.addDropdownOption('subUnit', value, parent)) {
        showToast(`"${value}" added under "${parent}"`, 'success');
        input.value = '';
        renderDDSubUnitList();
    } else {
        showToast('Already exists', 'error');
    }
}

async function renameDDSubUnit(parent, oldValue, idx) {
    const input = document.getElementById(`dd-sub-${idx}`);
    const newValue = input.value.trim();
    if (!newValue || newValue === oldValue) return;
    if (await DB.renameDropdownOption('subUnit', oldValue, newValue, parent)) {
        showToast(`Renamed "${oldValue}" → "${newValue}"`, 'success');
        renderDDSubUnitList();
        initDashboard();
    }
}

function renameDDSubUnitHandler(button) {
    const item = button.closest('.dd-item');
    const parent = item.dataset.parent;
    const idx = item.dataset.idx;
    const oldValue = item.dataset.value;
    renameDDSubUnit(parent, oldValue, idx);
}

async function removeDDSubUnit(parent, value) {
    if (!confirm(`Remove sub-unit "${value}"?`)) return;
    await DB.removeDropdownOption('subUnit', value, parent);
    showToast(`"${value}" removed`, 'info');
    renderDDSubUnitList();
    initDashboard();
}

function removeDDSubUnitHandler(button) {
    const item = button.closest('.dd-item');
    const parent = item.dataset.parent;
    const value = item.dataset.value;
    removeDDSubUnit(parent, value);
}

// ═══════════════════════════════════════
// CREATE PAPER — Two-Section Picker
// ═══════════════════════════════════════
let dragSrcIndex = null;

function renderQuestionPicker() {
    renderSelectedSection();
    renderAvailableSection();
    updateSelectedCount();
}

// ─── Selected questions (top) — brief cards, drag reorder ───
function renderSelectedSection() {
    const container = document.getElementById('selected-questions-list');
    if (paperSelectedIds.length === 0) {
        container.innerHTML = '<div class="empty-state small"><p>No questions selected yet. Add from below.</p></div>';
        return;
    }

    let html = '';
    paperSelectedIds.forEach((qid, index) => {
        const q = DB.getQuestion(qid);
        if (!q) return;

        // Brief summary: badges + truncated text
        let badges = '';
        if (q.type) badges += `<span class="badge badge-blue">${q.type}</span>`;
        if (q.unit) badges += `<span class="badge badge-green">${q.unit}</span>`;
        if (q.location && q.location.year) {
            badges += `<span class="badge badge-gray">${q.location.year} Q${q.location.questionNumber || '?'}</span>`;
        }

        const preview = q.question.replace(/\\[\(\[].+?\\[\)\]]/g, '[eq]').substring(0, 100);

        html += `<div class="sel-q-item" draggable="true" data-index="${index}"
            ondragstart="onDragStart(event, ${index})"
            ondragover="onDragOver(event)"
            ondragenter="onDragEnter(event)"
            ondragleave="onDragLeave(event)"
            ondrop="onDrop(event, ${index})"
            ondragend="onDragEnd(event)">
            <div class="sel-q-grip" title="Drag to reorder">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </div>
            <div class="sel-q-num">${index + 1}</div>
            <div class="sel-q-info">
                <div class="sel-q-badges">${badges}</div>
                <div class="sel-q-text">${preview}${q.question.length > 100 ? '…' : ''}</div>
            </div>
            <button class="btn-action-q btn-remove-q" onclick="removeQuestionFromPaper('${qid}')" title="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
        </div>`;
    });
    container.innerHTML = html;
    renderKaTeX(container);
}

// ─── Available questions (bottom) — full cards, filtered, excludes selected ───
function renderAvailableSection() {
    // Populate filter dropdowns (only on first call)
    const opts = DB.getDropdownOptions();
    const typeEl = document.getElementById('picker-filter-type');
    const sourceEl = document.getElementById('picker-filter-source');
    const unitEl = document.getElementById('picker-filter-unit');
    const subUnitEl = document.getElementById('picker-filter-subUnit');

    if (typeEl && typeEl.options.length <= 1) {
        opts.questionType.forEach(t => typeEl.innerHTML += `<option value="${t}">${t}</option>`);
    }
    if (sourceEl && sourceEl.options.length <= 1) {
        opts.source.forEach(s => sourceEl.innerHTML += `<option value="${s}">${s}</option>`);
    }
    if (unitEl && unitEl.options.length <= 1) {
        opts.unit.forEach(u => unitEl.innerHTML += `<option value="${u}">${u}</option>`);
    }

    const filters = {};
    if (typeEl && typeEl.value) filters.type = typeEl.value;
    if (sourceEl && sourceEl.value) filters.source = sourceEl.value;
    if (unitEl && unitEl.value) filters.unit = unitEl.value;
    if (subUnitEl && subUnitEl.value) filters.subUnit = subUnitEl.value;
    const searchEl = document.getElementById('picker-filter-search');
    if (searchEl && searchEl.value) filters.search = searchEl.value;

    const allQuestions = Object.keys(filters).length > 0 ? DB.getFilteredQuestions(filters) : DB.getQuestions();

    // Exclude already-selected questions
    const available = allQuestions.filter(q => !paperSelectedIds.includes(q.id));

    const pickerEl = document.getElementById('question-picker');
    if (available.length === 0) {
        const msg = allQuestions.length === 0 ? 'No questions match the filters.' : 'All matching questions are selected.';
        pickerEl.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
        return;
    }

    let html = '';
    available.forEach(q => {
        html += buildQuestionHTML(q, {
            showActions: false,
            showAddRemove: true,
            isSelected: false,
            compact: true,
            showAdminTags: true
        });
    });
    pickerEl.innerHTML = html;
    renderKaTeX(pickerEl);
}

function onPickerUnitChange() {
    const opts = DB.getDropdownOptions();
    const unit = document.getElementById('picker-filter-unit').value;
    const subEl = document.getElementById('picker-filter-subUnit');
    subEl.innerHTML = '<option value="">All Sub-Units</option>';
    if (unit && opts.subUnit[unit]) {
        opts.subUnit[unit].forEach(su => subEl.innerHTML += `<option value="${su}">${su}</option>`);
    }
}

function clearPickerFilters() {
    document.getElementById('picker-filter-type').value = '';
    document.getElementById('picker-filter-source').value = '';
    document.getElementById('picker-filter-unit').value = '';
    document.getElementById('picker-filter-subUnit').innerHTML = '<option value="">All Sub-Units</option>';
    document.getElementById('picker-filter-search').value = '';
    renderQuestionPicker();
}

function addQuestionToPaper(id) {
    if (!paperSelectedIds.includes(id)) {
        paperSelectedIds.push(id);
    }
    renderQuestionPicker();
}

function removeQuestionFromPaper(id) {
    paperSelectedIds = paperSelectedIds.filter(qid => qid !== id);
    renderQuestionPicker();
}

function clearAllPaperQuestions() {
    paperSelectedIds = [];
    renderQuestionPicker();
}

function updateSelectedCount() {
    document.getElementById('selected-count').textContent = `${paperSelectedIds.length} questions`;
}

// ─── Drag & Drop reorder ───
function onDragStart(e, index) {
    dragSrcIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
    e.preventDefault();
    const item = e.target.closest('.sel-q-item');
    if (item) item.classList.add('drag-over');
}

function onDragLeave(e) {
    const item = e.target.closest('.sel-q-item');
    if (item) item.classList.remove('drag-over');
}

function onDrop(e, targetIndex) {
    e.preventDefault();
    const item = e.target.closest('.sel-q-item');
    if (item) item.classList.remove('drag-over');

    if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

    // Reorder the array
    const moved = paperSelectedIds.splice(dragSrcIndex, 1)[0];
    paperSelectedIds.splice(targetIndex, 0, moved);
    dragSrcIndex = null;

    renderQuestionPicker();
}

function onDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.sel-q-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragSrcIndex = null;
}

function createPaper() {
    const name = document.getElementById('paper-name').value.trim();
    const code = document.getElementById('paper-code').value.trim();
    const timer = parseInt(document.getElementById('paper-timer').value) || 120;
    const selectedIds = [...paperSelectedIds];
    const activityType = document.getElementById('paper-activityType').value || 'paper';
    const description = document.getElementById('paper-description').value.trim();
    const dueDate = document.getElementById('paper-dueDate').value || null;
    const maxAttempts = parseInt(document.getElementById('paper-maxAttempts').value) || 1;
    const totalMarks = parseInt(document.getElementById('paper-totalMarks').value) || null;
    const isTimerEnabled = ['paper', 'quiz'].includes(activityType);

    if (!name) { showToast('Please enter an activity name', 'error'); return; }
    if (selectedIds.length === 0) {
        showToast('Please select at least one question', 'error'); return;
    }

    DB.createPaper(name, code, timer, selectedIds, {
        activityType, description, dueDate, maxAttempts, totalMarks, isTimerEnabled
    });
    showToast(`${activityType.charAt(0).toUpperCase() + activityType.slice(1)} "${name}" created`, 'success');

    // Reset
    document.getElementById('paper-name').value = '';
    document.getElementById('paper-code').value = '';
    document.getElementById('paper-timer').value = '120';
    document.getElementById('paper-description').value = '';
    document.getElementById('paper-dueDate').value = '';
    document.getElementById('paper-maxAttempts').value = '1';
    document.getElementById('paper-totalMarks').value = '100';
    paperSelectedIds = [];
    initDashboard(); // Refresh everything
}

function renderPapersList() {
    const papers = DB.getPapers();
    if (papers.length === 0) {
        document.getElementById('papers-list').innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>No activities created yet. Use the form above to create one.</p></div>';
        return;
    }

    const typeIcons = { paper: '📝', quiz: '⚡', homework: '📚', assignment: '📋' };
    let html = '<table class="data-table"><thead><tr><th>Name</th><th>Type</th><th>Code</th><th>Questions</th><th>Timer</th><th>Due Date</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
    papers.forEach(p => {
        const aType = p.activityType || 'paper';
        const icon = typeIcons[aType] || '📝';
        const timerText = (p.isTimerEnabled !== false && ['paper', 'quiz'].includes(aType)) ? `${p.timerMinutes} min` : '—';
        const dueText = p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—';
        html += `<tr>
      <td class="fw-600">${escapeHTML(p.name)}</td>
      <td><span class="badge badge-blue">${icon} ${aType}</span></td>
      <td>${p.code ? `<span class="badge badge-blue">${escapeHTML(p.code)}</span>` : '—'}</td>
      <td>${p.questionIds ? p.questionIds.length : 0}</td>
      <td>${timerText}</td>
      <td class="text-sm text-dim">${dueText}</td>
      <td class="text-sm text-dim">${new Date(p.createdAt).toLocaleDateString()}</td>
      <td>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-sm btn-outline" onclick="editPaper('${p.id}')" title="Edit">Edit</button>
          <button class="btn btn-sm btn-outline" onclick="duplicatePaper('${p.id}')" title="Duplicate" style="color:var(--purple);border-color:var(--purple);">Duplicate</button>
          <button class="btn btn-sm btn-danger" onclick="deletePaper('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('papers-list').innerHTML = html;
}

function deletePaper(id) {
    if (!confirm('Delete this paper and all its assignments?')) return;
    DB.deletePaper(id);
    initDashboard();
    showToast('Paper deleted', 'info');
}

// ═══════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════
function renderStudents() {
    const students = DB.getStudents();
    const tbody = document.getElementById('students-tbody');
    const empty = document.getElementById('students-empty');

    if (students.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    let html = '';
    students.forEach(s => {
        const assignedCount = DB.getStudentAssignments(s.id).length;
        const sType = s.type || 'guest';
        const typeBadge = sType === 'premium'
            ? `<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fbbf24;cursor:pointer;" onclick="toggleStudentType('${s.id}')" title="Click to switch to Guest">⭐ Premium</span>`
            : `<span class="badge" style="background:#f0fdf4;color:#166534;border:1px solid #86efac;cursor:pointer;" onclick="toggleStudentType('${s.id}')" title="Click to switch to Premium">Guest</span>`;
        const rawPwd = s.rawPassword || s.password;
        const pwdId = `pwd-${s.id}`;
        html += `<tr>
      <td class="fw-600">${s.name}</td>
      <td><code style="font-size:13px;background:#f1f5f9;padding:2px 8px;border-radius:4px;">${s.username}</code></td>
      <td>
        <div class="flex gap-4" style="align-items:center;">
          <code id="${pwdId}" style="font-size:13px;background:#f1f5f9;padding:2px 8px;border-radius:4px;letter-spacing:.5px;">●●●●●●</code>
          <button class="btn btn-sm btn-outline" onclick="togglePasswordVisibility('${pwdId}', '${rawPwd}', this)" title="Show/hide" style="padding:4px 6px;min-width:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-sm btn-outline" onclick="copyToClipboard('${rawPwd}')" title="Copy" style="padding:4px 6px;min-width:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </div>
      </td>
      <td>${typeBadge}</td>
      <td>${s.whatsapp || '<span class="text-muted text-sm">—</span>'}</td>
      <td><span class="badge badge-blue">${assignedCount}</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-sm btn-outline" onclick="editStudent('${s.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteStudent('${s.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
    });
    tbody.innerHTML = html;
}

function toggleStudentType(id) {
    const s = DB.getStudent(id);
    if (!s) return;
    const newType = (s.type || 'guest') === 'premium' ? 'guest' : 'premium';
    DB.updateStudent(id, { type: newType });
    showToast(`Student changed to ${newType}`, 'success');
    renderStudents();
}

function togglePasswordVisibility(elId, rawPwd, btn) {
    const el = document.getElementById(elId);
    if (el.dataset.visible === 'true') {
        el.textContent = '●●●●●●';
        el.dataset.visible = 'false';
    } else {
        el.textContent = rawPwd;
        el.dataset.visible = 'true';
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
}

function openStudentModal(editId) {
    document.getElementById('student-modal').classList.add('active');
    document.getElementById('student-form-error').style.display = 'none';
    if (!editId) {
        document.getElementById('student-modal-title').textContent = 'Add Student';
        document.getElementById('edit-student-id').value = '';
        document.getElementById('student-name').value = '';
        document.getElementById('student-username').value = '';
        document.getElementById('student-password').value = '';
        document.getElementById('student-type').value = 'premium';
        document.getElementById('student-whatsapp').value = '';
    }
}

function closeStudentModal() {
    document.getElementById('student-modal').classList.remove('active');
}

function editStudent(id) {
    const s = DB.getStudent(id);
    if (!s) return;
    document.getElementById('student-modal-title').textContent = 'Edit Student';
    document.getElementById('edit-student-id').value = id;
    document.getElementById('student-name').value = s.name;
    document.getElementById('student-username').value = s.username;
    document.getElementById('student-password').value = s.rawPassword || s.password;
    document.getElementById('student-type').value = s.type || 'guest';
    document.getElementById('student-whatsapp').value = s.whatsapp || '';
    document.getElementById('student-modal').classList.add('active');
}

function saveStudent() {
    const id = document.getElementById('edit-student-id').value;
    const name = document.getElementById('student-name').value.trim();
    const username = document.getElementById('student-username').value.trim();
    const password = document.getElementById('student-password').value;
    const type = document.getElementById('student-type').value || 'premium';
    const whatsapp = document.getElementById('student-whatsapp').value.trim();

    if (!name || !username || !password) {
        document.getElementById('student-form-error').textContent = 'Name, username, and password are required.';
        document.getElementById('student-form-error').style.display = 'block';
        return;
    }

    const existing = DB.getStudentByUsername(username);
    if (existing && existing.id !== id) {
        document.getElementById('student-form-error').textContent = 'Username already taken.';
        document.getElementById('student-form-error').style.display = 'block';
        return;
    }

    if (id) {
        DB.updateStudent(id, { name, username, password, rawPassword: password, type, whatsapp });
        showToast('Student updated', 'success');
    } else {
        DB.addStudent(name, username, password, type, whatsapp);
        showToast('Student added', 'success');
    }

    closeStudentModal();
    initDashboard();
}

function deleteStudent(id) {
    const s = DB.getStudent(id);
    if (!confirm(`Delete student "${s.name}"? This also removes their assignments and results.`)) return;
    DB.deleteStudent(id);
    initDashboard();
    showToast('Student deleted', 'info');
}

// ═══════════════════════════════════════
// ASSIGNMENTS
// ═══════════════════════════════════════
function renderAssignPaperSelect() {
    const papers = DB.getPapers();
    const select = document.getElementById('assign-paper-select');
    select.innerHTML = '<option value="">— Choose an activity —</option>';
    papers.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name} (${p.questionIds.length} Q)</option>`;
    });
}

function renderAssignStudents() {
    const paperId = document.getElementById('assign-paper-select').value;
    const groupEl = document.getElementById('assign-student-group');
    const selectEl = document.getElementById('assign-student-select');
    const btnEl = document.getElementById('btn-assign-save');

    if (!paperId) {
        groupEl.style.display = 'none';
        btnEl.style.display = 'none';
        return;
    }

    const students = DB.getStudents();
    if (students.length === 0) {
        selectEl.innerHTML = '<option value="">No students created yet.</option>';
        selectEl.disabled = true;
        groupEl.style.display = '';
        btnEl.style.display = 'none';
        return;
    }

    const assignments = DB.getPaperAssignments(paperId);
    const assignedIds = assignments.map(a => a.studentId);

    // Separate by type
    const premiumStudents = students.filter(s => (s.type || 'guest') === 'premium' && !assignedIds.includes(s.id));
    const guestAlreadyAssigned = assignedIds.includes('guest');

    let html = '<option value="">— Choose a student —</option>';

    // Guest group option
    if (!guestAlreadyAssigned) {
        html += '<optgroup label="Guest Students">';
        html += '<option value="guest" style="font-weight:700;">📢 All Guest Students</option>';
        html += '</optgroup>';
    }

    // Premium students
    if (premiumStudents.length > 0) {
        html += '<optgroup label="Premium Students">';
        premiumStudents.forEach(s => {
            html += `<option value="${s.id}">⭐ ${s.name} (${s.username})</option>`;
        });
        html += '</optgroup>';
    }

    // Check if anything is available
    if (premiumStudents.length === 0 && guestAlreadyAssigned) {
        selectEl.innerHTML = '<option value="">All students assigned to this paper</option>';
        selectEl.disabled = true;
        btnEl.style.display = 'none';
    } else {
        selectEl.innerHTML = html;
        selectEl.disabled = false;
        btnEl.style.display = '';
    }

    groupEl.style.display = '';
}

function saveAssignments() {
    const paperId = document.getElementById('assign-paper-select').value;
    const studentId = document.getElementById('assign-student-select').value;

    if (!paperId) { showToast('Select a paper first', 'error'); return; }
    if (!studentId) { showToast('Select a student first', 'error'); return; }

    DB.assignPaper(paperId, studentId);
    showToast('Paper assigned to student', 'success');

    // Re-render to remove the selected student from the dropdown
    initDashboard(); // Refresh students and results across tabs
}

function renderAssignmentsOverview() {
    const assignments = DB.getAssignments();
    const tbody = document.getElementById('assignments-tbody');
    const empty = document.getElementById('assignments-empty');

    if (assignments.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    let html = '';
    assignments.forEach(a => {
        const paper = DB.getPaper(a.paperId);
        if (!paper) return;

        // Skip completed individual assignments
        if (a.studentId !== 'guest') {
            const result = DB.getResult(a.paperId, a.studentId);
            if (result) return; // completed, don't show
        } else {
            // For guest group, skip if ALL guests completed
            const guestStudents = DB.getStudentsByType('guest');
            const completed = guestStudents.filter(s => DB.getResult(a.paperId, s.id)).length;
            if (guestStudents.length > 0 && completed === guestStudents.length) return;
        }

        let studentName, studentType;
        if (a.studentId === 'guest') {
            studentName = '📢 All Guest Students';
            studentType = '<span class="badge" style="background:#f0fdf4;color:#166534;border:1px solid #86efac;">Guest Group</span>';
        } else {
            const student = DB.getStudent(a.studentId);
            if (!student) return;
            studentName = `${student.name} (${student.username})`;
            const sType = student.type || 'guest';
            studentType = sType === 'premium'
                ? '<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fbbf24;">Premium</span>'
                : '<span class="badge" style="background:#f0fdf4;color:#166534;border:1px solid #86efac;">Guest</span>';
        }

        // Check status
        let statusBadge;
        if (a.studentId === 'guest') {
            // For guest group, count how many guests completed
            const guestStudents = DB.getStudentsByType('guest');
            const completed = guestStudents.filter(s => DB.getResult(a.paperId, s.id)).length;
            if (guestStudents.length === 0) {
                statusBadge = '<span class="badge" style="background:#f1f5f9;color:#64748b;">No guests</span>';
            } else if (completed === guestStudents.length) {
                statusBadge = '<span class="badge badge-green">All Done</span>';
            } else {
                statusBadge = `<span class="badge badge-orange">${completed}/${guestStudents.length} Done</span>`;
            }
        } else {
            const result = DB.getResult(a.paperId, a.studentId);
            if (result) {
                statusBadge = '<span class="badge badge-green">Completed</span>';
            } else {
                statusBadge = '<span class="badge badge-orange">Pending</span>';
            }
        }

        html += `<tr>
            <td class="fw-600">${paper.name}</td>
            <td>${studentName}</td>
            <td>${studentType}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="unassignPaperAction('${a.paperId}', '${a.studentId}')" title="Remove assignment">Unassign</button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function unassignPaperAction(paperId, studentId) {
    const label = studentId === 'guest' ? 'all guest students' : 'this student';
    if (!confirm(`Remove this paper assignment from ${label}?`)) return;
    DB.unassignPaper(paperId, studentId);
    showToast('Assignment removed', 'info');
    initDashboard();
}

// ═══════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════
function renderResults() {
    const results = DB.getResults();
    const tbody = document.getElementById('results-tbody');
    const empty = document.getElementById('results-empty');

    if (results.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    let html = '';
    results.slice().reverse().forEach(r => {
        const student = DB.getStudent(r.studentId);
        const paper = DB.getPaper(r.paperId);
        const pctClass = r.percentage >= 75 ? 'badge-green' : r.percentage >= 40 ? 'badge-blue' : 'badge-red';
        const feedback = DB.getFeedback(r.paperId, r.studentId);
        const feedbackBadge = feedback
            ? `<span class="badge badge-green" style="font-size:11px;cursor:pointer;" onclick="openFeedbackModal('${r.paperId}', '${r.studentId}')" title="View/Edit feedback">💬 Feedback given</span>`
            : `<button class="btn btn-sm btn-outline" onclick="openFeedbackModal('${r.paperId}', '${r.studentId}')" style="font-size:11px;">💬 Feedback</button>`;
        html += `<tr>
      <td class="fw-600">${student ? escapeHTML(student.name) : '—'}</td>
      <td>${paper ? escapeHTML(paper.name) : '—'}</td>
      <td>${r.score}/${r.total}</td>
      <td><span class="badge ${pctClass}">${r.percentage}%</span></td>
      <td class="text-sm text-dim">${new Date(r.submittedAt).toLocaleString()}</td>
      <td>
        <div class="flex gap-4" style="align-items:center;flex-wrap:wrap;">
            ${feedbackBadge}
            <button class="btn btn-sm btn-outline" onclick="reviewResult('${r.paperId}', '${r.studentId}')" title="Review paper">👁️ Review</button>
            <button class="btn btn-sm btn-danger" onclick="deleteResult('${r.paperId}', '${r.studentId}')" style="min-width:60px;">Delete</button>
        </div>
      </td>
    </tr>`;
    });
    tbody.innerHTML = html;
}

async function deleteResult(paperId, studentId) {
    const student = DB.getStudent(studentId);
    const studentName = student ? student.name : 'this student';
    if (!confirm(`Are you sure you want to delete the result for ${studentName}? This will reset their attempt.`)) return;

    await DB.deleteResult(paperId, studentId);
    showToast('Result deleted successfully', 'success');
    initDashboard(); // refresh tables
}

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════
// ACTIVITY TYPE SWITCHING
// ═══════════════════════════════════════
function onActivityTypeChange() {
    const type = document.getElementById('paper-activityType').value;
    const timerGroup = document.getElementById('paper-timer-group');
    const dueDateGroup = document.getElementById('paper-due-date-group');
    const maxAttemptsGroup = document.getElementById('paper-max-attempts-group');
    const totalMarksGroup = document.getElementById('paper-total-marks-group');

    // Show/hide based on type
    timerGroup.style.display = ['paper', 'quiz'].includes(type) ? '' : 'none';
    dueDateGroup.style.display = ['homework', 'assignment'].includes(type) ? '' : 'none';
    maxAttemptsGroup.style.display = type === 'quiz' ? '' : 'none';
    totalMarksGroup.style.display = ['homework', 'assignment'].includes(type) ? '' : 'none';
}

function reviewResult(paperId, studentId) {
    window.open(`paper.html?paperId=${paperId}&studentId=${studentId}&mode=review`, '_blank');
}

// ═══════════════════════════════════════
// FEEDBACK MODAL
// ═══════════════════════════════════════
function openFeedbackModal(activityId, studentId) {
    const paper = DB.getPaper(activityId);
    const student = DB.getStudent(studentId);
    const existing = DB.getFeedback(activityId, studentId);

    document.getElementById('feedback-activityId').value = activityId;
    document.getElementById('feedback-studentId').value = studentId;
    document.getElementById('feedback-student-name').value = student ? student.name : '—';
    document.getElementById('feedback-activity-name').value = paper ? paper.name : '—';

    if (existing) {
        document.getElementById('feedback-score').value = existing.score != null ? existing.score : '';
        document.getElementById('feedback-totalMarks').value = existing.totalMarks != null ? existing.totalMarks : '';
        document.getElementById('feedback-comment').value = existing.comment || '';
    } else {
        // Auto-fill from result if available
        const result = DB.getResult(activityId, studentId);
        document.getElementById('feedback-score').value = result ? result.score : '';
        document.getElementById('feedback-totalMarks').value = result ? result.total : '';
        document.getElementById('feedback-comment').value = '';
    }

    document.getElementById('feedback-form-error').style.display = 'none';
    document.getElementById('feedback-modal').classList.add('active');
}

function closeFeedbackModal() {
    document.getElementById('feedback-modal').classList.remove('active');
}

async function saveFeedback() {
    const activityId = document.getElementById('feedback-activityId').value;
    const studentId = document.getElementById('feedback-studentId').value;
    const comment = document.getElementById('feedback-comment').value.trim();
    const score = document.getElementById('feedback-score').value ? parseInt(document.getElementById('feedback-score').value) : null;
    const totalMarks = document.getElementById('feedback-totalMarks').value ? parseInt(document.getElementById('feedback-totalMarks').value) : null;

    if (!comment && score === null) {
        document.getElementById('feedback-form-error').textContent = 'Please enter a comment or score.';
        document.getElementById('feedback-form-error').style.display = 'block';
        return;
    }

    try {
        await DB.saveFeedback(activityId, studentId, comment, score, totalMarks);
        showToast('Feedback saved successfully', 'success');
        closeFeedbackModal();
        renderResults();
        renderGradebook();
    } catch (e) {
        showToast('Error saving feedback: ' + e.message, 'error');
    }
}

// ═══════════════════════════════════════
// GRADEBOOK
// ═══════════════════════════════════════
function renderGradebook() {
    const students = DB.getStudents();
    const papers = DB.getPapers();
    const results = DB.getResults();
    const filterType = document.getElementById('gradebook-filter-type') ? document.getElementById('gradebook-filter-type').value : '';

    const filteredPapers = filterType ? papers.filter(p => (p.activityType || 'paper') === filterType) : papers;

    const tableWrap = document.getElementById('gradebook-table-wrap');
    const empty = document.getElementById('gradebook-empty');

    if (!tableWrap) return;

    if (students.length === 0 || filteredPapers.length === 0) {
        tableWrap.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    const typeIcons = { paper: '📝', quiz: '⚡', homework: '📚', assignment: '📋' };

    let html = '<table class="data-table" style="font-size:13px;"><thead><tr><th style="position:sticky;left:0;background:#fff;z-index:2;">Student</th>';
    filteredPapers.forEach(p => {
        const icon = typeIcons[p.activityType || 'paper'] || '📝';
        html += `<th style="text-align:center;min-width:90px;white-space:nowrap;" title="${escapeHTML(p.name)}">${icon} ${escapeHTML(p.name).substring(0, 15)}</th>`;
    });
    html += '<th style="text-align:center;font-weight:800;">Average</th></tr></thead><tbody>';

    students.forEach(s => {
        html += `<tr><td style="position:sticky;left:0;background:#fff;z-index:1;font-weight:600;">${escapeHTML(s.name)}</td>`;
        let totalPct = 0, count = 0;
        filteredPapers.forEach(p => {
            const result = DB.getResult(p.id, s.id);
            const feedback = DB.getFeedback(p.id, s.id);
            if (result) {
                const pct = result.percentage;
                const cls = pct >= 75 ? 'badge-green' : pct >= 40 ? 'badge-blue' : 'badge-red';
                let cell = `<span class="badge ${cls}">${result.score}/${result.total}</span>`;
                if (feedback && feedback.comment) cell += ' 💬';
                html += `<td style="text-align:center;">${cell}</td>`;
                totalPct += pct; count++;
            } else if (feedback && feedback.score != null) {
                const pct = feedback.totalMarks ? Math.round((feedback.score / feedback.totalMarks) * 100) : 0;
                const cls = pct >= 75 ? 'badge-green' : pct >= 40 ? 'badge-blue' : 'badge-red';
                html += `<td style="text-align:center;"><span class="badge ${cls}">${feedback.score}/${feedback.totalMarks || '?'}</span> 💬</td>`;
                totalPct += pct; count++;
            } else {
                html += '<td style="text-align:center;color:var(--text-muted);">—</td>';
            }
        });
        const avg = count > 0 ? Math.round(totalPct / count) : 0;
        const avgCls = avg >= 75 ? 'badge-green' : avg >= 40 ? 'badge-blue' : 'badge-red';
        html += `<td style="text-align:center;"><span class="badge ${avgCls}" style="font-weight:800;">${count > 0 ? avg + '%' : '—'}</span></td></tr>`;
    });

    html += '</tbody></table>';
    tableWrap.innerHTML = html;
}

// ═══════════════════════════════════════
// MATERIAL BANK
// ═══════════════════════════════════════
function renderMaterialBank() {
    renderMaterialsList();
    renderMaterialAssignSelect();
    renderMaterialAssignmentsList();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadMaterial() {
    const fileEl = document.getElementById('material-file');
    const file = fileEl.files[0];
    if (!file) { showToast('Please select a file', 'error'); return; }

    const name = document.getElementById('material-name').value.trim() || file.name;
    const description = document.getElementById('material-desc').value.trim();
    const category = document.getElementById('material-category').value;

    try {
        showToast('Uploading...', 'info');
        await DB.uploadMaterial(file, { name, description, category });
        showToast(`Material "${name}" uploaded successfully`, 'success');

        // Reset form
        fileEl.value = '';
        document.getElementById('material-name').value = '';
        document.getElementById('material-desc').value = '';
        document.getElementById('material-category').value = 'notes';
        renderMaterialBank();
    } catch (e) {
        showToast('Upload failed: ' + e.message, 'error');
        console.error(e);
    }
}

function renderMaterialsList() {
    const materials = DB.getMaterials();
    const listEl = document.getElementById('materials-list');
    const emptyEl = document.getElementById('materials-empty');
    const countEl = document.getElementById('materials-count');

    if (!listEl) return;
    countEl.textContent = `${materials.length} file${materials.length !== 1 ? 's' : ''}`;

    if (materials.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    const catIcons = { notes: '📄', pdf: '📕', tutorial: '📖', worksheet: '📝', image: '🖼️', presentation: '📊', other: '📁' };

    let html = '<table class="data-table"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Assigned</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
    materials.forEach(m => {
        const icon = catIcons[m.category] || '📁';
        const assigned = DB.getMaterialAssignmentsForMaterial(m.id).length;
        html += `<tr>
            <td class="fw-600">${icon} ${escapeHTML(m.name)}</td>
            <td><span class="badge badge-blue">${m.category}</span></td>
            <td class="text-sm text-dim">${formatFileSize(m.sizeBytes || 0)}</td>
            <td><span class="badge badge-green">${assigned}</span></td>
            <td class="text-sm text-dim">${new Date(m.createdAt).toLocaleDateString()}</td>
            <td>
                <div class="flex gap-4">
                    <a href="${m.url}" target="_blank" class="btn btn-sm btn-outline" title="View/Download">View</a>
                    <button class="btn btn-sm btn-danger" onclick="deleteMaterial('${m.id}')">Delete</button>
                </div>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
}

async function deleteMaterial(id) {
    const mat = DB.getMaterial(id);
    if (!confirm(`Delete "${mat ? mat.name : 'this material'}"? This cannot be undone.`)) return;
    try {
        await DB.deleteMaterial(id);
        showToast('Material deleted', 'info');
        renderMaterialBank();
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
    }
}

function renderMaterialAssignSelect() {
    const materials = DB.getMaterials();
    const select = document.getElementById('material-assign-select');
    if (!select) return;
    const catIcons = { notes: '📄', pdf: '📕', tutorial: '📖', worksheet: '📝', image: '🖼️', presentation: '📊', other: '📁' };

    select.innerHTML = '<option value="">— Choose a material —</option>';
    materials.forEach(m => {
        const icon = catIcons[m.category] || '📁';
        select.innerHTML += `<option value="${m.id}">${icon} ${escapeHTML(m.name)}</option>`;
    });
}

function renderMaterialAssignStudents() {
    const materialId = document.getElementById('material-assign-select').value;
    const groupEl = document.getElementById('material-assign-student-group');
    const selectEl = document.getElementById('material-assign-student');
    const btnEl = document.getElementById('btn-material-assign');

    if (!materialId) {
        groupEl.style.display = 'none';
        btnEl.style.display = 'none';
        return;
    }

    const students = DB.getStudents();
    const existing = DB.getMaterialAssignmentsForMaterial(materialId);
    const assignedIds = existing.map(a => a.studentId);
    const guestAssigned = assignedIds.includes('guest');

    let html = '<option value="">— Choose student —</option>';
    if (!guestAssigned) {
        html += '<optgroup label="Guest Students"><option value="guest" style="font-weight:700;">📢 All Guest Students</option></optgroup>';
    }

    const unassigned = students.filter(s => !assignedIds.includes(s.id));
    if (unassigned.length > 0) {
        html += '<optgroup label="Individual Students">';
        unassigned.forEach(s => {
            const badge = (s.type || 'guest') === 'premium' ? '⭐' : '';
            html += `<option value="${s.id}">${badge} ${escapeHTML(s.name)} (${escapeHTML(s.username)})</option>`;
        });
        html += '</optgroup>';
    }

    if (unassigned.length === 0 && guestAssigned) {
        selectEl.innerHTML = '<option>All students assigned</option>';
        selectEl.disabled = true;
        btnEl.style.display = 'none';
    } else {
        selectEl.innerHTML = html;
        selectEl.disabled = false;
        btnEl.style.display = '';
    }
    groupEl.style.display = '';

    renderMaterialAssignmentsList();
}

function saveMaterialAssignment() {
    const materialId = document.getElementById('material-assign-select').value;
    const studentId = document.getElementById('material-assign-student').value;
    if (!materialId) { showToast('Select a material', 'error'); return; }
    if (!studentId) { showToast('Select a student', 'error'); return; }

    DB.assignMaterial(materialId, studentId);
    showToast('Material assigned', 'success');
    renderMaterialAssignStudents();
}

function renderMaterialAssignmentsList() {
    const assignments = DB.getMaterialAssignments();
    const listEl = document.getElementById('material-assignments-list');
    if (!listEl) return;

    if (assignments.length === 0) {
        listEl.innerHTML = '<div class="text-sm text-dim" style="padding:8px 0;">No material assignments yet.</div>';
        return;
    }

    let html = '<table class="data-table" style="font-size:13px;"><thead><tr><th>Material</th><th>Student</th><th>Assigned</th><th></th></tr></thead><tbody>';
    assignments.forEach(a => {
        const mat = DB.getMaterial(a.materialId);
        let studentName;
        if (a.studentId === 'guest') {
            studentName = '📢 All Guest Students';
        } else {
            const s = DB.getStudent(a.studentId);
            studentName = s ? escapeHTML(s.name) : '—';
        }
        html += `<tr>
            <td class="fw-600">${mat ? escapeHTML(mat.name) : '—'}</td>
            <td>${studentName}</td>
            <td class="text-sm text-dim">${new Date(a.assignedAt).toLocaleDateString()}</td>
            <td><button class="btn btn-sm btn-danger" onclick="unassignMaterialAction('${a.materialId}', '${a.studentId}')">Remove</button></td>
        </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
}

function unassignMaterialAction(materialId, studentId) {
    if (!confirm('Remove this material assignment?')) return;
    DB.unassignMaterial(materialId, studentId);
    showToast('Assignment removed', 'info');
    renderMaterialBank();
}

// ═══════════════════════════════════════
// MOBILE SIDEBAR TOGGLE
// ═══════════════════════════════════════
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

// ADMIN SETTINGS (Update credentials)
async function updateAdminSettings() {
    const current = document.getElementById('settings-current-pw').value;
    const newUsername = document.getElementById('settings-new-username').value.trim();
    const newPw = document.getElementById('settings-new-pw').value;
    const confirm = document.getElementById('settings-confirm-pw').value;
    const errEl = document.getElementById('settings-pw-error');

    errEl.style.display = 'none';

    if (!current) {
        errEl.textContent = 'Current password is required to save changes';
        errEl.style.display = 'block';
        return;
    }
    
    if (newPw && newPw.length < 4) {
        errEl.textContent = 'New password must be at least 4 characters';
        errEl.style.display = 'block';
        return;
    }
    if (newPw && newPw !== confirm) {
        errEl.textContent = 'New passwords do not match';
        errEl.style.display = 'block';
        return;
    }
    if (newUsername && newUsername.length < 3) {
        errEl.textContent = 'New username must be at least 3 characters';
        errEl.style.display = 'block';
        return;
    }

    try {
        const session = Auth.getSession();
        const resp = await fetch('/api/auth/update-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ 
                currentPassword: current, 
                newUsername: newUsername || undefined, 
                newPassword: newPw || undefined 
            })
        });
        const data = await resp.json();

        if (data.success) {
            showToast('Settings updated successfully!', 'success');
            // Update session if username changed
            if (newUsername) {
                session.username = newUsername;
                sessionStorage.setItem('active_session', JSON.stringify(session));
            }
            // Clear fields
            document.getElementById('settings-current-pw').value = '';
            document.getElementById('settings-new-username').value = '';
            document.getElementById('settings-new-pw').value = '';
            document.getElementById('settings-confirm-pw').value = '';
        } else {
            errEl.textContent = data.error || 'Failed to update settings';
            errEl.style.display = 'block';
        }
    } catch (e) {
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
    }
}

// ═══════════════════════════════════════
// ACTIVITY EDIT / DUPLICATE
// ═══════════════════════════════════════
function editPaper(id) {
    const paper = DB.getPaper(id);
    if (!paper) return;

    // Populate the form with existing paper data
    document.getElementById('paper-name').value = paper.name || '';
    document.getElementById('paper-code').value = paper.code || '';
    document.getElementById('paper-timer').value = paper.timerMinutes || 120;
    document.getElementById('paper-activityType').value = paper.activityType || 'paper';
    document.getElementById('paper-description').value = paper.description || '';
    document.getElementById('paper-dueDate').value = paper.dueDate || '';
    document.getElementById('paper-maxAttempts').value = paper.maxAttempts || 1;
    document.getElementById('paper-totalMarks').value = paper.totalMarks || 100;

    // Set selected questions
    paperSelectedIds = [...(paper.questionIds || [])];
    renderSelectedQuestions();
    renderQuestionPicker();

    // Switch to the papers tab
    showTab('papers');

    // Mark that we are editing (store editing paper id)
    document.getElementById('paper-name').dataset.editingId = id;

    // Change the create button to update
    const createBtn = document.querySelector('#panel-papers .btn-primary[onclick="createPaper()"]');
    if (createBtn) {
        createBtn.textContent = '✓ Update Activity';
        createBtn.setAttribute('onclick', 'updatePaper()');
    }

    showToast('Editing activity — make changes and click Update', 'info');
}

function updatePaper() {
    const id = document.getElementById('paper-name').dataset.editingId;
    if (!id) { createPaper(); return; }

    const name = document.getElementById('paper-name').value.trim();
    const code = document.getElementById('paper-code').value.trim();
    const timer = parseInt(document.getElementById('paper-timer').value) || 120;
    const selectedIds = [...paperSelectedIds];
    const activityType = document.getElementById('paper-activityType').value || 'paper';
    const description = document.getElementById('paper-description').value.trim();
    const dueDate = document.getElementById('paper-dueDate').value || null;
    const maxAttempts = parseInt(document.getElementById('paper-maxAttempts').value) || 1;
    const totalMarks = parseInt(document.getElementById('paper-totalMarks').value) || null;
    const isTimerEnabled = ['paper', 'quiz'].includes(activityType);

    if (!name) { showToast('Please enter an activity name', 'error'); return; }
    if (selectedIds.length === 0) {
        showToast('Please select at least one question', 'error'); return;
    }

    // Update via data layer
    const paper = DB.getPaper(id);
    if (!paper) return;

    paper.name = name;
    paper.code = code;
    paper.timerMinutes = timer;
    paper.questionIds = selectedIds;
    paper.activityType = activityType;
    paper.description = description;
    paper.dueDate = dueDate;
    paper.maxAttempts = maxAttempts;
    paper.totalMarks = totalMarks;
    paper.isTimerEnabled = isTimerEnabled;

    DB.savePapers();
    showToast(`Activity "${name}" updated successfully`, 'success');

    // Reset form back to create mode
    resetPaperForm();
    initDashboard();
}

function resetPaperForm() {
    document.getElementById('paper-name').value = '';
    document.getElementById('paper-code').value = '';
    document.getElementById('paper-timer').value = '120';
    document.getElementById('paper-description').value = '';
    document.getElementById('paper-dueDate').value = '';
    document.getElementById('paper-maxAttempts').value = '1';
    document.getElementById('paper-totalMarks').value = '100';
    delete document.getElementById('paper-name').dataset.editingId;
    paperSelectedIds = [];

    const createBtn = document.querySelector('#panel-papers .btn-primary[onclick="updatePaper()"]');
    if (createBtn) {
        createBtn.textContent = '';
        createBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Create Activity';
        createBtn.setAttribute('onclick', 'createPaper()');
    }
}

function duplicatePaper(id) {
    const paper = DB.getPaper(id);
    if (!paper) return;

    const newName = `${paper.name} (Copy)`;
    DB.createPaper(newName, paper.code || '', paper.timerMinutes || 120, [...(paper.questionIds || [])], {
        activityType: paper.activityType || 'paper',
        description: paper.description || '',
        dueDate: null,
        maxAttempts: paper.maxAttempts || 1,
        totalMarks: paper.totalMarks || null,
        isTimerEnabled: paper.isTimerEnabled !== false
    });

    showToast(`Duplicated as "${newName}"`, 'success');
    initDashboard();
}
