// app.js

// --- CONFIGURACIÓN CENTRAL DE SUPABASE ---
const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- VARIABLES GLOBALES ---
let currentSelectionMode = 'practice';
// Asegura que el quiz no falle si userStatus no está definido
if (typeof userStatus === 'undefined') var userStatus = { learning: 0, reviewing: 0, mastered: 0 };

// --- FUNCIONES AUXILIARES DE UI ---
function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = text;
}

// --- NAVEGACIÓN Y VISTAS ---
function switchView(targetId) {
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard) dashboard.classList.add('hidden');

    const views = [
        'learning-view', 'simulation-view', 'pomodoro-view', 
        'selection-view', 'pomodoro-timer-view', 'quiz-settings-modal',
        'stats-view', 'profile-view'
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
    const views = [
        'learning-view', 'simulation-view', 'pomodoro-view', 
        'selection-view', 'pomodoro-timer-view', 'quiz-settings-modal',
        'stats-view', 'profile-view'
    ];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const dbContent = document.getElementById('dashboard-content');
    if (dbContent) {
        dbContent.classList.remove('hidden');
        dbContent.classList.add('fade-in');
    }
    
    // Resetear navegación móvil visualmente
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-home-mobile')?.classList.add('active');
}

// --- LOGICA DE PROGRESO DE CATEGORÍAS ---
async function renderCategoriesWithProgress() {
    const list = document.getElementById('dynamic-cat-list');
    if (!list) return;

    list.innerHTML = '<div style="padding:20px; color:#666;">Cargando progreso...</div>';

    try {
        const userId = await getCurrentUserId();
        if (!userId) { list.innerHTML = 'Inicia sesión.'; return; }

        const [questionsRes, progressRes] = await Promise.all([
            _supabase.from('questions_bank').select('id, category').eq('is_active', true),
            _supabase.from('user_progress').select('question_id').eq('user_id', userId)
        ]);

        if (questionsRes.error) throw questionsRes.error;
        if (progressRes.error) throw progressRes.error;

        const stats = {};
        const answeredIds = new Set(progressRes.data.map(p => p.question_id));

        questionsRes.data.forEach(q => {
            const cat = q.category || 'General';
            if (!stats[cat]) stats[cat] = { total: 0, answered: 0 };
            stats[cat].total++;
            if (answeredIds.has(q.id)) stats[cat].answered++;
        });

        list.innerHTML = '';
        const sortedCategories = Object.keys(stats).sort();

        if (sortedCategories.length === 0) {
            list.innerHTML = '<div style="padding:20px;">No se encontraron categorías.</div>';
            return;
        }

        sortedCategories.forEach(cat => {
            const data = stats[cat];
            const percent = data.total === 0 ? 0 : Math.round((data.answered / data.total) * 100);

            const card = document.createElement('div');
            card.className = 'category-card';
            card.onclick = () => {
                document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            };

            card.innerHTML = `
                <div class="cat-header-flex">
                    <span class="cat-name">${cat}</span>
                    <span class="cat-percent">${percent}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${percent}%"></div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (error) {
        console.error('Error cargando categorías:', error);
        list.innerHTML = '<div style="color:red; padding:20px;">Error.</div>';
    }
}

function openSelectionView(mode) {
    currentSelectionMode = mode;
    const titleEl = document.getElementById('selection-mode-title');
    if (titleEl) {
        if (mode === 'standalone') titleEl.innerText = 'Stand Alone Practice';
        else if (mode === 'itemsets') titleEl.innerText = 'Item Sets';
        else if (mode === 'simulation') titleEl.innerText = 'Customize Simulation';
    }
    switchView('selection-view');
    // Solo cargar categorías si estamos en standalone y no estamos en móvil (o según prefieras)
    if (mode === 'standalone') {
        renderCategoriesWithProgress(); 
    }
}

// --- NOTAS (QUICK NOTES) ---
async function getCurrentUserId() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.user.id : null;
}

function openNotesModal() {
    const modal = document.getElementById('notes-modal');
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('active'); loadNotes(); }
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) { modal.classList.remove('active'); setTimeout(() => modal.classList.add('hidden'), 300); }
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const text = input.value.trim();
    if (!text) return;
    const userId = await getCurrentUserId();
    if (!userId) { alert("Please log in."); return; }
    
    const btn = document.getElementById('btn-save-note');
    btn.innerText = "...";
    
    const { error } = await _supabase.from('user_notes').insert({ user_id: userId, content: text });
    btn.innerText = "SAVE";
    
    if (error) console.error(error);
    else { input.value = ''; loadNotes(); }
}

async function loadNotes() {
    const container = document.getElementById('notes-list-container');
    if(!container) return;
    container.innerHTML = 'Loading...';
    
    const userId = await getCurrentUserId();
    if (!userId) { container.innerHTML = 'Log in to see notes.'; return; }
    
    const { data: notes } = await _supabase.from('user_notes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    
    if (!notes || notes.length === 0) { container.innerHTML = 'No notes yet.'; return; }
    
    container.innerHTML = notes.map(n => `
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; margin-bottom:8px; border-left:3px solid var(--accent);">
            <div style="color:#eee;">${n.content}</div>
            <div style="color:#666; font-size:0.7rem; margin-top:5px;">${new Date(n.created_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

// --- IA LAB ---
function openAIModal() {
    const modal = document.getElementById('ai-modal');
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('active'); }
}

function closeAIModal() {
    const modal = document.getElementById('ai-modal');
    if(modal) { modal.classList.remove('active'); setTimeout(() => modal.classList.add('hidden'), 300); }
}

function callGemini() {
    const input = document.getElementById('ai-input');
    if(!input || !input.value.trim()) return;
    
    // DETECCIÓN INTELIGENTE DE MÓVIL PARA REDIRECCIÓN IA
    const isMobile = window.location.href.includes('mobile.html');
    const targetPage = isMobile ? 'quiz_engine_mobile.html' : 'quiz_engine.html';

    // Simular carga visual
    const output = document.getElementById('ai-output');
    if(output) {
        output.style.display = 'block';
        output.innerHTML = '<div style="color:var(--accent);">🔍 Searching...</div>';
    }
    
    setTimeout(() => {
        window.location.href = `${targetPage}?mode=search&term=${encodeURIComponent(input.value.trim())}`;
    }, 800);
}

// --- POMODORO ---
let pomoInterval; let pomoTime = 25 * 60; let isPomoRunning = false;

function openPomodoroSession() { switchView('pomodoro-timer-view'); resetPomo(); }

function updatePomoDisplay() {
    const m = Math.floor(pomoTime / 60).toString().padStart(2, '0');
    const s = (pomoTime % 60).toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    if(display) display.innerText = `${m}:${s}`;
}

function toggleTimer() {
    const btn = document.getElementById('btn-pomo-toggle');
    if(isPomoRunning) {
        clearInterval(pomoInterval); isPomoRunning = false; if(btn) btn.innerText = "▶";
    } else {
        isPomoRunning = true; if(btn) btn.innerText = "❚❚";
        pomoInterval = setInterval(() => {
            if(pomoTime > 0) { pomoTime--; updatePomoDisplay(); } else { clearInterval(pomoInterval); isPomoRunning = false; }
        }, 1000);
    }
}

function resetPomo() { clearInterval(pomoInterval); isPomoRunning = false; pomoTime = 25 * 60; updatePomoDisplay(); const btn = document.getElementById('btn-pomo-toggle'); if(btn) btn.innerText = "▶"; }

// --- ACTIVITY LOG & HEADER ---
function openActivityModal() { const modal = document.getElementById('activity-modal'); if (modal) { modal.classList.remove('hidden'); modal.classList.add('active'); renderFullCalendar(); } }

function closeActivityModal() { const modal = document.getElementById('activity-modal'); if (modal) { modal.classList.remove('active'); setTimeout(() => modal.classList.add('hidden'), 300); } }

function renderMiniActivity() {
    const container = document.getElementById('activity-dots-container'); 
    if(!container) return; container.innerHTML = '';
    for (let i = 0; i < 10; i++) { const dot = document.createElement('div'); dot.className = 'dot'; if (Math.random() > 0.5) dot.classList.add('active'); container.appendChild(dot); }
}

function renderFullCalendar() { 
    const container = document.getElementById('full-calendar-container'); 
    if(!container) return; 
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let html = `<div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:5px; text-align:center;">`;
    for(let i=1; i<=daysInMonth; i++) {
        html += `<div style="background:${Math.random()>0.7?'#10b981':'#222'}; border-radius:4px; padding:5px; font-size:0.8rem;">${i}</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// --- FECHA / COUNTDOWN ---
async function initCountdown() {
    const badge = document.getElementById('countdown-badge');
    if (!badge) return;
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) { badge.innerText = "Set Date"; return; }
    const { data } = await _supabase.from('user_settings').select('exam_date').eq('user_id', session.user.id).single();
    if (data && data.exam_date) updateDaysLeftUI(data.exam_date);
}

function updateDaysLeftUI(dateString) {
    const target = new Date(dateString); const today = new Date();
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    const badge = document.getElementById('countdown-badge'); if(badge) badge.innerText = diff > 0 ? `${diff} Days Left` : "Exam Day!";
}

function openDateModal() { document.getElementById('date-setup-modal')?.classList.remove('hidden'); document.getElementById('date-setup-modal')?.classList.add('active'); }
function closeDateModal() { document.getElementById('date-setup-modal')?.classList.remove('active'); setTimeout(() => document.getElementById('date-setup-modal')?.classList.add('hidden'), 300); }

async function saveExamDate() {
    const dateInput = document.getElementById('exam-date-input');
    if (!dateInput || !dateInput.value) return;
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) { await _supabase.from('user_settings').upsert({ user_id: session.user.id, exam_date: dateInput.value }); updateDaysLeftUI(dateInput.value); closeDateModal(); }
}

// --- LÓGICA QUIZ ENGINE Y ESTADÍSTICAS (CRÍTICO: RESTAURADO) ---
function startRandomRun() {
    // DETECCIÓN INTELIGENTE DE MÓVIL
    if (window.location.href.includes('mobile.html')) {
        window.location.href = 'quiz_engine_mobile.html?mode=random&count=10';
    } else {
        window.location.href = 'quiz_engine.html?mode=random&count=10';
    }
}

function handleStatus(status) {
    // Esta función es llamada por el Quiz Engine
    if (userStatus[status] !== undefined) userStatus[status]++;
    if (typeof nextQuestion === 'function') nextQuestion(); 
}

function finishQuiz() {
    if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
    
    // Ocultar interfaz de quiz
    const quizContent = document.getElementById('quiz-content');
    const resultContainer = document.getElementById('result-screen');
    
    if(quizContent) quizContent.classList.add('hidden');
    
    // Calcular resultados simples
    let correct = 0;
    const total = typeof quizData !== 'undefined' ? quizData.length : 0;
    
    if (typeof quizData !== 'undefined') {
        quizData.forEach(q => {
            const userAns = userAnswers[q.id];
            if (userAns && userAns === q.correct_answer) correct++;
        });
    }

    const html = `
        <div style="text-align:center; padding:40px;">
            <h1 style="color:var(--accent); font-size:3rem; margin-bottom:10px;">Session Complete</h1>
            <div style="font-size:5rem; font-weight:bold; color:white;">${Math.round(total === 0 ? 0 : (correct/total)*100)}%</div>
            <p style="color:#888;">${correct} out of ${total} correct</p>
            <button onclick="window.location.href='dashboard.html'" style="background:var(--accent); color:black; border:none; padding:15px 30px; font-weight:bold; border-radius:10px; margin-top:30px; cursor:pointer;">BACK TO DASHBOARD</button>
        </div>
    `;

    if (resultContainer) {
        resultContainer.innerHTML = html;
        resultContainer.classList.remove('hidden');
    } else {
        document.body.innerHTML = html;
    }
}

async function loadDashboardStats() {
    safeSetText('total-questions', '1,240'); // Simulado para visual
}

// --- AUTH & LOAD DATA ---
async function logout() { await _supabase.auth.signOut(); window.location.href = 'index.html'; }

async function loadUserData() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user && user.email) {
        const name = user.email.split('@')[0];
        safeSetText('user-name-display', name.charAt(0).toUpperCase() + name.slice(1));
        initCountdown();
    }
}

// =========================================================
// === INICIALIZACIÓN Y "WIRING" (CONEXIONES) ===
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    
    const path = window.location.pathname;
    // Detectar si estamos en móvil para evitar conflictos
    const isMobilePage = path.includes('mobile.html');

    if (path.includes('dashboard.html') || isMobilePage) {
        console.log("Inicializando App...");
        await loadUserData();
        loadDashboardStats(); // Restaurado
        renderMiniActivity();

        // --- LÓGICA COMÚN (AUTH, NOTAS, MODALES) ---
        // Estos elementos existen tanto en mobile.html como dashboard.html (o no causan conflicto si faltan)
        document.getElementById('btn-logout-desktop')?.addEventListener('click', logout);
        document.getElementById('card-activity-log')?.addEventListener('click', openActivityModal);
        
        // Notas (Desktop y Mobile tienen IDs distintos o compartidos)
        document.getElementById('card-notes-desktop')?.addEventListener('click', openNotesModal);
        document.getElementById('nav-notes-mobile')?.addEventListener('click', openNotesModal);
        document.getElementById('btn-save-note')?.addEventListener('click', saveNote);
        document.getElementById('btn-close-notes-modal')?.addEventListener('click', closeNotesModal);
        
        // IA
        document.getElementById('btn-ai-submit')?.addEventListener('click', callGemini);
        document.getElementById('btn-close-ai-modal')?.addEventListener('click', closeAIModal);
        
        // Actividad / Fecha
        document.getElementById('btn-close-activity-modal')?.addEventListener('click', closeActivityModal);
        document.getElementById('countdown-badge')?.addEventListener('click', openDateModal);
        const btnSaveDate = document.querySelector('#date-setup-modal button'); 
        if(btnSaveDate) btnSaveDate.onclick = saveExamDate;
        const btnCloseDate = document.querySelector('#date-setup-modal .close-btn');
        if(btnCloseDate) btnCloseDate.onclick = closeDateModal;
        
        // --- AQUÍ ESTÁ EL CAMBIO IMPORTANTE ---
        // SOLO ACTIVAMOS LA NAVEGACIÓN DE ESCRITORIO SI NO ESTAMOS EN MÓVIL
        if (!isMobilePage) {
            console.log("Modo Escritorio Detectado: Activando navegación desktop.");

            // Tarjetas Principales
            document.getElementById('card-learning-lab')?.addEventListener('click', showLearningLab);
            document.getElementById('card-simulation-lab')?.addEventListener('click', showSimulationLab);
            document.getElementById('card-pomodoro-lab')?.addEventListener('click', showPomodoro);
            document.getElementById('btn-daily-run')?.addEventListener('click', startRandomRun);
            document.getElementById('btn-ia-lab-start')?.addEventListener('click', openAIModal);

            // Botones Back
            document.getElementById('btn-back-learning')?.addEventListener('click', goBackToDashboard);
            document.getElementById('btn-back-simulation')?.addEventListener('click', goBackToDashboard);
            document.getElementById('btn-back-pomodoro')?.addEventListener('click', goBackToDashboard);
            document.getElementById('btn-back-selection')?.addEventListener('click', showLearningLab);

            // Botones internos Learning / Simulation
            document.getElementById('btn-learn-standalone')?.addEventListener('click', () => openSelectionView('standalone'));
            document.getElementById('btn-learn-itemsets')?.addEventListener('click', () => window.location.href = 'quiz_engine.html?mode=itemsets&count=20');

            document.getElementById('btn-sim-customize')?.addEventListener('click', () => openSelectionView('simulation'));
            document.getElementById('btn-sim-start')?.addEventListener('click', () => window.location.href = 'quiz_engine.html?mode=simulation');

            // Pomodoro Controls
            document.getElementById('btn-pomo-session')?.addEventListener('click', openPomodoroSession);
            document.getElementById('btn-pomo-toggle')?.addEventListener('click', toggleTimer);
            document.getElementById('btn-pomo-reset')?.addEventListener('click', resetPomo);
            document.getElementById('btn-back-timer')?.addEventListener('click', () => switchView('pomodoro-view'));

            // --- QUIZ START (MODIFICADO) ---
            // Se eliminó la lógica que abría el modal. Ahora inicia directamente.
            document.getElementById('btn-start-quiz-selection')?.addEventListener('click', () => {
                 // Al no pasar "&count=XX", el quiz_engine usará su valor por defecto (150 preguntas o lo que tenga configurado)
                 window.location.href = `quiz_engine.html?mode=${currentSelectionMode}`;
            });
            // Las escuchas del modal se han eliminado porque ya no se utiliza el modal.
        } 
        else {
            console.log("Modo Móvil Detectado: app.js no interferirá con la navegación.");
            // En modo móvil, app.js solo provee Supabase, utilidades y lógica global (notas, auth),
            // la navegación específica de tarjetas se maneja en el script inline de mobile.html.
        }
    }
});
