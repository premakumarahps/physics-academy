// Quick fix: Update the lmsButtonUrl in Supabase from /index.html to /login.html
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    console.log('Updating lms_button_url in landing_config...');
    const { error } = await supabase
        .from('landing_config')
        .update({ lms_button_url: '/login.html' })
        .eq('id', 1);
    
    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Fixed! lms_button_url is now /login.html');
    }
}

fix();
