/* ═══════════════════════════════════════════
   data.js — Backend API Data Layer
   Interacts with Local Node/File Backend
   ═══════════════════════════════════════════ */

const API_BASE = '/api';

const DB = {
    // Local state for fast synchronous UI rendering where possible
    _state: {
        questions: [],
        dropdowns: null,
        config: {},
        students: [],
        papers: [],
        assignments: [],
        results: [],
        // Admin credentials are now handled by the backend for security
    },

    // ─── Generic helpers ───
    _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    _nextQuestionId() {
        // Q_Render style: q_01, q_02, q_03, ...
        let maxNum = 0;
        this._state.questions.forEach(q => {
            const match = (q.id || '').match(/^q_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        const next = maxNum + 1;
        return `q_${String(next).padStart(2, '0')}`;
    },

    _getAuthHeaders(isFormData = false) {
        const headers = {};
        if (!isFormData) headers['Content-Type'] = 'application/json';
        const sessionStr = sessionStorage.getItem('active_session');
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                if (session && session.token) {
                    headers['Authorization'] = `Bearer ${session.token}`;
                }
            } catch (e) { }
        }
        return headers;
    },

    // ═══════════════════════════════════════
    // DEFAULT DROPDOWN OPTIONS
    // ═══════════════════════════════════════
    _defaultDropdowns() {
        return {
            questionType: ['MCQ', 'Structured', 'Essay'],
            source: ['Original', 'Past Paper', 'Model'],
            examType: ['Class Test', 'Term Exam', 'Final Exam', 'Practice'],
            unit: [
                'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'
            ],
            subUnit: {
                'Unit 1': ['Topic 1.1', 'Topic 1.2'],
                'Unit 2': ['Topic 2.1', 'Topic 2.2'],
                'Unit 3': ['Topic 3.1', 'Topic 3.2'],
                'Unit 4': ['Topic 4.1', 'Topic 4.2'],
                'Unit 5': ['Topic 5.1', 'Topic 5.2']
            }
        };
    },

    // ═══════════════════════════════════════
    // INITIALIZATION / SYNC
    // ═══════════════════════════════════════
    async seed() {
        try {
            // Add cache busting to ensure fresh data
            const cacheBust = `?t=${Date.now()}`;
            
            // Load Dropdowns
            const ddRes = await fetch(`${API_BASE}/dropdowns${cacheBust}`);
            const dropdowns = await ddRes.json();
            if (Object.keys(dropdowns).length > 0) {
                this._state.dropdowns = dropdowns;
            } else {
                this._state.dropdowns = this._defaultDropdowns();
                // Save defaults to backend
                for (const [cat, opts] of Object.entries(this._state.dropdowns)) {
                    await fetch(`${API_BASE}/dropdowns`, {
                        method: 'POST',
                        headers: this._getAuthHeaders(),
                        body: JSON.stringify({ category: cat, options: opts })
                    });
                }
            }

            // Load Questions (with auth headers)
            const qRes = await fetch(`${API_BASE}/questions${cacheBust}`, {
                headers: this._getAuthHeaders()
            });
            this._state.questions = await qRes.json();

            // Fetch remaining entities from server instead of localStorage
            const entities = ['students', 'papers', 'assignments', 'results', 'config', 'feedback', 'materials', 'materialAssignments'];
            for (const entity of entities) {
                try {
                    const res = await fetch(`${API_BASE}/data/${entity}${cacheBust}`);
                    const data = await res.json();
                    if (entity === 'config' && !Array.isArray(data)) {
                        this._state.config = data;
                    } else {
                        this._state[entity] = data || [];
                    }
                } catch (e) {
                    console.error('Failed to load ' + entity, e);
                    this._state[entity] = entity === 'config' ? {} : [];
                }
            }
            // Ensure feedback array exists
            if (!this._state.feedback) this._state.feedback = [];
            if (!this._state.materials) this._state.materials = [];
            if (!this._state.materialAssignments) this._state.materialAssignments = [];

        } catch (e) {
            console.error("Failed to sync with backend:", e);
            if (!this._state.dropdowns) this._state.dropdowns = this._defaultDropdowns();
        }
    },

    // ═══════════════════════════════════════
    // AUTHENTICATION
    // ═══════════════════════════════════════
    async verifyCreds(username, password) {
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            return { success: response.status === 200, ...result };
        } catch (e) {
            console.error('Login request failed', e);
            return { success: false, error: 'Connection to server failed' };
        }
    },

    async registerGuest(username, password, whatsapp) {
        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, whatsapp })
            });
            const result = await response.json();
            return { success: response.ok, ...result };
        } catch (e) {
            console.error('Registration failed', e);
            return { success: false, error: 'Connection to server failed' };
        }
    },
    getConfig() { return this._state.config; },

    // ═══════════════════════════════════════
    // STUDENTS (Background synced to server)
    // ═══════════════════════════════════════
    getStudents() { return this._state.students; },
    getStudent(id) { return this._state.students.find(s => s.id === id) || null; },
    getStudentByUsername(uname) { return this._state.students.find(s => s.username === uname) || null; },

    _saveL(key, val) {
        this._state[key] = val;
        // Background sync to server replacing localStorage
        // Special handling: results should be awaited (but we don't wait in this function)
        fetch(`${API_BASE}/data/${key}`, {
            method: 'POST',
            headers: this._getAuthHeaders(),
            body: JSON.stringify(val)
        }).catch(e => console.error('Background sync failed for', key, e));
    },

    addStudent(name, username, password, type = 'premium', whatsapp = '') {
        const student = { id: this._uid(), name, username, password, rawPassword: password, type, whatsapp, createdAt: new Date().toISOString() };
        const list = [...this._state.students, student];
        this._saveL('students', list);
        return student;
    },
    getStudentsByType(type) { return this._state.students.filter(s => (s.type || 'guest') === type); },
    updateStudent(id, updates) {
        const students = [...this._state.students];
        const idx = students.findIndex(s => s.id === id);
        if (idx === -1) return null;
        Object.assign(students[idx], updates);
        this._saveL('students', students);
        return students[idx];
    },
    deleteStudent(id) {
        this._saveL('students', this._state.students.filter(s => s.id !== id));
        this._saveL('assignments', this._state.assignments.filter(a => a.studentId !== id));
        this._saveL('results', this._state.results.filter(r => r.studentId !== id));
    },

    // ═══════════════════════════════════════
    // DROPDOWN OPTIONS
    // ═══════════════════════════════════════
    getDropdownOptions() { return this._state.dropdowns || this._defaultDropdowns(); },

    async saveDropdownOptions(options) {
        this._state.dropdowns = options;
        try {
            for (const [cat, opts] of Object.entries(options)) {
                await fetch(`${API_BASE}/dropdowns`, {
                    method: 'POST',
                    headers: this._getAuthHeaders(),
                    body: JSON.stringify({ category: cat, options: opts })
                });
            }
        } catch (e) { console.error('Failed to save dropdowns to backend', e); }
    },

    async addDropdownOption(category, value, parentUnit) {
        const opts = this.getDropdownOptions();
        let changed = false;
        if (category === 'subUnit') {
            if (!parentUnit) return false;
            if (!opts.subUnit[parentUnit]) opts.subUnit[parentUnit] = [];
            if (opts.subUnit[parentUnit].includes(value)) return false;
            opts.subUnit[parentUnit].push(value);
            changed = true;
        } else {
            if (!opts[category]) return false;
            if (opts[category].includes(value)) return false;
            opts[category].push(value);
            if (category === 'unit') opts.subUnit[value] = [];
            changed = true;
        }
        if (changed) await this.saveDropdownOptions(opts);
        return true;
    },

    async renameDropdownOption(category, oldValue, newValue, parentUnit) {
        const opts = this.getDropdownOptions();
        if (category === 'subUnit') {
            if (!parentUnit || !opts.subUnit[parentUnit]) return false;
            const idx = opts.subUnit[parentUnit].indexOf(oldValue);
            if (idx === -1) return false;
            opts.subUnit[parentUnit][idx] = newValue;
        } else {
            if (!opts[category]) return false;
            const idx = opts[category].indexOf(oldValue);
            if (idx === -1) return false;
            opts[category][idx] = newValue;
            if (category === 'unit' && opts.subUnit[oldValue]) {
                opts.subUnit[newValue] = opts.subUnit[oldValue];
                delete opts.subUnit[oldValue];
            }
        }
        await this.saveDropdownOptions(opts);

        // With stable q_XX IDs, no batch file rename is needed.
        // Just update the metadata values in local memory.
        const fieldMap = { questionType: 'type', source: 'source', examType: 'examType', unit: 'unit', subUnit: 'subUnit' };
        const field = fieldMap[category];
        if (field) {
            this._state.questions.forEach(q => {
                if (q[field] === oldValue) q[field] = newValue;
            });
        }
        return true;
    },

    async removeDropdownOption(category, value, parentUnit) {
        const opts = this.getDropdownOptions();
        if (category === 'subUnit') {
            if (!parentUnit || !opts.subUnit[parentUnit]) return false;
            opts.subUnit[parentUnit] = opts.subUnit[parentUnit].filter(v => v !== value);
        } else {
            if (!opts[category]) return false;
            opts[category] = opts[category].filter(v => v !== value);
            if (category === 'unit') delete opts.subUnit[value];
        }
        await this.saveDropdownOptions(opts);
        return true;
    },

    // ═══════════════════════════════════════
    // QUESTION BANK
    // ═══════════════════════════════════════
    getQuestionIndex() { return this._state.questions.map(q => q.id); },
    getQuestions() { return this._state.questions; },
    getQuestion(id) {
        // Search directly without prefix manipulation to support both q_ and meaningful IDs
        return this._state.questions.find(q => q.id === id) || null;
    },

    // NOTE: addQuestion is now ASYNC because it needs to post to backend
    async addQuestion(questionData, imageFiles = []) {
        const id = this._nextQuestionId();
        questionData.id = id;
        if (!questionData.createdAt) questionData.createdAt = new Date().toISOString();

        const q = {
            id,
            type: questionData.type || 'MCQ',
            source: questionData.source || '',
            examType: questionData.examType || '',
            location: questionData.location || { year: '', questionNumber: '' },
            unit: questionData.unit || '',
            subUnit: questionData.subUnit || '',
            question: questionData.question || '',
            options: questionData.options || {},
            correctAnswer: questionData.correctAnswer || '',
            images: questionData.images || [],
            createdAt: questionData.createdAt
        };

        const formData = new FormData();
        formData.append('questionData', JSON.stringify(q));

        if (imageFiles && imageFiles.length > 0) {
            imageFiles.forEach(file => {
                formData.append('images', file);
            });
        }

        const response = await fetch(`${API_BASE}/questions`, {
            method: 'POST',
            headers: this._getAuthHeaders(true),
            body: formData // No content-type header for FormData
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        // The backend returns the public URLs for the images, update the local state
        q.images = result.images;
        this._state.questions.push(q);

        return q;
    },

    async updateQuestion(questionData, oldId) {
        // Keep the same ID — metadata changes don't affect the filename
        questionData.id = oldId;
        
        const idx = this._state.questions.findIndex(q => q.id === oldId);
        if (idx === -1) return null;

        // Update the question in local state
        this._state.questions[idx] = questionData;

        // Post the updated question back to backend (same ID, just content update)
        const formData = new FormData();
        formData.append('questionData', JSON.stringify(questionData));
        
        const response = await fetch(`${API_BASE}/questions`, { 
            method: 'POST', 
            body: formData, 
            headers: this._getAuthHeaders(true) 
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to update question');
        }

        return questionData;
    },

    async deleteQuestion(id) {
        // Support both q_ prefixed and meaningful IDs
        try {
            const response = await fetch(`${API_BASE}/questions/${id}`, {
                method: 'DELETE',
                headers: this._getAuthHeaders()
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            // Remove from local cache
            this._state.questions = this._state.questions.filter(q => q.id !== id);
            return true;
        } catch (e) {
            console.error('Failed to delete question from backend', e);
            throw e;
        }
    },

    getFilteredQuestions(filters = {}) {
        return this._state.questions.filter(q => {
            if (filters.type && q.type !== filters.type) return false;
            if (filters.source && q.source !== filters.source) return false;
            if (filters.examType && q.examType !== filters.examType) return false;
            if (filters.unit && q.unit !== filters.unit) return false;
            if (filters.subUnit && q.subUnit !== filters.subUnit) return false;
            if (filters.search) {
                const term = filters.search.toLowerCase();
                const text = (q.question || '').toLowerCase();
                if (!text.includes(term)) return false;
            }
            return true;
        });
    },

    // ═══════════════════════════════════════
    // PAPERS & ASSIGNMENTS (Background synced)
    // ═══════════════════════════════════════
    getPapers() { return this._state.papers; },
    getPaper(id) { return this._state.papers.find(p => p.id === id) || null; },
    createPaper(name, code, timerMinutes, questionIds, extra = {}) {
        const paper = {
            id: this._uid(), name, code, timerMinutes, questionIds,
            activityType: extra.activityType || 'paper',
            description: extra.description || '',
            dueDate: extra.dueDate || null,
            maxAttempts: extra.maxAttempts || 1,
            totalMarks: extra.totalMarks || null,
            isTimerEnabled: extra.isTimerEnabled !== undefined ? extra.isTimerEnabled : true,
            createdAt: new Date().toISOString()
        };
        const list = [...this._state.papers, paper];
        this._saveL('papers', list);
        return paper;
    },
    deletePaper(id) {
        this._saveL('papers', this._state.papers.filter(p => p.id !== id));
        this._saveL('assignments', this._state.assignments.filter(a => a.paperId !== id));
        this._saveL('results', this._state.results.filter(r => r.paperId !== id));
    },
    savePapers() {
        this._saveL('papers', this._state.papers);
    },
    getPaperQuestions(paperId) {
        const paper = this.getPaper(paperId);
        if (!paper) return [];
        return paper.questionIds.map(qid => this.getQuestion(qid)).filter(Boolean);
    },

    getAssignments() { return this._state.assignments; },
    assignPaper(paperId, studentId) {
        if (this._state.assignments.find(a => a.paperId === paperId && a.studentId === studentId)) return null;
        const assignment = { id: this._uid(), paperId, studentId, assignedAt: new Date().toISOString() };
        const list = [...this._state.assignments, assignment];
        this._saveL('assignments', list);
        return assignment;
    },
    unassignPaper(paperId, studentId) {
        this._saveL('assignments', this._state.assignments.filter(
            a => !(a.paperId === paperId && a.studentId === studentId)
        ));
    },
    getStudentAssignments(studentId) {
        // Get direct assignments
        const direct = this._state.assignments.filter(a => a.studentId === studentId);
        // Also get papers marked for all guests (studentId === 'guest')
        const student = this.getStudent(studentId);
        if (student) {
            const guestAssignments = this._state.assignments.filter(a => a.studentId === 'guest');
            // Merge guest assignments, avoid duplicates
            guestAssignments.forEach(ga => {
                if (!direct.find(d => d.paperId === ga.paperId)) {
                    direct.push(ga);
                }
            });
        }
        return direct;
    },
    getPaperAssignments(paperId) { return this._state.assignments.filter(a => a.paperId === paperId); },

    // ═══════════════════════════════════════
    // RESULTS (Synced - ASYNC for consistency)
    // ═══════════════════════════════════════
    getResults() { return this._state.results; },
    async saveResult(paperId, studentId, answers, score, total) {
        const result = {
            id: this._uid(), paperId, studentId, answers, score, total,
            percentage: total > 0 ? Math.round((score / total) * 100) : 0,
            submittedAt: new Date().toISOString()
        };
        const list = [...this._state.results, result];
        this._state.results = list;
        
        // CRITICAL: Make this synchronous (await) so data is guaranteed saved before navigation
        try {
            const response = await fetch(`${API_BASE}/data/results`, {
                method: 'POST',
                headers: this._getAuthHeaders(),
                body: JSON.stringify(list)
            });
            if (!response.ok) {
                console.error('Failed to save result to server:', response.statusText);
            }
        } catch (e) {
            console.error('Result sync failed:', e);
        }
        
        return result;
    },
    getStudentResults(studentId) { return this._state.results.filter(r => r.studentId === studentId); },
    async deleteResult(paperId, studentId) {
        const list = this._state.results.filter(r => !(r.paperId === paperId && r.studentId === studentId));
        this._state.results = list;
        try {
            const response = await fetch(`${API_BASE}/data/results`, {
                method: 'POST',
                headers: this._getAuthHeaders(),
                body: JSON.stringify(list)
            });
            if (!response.ok) console.error('Failed to delete result on server:', response.statusText);
        } catch (e) {
            console.error('Delete result sync failed:', e);
        }
    },
    getPaperResults(paperId) { return this._state.results.filter(r => r.paperId === paperId); },
    getResult(paperId, studentId) { return this._state.results.find(r => r.paperId === paperId && r.studentId === studentId) || null; },
    hasCompleted(paperId, studentId) { return !!this.getResult(paperId, studentId); },

    // ═══════════════════════════════════════
    // FEEDBACK (Background synced)
    // ═══════════════════════════════════════
    getFeedbackList() { return this._state.feedback || []; },
    getFeedback(activityId, studentId) {
        return (this._state.feedback || []).find(f => f.activityId === activityId && f.studentId === studentId) || null;
    },
    getStudentFeedback(studentId) {
        return (this._state.feedback || []).filter(f => f.studentId === studentId);
    },
    async saveFeedback(activityId, studentId, comment, score, totalMarks) {
        let list = [...(this._state.feedback || [])];
        const existingIdx = list.findIndex(f => f.activityId === activityId && f.studentId === studentId);
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], comment, score, totalMarks, updatedAt: new Date().toISOString() };
        } else {
            list.push({ id: this._uid(), activityId, studentId, comment, score: score, totalMarks: totalMarks, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
        this._state.feedback = list;
        try {
            await fetch(`${API_BASE}/data/feedback`, { method: 'POST', headers: this._getAuthHeaders(), body: JSON.stringify(list) });
        } catch (e) { console.error('Feedback sync failed:', e); }
        return this._state.feedback.find(f => f.activityId === activityId && f.studentId === studentId);
    },
    async deleteFeedback(id) {
        const list = (this._state.feedback || []).filter(f => f.id !== id);
        this._state.feedback = list;
        try {
            await fetch(`${API_BASE}/data/feedback`, { method: 'POST', headers: this._getAuthHeaders(), body: JSON.stringify(list) });
        } catch (e) { console.error('Delete feedback sync failed:', e); }
    },

    // ═══════════════════════════════════════
    // MATERIAL BANK
    // ═══════════════════════════════════════
    getMaterials() { return this._state.materials || []; },
    getMaterial(id) { return (this._state.materials || []).find(m => m.id === id) || null; },

    async uploadMaterial(file, meta = {}) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('meta', JSON.stringify(meta));

        const session = JSON.parse(sessionStorage.getItem('active_session') || '{}');
        const res = await fetch(`${API_BASE}/materials/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.token || ''}` },
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
        }

        const result = await res.json();
        if (!this._state.materials) this._state.materials = [];
        this._state.materials.push(result.material);
        return result.material;
    },

    async deleteMaterial(id) {
        const session = JSON.parse(sessionStorage.getItem('active_session') || '{}');
        const res = await fetch(`${API_BASE}/materials/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.token || ''}` }
        });
        if (res.ok) {
            this._state.materials = (this._state.materials || []).filter(m => m.id !== id);
            this._state.materialAssignments = (this._state.materialAssignments || []).filter(a => a.materialId !== id);
        }
        return res.ok;
    },

    // Material Assignments
    getMaterialAssignments() { return this._state.materialAssignments || []; },
    getStudentMaterials(studentId) {
        const assignments = (this._state.materialAssignments || []).filter(
            a => a.studentId === studentId || a.studentId === 'guest'
        );
        return assignments.map(a => this.getMaterial(a.materialId)).filter(Boolean);
    },
    getMaterialAssignmentsForMaterial(materialId) {
        return (this._state.materialAssignments || []).filter(a => a.materialId === materialId);
    },

    assignMaterial(materialId, studentId) {
        const existing = (this._state.materialAssignments || []).find(
            a => a.materialId === materialId && a.studentId === studentId
        );
        if (existing) return existing;

        const assignment = { id: this._uid(), materialId, studentId, assignedAt: new Date().toISOString() };
        const list = [...(this._state.materialAssignments || []), assignment];
        this._state.materialAssignments = list;
        this._saveL('materialAssignments', list);
        return assignment;
    },

    unassignMaterial(materialId, studentId) {
        const list = (this._state.materialAssignments || []).filter(
            a => !(a.materialId === materialId && a.studentId === studentId)
        );
        this._state.materialAssignments = list;
        this._saveL('materialAssignments', list);
    }
};

