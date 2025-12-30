
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

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
