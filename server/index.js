require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds

// Middleware - Security Headers
app.use((req, res, next) => {
    // Restrict CORS to localhost only (allow any localhost port for development)
    const origin = req.headers.origin;
    if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.header('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: http: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;");
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
// ─── Security: Protect JSON data files ───
app.use((req, res, next) => {
    if (req.path.endsWith('.json') && !req.path.includes('/api/')) {
        return res.status(403).json({ error: 'Access to data files is restricted.' });
    }
    next();
});

// Serve project root for HTML, CSS, JS and template files
// NOTE: home.html is the new default landing page; LMS login is at /index.html
app.use(express.static(path.join(__dirname, '..'), { index: 'home.html' }));

// Specific public folders in uploads
app.use('/uploads/image_bank', express.static(path.join(__dirname, 'uploads', 'image_bank')));
app.use('/uploads/material_bank', express.static(path.join(__dirname, 'uploads', 'material_bank')));

// ─── Site content images (public) ───
app.use('/site-images', express.static(path.join(__dirname, 'uploads', 'site_content', 'images')));

// NOTE: We no longer serve the whole /uploads directory.
// Question bank JSONs and root-level config JSONs are now protected.
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const Q_BANK_DIR = path.join(UPLOADS_DIR, 'question_bank');
const MATERIAL_BANK_DIR = path.join(UPLOADS_DIR, 'material_bank');
const SITE_CONTENT_DIR = path.join(UPLOADS_DIR, 'site_content');

// Ensure required directories exist
[MATERIAL_BANK_DIR, SITE_CONTENT_DIR, path.join(SITE_CONTENT_DIR, 'images')].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Simple in-memory session store with expiration
// Maps token -> { role, username, studentId: optional, expiresAt }
const sessions = new Map();

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        if (session.expiresAt && now > session.expiresAt) {
            sessions.delete(token);
        }
    }
}, 60000); // Check every minute

// Helper: Authentication Middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const session = sessions.get(token);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    // Check if session has expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Unauthorized: Session expired' });
    }
    req.user = session;
    next();
}

// Helper: Admin Only Middleware
function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
}

// Helper: Validate request body is not empty
function validateRequestBody(req, res) {
    if (!req.body || (typeof req.body === 'string' && req.body.trim() === '')) {
        res.status(400).json({ error: 'Request body cannot be empty' });
        return false;
    }
    return true;
}

// Helper: Validate JSON payload size
function validatePayloadSize(payload, maxSizeMB = 100) {
    const sizeInBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    const sizeInMB = sizeInBytes / (1024 * 1024);
    return sizeInMB <= maxSizeMB;
}

// Helper: Validate JSON structure
function validateJSONStructure(data, expectedType = 'object') {
    if (expectedType === 'array' && !Array.isArray(data)) return false;
    if (expectedType === 'object' && (Array.isArray(data) || typeof data !== 'object')) return false;
    return true;
}

// Helper: Sanitize for filenames (keep only safe characters)
function sanitize(str) {
    if (!str) return '';
    return str.toString()
        .replace(/[^a-z0-9_\-\.]/gi, '')
        .trim();
}

// Ensure uploads directories exist
const uploadDirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'image_bank'),
    path.join(__dirname, 'uploads', 'question_bank')
];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize default admin if not exists
const adminFile = path.join(__dirname, 'uploads', 'admin.json');
if (!fs.existsSync(adminFile)) {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
    const defaultAdmin = {
        username: defaultUsername,
        password: hashedPassword
    };
    fs.writeFileSync(adminFile, JSON.stringify(defaultAdmin, null, 2));
    console.log(`Default admin created: username=${defaultUsername}`);
    console.log('⚠️  IMPORTANT: Change the default password immediately in admin settings!');
} else {
    // Upgrade existing plaintext passwords to hashed (one-time migration)
    const adminData = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
    if (adminData.password && !adminData.password.startsWith('$2')) {
        console.log('Upgrading admin password to hashed format...');
        adminData.password = bcrypt.hashSync(adminData.password, 10);
        fs.writeFileSync(adminFile, JSON.stringify(adminData, null, 2));
    }
}

// Migrate existing student passwords from plaintext to hashed
const studentsFile = path.join(__dirname, 'uploads', 'students.json');
if (fs.existsSync(studentsFile)) {
    try {
        const students = JSON.parse(fs.readFileSync(studentsFile, 'utf8'));
        let needsMigration = false;
        const migratedStudents = students.map(s => {
            if (s.password && !s.password.startsWith('$2')) {
                needsMigration = true;
                return { ...s, password: bcrypt.hashSync(s.password, 10) };
            }
            return s;
        });
        if (needsMigration) {
            fs.writeFileSync(studentsFile, JSON.stringify(migratedStudents, null, 2));
            console.log('✓ Student passwords upgraded to hashed format');
        }
    } catch (e) {
        console.error('Warning: Could not migrate student passwords:', e.message);
    }
}

// Initialize default config if not exists
const configFile = path.join(__dirname, 'uploads', 'config.json');
if (!fs.existsSync(configFile)) {
    const defaultConfig = {
        paperSubject: 'MCQ Paper',
        markingScheme: '+1 per correct',
        instructions: [
            'This paper contains multiple choice questions (MCQs).',
            'Each question has <strong>five</strong> answer choices.',
            'Select <strong>only one</strong> answer for each question.',
            'There is <strong>no negative marking</strong>.',
            'The paper will auto-submit when time runs out.',
            'After submission, you can review corrections and download as PDF.'
        ],
        welcomeHint: 'Click start when you are ready. Good luck!'
    };
    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
}

// Configure Multer with memory storage — files are written manually with correct names in the handler
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
    fileFilter: fileFilter
});

// Material uploads — allow PDFs, images, docs (up to 25MB)
const materialFileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: PDF, images, Word, PowerPoint, text.'), false);
    }
};

const materialUpload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
    fileFilter: materialFileFilter
});

// --- API Endpoints ---

// Questions (Protected)
app.get('/api/questions', authMiddleware, (req, res) => {
    try {
        const qBankDir = path.join(__dirname, 'uploads', 'question_bank');
        const files = fs.readdirSync(qBankDir).filter(f => f.endsWith('.json'));

        const questions = files.map(file => {
            const raw = fs.readFileSync(path.join(qBankDir, file), 'utf8');
            return JSON.parse(raw);
        });

        res.json(questions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/questions', authMiddleware, adminOnly, upload.array('images'), (req, res) => {
    try {
        if (!req.body.questionData) {
            return res.status(400).json({ error: 'Missing questionData in request' });
        }

        let questionData;
        try {
            questionData = JSON.parse(req.body.questionData);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON in questionData' });
        }

        // Validate payload size
        if (!validatePayloadSize(questionData, 100)) {
            return res.status(413).json({ error: 'Question data too large (max 100MB)' });
        }

        // Validate question object structure
        if (typeof questionData !== 'object' || !questionData.id) {
            return res.status(400).json({ error: 'Invalid question structure' });
        }

        const qId = path.basename(questionData.id);
        const qBankDir = path.join(__dirname, 'uploads', 'question_bank');
        const imgBankDir = path.join(__dirname, 'uploads', 'image_bank');
        const filePath = path.join(qBankDir, `${qId}.json`);

        // Validate required fields for new questions
        const isNewQuestion = !fs.existsSync(filePath);
        if (isNewQuestion) {
            if (!questionData.question || !questionData.options || !questionData.correctAnswer) {
                return res.status(400).json({ error: 'Missing required fields: question, options, correctAnswer' });
            }
        }

        const images = [];

        // Write uploaded files to disk with Q_Render style names: q_XX_originalname.ext
        // Note: multer memoryStorage stores files as buffers (file.buffer), not on disk
        if (req.files && req.files.length > 0) {
            req.files.forEach((file, index) => {
                const safeName = sanitize(file.originalname) || 'image.png';
                const finalName = `${qId}_${safeName}`;
                const newPath = path.join(imgBankDir, finalName);

                // Write the in-memory buffer to disk with the proper Q_Render name
                try {
                    fs.writeFileSync(newPath, file.buffer);
                    file.filename = finalName;
                    file.path = newPath;
                    console.log(`[IMAGE] Saved: ${finalName}`);
                } catch (err) {
                    console.error(`Warning: Could not save image ${file.originalname} as ${finalName}:`, err.message);
                }

                const imgRef = (questionData.images && questionData.images.find(img => img.name === file.originalname)) || (questionData.images && questionData.images[index]) || {};
                const newImg = {
                    name: file.originalname,
                    position: imgRef.position || 'bottom-center',
                    data: `/uploads/image_bank/${finalName}`,
                    width: imgRef.width || 'auto',
                    marginTop: imgRef.marginTop || '0px',
                    marginRight: imgRef.marginRight || '0px',
                    marginLeft: imgRef.marginLeft || '0px'
                };
                images.push(newImg);
            });
        }

        // For updates, preserve existing images if no new images uploaded
        if (!req.files || req.files.length === 0) {
            if (fs.existsSync(filePath)) {
                const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (existing.images && existing.images.length > 0 && !questionData.images) {
                    questionData.images = existing.images;
                }
            }
        }

        // Write the question file (simple overwrite — ID never changes)
        const savedData = { ...questionData, images: images.length > 0 ? images : (questionData.images || []) };
        fs.writeFileSync(filePath, JSON.stringify(savedData, null, 2));
        console.log(`[WRITE] File written to: ${filePath}`);

        res.json({ success: true, id: questionData.id, images: savedData.images });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/questions/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const id = path.basename(req.params.id);
        const qBankDir = path.join(__dirname, 'uploads', 'question_bank');
        const imgBankDir = path.join(__dirname, 'uploads', 'image_bank');
        const questionFile = path.join(qBankDir, `${id}.json`);

        if (fs.existsSync(questionFile)) {
            try {
                // Read question to find associated images
                const raw = fs.readFileSync(questionFile, 'utf8');
                const data = JSON.parse(raw);

                // Delete associated images
                if (data.images && Array.isArray(data.images)) {
                    data.images.forEach(img => {
                        try {
                            // Handle both URL strings and objects
                            const imgData = typeof img === 'string' ? img : (img && img.data);
                            if (!imgData) return;

                            // Extract filename from the URL 
                            // e.g. "http://localhost:3000/uploads/image_bank/12345-circuit.png" -> "12345-circuit.png"
                            const urlParts = imgData.split('/');
                            const filename = urlParts[urlParts.length - 1];
                            const imgPath = path.join(imgBankDir, filename);

                            if (fs.existsSync(imgPath)) {
                                fs.unlinkSync(imgPath);
                                console.log(`Deleted image: ${filename}`);
                            }
                        } catch (imgErr) {
                            console.error(`Warning: Failed to delete image ${img}:`, imgErr.message);
                            // Don't fail the whole delete if one image deletion fails
                        }
                    });
                }
            } catch (parseErr) {
                console.error('Warning: Could not read question file to delete images:', parseErr.message);
            }

            // Delete the JSON file itself
            try {
                fs.unlinkSync(questionFile);
                console.log(`Deleted question file: ${id}.json`);
            } catch (fileErr) {
                console.error('Error deleting question file:', fileErr.message);
                return res.status(500).json({ error: 'Failed to delete question file: ' + fileErr.message });
            }
        } else {
            return res.status(404).json({ error: 'Question not found' });
        }

        res.json({ success: true, message: 'Question and associated images deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dropdowns
const dropdownsFile = path.join(__dirname, 'uploads', 'dropdowns.json');

app.get('/api/dropdowns', (req, res) => {
    try {
        if (!fs.existsSync(dropdownsFile)) {
            return res.json({}); // Will fallback to defaults on frontend
        }
        const raw = fs.readFileSync(dropdownsFile, 'utf8');
        res.json(JSON.parse(raw));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/dropdowns', authMiddleware, adminOnly, (req, res) => {
    try {
        if (!validateRequestBody(req, res)) return;
        const { category, options } = req.body;

        if (!category || !Array.isArray(options)) {
            return res.status(400).json({ error: 'Invalid category or options format' });
        }

        let existing = {};
        if (fs.existsSync(dropdownsFile)) {
            existing = JSON.parse(fs.readFileSync(dropdownsFile, 'utf8'));
        }

        existing[category] = options;
        fs.writeFileSync(dropdownsFile, JSON.stringify(existing, null, 2));

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══ Material Bank API ═══
app.post('/api/materials/upload', authMiddleware, adminOnly, materialUpload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const meta = req.body.meta ? JSON.parse(req.body.meta) : {};
        const timestamp = Date.now();
        const safeName = sanitize(req.file.originalname) || 'file';
        const finalName = `${timestamp}_${safeName}`;
        const filePath = path.join(MATERIAL_BANK_DIR, finalName);

        fs.writeFileSync(filePath, req.file.buffer);
        console.log(`[MATERIAL] Uploaded: ${finalName} (${(req.file.size / 1024).toFixed(1)} KB)`);

        const material = {
            id: `mat_${timestamp}`,
            name: meta.name || req.file.originalname,
            description: meta.description || '',
            category: meta.category || 'general',
            fileName: finalName,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            url: `/uploads/material_bank/${finalName}`,
            createdAt: new Date().toISOString()
        };

        // Append to materials.json
        const materialsFile = path.join(UPLOADS_DIR, 'materials.json');
        let materials = [];
        if (fs.existsSync(materialsFile)) {
            materials = JSON.parse(fs.readFileSync(materialsFile, 'utf8'));
        }
        materials.push(material);
        fs.writeFileSync(materialsFile, JSON.stringify(materials, null, 2));

        res.json({ success: true, material });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/materials/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const id = req.params.id;
        const materialsFile = path.join(UPLOADS_DIR, 'materials.json');
        if (!fs.existsSync(materialsFile)) return res.status(404).json({ error: 'Not found' });

        let materials = JSON.parse(fs.readFileSync(materialsFile, 'utf8'));
        const mat = materials.find(m => m.id === id);
        if (!mat) return res.status(404).json({ error: 'Material not found' });

        // Delete file from disk
        const filePath = path.join(MATERIAL_BANK_DIR, mat.fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        materials = materials.filter(m => m.id !== id);
        fs.writeFileSync(materialsFile, JSON.stringify(materials, null, 2));

        // Also remove related material assignments
        const maFile = path.join(UPLOADS_DIR, 'materialAssignments.json');
        if (fs.existsSync(maFile)) {
            let ma = JSON.parse(fs.readFileSync(maFile, 'utf8'));
            ma = ma.filter(a => a.materialId !== id);
            fs.writeFileSync(maFile, JSON.stringify(ma, null, 2));
        }

        console.log(`[MATERIAL] Deleted: ${mat.fileName}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generic Data Endpoints for Students, Papers, Assignments, Results, Config
const ALLOWED_ENTITIES = ['students', 'papers', 'assignments', 'results', 'config', 'feedback', 'materials', 'materialAssignments'];

app.get('/api/data/:entity', (req, res) => {
    try {
        const entity = path.basename(req.params.entity);
        if (!ALLOWED_ENTITIES.includes(entity)) {
            return res.status(400).json({ error: 'Invalid entity' });
        }

        const filePath = path.join(__dirname, 'uploads', `${entity}.json`);
        if (!fs.existsSync(filePath)) {
            return res.json([]); // Return empty array by default
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(raw));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/data/:entity', authMiddleware, (req, res) => {
    try {
        if (!validateRequestBody(req, res)) return;

        const entity = path.basename(req.params.entity);
        if (!ALLOWED_ENTITIES.includes(entity)) {
            return res.status(400).json({ error: 'Invalid entity' });
        }

        // Only admins can modify students, papers, assignments, config, and feedback
        // Students are allowed to modify results
        if (['students', 'papers', 'assignments', 'config', 'feedback'].includes(entity) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Validate payload size
        if (!validatePayloadSize(req.body, 100)) {
            return res.status(413).json({ error: 'Payload too large (max 100MB)' });
        }

        // Validate data format
        const expectedType = entity === 'config' ? 'object' : 'array';
        if (!validateJSONStructure(req.body, expectedType)) {
            return res.status(400).json({ error: `Invalid format: ${entity} should be ${expectedType}` });
        }

        // Hash student passwords before saving
        let dataToSave = req.body;
        if (entity === 'students' && Array.isArray(req.body)) {
            dataToSave = req.body.map(student => {
                if (student.password && !student.password.startsWith('$2')) {
                    // Hash plaintext password
                    return { ...student, password: bcrypt.hashSync(student.password, 10) };
                }
                return student;
            });
        }

        const filePath = path.join(__dirname, 'uploads', `${entity}.json`);
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Batch-rename endpoint removed — IDs are now stable (q_XX)
// Metadata changes (unit, examType, etc.) update JSON content only, not filenames

// Authentication (Admin & Student)
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        // 1. Check Admin
        const adminFile = path.join(__dirname, 'uploads', 'admin.json');
        if (fs.existsSync(adminFile)) {
            const adminData = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
            if (username === adminData.username && bcrypt.compareSync(password, adminData.password)) {
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = Date.now() + SESSION_TIMEOUT;
                sessions.set(token, { role: 'admin', username, expiresAt });
                return res.json({ success: true, role: 'admin', username, token });
            }
        }

        // 2. Check Students
        const studentsFile = path.join(__dirname, 'uploads', 'students.json');
        if (fs.existsSync(studentsFile)) {
            const students = JSON.parse(fs.readFileSync(studentsFile, 'utf8'));
            const student = students.find(s => s.username === username && bcrypt.compareSync(password, s.password));
            if (student) {
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = Date.now() + SESSION_TIMEOUT;
                sessions.set(token, { role: 'student', username: student.username, studentId: student.id, expiresAt });
                return res.json({
                    success: true,
                    role: 'student',
                    username: student.username,
                    studentId: student.id,
                    name: student.name,
                    studentType: student.type || 'guest',
                    token
                });
            }
        }

        res.status(401).json({ success: false, error: 'Invalid username or password' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Guest Student Self-Registration
app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password, whatsapp } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
        }

        if (password.length < 4) {
            return res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
        }

        // Check admin username conflict
        const adminFile = path.join(__dirname, 'uploads', 'admin.json');
        if (fs.existsSync(adminFile)) {
            const adminData = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
            if (username === adminData.username) {
                return res.status(409).json({ success: false, error: 'Username already taken' });
            }
        }

        // Check student username uniqueness
        const studentsFile = path.join(__dirname, 'uploads', 'students.json');
        let students = [];
        if (fs.existsSync(studentsFile)) {
            students = JSON.parse(fs.readFileSync(studentsFile, 'utf8'));
        }

        if (students.find(s => s.username === username)) {
            return res.status(409).json({ success: false, error: 'Username already taken' });
        }

        // Create guest student
        const hashedPassword = bcrypt.hashSync(password, 10);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const newStudent = {
            id,
            name: username,
            username,
            password: hashedPassword,
            rawPassword: password,
            type: 'guest',
            whatsapp: whatsapp || '',
            createdAt: new Date().toISOString()
        };

        students.push(newStudent);
        fs.writeFileSync(studentsFile, JSON.stringify(students, null, 2));
        console.log(`[REGISTER] New guest student: ${username}`);

        // Auto-login
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + SESSION_TIMEOUT;
        sessions.set(token, { role: 'student', username, studentId: id, expiresAt });

        res.json({
            success: true,
            role: 'student',
            username,
            studentId: id,
            name: username,
            studentType: 'guest',
            token
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
    try {
        // Get token from header and remove from sessions
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            sessions.delete(token);
        }
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Admin Password Change
app.post('/api/auth/change-password', authMiddleware, adminOnly, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
        }

        if (newPassword.length < 4) {
            return res.status(400).json({ success: false, error: 'New password must be at least 4 characters' });
        }

        const adminFile = path.join(__dirname, 'uploads', 'admin.json');
        const adminData = JSON.parse(fs.readFileSync(adminFile, 'utf8'));

        // Verify current password
        if (!bcrypt.compareSync(currentPassword, adminData.password)) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        // Hash and save new password
        adminData.password = bcrypt.hashSync(newPassword, 10);
        fs.writeFileSync(adminFile, JSON.stringify(adminData, null, 2));

        console.log('✓ Admin password changed successfully');
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ═══ Site Content API (public read, admin write) ═══
const SITE_CONFIG_FILE = path.join(SITE_CONTENT_DIR, 'site_config.json');
const SITE_SECTIONS_FILE = path.join(SITE_CONTENT_DIR, 'sections.json');

app.get('/api/site-content/config', (req, res) => {
    try {
        if (!fs.existsSync(SITE_CONFIG_FILE)) return res.json({});
        res.json(JSON.parse(fs.readFileSync(SITE_CONFIG_FILE, 'utf8')));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/site-content/sections', (req, res) => {
    try {
        if (!fs.existsSync(SITE_SECTIONS_FILE)) return res.json([]);
        res.json(JSON.parse(fs.readFileSync(SITE_SECTIONS_FILE, 'utf8')));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/site-content/config', authMiddleware, adminOnly, (req, res) => {
    try {
        if (!validateRequestBody(req, res)) return;
        fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/site-content/sections', authMiddleware, adminOnly, (req, res) => {
    try {
        if (!validateRequestBody(req, res)) return;
        fs.writeFileSync(SITE_SECTIONS_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Upload site content images (admin only)
app.post('/api/site-content/images', authMiddleware, adminOnly, upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        const safeName = sanitize(req.body.name || req.file.originalname) || 'image.png';
        const imgPath = path.join(SITE_CONTENT_DIR, 'images', safeName);
        fs.writeFileSync(imgPath, req.file.buffer);
        res.json({ success: true, url: `/site-images/${safeName}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Local backend server running on http://localhost:${PORT}`);
});
