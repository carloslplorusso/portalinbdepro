
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCardinality() {
    console.log("Checking Question-to-Case Cardinality...");

    // Fetch all active questions with their clinical_case_id
    const { data: questions, error } = await supabase
        .from('questions_bank')
        .select('id, clinical_case_id, category')
        .eq('is_active', true);

    if (error) {
        console.error("Error:", error);
        return;
    }

    const counts = {}; // Map<clinical_case_id, count>
    const caseExamples = {}; // Map<clinical_case_id, questionExample>

    questions.forEach(q => {
        if (q.clinical_case_id) {
            counts[q.clinical_case_id] = (counts[q.clinical_case_id] || 0) + 1;
            if (!caseExamples[q.clinical_case_id]) {
                caseExamples[q.clinical_case_id] = q.id;
            }
        }
    });

    let singleQuestionCases = 0;
    let multiQuestionCases = 0;

    // Analyze distribution
    const frequency = {}; // Map<groupSize, numberOfGroups>

    Object.values(counts).forEach(c => {
        if (c === 1) singleQuestionCases++;
        else multiQuestionCases++;

        frequency[c] = (frequency[c] || 0) + 1;
    });

    console.log(`Total Questions linked to a Case: ${questions.length}`);
    console.log(`Cases with EXACTLY 1 Question (Probable Standalone Vignettes): ${singleQuestionCases} (Covering ${singleQuestionCases} questions)`);
    console.log(`Cases with > 1 Question (Item Sets): ${multiQuestionCases} (Covering ${questions.length - singleQuestionCases} questions)`);

    console.log("\nGroup Size Frequency:");
    console.table(frequency);

    // Also let's check if the previous filter (scenario linked) overlaps with these
    // Fetch a sample of Single-Question Cases and see if they have scenario_text
    // We'll pick first 5 IDs
    const sampleSingleIDs = Object.keys(counts).filter(k => counts[k] === 1).slice(0, 5);

    if (sampleSingleIDs.length > 0) {
        const { data: cases } = await supabase.from('clinical_cases').select('id, scenario_text').in('id', sampleSingleIDs);
        console.log("\nSample 1-to-1 Cases content check:");
        cases.forEach(c => {
            console.log(`Case ${c.id}: Has Scenario Text? ${c.scenario_text ? 'YES (' + c.scenario_text.slice(0, 30) + ' ...)' : 'NO'}`);
        });
    }
}

checkCardinality();
