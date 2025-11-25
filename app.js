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
        // NOTA: Asegúrate de que la columna en Supabase se llame 'type'
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

// --- LÓGICA DE SELECCIÓN DE CATEGORÍAS (CORREGIDA) ---
function openSelectionView(mode) {
    let title = "Select Topic";
    let filterType = "single"; // Por defecto
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
    
    // Llamamos a la función renderizadora corregida
    renderDynamicCategories(filterType);

    // Asignar botón de atrás dinámicamente
    const btnBack = document.querySelector('#selection-view button');
    if(btnBack) btnBack.onclick = backFunc;

    switchView('selection-view');
}

// *** AQUÍ ESTABA EL ERROR PRINCIPAL ***
function renderDynamicCategories(filterType) {
    const container = document.getElementById('dynamic-cat-list');
    if(!container) return;
    container.innerHTML = '';

    // CORRECCIÓN: Usamos 'type' (inglés)
    const filteredQuizzes = allQuizzes.filter(q => q.type === filterType);
    const uniqueSubjects = [...new Set(filteredQuizzes.map(q => q.category))];

    if (uniqueSubjects.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No questions found for this mode.</div>';
        return;
    }

    // Botón "Select All"
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'subject-item special-select-all';
    selectAllDiv.style.fontWeight = 'bold';
    selectAllDiv.style.marginBottom = '10px';
    selectAllDiv.innerHTML = `<div class="custom-checkbox"></div> Select All Categories`;
    selectAllDiv.onclick = function() { toggleSelectAll(this); };
    container.appendChild(selectAllDiv);

    // Lista de Materias
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
// --- FIN DE LA FUNCIÓN CORREGIDA ---

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
}

function closeQuizSettings() {
    document.getElementById('quiz-settings-modal').classList.remove('active');
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
    // CORRECCIÓN: Filtro por 'type'
    const available = allQuizzes.filter(q => q.type === 'single');
    
    if(available.length < 10) {
        alert("Not enough questions for Daily Run.");
        return;
    }

    // Aleatorizar simple
    const shuffled = available.sort(() => 0.5 - Math.random()).slice(0, 10);
    const ids = shuffled.map(q => q.id).join(',');

    window.location.href = `quiz_engine.html?mode=daily&count=10&ids=${ids}`;
}

async function logout() {
    await _supabase.auth.signOut();
    window.location.href = 'index.html';
}

// --- UTILIDADES DE FECHA (Omitido para brevedad, agrégalo si lo necesitas) ---
function initCountdown() {}
function openDateModal() {}
