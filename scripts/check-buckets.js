
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sirfbpjysvceqbbxvirw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmZicGp5c3ZjZXFiYnh2aXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTM5OTkzNSwiZXhwIjoyMDc0OTc1OTM1fQ.9RX24WQgmYm8T802Z1mnFIYQ0IJ-wyRD_29TvujGydw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyAllBuckets() {
    console.log('Verifying all Supabase Storage buckets...');

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('Error listing buckets:', listError);
        return;
    }

    console.log('Available buckets:', buckets.map(b => b.name).join(', '));

    const requiredBuckets = ['chat-attachments', 'assignment-attachments', 'submission-attachments', 'avatars'];

    for (const name of requiredBuckets) {
        const bucket = buckets.find(b => b.name === name);
        if (!bucket) {
            console.error(`Bucket '${name}' NOT found.`);
        } else {
            console.log(`Bucket '${name}' found. Public: ${bucket.public}`);
        }
    }
}

verifyAllBuckets();
