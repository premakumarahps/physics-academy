/* ═══════════════════════════════════════════
   shared.js — Common UI Rendering & Utilities
   ═══════════════════════════════════════════ */

// ─── Helper: Sanitize HTML - Allow safe tags only ───
function sanitizeHTML(html) {
    if (!html) return '';
    const allowedTags = ['sup', 'sub', 'br', 'strong', 'em', 'b', 'i', 'u', 'span'];
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const walk = (node) => {
        for (let n = 0; n < node.childNodes.length; n++) {
            const child = node.childNodes[n];
            if (child.nodeType === 1) { // Element node
                if (!allowedTags.includes(child.tagName.toLowerCase())) {
                    // Replace dangerous tags with their text content
                    const text = document.createTextNode(child.textContent);
                    node.replaceChild(text, child);
                    n--;
                } else {
                    walk(child);
                }
            }
        }
    };

    walk(temp);
    return temp.innerHTML;
}

// Helper: Escape HTML to prevent XSS (for option text and other plain text)
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render KaTeX in a container
function renderKaTeX(container) {
    setTimeout(() => {
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(container, {
                delimiters: [
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        }
    }, 50);
}

// ═══════════════════════════════════════════
// IMAGE POSITION HELPERS (Q_Render engine)
// ═══════════════════════════════════════════

// Map image position to CSS layout class
function _imgLayoutClass(position, isEditable) {
    let cls = 'question-diagram';
    if (isEditable) cls += ' draggable';

    switch (position) {
        case 'right':        cls += ' float-right'; break;
        case 'left':         cls += ' float-left'; break;
        case 'top-left':
        case 'bottom-left':
        case 'footer-left':  cls += ' block-left'; break;
        case 'top-right':
        case 'bottom-right':
        case 'footer-right': cls += ' block-right'; break;
        default:             cls += ' block-center'; break;
    }
    return cls;
}

// Determine which zone an image belongs to (top / bottom / footer)
function _imgZone(position) {
    if (!position) return 'top';
    if (position.startsWith('footer')) return 'footer';
    if (position.startsWith('bottom')) return 'bottom';
    // 'right', 'left', 'top-*', 'center' etc. all go in top zone
    return 'top';
}

// Map legacy AL_Physics position values to Q_Render positions
function _normalizePosition(position) {
    if (position === 'right_of_question') return 'right';
    if (position === 'after_question' || position === 'below') return 'bottom-center';
    return position || 'bottom-center';
}

// Build inline style for an image wrapper
function _imgInlineStyle(img) {
    let style = `width: ${img.width || 'auto'}; height: auto;`;
    style += ` margin-top: ${img.marginTop || '0px'};`;

    const pos = _normalizePosition(img.position);
    if (pos === 'right' || pos.endsWith('-right')) {
        style += ` margin-right: ${img.marginRight || '0px'};`;
    }
    if (pos === 'left' || pos.endsWith('-left')) {
        style += ` margin-left: ${img.marginLeft || '0px'};`;
    }
    return style;
}

// ═══════════════════════════════════════════
// BUILD SINGLE IMAGE HTML
// ═══════════════════════════════════════════

function _buildImageHTML(img, qId, imgIndex, isEditable) {
    const pos = _normalizePosition(img.position);
    const layoutClass = _imgLayoutClass(pos, isEditable);
    const inlineStyle = _imgInlineStyle(img);

    // Image source: support both Q_Render (file_name) and AL_Physics (data URL) formats
    const imgSrc = img.data || (img.file_name ? `images/${img.file_name}` : '');
    const imgAlt = escapeHTML(img.name || img.file_name || 'Question image');

    let editorHtml = '';
    if (isEditable) {
        const positions = [
            { val: 'left',          label: 'Float Left (Wrap)' },
            { val: 'right',         label: 'Float Right (Wrap)' },
            { val: 'top-left',      label: 'Top Left' },
            { val: 'top-right',     label: 'Top Right' },
            { val: 'top-center',    label: 'Top Center' },
            { val: '_sep1',         label: '--- Below Text ---', disabled: true },
            { val: 'bottom-left',   label: 'Bottom Left' },
            { val: 'bottom-right',  label: 'Bottom Right' },
            { val: 'bottom-center', label: 'Bottom Center' },
            { val: '_sep2',         label: '--- Below Options ---', disabled: true },
            { val: 'footer-left',   label: 'Footer Left' },
            { val: 'footer-right',  label: 'Footer Right' },
            { val: 'footer-center', label: 'Footer Center' },
        ];
        const posOptions = positions.map(p => {
            if (p.disabled) return `<option disabled>${p.label}</option>`;
            const sel = (pos === p.val || (!pos && p.val === 'bottom-center')) ? 'selected' : '';
            return `<option value="${p.val}" ${sel}>${p.label}</option>`;
        }).join('');

        editorHtml = `
            <div class="image-editor">
                <label>Pos:
                    <select onchange="updateImageProp('${qId}', ${imgIndex}, 'position', this.value)">${posOptions}</select>
                </label>
                <span class="drag-hint">↳ Drag / Resize</span>
            </div>
        `;
    }

    return `
        <div class="${layoutClass}" style="${inlineStyle}" data-qid="${qId}" data-idx="${imgIndex}">
            <div style="position: relative; width: 100%; display: block;">
                <img src="${imgSrc}" alt="${imgAlt}" style="width:100%; height:auto; display:block;">
                ${isEditable ? '<div class="resize-handle"></div>' : ''}
            </div>
            ${editorHtml}
        </div>
    `;
}

// ═══════════════════════════════════════════
// BUILD QUESTION HTML (Q_Render-style engine)
// ═══════════════════════════════════════════
//
// options parameter controls context-specific rendering:
//   showActions      — show Edit/Export/Delete buttons (admin card views)
//   showAddRemove    — show +/- buttons (paper builder picker)
//   isSelected       — question is selected in paper builder
//   compact          — compact card style
//   isStudentView    — true if rendering radio options for taking the test
//   questionIndex    — question number for student view
//   showAdminTags    — show badges (type, unit, etc.)
//   isEditable       — enable drag/resize/position editor controls

function buildQuestionHTML(q, options = {}) {
    const {
        showActions = false,
        showAddRemove = false,
        isSelected = false,
        compact = false,
        isStudentView = false,
        questionIndex = null,
        showAdminTags = true,
        isEditable = false
    } = options;

    const questionText = sanitizeHTML(q.question);
    const qId = q.id || q.question_id || '';

    // ─── 1. Process Images into zones ───
    let topImagesHTML = '';
    let bottomImagesHTML = '';
    let footerImagesHTML = '';

    if (q.images && q.images.length > 0) {
        q.images.forEach((img, imgIndex) => {
            const pos = _normalizePosition(img.position);
            const imgHtml = _buildImageHTML(img, qId, imgIndex, isEditable);
            const zone = _imgZone(pos);

            if (zone === 'footer')      footerImagesHTML += imgHtml;
            else if (zone === 'bottom') bottomImagesHTML += imgHtml;
            else                        topImagesHTML += imgHtml;
        });
    }

    // ─── 2. Question Text ───
    let questionArea = '';
    if (isStudentView && questionIndex !== null) {
        questionArea = `
        <div class="q-header" style="display:flex; align-items:flex-start; gap:8px;">
            <div class="q-number" style="font-weight:700; font-size:15px; color:var(--text); flex-shrink:0;">${questionIndex + 1}.</div>
            <div class="q-render-text">${questionText}</div>
        </div>`;
    } else {
        questionArea = `<div class="q-render-text">${questionText}</div>`;
    }

    // ─── 3. Options ───
    const optionsLayout = q.options_layout || q.optionsLayout || '';
    let optionsEditorHtml = '';
    let optionsHTML = '';

    if (q.options) {
        // Editor bar for options layout + correct answer
        if (isEditable) {
            // Build correct answer selector
            const optionKeys = Array.isArray(q.options) 
                ? q.options.map((_, i) => i) 
                : Object.keys(q.options);
            const correctOpts = optionKeys.map(k => {
                const label = Array.isArray(q.options) ? `Option ${parseInt(k) + 1}` : `Option (${k})`;
                const isCorrect = (String(k) === String(q.correctAnswer) || String(k) === String(q.correct_answer));
                return `<option value="${k}" ${isCorrect ? 'selected' : ''}>${label}</option>`;
            }).join('');

            optionsEditorHtml = `
                <div class="options-editor">
                    <label>Layout:
                        <select onchange="updateQuestionProp('${qId}', 'options_layout', this.value)">
                            <option value="horizontal" ${optionsLayout !== 'vertical' ? 'selected' : ''}>Horizontal (Flow)</option>
                            <option value="vertical" ${optionsLayout === 'vertical' ? 'selected' : ''}>Vertical (List)</option>
                        </select>
                    </label>
                    <span style="font-size:11px; color:var(--text-muted);">Click an option to mark as correct answer</span>
                </div>
            `;
        }

        if (isStudentView) {
            // Student view: radio buttons for answering
            const containerClass = `qr-options-container${optionsLayout === 'vertical' ? ' vertical-layout' : ''}`;
            const entries = Array.isArray(q.options)
                ? q.options.map((text, i) => [String(i + 1), text])
                : Object.entries(q.options);
            
            optionsHTML = entries.map(([key, text]) => {
                const inputId = `q${qId}_opt${key}`;
                return `
                    <label class="qr-option-item" data-qid="${qId}" data-val="${key}">
                        <input type="radio" name="q${qId}" id="${inputId}" value="${key}">
                        <span class="qr-option-number">(${key})</span>
                        <span class="qr-option-text">${escapeHTML(text)}</span>
                    </label>`;
            }).join('');
            optionsHTML = `<div class="${containerClass}" id="opts-${qId}">${optionsHTML}</div>`;
        } else if (isEditable) {
            // Editor view: clickable options to set correct answer
            const containerClass = `qr-options-container${optionsLayout === 'vertical' ? ' vertical-layout' : ''}`;
            const entries = Array.isArray(q.options)
                ? q.options.map((text, i) => [String(i + 1), text])
                : Object.entries(q.options);

            optionsHTML = entries.map(([key, text]) => {
                const isCorrect = (String(key) === String(q.correctAnswer) || String(key) === String(q.correct_answer));
                return `
                    <label class="qr-option-item${isCorrect ? ' correct-answer' : ''}" onclick="updateQuestionProp('${qId}', 'correctAnswer', '${key}')" style="cursor:pointer;">
                        <input type="radio" name="${qId}" value="${key}" ${isCorrect ? 'checked' : ''}>
                        <span class="qr-option-number">(${key})</span>
                        <span class="qr-option-text">${escapeHTML(text)}</span>
                    </label>`;
            }).join('');
            optionsHTML = `<div class="${containerClass}">${optionsHTML}</div>`;
        } else {
            // Admin card view: same Q_Render-style rendering with correct answer highlight
            const containerClass = `qr-options-container${optionsLayout === 'vertical' ? ' vertical-layout' : ''}`;
            const entries = Array.isArray(q.options)
                ? q.options.map((text, i) => [String(i + 1), text])
                : Object.entries(q.options);
            optionsHTML = entries.map(([key, text]) => {
                const isCorrect = key === q.correctAnswer;
                return `
                    <label class="qr-option-item${isCorrect ? ' correct-answer' : ''}" style="cursor:default;">
                        <input type="radio" name="${qId}_view" value="${key}" disabled>
                        <span class="qr-option-number">(${key})</span>
                        <span class="qr-option-text">${escapeHTML(text)}</span>
                    </label>`;
            }).join('');
            optionsHTML = `<div class="${containerClass}">${optionsHTML}</div>`;
        }
    }

    // ─── 4. Badges and Tags (Admin view only) ───
    let headerTags = '';
    if (showAdminTags) {
        let badges = '';
        if (q.type) badges += `<span class="badge badge-blue">${q.type}</span>`;
        if (q.source) badges += `<span class="badge badge-orange">${q.source}</span>`;
        if (q.examType) badges += `<span class="badge badge-gray">${q.examType}</span>`;
        if (q.unit) badges += `<span class="badge badge-green">${q.unit}</span>`;
        if (q.subUnit) badges += `<span class="badge badge-gray">${q.subUnit}</span>`;
        if (q.location && q.location.year) {
            badges += `<span class="badge badge-gray">${q.location.year} Q${q.location.questionNumber || '?'}</span>`;
        }

        let naTags = '';
        if (!q.type) naTags += `<span class="badge badge-na">Type: N/A</span>`;
        if (!q.source) naTags += `<span class="badge badge-na">Source: N/A</span>`;
        if (!q.examType) naTags += `<span class="badge badge-na">Exam: N/A</span>`;
        if (!q.unit) naTags += `<span class="badge badge-na">Unit: N/A</span>`;
        if (!q.subUnit) naTags += `<span class="badge badge-na">Sub-Unit: N/A</span>`;

        headerTags = `
            <div class="q-card-badges">${badges}</div>
            ${naTags ? `<div class="q-card-na-tags">${naTags}</div>` : ''}
        `;
    }

    // ─── 5. Actions (Admin only) ───
    let actionsHTML = '';
    if (showActions) {
        actionsHTML = `<div class="q-card-actions">
            <button class="btn btn-sm btn-outline btn-edit-question" data-question-id="${escapeHTML(qId)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
            </button>

            <button class="btn btn-sm btn-danger btn-delete-question" data-question-id="${escapeHTML(qId)}" style="margin-left: auto;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Delete
            </button>
        </div>`;
    }

    if (showAddRemove) {
        if (isSelected) {
            headerTags += `<button class="btn-action-q btn-remove-q" onclick="removeQuestionFromPaper('${qId}')" title="Remove from paper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>`;
        } else {
            headerTags += `<button class="btn-action-q btn-add-q" onclick="addQuestionToPaper('${qId}')" title="Add to paper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>`;
        }
    }

    // ─── 6. Assemble final HTML with Q_Render layout ───
    // Use float-based layout: top images + text in one overflow:hidden block,
    // then bottom images, then options, then footer images
    const contentHtml = `
        <div class="q-render-content">
            ${topImagesHTML}
            ${questionArea}
        </div>
        ${bottomImagesHTML}
        ${optionsEditorHtml}
        ${optionsHTML}
        ${footerImagesHTML}
    `;

    if (isStudentView) {
        return `
        <div class="question-block" id="qblock-${qId}" style="animation-delay:${(questionIndex || 0) * 0.04}s">
            ${contentHtml}
        </div>`;
    } else {
        return `
        <div class="q-full-card ${isSelected ? 'selected' : ''} ${compact ? 'compact' : ''}" id="qcard-${escapeHTML(qId)}">
            ${headerTags ? `<div class="q-card-header">${headerTags}</div>` : ''}
            ${contentHtml}
            ${showActions ? actionsHTML : ''}
        </div>`;
    }
}
