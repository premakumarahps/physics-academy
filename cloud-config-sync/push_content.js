const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DATA_DIR = path.join(__dirname, 'content');

const tableNames = ['landing_config', 'landing_sections', 'site_config', 'dropdowns'];

async function pushData() {
    console.log('☁️ Pushing Configuration Content to Supabase...');
    
    for (const table of tableNames) {
        const filePath = path.join(DATA_DIR, `${table}.json`);
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ Skipping [${table}] - Document not found.`);
            continue;
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const items = JSON.parse(rawData);

        if (items.length > 0) {
            const { error } = await supabase.from(table).upsert(items);
            if (error) {
                console.error(`❌ Error pushing to ${table}:`, error.message);
            } else {
                console.log(`✅ Pushed [${table}] -> ${items.length} records synced to Cloud.`);
            }
        }
    }
    
    console.log('🎉 Push complete! The Cloud has been updated with your local edits.');
}

pushData();
