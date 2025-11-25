// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allQuizzes = [];
let currentUser = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    updateActivityCharts(); // Cargar gráficos al inicio
});

_supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") showRecoveryAlert();
});

async function initApp() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        currentUser = { id: 'test-user', user_metadata: { full_name: 'Guest Doctor' }, email: 'guest@inbde.com' };
    } else {
        currentUser = session.user;
    }
    
    const nameDisplay = document.getElementById('user-name-display');
    if(nameDisplay) nameDisplay.innerText = currentUser.user_metadata.full_name || 'Doctor';

    await loadData();
}

async function loadData() {
    try {
        // Cargar preguntas para el conteo de categorías
        const { data, error } = await _supabase
            .from('questions_bank')
            .select('category, id'); // Solo necesitamos esto para filtrar

        if (error) throw error;
        allQuizzes = data || [];
        console.log("Datos cargados:", allQuizzes.length);

    } catch (err) {
        console.error("Error cargando datos:", err);
    }
}

// --- ESTADÍSTICAS Y GRÁFICOS (PIE CHART) ---
async function updateActivityCharts() {
    if (!currentUser || currentUser.id === 'test-user') return;

    try {
        // Obtener estadísticas del usuario
        const { data, error } = await _supabase
            .from('user_analytics')
            .select('is_correct');

        if (error) throw error;

        const total = data.length;
        if (total === 0) return; // Dejar gráfico por defecto

        const correct = data.filter(x => x.is_correct).length;
        const percentage = Math.round((correct / total) * 100);

        // Actualizar Pie Charts en el DOM
        const pieCharts = document.querySelectorAll('.pie-chart-main, .ring-chart');
        pieCharts.forEach(chart => {
            // Actualizar gradiente dinámicamente
            chart.style.background = `conic-gradient(var(--accent) 0% ${percentage}%, #27272a ${percentage}% 100%)`;
        });

        // Actualizar texto si existe un elemento de porcentaje
        const textPct = document.getElementById('accuracy-text');
        if(textPct) textPct.innerText = `${percentage}%`;

    } catch (err) {
        console.error("Error actualizando gráficos:", err);
    }
}

// --- NAVEGACIÓN ENTRE VISTAS ---
function showLearningLab() { switchView('learning-view'); }
function showSimulationLab() { switchView('simulation-view'); }
function showPomodoro() { switchView('pomodoro-view'); }
function goBackToDashboard() { switchView('dashboard-content', true); }
function goBackToLearning() { switchView('learning-view'); }
function goBackToPomodoro() { switchView('pomodoro-view'); }

function switchView(targetId, showHeader = false) {
    // Ocultar todas las vistas principales
    const views = ['dashboard-content', 'learning-view', 'simulation-view', 'pomodoro-view', 'selection-view', 'pomodoro-timer-view', 'pomodoro-customization-view'];
    
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    // Mostrar la deseada
    const target = document.getElementById(targetId);
    if(target) target.classList.remove('hidden');
    
    // Manejo del Header
    const header = document.getElementById('header-welcome-section');
    if(header) {
        if(showHeader) header.classList.remove('hidden');
        else header.classList.add('hidden');
    }
}

// --- SELECCIÓN DE QUIZ & SIMULACIÓN ---
let currentQuizMode = 'practice';

function openSelectionView(mode) {
    currentQuizMode = mode;
    let title = "Select Topic";
    let backFunc = goBackToLearning;

    if (mode === 'standalone') {
        title = "Stand Alone Questions";
    } else if (mode === 'itemsets') {
        title = "Item Sets";
    } else if (mode === 'simulation') {
        title = "Customize Simulation";
        backFunc = () => switchView('simulation-view');
    }

    const titleEl = document.getElementById('selection-mode-title');
    if(titleEl) titleEl.innerText = title;
    
    renderDynamicCategories();

    // Configurar botón 'Next' para abrir el modal de configuración
    const nextBtn = document.querySelector('#selection-view .square-card, #selection-view .btn-action'); 
    if(nextBtn) {
        nextBtn.onclick = openQuizSettings;
        // Cambiar texto del botón si es simulación
        if(mode === 'simulation') {
            nextBtn.innerHTML = '<span style="font-weight:bold; color:white;">CONFIGURE EXAM →</span>';
        }
    }

    const btnBack = document.querySelector('#selection-view .btn-back-small');
    if(btnBack) btnBack.onclick = backFunc;

    switchView('selection-view');
}

function renderDynamicCategories() {
    const container = document.getElementById('dynamic-cat-list');
    if(!container) return;
    container.innerHTML = '';

    // Obtener categorías únicas
    const uniqueSubjects = [...new Set(allQuizzes.map(q => q.category))].filter(Boolean);

    if (uniqueSubjects.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Loading categories... (Check DB)</div>';
        return;
    }

    // Botón Select All
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'subject-item special-select-all';
    selectAllDiv.innerHTML = `<div class="custom-checkbox"></div> Select All Categories`;
    selectAllDiv.onclick = function() { toggleSelectAll(this); };
    container.appendChild(selectAllDiv);

    uniqueSubjects.forEach(subject => {
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.dataset.subject = subject;
        item.innerHTML = `<div class="custom-checkbox"></div> ${subject}`;
        item.onclick = function() { toggleCheck(this); };
        container.appendChild(item);
    });
}

function toggleCheck(item) { item.classList.toggle('active'); }
function toggleSelectAll(source) {
    const isChecked = source.classList.contains('active');
    source.classList.toggle('active');
    const allItems = document.querySelectorAll('#dynamic-cat-list .subject-item:not(.special-select-all)');
    allItems.forEach(item => isChecked ? item.classList.remove('active') : item.classList.add('active'));
}

// --- MODAL DE CONFIGURACIÓN DE QUIZ (SIMULACIÓN Y PRÁCTICA) ---
function openQuizSettings() {
    const modal = document.getElementById('quiz-settings-modal');
    const select = document.getElementById('quiz-count');
    
    // Limpiar opciones anteriores
    select.innerHTML = '';

    if (currentQuizMode === 'simulation') {
        // Opciones específicas para simulación (Tiempo se calcula en quiz_engine)
        const options = [25, 50, 75, 100];
        options.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.text = `${val} Questions (${Math.round(val * 1.2)} mins)`;
            select.appendChild(opt);
        });
    } else {
        // Opciones para práctica
        [10, 20, 30].forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.text = `${val} Questions`;
            select.appendChild(opt);
        });
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeQuizSettings() {
    const modal = document.getElementById('quiz-settings-modal');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; modal.classList.add('hidden'); }, 300);
}

function startQuiz() {
    const count = document.getElementById('quiz-count').value;
    // Obtener materias seleccionadas (si estamos en modo selección)
    const selectedEls = document.querySelectorAll('#dynamic-cat-list .subject-item.active:not(.special-select-all)');
    let subjects = Array.from(selectedEls).map(el => el.dataset.subject).join(',');

    // Si no hay selección (ej. simulation standard), enviar vacío (todos)
    if(currentQuizMode === 'simulation_standard') subjects = '';

    const params = new URLSearchParams();
    params.append('mode', currentQuizMode);
    params.append('count', count);
    if(subjects) params.append('subjects', subjects);

    window.location.href = `quiz_engine.html?${params.toString()}`;
}

// Acceso directo para examen estándar (Botón "Standard Exam")
function startQuizEngine(mode) {
    currentQuizMode = mode;
    if(mode === 'simulation_standard') {
        // Configuración fija para estándar
        window.location.href = `quiz_engine.html?mode=simulation&count=100`; 
    } else if (mode === 'daily') {
        window.location.href = `quiz_engine.html?mode=daily&count=10`;
    }
}

// --- QUICK NOTES (CORREGIDO) ---
function openNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        loadUserNotes();
    }
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; modal.classList.add('hidden'); }, 300);
    }
}

async function loadUserNotes() {
    const container = document.getElementById('notes-list-container');
    if(!container) return;
    
    container.innerHTML = '<div style="color:gray; text-align:center; padding:20px;">Loading notes...</div>';
    
    if (currentUser.id === 'test-user') {
        container.innerHTML = '<div style="color:#666; padding:10px;">Test Mode: Notes are not saved to cloud.</div>';
        return;
    }

    const { data, error } = await _supabase
        .from('user_notes')
        .select('*')
        .eq('user_email', currentUser.email)
        .order('created_at', { ascending: false });

    if (error || !data) {
        container.innerHTML = '<div style="color:red; padding:10px;">Error loading notes.</div>';
        return;
    }

    container.innerHTML = '';
    if (data.length === 0) {
        container.innerHTML = '<div style="color:#444; text-align:center; margin-top:20px;">No notes yet.</div>';
        return;
    }

    data.forEach(note => {
        const div = document.createElement('div');
        div.style.cssText = 'background:#1a1a1a; padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid #333; position:relative;';
        div.innerHTML = `
            <div style="color:#ddd; font-size:0.9rem; white-space: pre-wrap;">${note.content}</div>
            <div style="color:#555; font-size:0.7rem; margin-top:5px;">${new Date(note.created_at).toLocaleDateString()}</div>
            <button onclick="deleteNote('${note.id}')" style="position:absolute; top:5px; right:5px; background:none; border:none; cursor:pointer;">🗑️</button>
        `;
        container.appendChild(div);
    });
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const content = input.value.trim();
    if(!content) return;

    if(currentUser.id === 'test-user') { alert("Login to save notes."); return; }

    await _supabase.from('user_notes').insert([{ user_email: currentUser.email, content: content }]);
    input.value = '';
    loadUserNotes();
}

async function deleteNote(id) {
    if(confirm("Delete note?")) {
        await _supabase.from('user_notes').delete().eq('id', id);
        loadUserNotes();
    }
}

// --- POMODORO LOGIC (CORREGIDA CICLOS) ---
let pomoTimer = null;
let pomoTimeLeft = 1500; // 25 min
let pomoIsBreak = false;
let pomoRunning = false;

function openPomodoroSession() { switchView('pomodoro-timer-view'); resetPomo(); }
function openPomodoroCustomization() { switchView('pomodoro-customization-view'); }

function toggleTimer() {
    const btn = document.getElementById('play-icon');
    if (pomoRunning) {
        clearInterval(pomoTimer);
        btn.innerText = '▶';
    } else {
        pomoTimer = setInterval(pomoTick, 1000);
        btn.innerText = '❚❚';
    }
    pomoRunning = !pomoRunning;
}

function pomoTick() {
    if (pomoTimeLeft > 0) {
        pomoTimeLeft--;
        updatePomoDisplay();
    } else {
        clearInterval(pomoTimer);
        pomoRunning = false;
        document.getElementById('play-icon').innerText = '▶';
        
        // Logic Ciclo
        if (!pomoIsBreak) {
            alert("Focus Time Complete! Take a 5 min break.");
            pomoIsBreak = true;
            pomoTimeLeft = 300; // 5 min
            document.querySelector('.pomo-container').style.borderColor = '#4ade80'; // Verde para break
        } else {
            alert("Break Over! Back to Focus.");
            pomoIsBreak = false;
            pomoTimeLeft = 1500; // 25 min
            document.querySelector('.pomo-container').style.borderColor = '#facc15'; // Amarillo para focus
        }
        updatePomoDisplay();
    }
}

function resetPomo() {
    clearInterval(pomoTimer);
    pomoRunning = false;
    pomoIsBreak = false;
    pomoTimeLeft = 1500;
    updatePomoDisplay();
    document.getElementById('play-icon').innerText = '▶';
    document.querySelector('.pomo-container').style.borderColor = '#facc15';
}

function updatePomoDisplay() {
    const m = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
    const s = (pomoTimeLeft % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').innerText = `${m}:${s}`;
}

// --- AI & AUTH (Utilidades) ---
function openAIModal(type) { 
    document.getElementById('ai-modal').classList.remove('hidden');
    document.getElementById('ai-modal').classList.add('active'); 
}
function closeAIModal() { 
    document.getElementById('ai-modal').classList.remove('active');
    setTimeout(() => document.getElementById('ai-modal').classList.add('hidden'), 300);
}
async function logout() { await _supabase.auth.signOut(); window.location.href = 'index.html'; }
function initCountdown() {} // Placeholder fecha
function showRecoveryAlert() { alert("Set new password."); }
// --- AGREGA ESTO AL FINAL DE APP.JS ---

function startDailyRun() {
    console.log("Starting Daily Run...");
    // Redirige al quiz engine forzando modo 'daily' y 10 preguntas
    window.location.href = 'quiz_engine.html?mode=daily&count=10';
}
