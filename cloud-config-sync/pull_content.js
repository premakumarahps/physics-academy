const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DATA_DIR = path.join(__dirname, 'content');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

const tableNames = ['landing_config', 'landing_sections', 'site_config', 'dropdowns'];

async function pullData() {
    console.log('☁️ Pulling Configuration Content from Supabase...');
    
    for (const table of tableNames) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            console.error(`❌ Error pulling from ${table}:`, error.message);
            continue;
        }

        const filePath = path.join(DATA_DIR, `${table}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`✅ Synced [${table}] -> ${data.length} records saved to content/${table}.json`);
    }
    
    console.log('🎉 Pull complete! You can now edit the JSON files locally.');
}

pullData();
