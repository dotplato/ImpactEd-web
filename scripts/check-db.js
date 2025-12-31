const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttachments() {
    const { data, error } = await supabase
        .from('quiz_submission_attachments')
        .select('*');

    if (error) {
        console.error('Error fetching attachments:', error);
    } else {
        console.log('Attachments in database:', JSON.stringify(data, null, 2));
    }

    const { data: submissions, error: subError } = await supabase
        .from('quiz_submissions')
        .select('id, quiz_id, student_id');

    if (subError) {
        console.error('Error fetching submissions:', subError);
    } else {
        console.log('Submissions in database:', JSON.stringify(submissions, null, 2));
    }
}

checkAttachments();
