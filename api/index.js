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
const JWT_SECRET = process.env.JWT_SECRET || 'al-physics-academy-secret-2026';

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
        res.json(data);
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
    'assignments': 'material_assignments', // Wait, let's fix this in the frontend mapping
    'results': 'results',
    'config': 'site_config',
    'feedback': 'feedback',
    'materials': 'materials',
    'materialAssignments': 'material_assignments'
};

// Re-mapping for paper-student assignments specifically if needed
// Actually, 'assignments' in papers.json are stored in a separate table in Supabase.
// Let's use simple table names in current logic mapping:
const ALLOWED_ENTITIES = ['students', 'papers', 'results', 'config', 'feedback', 'materials', 'materialAssignments'];

app.get('/api/data/:entity', async (req, res) => {
    try {
        const entity = req.params.entity;
        if (!ALLOWED_ENTITIES.includes(entity)) return res.status(400).json({ error: 'Invalid entity' });

        const table = entity === 'config' ? 'site_config' : 
                     entity === 'materialAssignments' ? 'material_assignments' : entity;

        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;

        // Map back from snake_case to camelCase for the frontend if needed
        // Or return as is if frontend handles it (frontend uses getStudents() etc.)
        if (entity === 'config') return res.json(data[0] || {});
        res.json(data || []);
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

        const table = entity === 'config' ? 'site_config' : 
                     entity === 'materialAssignments' ? 'material_assignments' : entity;

        // Upsert the entire array or single object
        const items = Array.isArray(req.body) ? req.body : [req.body];
        
        // Note: Supabase upsert works best with a single call. 
        // For larger arrays, it's fine.
        const { error } = await supabase.from(table).upsert(items);
        if (error) throw error;

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
            lms_buttonUrl: data.lms_button_url,
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

        const { data: user, error } = await supabase.from('students').select('*').eq('username', username).single();
        if (user && bcrypt.compareSync(password, user.password)) {
            const payload = {
                role: user.type === 'admin' ? 'admin' : 'student',
                username: user.username,
                studentId: user.id,
                name: user.name,
                studentType: user.type || 'guest'
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TIMEOUT });
            return res.json({
                success: true,
                role: payload.role,
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

        res.json({ success: true, material });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Export for Vercel
module.exports = app;
