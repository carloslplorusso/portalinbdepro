// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allQuizzes = [];
let currentUser = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    initCountdown();
});

_supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") showRecoveryAlert();
});

async function initApp() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        // Modo prueba si no hay login
        currentUser = { id: 'test-user', user_metadata: { full_name: 'Test Doctor' }, email: 'test@inbde.com' };
    } else {
        currentUser = session.user;
    }
    
    const nameDisplay = document.getElementById('user-name-display');
    if(nameDisplay) nameDisplay.innerText = currentUser.user_metadata.full_name || 'Doctor';

    await loadData();
}

async function loadData() {
    try {
        const { data, error } = await _supabase
            .from('questions_bank')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw error;
        allQuizzes = data;
        console.log("Datos cargados:", allQuizzes.length);

    } catch (err) {
        console.error("Error cargando datos:", err);
        // Datos Dummy por si falla la conexión
        allQuizzes = [
            { id: 1, category: 'Anatomy', type: 'single' },
            { id: 2, category: 'Pharmacology', type: 'single' }
        ];
    }
}

// --- NAVEGACIÓN ---
function showLearningLab() { switchView('learning-view'); }
function showSimulationLab() { switchView('simulation-view'); }
function showPomodoro() { switchView('pomodoro-view'); }
function goBackToDashboard() { switchView('dashboard-content', true); }
function goBackToLearning() { switchView('learning-view'); }

function switchView(targetId, showHeader = false) {
    const views = ['dashboard-content', 'learning-view', 'simulation-view', 'pomodoro-view', 'selection-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    document.getElementById(targetId).classList.remove('hidden');
    
    const header = document.getElementById('header-welcome-section');
    if(header) {
        if(showHeader) header.classList.remove('hidden');
        else header.classList.add('hidden');
    }
}

// --- LÓGICA DE SELECCIÓN DE CATEGORÍAS ---
function openSelectionView(mode) {
    let title = "Select Topic";
    let filterType = "single";
    let backFunc = goBackToLearning;

    if (mode === 'standalone') {
        title = "Stand Alone Questions";
        filterType = 'single';
    } else if (mode === 'itemsets') {
        title = "Item Sets";
        filterType = 'itemsets';
    } else if (mode === 'simulation') {
        title = "Custom Simulation";
        filterType = 'simulation';
        backFunc = () => switchView('simulation-view');
    }

    document.getElementById('selection-mode-title').innerText = title;
    renderDynamicCategories(filterType);

    const btnBack = document.querySelector('#selection-view button');
    if(btnBack) btnBack.onclick = backFunc;

    switchView('selection-view');
}

function renderDynamicCategories(filterType) {
    const container = document.getElementById('dynamic-cat-list');
    if(!container) return;
    container.innerHTML = '';

    const filteredQuizzes = allQuizzes.filter(q => q.type === filterType);
    const uniqueSubjects = [...new Set(filteredQuizzes.map(q => q.category))];

    if (uniqueSubjects.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No questions found for this mode.</div>';
        return;
    }

    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'subject-item special-select-all';
    selectAllDiv.style.fontWeight = 'bold';
    selectAllDiv.style.marginBottom = '10px';
    selectAllDiv.innerHTML = `<div class="custom-checkbox"></div> Select All Categories`;
    selectAllDiv.onclick = function() { toggleSelectAll(this); };
    container.appendChild(selectAllDiv);

    uniqueSubjects.forEach(subject => {
        if(!subject) return; 
        const count = filteredQuizzes.filter(q => q.category === subject).length;
        
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.dataset.subject = subject;
        item.innerHTML = `<div class="custom-checkbox"></div> ${subject} <span style="margin-left:auto; opacity:0.5;">(${count})</span>`;
        item.onclick = function() { toggleCheck(this); };
        
        container.appendChild(item);
    });
} 

// --- INTERACCIONES UI ---
function toggleCheck(item) { item.classList.toggle('active'); }

function toggleSelectAll(source) {
    const isChecked = source.classList.contains('active');
    source.classList.toggle('active');
    const allItems = document.querySelectorAll('#dynamic-cat-list .subject-item:not(.special-select-all)');
    allItems.forEach(item => isChecked ? item.classList.remove('active') : item.classList.add('active'));
}

function openQuizSettings() {
    const selected = document.querySelectorAll('#dynamic-cat-list .subject-item.active:not(.special-select-all)');
    if(selected.length === 0) {
        alert("Please select at least one subject.");
        return;
    }
    document.getElementById('quiz-settings-modal').classList.add('active');
    document.getElementById('quiz-settings-modal').style.display = 'flex'; // Asegurar visualización
}

function closeQuizSettings() {
    document.getElementById('quiz-settings-modal').classList.remove('active');
    document.getElementById('quiz-settings-modal').style.display = 'none';
}

function startQuiz() {
    const count = document.getElementById('quiz-count').value;
    const selectedEls = document.querySelectorAll('#dynamic-cat-list .subject-item.active:not(.special-select-all)');
    const subjects = Array.from(selectedEls).map(el => el.dataset.subject);

    const params = new URLSearchParams();
    params.append('mode', 'practice');
    params.append('count', count);
    params.append('subjects', subjects.join(','));

    window.location.href = `quiz_engine.html?${params.toString()}`;
}

function startDailyRun() {
    const available = allQuizzes.filter(q => q.type === 'single');
    if(available.length < 10) {
        alert("Not enough questions for Daily Run.");
        return;
    }
    const shuffled = available.sort(() => 0.5 - Math.random()).slice(0, 10);
    const ids = shuffled.map(q => q.id).join(',');
    window.location.href = `quiz_engine.html?mode=daily&count=10&ids=${ids}`;
}

async function logout() {
    await _supabase.auth.signOut();
    window.location.href = 'index.html';
}

// --- IA LAB & SEARCH LOGIC ---

// 1. Abrir Modal
function openAIModal(mode) {
    const modal = document.getElementById('ai-modal');
    const output = document.getElementById('ai-output');
    // Limpiar estado anterior
    if(modal) {
        modal.classList.add('active');
        const input = document.getElementById('ai-input'); 
        if(input) input.value = '';
        if(output) output.innerHTML = '';
    }
}

// 2. Cerrar Modal
function closeAIModal() {
    const modal = document.getElementById('ai-modal');
    if(modal) modal.classList.remove('active');
}

// 3. Buscar en Base de Datos y Redirigir
async function performAISearch() {
    const inputEl = document.querySelector('#ai-modal input, #ai-modal textarea'); // Busca input o textarea
    const query = inputEl ? inputEl.value.trim() : '';
    const output = document.getElementById('ai-output');
    
    if (!query) {
        alert("Please enter a topic or keyword.");
        return;
    }

    if(output) output.innerHTML = '<div style="color:#acc; text-align:center; padding:10px;">🔍 Searching knowledge base...</div>';

    try {
        // Búsqueda simple usando ILIKE en Supabase
        const { data, error } = await _supabase
            .from('questions_bank')
            .select('id')
            .ilike('question_text', `%${query}%`) // Busca coincidencias parciales
            .limit(20); // Limitar resultados

        if (error) throw error;

        if (!data || data.length === 0) {
            if(output) output.innerHTML = '<div style="color:#ef4444; text-align:center; padding:10px;">No questions found. Try a simpler keyword.</div>';
            return;
        }

        // Extraer IDs y redirigir al Quiz Engine en modo 'practice_custom' (Fondo Oscuro)
        const ids = data.map(q => q.id).join(',');
        console.log(`Found ${data.length} questions for "${query}"`);
        
        // Redirección
        window.location.href = `quiz_engine.html?mode=practice_custom&ids=${ids}`;

    } catch (err) {
        console.error(err);
        if(output) output.innerHTML = `<div style="color:red;">Error: ${err.message}</div>`;
    }
}

// Vincular la función al nombre que usaste en el HTML
window.callGemini = performAISearch; 

// --- LOGICA DE NOTAS (NUEVA SECCIÓN AÑADIDA) ---

function openNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
        modal.style.display = 'flex'; // Usamos flex para centrarlo según tu CSS
        loadUserNotes(); // Cargar notas al abrir
    }
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function loadUserNotes() {
    const container = document.getElementById('notes-list-container');
    if (!container) return;
    
    container.innerHTML = '<div style="color:gray; text-align:center; padding:20px;">Loading notes...</div>';

    // Verificar usuario
    if (!currentUser || currentUser.id === 'test-user') {
        container.innerHTML = '<div style="color:#666; padding:10px;">Notes are stored locally in Test Mode. (Login to save to cloud)</div>';
        // Podrías implementar localStorage aquí si quisieras
        return;
    }

    try {
        const { data, error } = await _supabase
            .from('user_notes')
            .select('*')
            .eq('user_email', currentUser.email)
            .order('created_at', { ascending: false });

        if (error) throw error;

        container.innerHTML = '';

        if (data.length === 0) {
            container.innerHTML = '<div style="color:#444; text-align:center; margin-top:20px;">No notes yet. Write something!</div>';
            return;
        }

        data.forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.style.cssText = "background:#111; border:1px solid #333; padding:10px; margin-bottom:10px; border-radius:8px; position:relative;";
            
            // Formato simple de fecha
            const date = new Date(note.created_at).toLocaleDateString();
            
            noteEl.innerHTML = `
                <div style="color:#ccc; font-size:0.9rem; white-space: pre-wrap;">${note.content}</div>
                <div style="color:#555; font-size:0.7rem; margin-top:5px;">${date}</div>
                <button onclick="deleteNote('${note.id}')" style="position:absolute; top:5px; right:5px; background:transparent; border:none; color:#666; cursor:pointer;">🗑️</button>
            `;
            container.appendChild(noteEl);
        });

    } catch (err) {
        console.error("Error loading notes:", err);
        container.innerHTML = '<div style="color:red;">Error loading notes.</div>';
    }
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const content = input.value.trim();

    if (!content) return;

    if (!currentUser || currentUser.id === 'test-user') {
        alert("Please login to save notes to the cloud.");
        return;
    }

    try {
        const { error } = await _supabase
            .from('user_notes')
            .insert([{ user_email: currentUser.email, content: content }]);

        if (error) throw error;

        input.value = ''; // Limpiar input
        loadUserNotes(); // Recargar lista

    } catch (err) {
        console.error("Error saving note:", err);
        alert("Failed to save note.");
    }
}

async function deleteNote(noteId) {
    if (!confirm("Delete this note?")) return;

    try {
        const { error } = await _supabase
            .from('user_notes')
            .delete()
            .eq('id', noteId);

        if (error) throw error;
        loadUserNotes(); // Recargar

    } catch (err) {
        console.error("Error deleting note:", err);
    }
}

// --- UTILIDADES DE FECHA ---
function initCountdown() {}
function openDateModal() {}
function showRecoveryAlert() { alert("Recovery Mode"); }
