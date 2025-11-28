// app.js

// --- CONFIGURACIÓN CENTRAL DE SUPABASE ---
const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

// Inicialización del cliente Supabase
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FUNCIONES Y VARIABLES GLOBALES ---

// 1. VARIABLE GLOBAL PARA EL MODO
let currentSelectionMode = 'practice';

// --- FUNCIONES AUXILIARES DE UI (NUEVO: Para evitar errores en Móvil/Desktop) ---
function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerText = text;
    }
    // Si no existe, no hacemos nada (evita errores de consola)
}

// 2. FUNCIÓN PARA EL RANDOM LAB RUN (10 Preguntas Aleatorias)
function startRandomRun() {
    console.log("Starting Random Run...");
    // Cambiamos el modo a 'random'
    window.location.href = 'quiz_engine.html?mode=random&count=10';
}

// 3. MANEJO DE ESTADO (SEMÁFORO)
function handleStatus(status) {
    if (typeof userStatus !== 'undefined' && userStatus[status] !== undefined) {
        userStatus[status]++;
    }
    console.log(`Question marked as: ${status}`);
    
    if (typeof nextQuestion === 'function') {
        nextQuestion();
    } else {
        console.warn("nextQuestion() not found. Ensure app.js is loaded in the correct context.");
    }
}

// 4. FUNCIÓN FINISHQUIZ (Lógica de resultados)
function finishQuiz() {
    if (typeof timerInterval !== 'undefined') {
        clearInterval(timerInterval);
    }
    
    // Ocultar elementos de la interfaz
    const inbdeHeader = document.querySelector('.inbde-header');
    const inbdeFooter = document.querySelector('.inbde-footer');
    const mainContainer = document.getElementById('main-container');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const quizContent = document.getElementById('quiz-content');
    const reviewModal = document.getElementById('review-modal');

    if (inbdeHeader) inbdeHeader.classList.add('hidden');
    if (inbdeFooter) inbdeFooter.classList.add('hidden');
    
    if (mainContainer) mainContainer.style.display = 'block';
    if (leftPanel) leftPanel.classList.add('hidden');
    if (rightPanel) rightPanel.style.width = '100%'; 
    if (quizContent) quizContent.classList.add('hidden');
    if (reviewModal) reviewModal.style.display = 'none';
    
    // Cálculos
    let correct = 0;
    const total = typeof quizData !== 'undefined' ? quizData.length : 0;
    
    let listHTML = '';
    if (typeof quizData !== 'undefined' && quizData.length > 0) {
        quizData.forEach((q, idx) => {
            const userAns = userAnswers[q.id];
            const isCorrect = userAns && q.correct_answer && userAns.trim().includes(q.correct_answer.trim());
            if(isCorrect) correct++;

            listHTML += `
                <div class="bg-gray-800 p-4 rounded border border-gray-700 mb-3">
                    <div class="font-bold text-white mb-1">Q${idx+1}: ${q.question_text}</div>
                    <div class="text-sm text-gray-400 mb-2">Correct Answer: <span class="text-green-400">${q.correct_answer}</span></div>
                    <button class="ai-btn text-xs" onclick="askGemini(this, '${q.question_text.replace(/'/g, "\\'")}', '${q.correct_answer.replace(/'/g, "\\'")}')">✨ Why?</button>
                    <div class="ai-response mt-2 text-gray-300 text-sm hidden bg-black p-2 rounded"></div>
                </div>
            `;
        });
    }

    const totalStatus = typeof userStatus !== 'undefined' ? userStatus.learning + userStatus.reviewing + userStatus.mastered : 0; 
    const safeTotal = totalStatus > 0 ? totalStatus : 1; 
    
    const pctLearning = Math.round((userStatus.learning / safeTotal) * 100);
    const pctReviewing = Math.round((userStatus.reviewing / safeTotal) * 100);
    const pctMastered = Math.round((userStatus.mastered / safeTotal) * 100);

    const resultsHTML = `
        <h1 class="text-3xl font-bold mb-6 text-yellow-400">Session Complete</h1>
        
        <div class="flex justify-center gap-4 mb-8">
            <div class="text-center bg-gray-800 p-4 rounded-lg border border-gray-700 w-32">
                <div class="text-4xl font-bold text-green-500">${correct}</div>
                <div class="text-xs text-gray-400 uppercase">Correct</div>
            </div>
            <div class="text-center bg-gray-800 p-4 rounded-lg border border-gray-700 w-32">
                <div class="text-4xl font-bold text-red-500">${total - correct}</div>
                <div class="text-xs text-gray-400 uppercase">Incorrect</div>
            </div>
            <div class="text-center bg-gray-800 p-4 rounded-lg border border-yellow-500 w-32">
                <div class="text-4xl font-bold text-yellow-400">${Math.round((correct/total)*100)}%</div>
                <div class="text-xs text-gray-400 uppercase">Score</div>
            </div>
        </div>

        <div class="mb-8 bg-gray-900 p-5 rounded-xl border border-gray-700">
            <h3 class="text-white font-bold mb-4 uppercase text-sm tracking-wider">Knowledge Confidence</h3>
            <div class="flex justify-between gap-2 text-center">
                <div class="flex-1">
                    <div class="text-2xl font-bold text-red-500">${userStatus.learning}</div>
                    <div class="text-xs text-red-400">Learning (${pctLearning}%)</div>
                    <div class="w-full bg-gray-700 h-2 mt-2 rounded"><div class="bg-red-500 h-2 rounded" style="width:${pctLearning}%"></div></div>
                </div>
                <div class="flex-1">
                    <div class="text-2xl font-bold text-yellow-400">${userStatus.reviewing}</div>
                    <div class="text-xs text-yellow-300">Reviewing (${pctReviewing}%)</div>
                    <div class="w-full bg-gray-700 h-2 mt-2 rounded"><div class="bg-yellow-400 h-2 rounded" style="width:${pctReviewing}%"></div></div>
                </div>
                <div class="flex-1">
                    <div class="text-2xl font-bold text-green-500">${userStatus.mastered}</div>
                    <div class="text-xs text-green-400">Mastered (${pctMastered}%)</div>
                    <div class="w-full bg-gray-700 h-2 mt-2 rounded"><div class="bg-green-500 h-2 rounded" style="width:${pctMastered}%"></div></div>
                </div>
            </div>
        </div>

        <button onclick="goBackToHome()" class="bg-yellow-400 text-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-300 w-full max-w-md mb-8 transition-transform transform hover:scale-105">BACK TO DASHBOARD</button>
        
        <h3 class="text-left text-white font-bold mb-4 border-b border-gray-700 pb-2">Detailed Review</h3>
        <div id="detailed-review" class="text-left space-y-4">
            ${listHTML}
        </div>
    `;

    const resultContainer = document.getElementById('result-screen');
    if (resultContainer) {
        resultContainer.innerHTML = resultsHTML;
        resultContainer.classList.remove('hidden');
    }
}

// --- LÓGICA DE ACTIVIDAD (DASHBOARD) ---
function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

const mockUserActivity = {
    '2023-10-01': true, '2023-10-02': true, '2023-10-05': true,
    '2023-10-10': true, '2023-10-11': true, '2023-10-12': true,
    '2023-10-25': true,
    '2025-11-25': true 
};

function renderMiniActivity() {
    const container = document.getElementById('activity-dots-container'); 
    if(!container) return;
    
    container.innerHTML = '';
    const today = new Date();
    const daysToShow = 9; 
    
    for (let i = daysToShow - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = d.getDate().toString().padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${monthStr}-${dayStr}`;
        
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (mockUserActivity[dateStr]) dot.classList.add('active'); 
        container.appendChild(dot);
    }
}

function openActivityModal() {
    const modal = document.getElementById('activity-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        renderFullCalendar();
    }
}

function closeActivityModal() {
    const modal = document.getElementById('activity-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function renderFullCalendar() {
    const container = document.getElementById('full-calendar-container');
    if(!container) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 
    const daysInMonth = getDaysInMonth(year, month);
    
    let html = `
        <h4 style="text-align:center; color:var(--accent); margin-bottom:10px; font-weight:bold;">${new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h4>
        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:5px; text-align:center;">`;
    
    ['S','M','T','W','T','F','S'].forEach(d => {
        html += `<div style="color:#666; font-size:0.8rem; font-weight:bold;">${d}</div>`;
    });

    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const monthStr = (month + 1).toString().padStart(2, '0');
        const dayStr = i.toString().padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;

        const isActive = mockUserActivity[dateStr] === true;
        const isCurrentDay = d.toDateString() === now.toDateString();
        
        let color = 'background:#222; color:#555;';
        let border = 'border:1px solid #333;';
        
        if(isActive) { color = 'background:#10b981; color:black; font-weight:bold;'; border = 'border:1px solid #10b981;'; }
        if(isCurrentDay) { border = 'border:2px solid var(--accent); box-shadow:0 0 5px var(--accent);'; }
        
        html += `<div style="${color} ${border} border-radius:4px; padding:8px 0; font-size:0.9rem;">${i}</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

/* =========================================
   CORE NAVIGATION & UI LOGIC
   ========================================= */

// --- GESTIÓN DE VISTAS (Navegación) ---
function switchView(targetId) {
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard) dashboard.classList.add('hidden');

    const views = [
        'learning-view', 'simulation-view', 'pomodoro-view', 
        'selection-view', 'pomodoro-timer-view', 'quiz-settings-modal'
    ];
    
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(targetId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in');
    }
}

function showLearningLab() { switchView('learning-view'); }
function showSimulationLab() { switchView('simulation-view'); }
function showPomodoro() { switchView('pomodoro-view'); }

function goBackToDashboard() {
    const views = ['learning-view', 'simulation-view', 'pomodoro-view', 'selection-view', 'pomodoro-timer-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const dbContent = document.getElementById('dashboard-content');
    if (dbContent) {
        dbContent.classList.remove('hidden');
        dbContent.classList.add('fade-in');
    }
}

function goBackToLearning() { switchView('learning-view'); }
function goBackToPomodoro() { switchView('pomodoro-view'); }


// --- SELECTION VIEW LOGIC ---
function openSelectionView(mode) {
    currentSelectionMode = mode;

    const titleEl = document.getElementById('selection-mode-title');
    if (titleEl) {
        if (mode === 'standalone') titleEl.innerText = 'Stand Alone Practice';
        else if (mode === 'itemsets') titleEl.innerText = 'Item Sets';
        else if (mode === 'simulation') titleEl.innerText = 'Customize Simulation';
    }

    const list = document.getElementById('dynamic-cat-list');
    if (list) {
        list.innerHTML = `
            <div class="subject-item active" onclick="this.classList.toggle('active')"><div class="custom-checkbox"></div> Oral Pathology</div>
            <div class="subject-item" onclick="this.classList.toggle('active')"><div class="custom-checkbox"></div> Pharmacology</div>
            <div class="subject-item" onclick="this.classList.toggle('active')"><div class="custom-checkbox"></div> Anatomy</div>
            <div class="subject-item" onclick="this.classList.toggle('active')"><div class="custom-checkbox"></div> Operative Dentistry</div>
        `;
    }
    
    switchView('selection-view');
}

function openQuizSettings() {
    const modal = document.getElementById('quiz-settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        
        const select = document.getElementById('quiz-count');
        if(select && select.options.length === 0) {
            select.innerHTML = `
                <option value="10">10 Questions</option>
                <option value="20">20 Questions</option>
                <option value="50">50 Questions</option>
            `;
        }
    }
}

function closeQuizSettings() {
    const modal = document.getElementById('quiz-settings-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

// 5. START QUIZ
function startQuiz() {
    const count = document.getElementById('quiz-count').value;
    window.location.href = `quiz_engine.html?mode=${currentSelectionMode}&count=${count}`;
}

function startQuizEngine(mode) {
    window.location.href = `quiz_engine.html?mode=${mode}&count=50`; 
}


// --- QUICK NOTES LOGIC ---
async function getCurrentUserId() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        return session.user.id;
    }
    return '00000000-0000-0000-0000-000000000000'; 
}

function openNotesModal() {
    const modal = document.getElementById('notes-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active'); 
        loadNotes(); 
    }
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const text = input.value.trim();
    if (!text) return;

    const userId = await getCurrentUserId();
    if (!userId) {
        alert("Please log in to save notes.");
        return;
    }
    
    const { error } = await _supabase
        .from('user_notes')
        .insert({ user_id: userId, content: text });
        
    if (error) {
        console.error('Error saving note to Supabase:', error);
        alert('Error saving note: ' + error.message);
    } else {
        input.value = ''; 
        loadNotes(); 
    }
}

async function loadNotes() {
    const container = document.getElementById('notes-list-container');
    if(!container) return;
    
    container.innerHTML = '<div style="color:var(--accent); text-align:center; padding:20px;">Loading notes from server...</div>';

    const userId = await getCurrentUserId();
    if (!userId) {
        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Please log in to load notes.</div>';
        return;
    }
    
    const { data: notes, error } = await _supabase
        .from('user_notes')
        .select('content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading notes from Supabase:', error);
        container.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Error loading notes.</div>';
        return;
    }
    
    if (notes.length === 0) {
        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">No notes yet. Start typing above!</div>';
        return;
    }

    container.innerHTML = notes.map(n => `
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; margin-bottom:8px; border-left:3px solid var(--accent);">
            <div style="color:#eee;">${n.content}</div>
            <div style="color:#666; font-size:0.7rem; margin-top:5px;">${new Date(n.created_at).toLocaleDateString()} ${new Date(n.created_at).toLocaleTimeString()}</div>
        </div>
    `).join('');
}


// --- IA LAB LOGIC ---
function openAIModal(mode) {
    const modal = document.getElementById('ai-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        document.getElementById('ai-input').focus();
    }
}

function closeAIModal() {
    const modal = document.getElementById('ai-modal');
    if(modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

// BUSCADOR Y REDIRECCIÓN DIRECTA
function callGemini() {
    const inputEl = document.getElementById('ai-input');
    const outputEl = document.getElementById('ai-output');
    
    if(!inputEl) return;

    const query = inputEl.value.trim();

    if (!query) {
        alert("Please enter a keyword.");
        return;
    }
    if (query.includes(" ")) {
        alert("Please enter only ONE keyword (e.g. 'Ameloblastoma').");
        return;
    }
    
    outputEl.style.display = 'block';
    outputEl.innerHTML = '<div style="color:var(--accent);">🔍 Searching database...</div>';

    setTimeout(() => {
        window.location.href = `quiz_engine.html?mode=search&term=${encodeURIComponent(query)}`;
    }, 1000);
}


// --- POMODORO TIMER LOGIC ---
let pomoInterval;
let pomoTime = 25 * 60; 
let isPomoRunning = false;
let pMode = 'classic'; 

function openPomodoroSession() {
    switchView('pomodoro-timer-view');
    resetPomo();
}

function updatePomoDisplay() {
    const m = Math.floor(pomoTime / 60).toString().padStart(2, '0');
    const s = (pomoTime % 60).toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    if(display) display.innerText = `${m}:${s}`;
}

function toggleTimer() {
    const btn = document.getElementById('play-icon');
    
    if(isPomoRunning) {
        clearInterval(pomoInterval);
        isPomoRunning = false;
        if(btn) btn.innerText = "▶";
    } else {
        isPomoRunning = true;
        if(btn) btn.innerText = "❚❚";
        pomoInterval = setInterval(() => {
            if(pomoTime > 0) {
                pomoTime--;
                updatePomoDisplay();
            } else {
                clearInterval(pomoInterval);
                alert("Time is up!");
                isPomoRunning = false;
                if(btn) btn.innerText = "▶";
            }
        }, 1000);
    }
}

function resetPomo() {
    clearInterval(pomoInterval);
    isPomoRunning = false;
    pomoTime = pMode === 'classic' ? 25 * 60 : 50 * 60;
    updatePomoDisplay();
    const btn = document.getElementById('play-icon');
    if(btn) btn.innerText = "▶";
}


// --- AUTHENTICATION ---
async function logout() {
    if(typeof _supabase !== 'undefined') {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    } else {
        window.location.href = 'index.html';
    }
}

// --- LOGIC DE FECHA Y TIMER (CON SUPABASE) ---

// 1. Inicializar al cargar la página
async function initCountdown() {
    const badge = document.getElementById('countdown-badge');
    if (!badge) return;

    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        badge.innerText = "Set Date";
        return;
    }

    const { data, error } = await _supabase
        .from('user_settings')
        .select('exam_date')
        .eq('user_id', session.user.id)
        .single();

    if (data && data.exam_date) {
        updateDaysLeftUI(data.exam_date);
        const dateInput = document.getElementById('exam-date-input');
        if(dateInput) dateInput.value = data.exam_date;
    } else {
        badge.innerText = "📅 Set Exam Date";
    }
}

// 2. Guardar fecha en Supabase
async function saveExamDate() {
    const dateInput = document.getElementById('exam-date-input');
    const dateVal = dateInput?.value;
    
    if (!dateVal) return alert("Please select a date.");

    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return alert("Please log in to save dates.");

    const { error } = await _supabase
        .from('user_settings')
        .upsert({ 
            user_id: session.user.id, 
            exam_date: dateVal,
            updated_at: new Date()
        });

    if (error) {
        console.error('Error saving date:', error);
        alert("Error saving date.");
    } else {
        updateDaysLeftUI(dateVal);
        closeDateModal();
    }
}

// 3. Actualizar la interfaz (Cálculo de días)
function updateDaysLeftUI(dateString) {
    const target = new Date(dateString);
    const today = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);

    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    const badge = document.getElementById('countdown-badge');
    if (badge) {
        if (diffDays < 0) {
            badge.innerHTML = `<span style="color:#ef4444">Exam Passed</span>`;
        } else if (diffDays === 0) {
            badge.innerHTML = `<span style="color:#facc15; animation: pulse 1s infinite;">IT'S TODAY!</span>`;
        } else {
            badge.innerText = `${diffDays} Days Left`;
        }
    }
}

// 4. Funciones del Modal
function openDateModal() {
    const modal = document.getElementById('date-setup-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
    }
}

function closeDateModal() {
    const modal = document.getElementById('date-setup-modal');
    if(modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

function setPomodoroMode(mode) {
    pMode = mode;
    console.log(`Pomodoro mode set to: ${mode}`);
    resetPomo();
}


// --- CARGA DE DATOS Y ESTADÍSTICAS (VERSIÓN SEGURA) ---

async function loadUserData() {
    try {
        const { data: { user }, error } = await _supabase.auth.getUser();

        if (error) throw error;

        if (user) {
            const email = user.email;
            
            let displayName = "User";
            if (email) {
                const namePart = email.split('@')[0];
                displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
            }

            // Usamos safeSetText para actualizar UI sin errores
            safeSetText('user-name', displayName);
            safeSetText('user-email', email);
            safeSetText('user-name-display', displayName);

            console.log("User data loaded:", email);
        }
    } catch (err) {
        console.error("Error loading user data:", err.message);
    }
}

async function loadDashboardStats() {
    try {
        const { data: questions, error } = await _supabase
            .from('questions_bank')
            .select('category, is_active');

        if (error) throw error;

        // Calcular totales
        const stats = {
            general: questions.filter(q => q.category === 'General').length,
            oralPathology: questions.filter(q => q.category === 'Oral Pathology').length,
            prostho: questions.filter(q => q.category === 'Prosthodontics').length,
            pharma: questions.filter(q => q.category === 'Pharmacology').length,
            operative: questions.filter(q => q.category === 'Operative Dentistry').length,
            endo: questions.filter(q => q.category === 'Endodontics').length,
            perio: questions.filter(q => q.category === 'Periodontics').length,
            ortho: questions.filter(q => q.category === 'Orthodontics').length,
            anatomy: questions.filter(q => q.category === 'Oral Anatomy').length,
            surgery: questions.filter(q => q.category === 'Oral Surgery').length,
            patient: questions.filter(q => q.category === 'Patient Management').length
        };

        const total = questions.length;

        // Usar safeSetText en lugar de document.getElementById directo
        safeSetText('total-questions', total);
        safeSetText('cat-general-total', stats.general);
        safeSetText('cat-pathology-total', stats.oralPathology);
        safeSetText('cat-prostho-total', stats.prostho);
        safeSetText('cat-pharma-total', stats.pharma);
        safeSetText('cat-operative-total', stats.operative);
        safeSetText('cat-endo-total', stats.endo);
        safeSetText('cat-perio-total', stats.perio);
        safeSetText('cat-ortho-total', stats.ortho);
        safeSetText('cat-anatomy-total', stats.anatomy);
        safeSetText('cat-surgery-total', stats.surgery);
        safeSetText('cat-patient-total', stats.patient);

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    
    // Verificar Auth si existe la función externa
    if (typeof checkAuth === 'function') {
        checkAuth();
    }

    const path = window.location.pathname;

    // Verificar si estamos en Dashboard O en Mobile
    if (path.includes('dashboard.html') || path.includes('mobile.html')) {
        console.log("Vista detectada: Cargando datos de usuario y estadísticas...");
        
        await loadUserData();
        loadDashboardStats();
        
        // Configurar botón de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
        
        // Listeners seguros (con Optional Chaining ?.)
        // ** CAMBIO AQUÍ: Se asigna la función startRandomRun al botón **
        document.getElementById('btn-daily-run')?.addEventListener('click', startRandomRun);
        document.getElementById('card-notes-desktop')?.addEventListener('click', openNotesModal);
    }

    // Inicializar Quiz si estamos en esa vista
    if (document.getElementById('question-container')) {
        startQuiz();
    }
});
