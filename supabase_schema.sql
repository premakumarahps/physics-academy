-- AL Physics Academy Database Schema

-- 0. Admins Table (Isolated from students)
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    raw_password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    raw_password TEXT, -- optional, if keeping legacy data
    type TEXT DEFAULT 'guest',
    whatsapp TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Papers Table
CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    timer_minutes INTEGER DEFAULT 120,
    question_ids JSONB DEFAULT '[]',
    activity_type TEXT DEFAULT 'paper',
    description TEXT,
    due_date TIMESTAMPTZ,
    max_attempts INTEGER DEFAULT 1,
    total_marks INTEGER,
    is_timer_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'MCQ',
    source TEXT,
    exam_type TEXT,
    location JSONB DEFAULT '{}',
    unit TEXT,
    sub_unit TEXT,
    question TEXT NOT NULL,
    options JSONB DEFAULT '{}',
    correct_answer TEXT,
    images JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Results Table
CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY,
    paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
    answers JSONB DEFAULT '{}',
    score NUMERIC,
    total NUMERIC,
    percentage INTEGER,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Materials Table
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    file_name TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Material Assignments Table
CREATE TABLE IF NOT EXISTS material_assignments (
    id TEXT PRIMARY KEY,
    material_id TEXT REFERENCES materials(id) ON DELETE CASCADE,
    student_id TEXT, -- Note: Can be specific student ID or 'guest'
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.5 Paper Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
    student_id TEXT, 
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Config Table (Single Row)
CREATE TABLE IF NOT EXISTS site_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    paper_subject TEXT,
    marking_scheme TEXT,
    instructions JSONB DEFAULT '[]',
    welcome_hint TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Dropdowns Table
CREATE TABLE IF NOT EXISTS dropdowns (
    category TEXT PRIMARY KEY,
    options JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    activity_id TEXT,
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
    comment TEXT,
    score NUMERIC,
    total_marks NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Landing Page Config Table
CREATE TABLE IF NOT EXISTS landing_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    site_name TEXT,
    tagline TEXT,
    phone TEXT,
    socials JSONB DEFAULT '{}',
    nav_links JSONB DEFAULT '[]',
    lms_button_text TEXT,
    lms_button_url TEXT,
    footer_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Landing Page Sections Table
CREATE TABLE IF NOT EXISTS landing_sections (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    heading TEXT,
    subheading TEXT,
    content TEXT,
    image TEXT,
    cta_text TEXT,
    cta_url TEXT,
    secondary_cta_text TEXT,
    secondary_cta_url TEXT,
    stats JSONB DEFAULT '[]',
    items JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    whatsapp TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- INDEXES FOR PERFORMANCE ---
CREATE INDEX IF NOT EXISTS idx_results_paper_id ON results(paper_id);
CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_material_assignments_student_id ON material_assignments(student_id);

-- --- SECURITY (RLS) ---
-- Enable RLS on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_sections ENABLE ROW LEVEL SECURITY;

-- Note: For now, we will use the Service Role key for all backend operations (Serverless Functions),
-- so RLS will be bypassed by the backend. This is the simplest migration path.
