require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('--- Starting Admin Migration ---');

    try {
        // 1. Ensure admins table exists (SQL executed via RPC or handled by schema)
        // Since we can't run arbitrary SQL via the client without an RPC, 
        // we'll assume the table exists or was created via the Supabase dashboard.
        // However, we can try to select from it to check.
        console.log('Checking for admins table...');
        const { error: tableError } = await supabase.from('admins').select('id').limit(1);
        
        if (tableError && tableError.code === '42P01') {
            console.error('Table "admins" does not exist. Please run the SQL in supabase_schema.sql first.');
            process.exit(1);
        }

        // 2. Insert the requested admin
        const adminUsername = 'alphysicsacademy';
        const adminPassword = '20000417';
        const hashedPassword = bcrypt.hashSync(adminPassword, 10);

        console.log(`Checking if admin "${adminUsername}" exists...`);
        const { data: existingAdmin } = await supabase
            .from('admins')
            .select('id')
            .eq('username', adminUsername)
            .maybeSingle();

        if (!existingAdmin) {
            console.log(`Inserting admin "${adminUsername}"...`);
            const { error: insertError } = await supabase.from('admins').insert({
                id: 'admin_primary',
                username: adminUsername,
                password: hashedPassword,
                raw_password: adminPassword,
                created_at: new Date().toISOString()
            });

            if (insertError) throw insertError;
            console.log('Admin inserted successfully.');
        } else {
            console.log('Admin already exists. Skipping insertion.');
        }

        // 3. Clean up students table (remove admin types)
        console.log('Cleaning up "admin" types from students table...');
        const { error: deleteError } = await supabase
            .from('students')
            .delete()
            .eq('type', 'admin');

        if (deleteError) {
            console.warn('Cleanup warning (non-critical):', deleteError.message);
        } else {
            console.log('Cleanup successful.');
        }

        console.log('--- Migration Completed Successfully ---');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
