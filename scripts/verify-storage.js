
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    console.log('URL:', supabaseUrl);
    console.log('Service Key exists:', !!supabaseServiceKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyStorage() {
    console.log('Verifying Supabase Storage...');

    // List buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('Error listing buckets:', listError);
        return;
    }

    const bucketName = 'chat-attachments';
    const bucket = buckets.find(b => b.name === bucketName);

    if (!bucket) {
        console.error(`Bucket '${bucketName}' NOT found.`);
        console.log('Available buckets:', buckets.map(b => b.name).join(', '));
    } else {
        console.log(`Bucket '${bucketName}' found.`);
        console.log('Bucket details:', bucket);

        // Try to list files in the bucket
        const { data: files, error: filesError } = await supabase.storage
            .from(bucketName)
            .list();

        if (filesError) {
            console.error(`Error listing files in '${bucketName}':`, filesError);
        } else {
            console.log(`Successfully listed files in '${bucketName}'. Count: ${files.length}`);
        }
    }
}

verifyStorage();
