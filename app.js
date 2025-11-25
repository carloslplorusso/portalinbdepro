// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allQuizzes = [];
let userCompletedIds = new Set();
let currentUser = null;
const headerWelcome = document.getElementById('header-welcome-section');

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initApp(); // Carga de datos y Auth
    initCountdown(); // Lógica de fechas
});

// --- 1. LÓGICA DE AUTENTICACIÓN & DATOS ---
_supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
        showRecoveryAlert();
    }
});

async function initApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const isRecovery = urlParams.get('recovery') === 'true';

    if (isRecovery) {
        window.history.replaceState({}, document.title, "dashboard.html"); // Limpiar URL
        showRecoveryAlert();
    }

    // Verificar Sesión
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        console.log("Modo sin sesión activa (Pruebas)");
        currentUser = { id: 'test-user', user_metadata: { full_name: 'Test Doctor' }, email: 'test@inbde.com' };
    } else {
        currentUser = session.user;
    }
    
    // Mostrar Nombre (Verificamos si existe el elemento para evitar errores en vistas que no lo tengan)
    const userNameDisplay = document.getElementById('user-name-display');
    if (userNameDisplay) {
        const displayName = currentUser.user_metadata.full_name || currentUser.email.split('@')[0];
        userNameDisplay.innerText = displayName;
    }

    // Cargar Datos
    await loadData();
    
    // Cargar Actividad Diaria
    if(currentUser.id !== 'test-user') {
        logActivity();
        loadActivityVisuals();
    }
}

async function loadData() {
    try {
        const quizzesReq = _supabase.from('questions_bank').select('*').order('category', { ascending: true });
        
        let progressReq = Promise.resolve({ data: [] });
        if (currentUser.id !== 'test-user') {
            progressReq = _supabase.from('user_analytics').select('question_id').eq('user_email', currentUser.email);
        }

        const [quizzesRes, progressRes] = await Promise.all([quizzesReq, progressReq]);

        if (quizzesRes.error) throw quizzesRes.error;

        allQuizzes = quizzesRes.data;
        if (progressRes.data) {
            userCompletedIds = new Set(progressRes.data.map(p => p.question_id));
        }
        console.log("Datos cargados correctamente:", allQuizzes.length, "quizzes.");
    } catch (err) {
        console.error("Error cargando datos:", err);
        if (allQuizzes.length === 0) {
            allQuizzes = [
                    { id: 1, category: 'Anatomy', tipo: 'single' },
                    { id: 2, category: 'Oral Pathology', tipo: 'itemsets' }
            ];
        }
    }
}

async function logout() {
    await _supabase.auth.signOut();
    window.location.href = './index.html';
}

// --- RECUPERACIÓN DE CONTRASEÑA ---
function showRecoveryAlert() {
    const container = document.getElementById('password-alert-container');
    if (!container) return;

    const alertBox = document.createElement('div');
    alertBox.className = 'password-alert';
    alertBox.innerHTML = `⚠️ <strong>ACTION REQUIRED:</strong> You are using a temporary access link. <span style="text-decoration:underline; cursor:pointer; font-weight:800;" onclick="openRecoveryModal()">Click here to set password</span>.`;
    container.appendChild(alertBox);
    alertBox.style.display = 'block';
    setTimeout(() => { openRecoveryModal(); }, 800);
}

function openRecoveryModal() {
    const modal = document.getElementById('recovery-modal');
    if(modal) modal.classList.add('active');
}

async function saveNewPassword() {
    const newPass = document.getElementById('new-password-input').value;
    if (!newPass || newPass.length < 6) {
        window.confirm("Password must be at least 6 characters long.");
        return;
    }
    const { data, error } = await _supabase.auth.updateUser({ password: newPass });
    if (error) {
        window.confirm("Error: " + error.message);
    } else {
        window.confirm("Password updated successfully! Please log in with your new credentials.");
        logout();
    }
}

// --- 2. NAVEGACIÓN Y RENDERIZADO DINÁMICO ---
function showLearningLab() { switchView('learning-view'); }
function showSimulationLab() { switchView('simulation-view'); }
function showPomodoro() { switchView('pomodoro-view'); }
function goBackToDashboard() { switchView('dashboard-content', true); }
function goBackToLearning() { switchView('learning-view'); }
function goBackToSimulation() { switchView('simulation-view'); }
function goBackToPomodoro() { switchView('pomodoro-view'); }
function startQuizEngine(mode) { window.location.href = `quiz_engine.html?mode=${mode}&count=10`; }

// Mapeo de modos visuales a tipos en base de datos
function openSelectionView(mode) { 
    let title = "";
    let filterType = "";
    let backFunc = null;

    if (mode === 'standalone') {
        title = "Stand Alone Questions";
        filterType = 'single';
        backFunc = goBackToLearning;
    } else if (mode === 'itemsets') {
        title = "Item Sets";
        filterType = 'itemsets';
        backFunc = goBackToLearning;
    } else if (mode === 'simulation') {
        title = "Custom Simulation";
        filterType = 'simulation';
        backFunc = goBackToSimulation;
    }

    const titleEl = document.getElementById('selection-mode-title');
    if(titleEl) titleEl.innerText = title;
    
    renderDynamicCategories(filterType);

    const btnBack = document.querySelector('#selection-view .btn-back-small');
    if(btnBack) btnBack.onclick = backFunc;

    switchView('selection-view'); 
}

function renderDynamicCategories(filterType) {
    const container = document.getElementById('dynamic-cat-list');
    if(!container) return;
    container.innerHTML = '';

    const filteredQuizzes = allQuizzes.filter(q => q.tipo === filterType);
    const uniqueSubjects = [...new Set(filteredQuizzes.map(q => q.category))];

    if (uniqueSubjects.length === 0) {
        container.innerHTML = '<div style="padding:15px; text-align:center; color:#666;">No content available for this mode yet.</div>';
        return;
    }

    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'subject-item special-select-all';
    selectAllDiv.onclick = function() { toggleSelectAll(this); };
    selectAllDiv.innerHTML = `<div class="custom-checkbox"></div> Select All Categories`;
    container.appendChild(selectAllDiv);

    uniqueSubjects.forEach(subject => {
        if(!subject) return; 
        const count = filteredQuizzes.filter(q => q.category === subject).length;
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.onclick = function() { toggleCheck(this); };
        item.innerHTML = `<div class="custom-checkbox"></div> ${subject} <span style="font-size:0.7em; margin-left:auto; opacity:0.5;">(${count})</span>`;
        item.dataset.subject = subject;
        container.appendChild(item);
    });
}

function openSimulationCustomization() { openSelectionView('simulation'); }
function openPomodoroCustomization() { switchView('pomodoro-customization-view'); }
function openPomodoroSession() { switchView('pomodoro-timer-view'); resetTimer(); }

function switchView(targetId, showHeader = false) {
    const views = ['dashboard-content', 'learning-view', 'simulation-view', 'pomodoro-view', 'selection-view', 'pomodoro-customization-view', 'pomodoro-timer-view'];
    
    // Verificar si los elementos existen antes de manipularlos (importante para mobile)
    let current = views.find(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
    
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return; // Si la vista no existe en este HTML, no hacer nada

    if(current) {
        const currentEl = document.getElementById(current);
        currentEl.classList.add('fade-out');
        setTimeout(() => {
            currentEl.classList.add('hidden');
            currentEl.classList.remove('fade-out');
            
            targetEl.classList.remove('hidden');
            targetEl.classList.add('fade-in');
            
            if (headerWelcome) {
                if(showHeader) headerWelcome.classList.remove('hidden');
                else headerWelcome.classList.add('hidden');
            }
        }, 300);
    } else {
        targetEl.classList.remove('hidden');
    }
}

// --- DATE LOGIC ---
function initCountdown() {
    const storedDate = localStorage.getItem('examDate');
    const modal = document.getElementById('date-setup-modal');
    if (!modal) return;

    if (!storedDate) {
        modal.classList.add('active');
    } else {
        modal.classList.remove('active');
        updateDaysLeft(storedDate);
    }
}

function saveExamDate() {
    const dateInput = document.getElementById('exam-date-input');
    if(!dateInput) return;
    
    if (!dateInput.value) return window.confirm("Please select a date.");
    localStorage.setItem('examDate', dateInput.value);
    
    const modal = document.getElementById('date-setup-modal');
    if(modal) modal.classList.remove('active');
    
    updateDaysLeft(dateInput.value);
}

function updateDaysLeft(dateString) {
    const target = new Date(dateString);
    const today = new Date();
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const display = diffDays > 0 ? `${diffDays} Days Left` : "Exam Day!";
    
    const label = document.getElementById('countdown-value');
    if(label) label.innerText = display;
}

function openDateModal() {
    const modal = document.getElementById('date-setup-modal');
    if(modal) modal.classList.add('active');
}

// --- UI INTERACTION HELPERS ---
function toggleCategories(header) { header.parentElement.classList.toggle('open'); }
function toggleCheck(item) { item.classList.toggle('active'); }
function toggleSelectAll(source) {
    const isChecked = source.classList.contains('active');
    source.classList.toggle('active');
    const allItems = source.closest('.cat-list').querySelectorAll('.subject-item:not(.special-select-all)');
    allItems.forEach(item => isChecked ? item.classList.remove('active') : item.classList.add('active'));
}

function openQuizSettings() { 
    const selected = document.querySelectorAll('#dynamic-cat-list .subject-item.active:not(.special-select-all)');
    if(selected.length === 0) {
        window.confirm("Please select at least one subject.");
        return;
    }
    document.getElementById('quiz-settings-modal').classList.add('active'); 
}
function closeQuizSettings() { document.getElementById('quiz-settings-modal').classList.remove('active'); }

function startQuiz() { 
    closeQuizSettings(); 
    const count = document.getElementById('quiz-count').value;
    const selectedSubjects = Array.from(document.querySelectorAll('#dynamic-cat-list .subject-item.active:not(.special-select-all)')).map(el => el.dataset.subject);
    
    if (selectedSubjects.length === 0) {
        window.confirm("Please select at least one subject.");
        return;
    }

    console.log("Starting Quiz:", {count, subjects: selectedSubjects});
    
    const subjectsParam = encodeURIComponent(selectedSubjects.join(','));
    window.location.href = `quiz_engine.html?mode=practice&count=${count}&subjects=${subjectsParam}`;
}

// --- POMODORO LOGIC ---
let timerInterval;
let timeLeft = 1500; 
let isRunning = false;
let currentCycle = 0;
let isBreak = false;
let pMode = 'classic'; 

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if(!display) return;

    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    display.innerText = `${m}:${s}`;
}

function toggleTimer() {
    const btn = document.getElementById('play-icon');
    if (isRunning) {
        clearInterval(timerInterval);
        if(btn) btn.innerText = '▶';
    } else {
        timerInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                completeCycle();
            }
        }, 1000);
        if(btn) btn.innerText = '❚❚';
    }
    isRunning = !isRunning;
}

function completeCycle() {
    clearInterval(timerInterval);
    isRunning = false;
    const btn = document.getElementById('play-icon');
    if(btn) btn.innerText = '▶';
    
    window.confirm(isBreak ? "Break Over! Back to work." : "Time's up! Take a break.");
    if (!isBreak) {
        currentCycle++;
        updateDots();
        if (currentCycle >= 4) {
            isBreak = true;
            timeLeft = pMode === 'classic' ? 15 * 60 : 20 * 60; 
            currentCycle = 0; 
            updateDots(true); 
        } else {
            isBreak = true;
            timeLeft = pMode === 'classic' ? 5 * 60 : 10 * 60;
        }
    } else {
        isBreak = false;
        timeLeft = pMode === 'classic' ? 25 * 60 : 50 * 60;
    }
    updateTimerDisplay();
}

function updateDots(clear = false) {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if(!dot) continue;
        if (clear) dot.classList.remove('filled');
        else if (i <= currentCycle) dot.classList.add('filled');
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    isBreak = false;
    const btn = document.getElementById('play-icon');
    if(btn) btn.innerText = '▶';
    timeLeft = pMode === 'classic' ? 25 * 60 : 50 * 60;
    updateTimerDisplay();
}

function setPomodoroMode(mode) {
    pMode = mode;
    const btnC = document.getElementById('btn-classic');
    const btnF = document.getElementById('btn-flow');
    
    if(btnC) btnC.classList.toggle('active', mode === 'classic');
    if(btnF) btnF.classList.toggle('active', mode === 'flow');
    resetTimer();
}

// --- AI MODAL LOGIC ---
const modal = document.getElementById('ai-modal');
const inputArea = document.getElementById('ai-input');
const outputArea = document.getElementById('ai-output');

function openAIModal(mode) {
    if(modal) modal.classList.add('active'); 
    if(outputArea) {
        outputArea.style.display = 'none'; 
        outputArea.innerHTML = ''; 
    }
    if(inputArea) inputArea.value = '';
    
    const title = document.getElementById('ai-modal-title');
    const desc = document.getElementById('ai-modal-desc');

    if (title && desc) {
        if (mode === 'ia_search') {
            title.textContent = "INBDE Pro IA";
            desc.textContent = "Find questions instantly.";
        } else {
            title.textContent = "AI Tutor";
            desc.textContent = "Ask any dental question.";
        }
    }
}
function closeAIModal() { if(modal) modal.classList.remove('active'); }
async function callGemini() {
    window.confirm("AI Integration would trigger here.");
}

// --- LÓGICA DAILY RUN ---
function seededRandom(seed) {
    var m = 0x80000000;
    var a = 1103515245;
    var c = 12345;
    var state = seed ? seed : Math.floor(Math.random() * (m - 1));
    return function() {
        state = (a * state + c) % m;
        return state / (m - 1);
    }
}

function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var character = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash; 
    }
    return Math.abs(hash);
}

function startDailyRun() {
    if (!allQuizzes || allQuizzes.length === 0) {
        if(confirm("Data is loading. Click OK to try fetching again or Cancel to wait.")) {
                loadData().then(startDailyRun);
        }
        return;
    }

    const standAloneQuestions = allQuizzes.filter(q => 
        q.tipo !== 'itemsets' && q.tipo !== 'simulation'
    );

    if (standAloneQuestions.length < 10) {
        alert("Not enough questions in database for a Daily Run (Need 10).");
        return;
    }

    const todayStr = new Date().toLocaleDateString('en-CA');
    const seed = hashCode(todayStr);
    const rng = seededRandom(seed);

    let shuffled = [...standAloneQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected10 = shuffled.slice(0, 10);
    const selectedIds = selected10.map(q => q.id).join(',');

    console.log("Starting Daily Run for:", todayStr, "Questions:", selectedIds);
    window.location.href = `quiz_engine.html?mode=daily&count=10&ids=${selectedIds}`;
}

// --- LÓGICA DE APUNTES (NOTES) ---
function openNotesModal() {
    document.getElementById('notes-modal').classList.add('active');
    fetchNotes();
}

function closeNotesModal() {
    document.getElementById('notes-modal').classList.remove('active');
}

async function fetchNotes() {
    const container = document.getElementById('notes-list-container');
    container.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">Loading...</div>';

    const { data, error } = await _supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notes:', error);
        container.innerHTML = '<div style="color:var(--danger); text-align:center;">Error loading notes.</div>';
        return;
    }

    renderNotesList(data);
}

function renderNotesList(notes) {
    const container = document.getElementById('notes-list-container');
    container.innerHTML = '';

    if (notes.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#444; padding:20px; font-style:italic;">No notes yet. Write something above!</div>';
        return;
    }

    notes.forEach(note => {
        const date = new Date(note.created_at).toLocaleDateString() + ' ' + new Date(note.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const noteEl = document.createElement('div');
        noteEl.style.cssText = `
            background: rgba(255,255,255,0.03); 
            border: 1px solid #333; 
            border-radius: 8px; 
            padding: 15px; 
            animation: fadeIn 0.3s ease;
        `;
        
        noteEl.innerHTML = `
            <div style="font-size: 0.95rem; color: #ddd; white-space: pre-wrap; margin-bottom: 8px;">${note.content}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">📅 ${date}</div>
        `;
        container.appendChild(noteEl);
    });
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const content = input.value.trim();

    if (!content) return;

    const { error } = await _supabase
        .from('user_notes')
        .insert([{ user_id: currentUser.id, content: content }]);

    if (error) {
        alert('Error saving note: ' + error.message);
    } else {
        input.value = '';
        fetchNotes();
    }
}

// --- LÓGICA DE ACTIVIDAD ---
async function logActivity() {
    await _supabase
        .from('user_activity_log')
        .insert([{ user_id: currentUser.id }])
        .select();
}

async function loadActivityVisuals() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await _supabase
        .from('user_activity_log')
        .select('activity_date')
        .eq('user_id', currentUser.id)
        .gte('activity_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (error || !data) return;

    const uniqueDays = new Set(data.map(d => d.activity_date)).size;
    const percentage = Math.min(Math.round((uniqueDays / 30) * 100), 100);
    
    const ringChart = document.getElementById('activity-ring');
    if (ringChart) {
        ringChart.style.background = `conic-gradient(var(--accent) ${percentage}%, #27272a 0)`;
    }

    const dotsContainer = document.getElementById('activity-dots-container');
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0];
            
            const isActive = data.some(record => record.activity_date === dateString);
            
            const dot = document.createElement('div');
            dot.className = `dot ${isActive ? 'active' : ''}`;
            dot.title = dateString;
            dotsContainer.appendChild(dot);
        }
    }
}
