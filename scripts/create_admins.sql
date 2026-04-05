-- 0. Admins Table (Isolated from students)
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    raw_password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Insert baseline admin (alphysicsacademy / 20000417)
-- Hash generated earlier: $2b$10$DtcRIwjObTI4gT7cwb8L8.A4DuSu7GNTiiyaEiFzlA8ZuNlFq8Mju
INSERT INTO admins (id, username, password, raw_password, created_at)
VALUES ('admin_primary', 'alphysicsacademy', '$2b$10$DtcRIwjObTI4gT7cwb8L8.A4DuSu7GNTiiyaEiFzlA8ZuNlFq8Mju', '20000417', NOW())
ON CONFLICT (username) DO NOTHING;

-- Cleanup existing admins from students table
DELETE FROM students WHERE type = 'admin';
