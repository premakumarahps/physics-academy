require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SESSION_TIMEOUT = '1h'; 
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set!');
}

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- Security Middleware ---
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
}

function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
}

// --- Multer Configuration for Cloud ---
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper Functions ---
function mapKeys(obj, type) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => mapKeys(item, type));
    
    const result = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            let newKey = key;
            if (type === 'toCamel') {
                newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            } else if (type === 'toSnake') {
                newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            }
            result[newKey] = obj[key];
        }
    }
    return result;
}

async function uploadToStorage(bucketName, fileName, buffer, contentType) {
    const { data, error } = await supabase.storage.from(bucketName).upload(fileName, buffer, {
        upsert: true,
        contentType: contentType
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    return publicUrl;
}

// --- API Endpoints ---

// Questions
app.get('/api/questions', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(mapKeys(data, 'toCamel'));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/questions', authMiddleware, adminOnly, upload.array('images'), async (req, res) => {
    try {
        if (!req.body.questionData) return res.status(400).json({ error: 'Missing questionData' });
        const questionData = JSON.parse(req.body.questionData);
        const qId = questionData.id;

        const images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const finalName = `${qId}_${Date.now()}_${file.originalname}`;
                const publicUrl = await uploadToStorage('image-bank', finalName, file.buffer, file.mimetype);
                
                const imgRef = (questionData.images && questionData.images.find(img => img.name === file.originalname)) || {};
                images.push({
                    name: file.originalname,
                    position: imgRef.position || 'bottom-center',
                    data: publicUrl,
                    width: imgRef.width || 'auto',
                    marginTop: imgRef.marginTop || '0px',
                    marginRight: imgRef.marginRight || '0px',
                    marginLeft: imgRef.marginLeft || '0px'
                });
            }
        }

        const payload = {
            id: qId,
            type: questionData.type,
            source: questionData.source,
            exam_type: questionData.examType,
            location: questionData.location,
            unit: questionData.unit,
            sub_unit: questionData.subUnit,
            question: questionData.question,
            options: questionData.options,
            correct_answer: questionData.correctAnswer,
            images: images.length > 0 ? images : (questionData.images || []),
            created_at: questionData.createdAt || new Date().toISOString()
        };

        const { error } = await supabase.from('questions').upsert(payload);
        if (error) throw error;

        res.json({ success: true, id: qId, images: payload.images });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/questions/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { error } = await supabase.from('questions').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Question deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generic Data Endpoints
const ENTITY_TABLE_MAP = {
    'students': 'students',
    'papers': 'papers',
    'assignments': 'assignments', // Fixed: mapping correctly
    'results': 'results',
    'config': 'site_config',
    'feedback': 'feedback',
    'materials': 'materials',
    'materialAssignments': 'material_assignments'
};

const ALLOWED_ENTITIES = ['students', 'papers', 'results', 'config', 'feedback', 'materials', 'materialAssignments', 'assignments'];

app.get('/api/data/:entity', async (req, res) => {
    try {
        const entity = req.params.entity;
        if (!ALLOWED_ENTITIES.includes(entity)) return res.status(400).json({ error: 'Invalid entity' });

        // Protect sensitive entities
        const sensitiveEntities = ['students', 'results', 'feedback', 'materialAssignments', 'assignments'];
        if (sensitiveEntities.includes(entity)) {
            // Need a way to run authMiddleware inline or just call its logic
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Unauthorized: Authentication required for this data' });
            }
            try {
                jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
            } catch (err) {
                return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
            }
        }

        const table = ENTITY_TABLE_MAP[entity];

        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;

        const mappedData = mapKeys(data, 'toCamel');
        if (entity === 'config') return res.json(mappedData[0] || {});
        res.json(mappedData || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/data/:entity', authMiddleware, async (req, res) => {
    try {
        const entity = req.params.entity;
        if (!ALLOWED_ENTITIES.includes(entity)) return res.status(400).json({ error: 'Invalid entity' });

        if (['students', 'papers', 'config', 'feedback'].includes(entity) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const table = ENTITY_TABLE_MAP[entity];

        let items = Array.isArray(req.body) ? req.body : [req.body];

        // Hash plaintext student passwords before saving to DB
        if (entity === 'students') {
            items = items.map(s => {
                if (s.password && !s.password.startsWith('$2')) {
                    return { ...s, password: bcrypt.hashSync(s.password, 10) };
                }
                return s;
            });
        }
        
        const mappedItems = mapKeys(items, 'toSnake');

        // Sync deletions: remove rows from DB that are no longer in the submitted array.
        // This ensures that client-side deletions (deleteStudent, deletePaper, etc.) persist
        // in Supabase.
        const skipDeleteSync = ['config'];
        if (Array.isArray(req.body) && !skipDeleteSync.includes(entity)) {
            const submittedIds = mappedItems.map(i => i.id).filter(Boolean);
            if (submittedIds.length > 0) {
                // Fetch existing IDs and delete any that aren't in the submitted array
                const { data: existing } = await supabase.from(table).select('id');
                const toDelete = (existing || []).map(r => r.id).filter(id => !submittedIds.includes(id));
                if (toDelete.length > 0) {
                    await supabase.from(table).delete().in('id', toDelete);
                }
            } else {
                // Empty array submitted = clear all rows in this table
                await supabase.from(table).delete().neq('id', '');
            }
        }

        if (mappedItems.length > 0) {
            const { error } = await supabase.from(table).upsert(mappedItems);
            if (error) throw error;
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dropdowns
app.get('/api/dropdowns', async (req, res) => {
    try {
        const { data, error } = await supabase.from('dropdowns').select('*');
        if (error) throw error;
        const result = {};
        data.forEach(d => result[d.category] = d.options);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/dropdowns', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { category, options } = req.body;
        const { error } = await supabase.from('dropdowns').upsert({ category, options });
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Site Content Endpoints (Landing Page) ---
app.get('/api/site-content/config', async (req, res) => {
    try {
        const { data, error } = await supabase.from('landing_config').select('*').single();
        if (error) throw error;
        
        // Map back to camelCase for the frontend if needed
        const config = {
            siteName: data.site_name,
            tagline: data.tagline,
            phone: data.phone,
            socials: data.socials,
            navLinks: data.nav_links,
            lmsButtonText: data.lms_button_text,
            lmsButtonUrl: data.lms_button_url,
            footerText: data.footer_text
        };
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/site-content/sections', async (req, res) => {
    try {
        const { data, error } = await supabase.from('landing_sections').select('*').order('order_index', { ascending: true });
        if (error) throw error;

        // Map back to format expected by home.js
        const sections = data.map(s => ({
            id: s.id,
            type: s.type,
            heading: s.heading,
            subheading: s.subheading,
            content: s.content,
            image: s.image,
            ctaText: s.cta_text,
            ctaUrl: s.cta_url,
            secondaryCtaText: s.secondary_cta_text,
            secondaryCtaUrl: s.secondary_cta_url,
            stats: s.stats,
            items: s.items,
            images: s.images,
            whatsapp: s.whatsapp,
            email: s.email,
            phone: s.phone,
            address: s.address
        }));
        res.json(sections);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Check Admins table first
        const { data: admin } = await supabase.from('admins').select('*').eq('username', username).maybeSingle();
        if (admin && bcrypt.compareSync(password, admin.password)) {
            const payload = {
                role: 'admin',
                username: admin.username,
                studentId: admin.id,
                name: 'Administrator',
                studentType: 'admin'
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TIMEOUT });
            return res.json({
                success: true,
                role: 'admin',
                username: admin.username,
                studentId: admin.id,
                name: 'Administrator',
                studentType: 'admin',
                token
            });
        }

        // 2. Check Students table fallback
        const { data: user } = await supabase.from('students').select('*').eq('username', username).maybeSingle();
        if (user && bcrypt.compareSync(password, user.password)) {
            const payload = {
                role: 'student',
                username: user.username,
                studentId: user.id,
                name: user.name,
                studentType: user.type || 'guest'
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TIMEOUT });
            return res.json({
                success: true,
                role: 'student',
                username: user.username,
                studentId: user.id,
                name: user.name,
                studentType: payload.studentType,
                token
            });
        }

        res.status(401).json({ success: false, error: 'Invalid username or password' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Logout (In JWT it is client-side, but we keep the endpoint for compatibility)
app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
});

// Guest Self-Registration
app.post('/api/auth/register', async (req, res) => {
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

        // Check if username already exists
        const { data: existing } = await supabase.from('students').select('id').eq('username', username).maybeSingle();
        if (existing) {
            return res.status(409).json({ success: false, error: 'Username already taken' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

        const newStudent = {
            id,
            name: username,
            username,
            password: hashedPassword,
            raw_password: password,
            type: 'guest',
            whatsapp: whatsapp || '',
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('students').insert(newStudent);
        if (error) throw error;

        // Auto-login after registration
        const payload = {
            role: 'student',
            username,
            studentId: id,
            name: username,
            studentType: 'guest'
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TIMEOUT });

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

// Update Admin Credentials
app.post('/api/auth/update-admin', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { currentPassword, newUsername, newPassword } = req.body;
        if (!currentPassword) {
            return res.status(400).json({ success: false, error: 'Current password is required to make changes' });
        }
        if (!newUsername && !newPassword) {
            return res.status(400).json({ success: false, error: 'Nothing to update' });
        }
        if (newPassword && newPassword.length < 4) {
            return res.status(400).json({ success: false, error: 'New password must be at least 4 characters' });
        }
        if (newUsername && newUsername.length < 3) {
            return res.status(400).json({ success: false, error: 'New username must be at least 3 characters' });
        }

        // Find admin user in admins table
        const { data: admin, error: fetchErr } = await supabase.from('admins').select('*').eq('id', req.user.studentId).maybeSingle();
        if (fetchErr || !admin) {
            return res.status(404).json({ success: false, error: 'Admin account not found in admins table' });
        }
        if (!bcrypt.compareSync(currentPassword, admin.password)) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        const updates = {};
        if (newUsername) updates.username = newUsername;
        if (newPassword) {
            updates.password = bcrypt.hashSync(newPassword, 10);
            updates.raw_password = newPassword;
        }

        const { error } = await supabase.from('admins').update(updates).eq('id', admin.id);
        if (error) {
            if (error.code === '23505') return res.status(409).json({ success: false, error: 'Username already taken' });
            throw error;
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Material Uploads
app.post('/api/materials/upload', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const meta = req.body.meta ? JSON.parse(req.body.meta) : {};
        const fileName = `${Date.now()}_${req.file.originalname}`;
        
        const publicUrl = await uploadToStorage('material-bank', fileName, req.file.buffer, req.file.mimetype);

        const material = {
            id: `mat_${Date.now()}`,
            name: meta.name || req.file.originalname,
            description: meta.description || '',
            category: meta.category || 'general',
            file_name: fileName,
            original_name: req.file.originalname,
            mime_type: req.file.mimetype,
            size_bytes: req.file.size,
            url: publicUrl,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('materials').upsert(material);
        if (error) throw error;

        res.json({ success: true, material: mapKeys(material, 'toCamel') });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Material
app.delete('/api/materials/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const id = req.params.id;

        // Get material to find file name for storage cleanup
        const { data: mat } = await supabase.from('materials').select('*').eq('id', id).maybeSingle();
        if (!mat) return res.status(404).json({ error: 'Material not found' });

        // Delete file from Supabase Storage
        if (mat.file_name) {
            await supabase.storage.from('material-bank').remove([mat.file_name]);
        }

        // Delete from DB
        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) throw error;

        // Also remove related material assignments
        await supabase.from('material_assignments').delete().eq('material_id', id);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Export for Vercel
module.exports = app;
