
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://sirfbpjysvceqbbxvirw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmZicGp5c3ZjZXFiYnh2aXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTk5MzUsImV4cCI6MjA3NDk3NTkzNX0.XEV6tEHO6ilf3PHqNLvoCK6EZRwkDRgusNGrBr5LlIk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpload() {
    console.log('Testing anonymous upload...');
    const fileName = `test-${Date.now()}.txt`;
    const content = 'Hello World';

    const { data, error } = await supabase.storage
        .from('assignment-attachments')
        .upload(`test/${fileName}`, content);

    if (error) {
        console.error('Upload failed:', error);
    } else {
        console.log('Upload successful:', data);
    }
}

testUpload();
