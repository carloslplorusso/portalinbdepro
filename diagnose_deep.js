
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnoseDeep() {
    console.log("Diagnosing Deep...");

    // 1. Fetch one full question
    const { data: qData, error: qError } = await supabase.from('questions_bank').select('*').limit(1);
    if (qError) console.error("Error Q:", qError);
    console.log("Full Question Row (id=" + qData[0]?.id + "):", qData[0]);

    // 2. Fetch the linked case for that question
    if (qData[0] && qData[0].clinical_case_id) {
        const cid = qData[0].clinical_case_id;
        const { data: cData, error: cError } = await supabase.from('clinical_cases').select('*').eq('id', cid);
        console.log("Linked Case Row (id=" + cid + "):", cData[0]);
    }
}

diagnoseDeep();
