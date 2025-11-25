// --- FUNCIONES Y VARIABLES GLOBALES (DEBE REEMPLAZAR EL CONTENIDO DE app.js) ---

// Las variables de estado (como userStatus, quizData, etc.) se asumen definidas
// en quiz_engine.html o en la inicialización principal de la aplicación.
// Esta es la lógica que debe estar disponible globalmente.

// 1. FUNCIÓN PARA EL DAILY RUN (Llamada desde dashboard.html)
function startDailyRun() {
    console.log("Starting Daily Run...");
    // Redirige al quiz engine forzando modo 'daily' y 10 preguntas
    window.location.href = 'quiz_engine.html?mode=daily&count=10';
}

// Nota: La variable 'let userStatus = { learning: 0, reviewing: 0, mastered: 0 };'
// y 'let userAnswers = {};' deben estar definidas en la parte superior del script de quiz_engine.html.
// Aquí solo se incluyen las funciones que dependen de ese estado.

// 2. FUNCIÓN HANDLESTATUS (para los botones del semáforo en quiz_engine.html)
function handleStatus(status) {
    // Estas variables globales (userStatus, nextQuestion) deben existir en el ámbito de quiz_engine.html
    if (typeof userStatus !== 'undefined' && userStatus[status] !== undefined) {
        userStatus[status]++;
    }
    console.log(`Question marked as: ${status}`);
    
    if (typeof nextQuestion === 'function') {
        nextQuestion();
    } else {
        console.warn("nextQuestion() not found. Ensure app.js is loaded in the correct context (quiz_engine.html).");
    }
}

// 3. FUNCIÓN FINISHQUIZ (Lógica de resultados actualizada para quiz_engine.html)
function finishQuiz() {
    // Se asume que quizData, userAnswers, timerInterval, etc., son variables globales.

    // Lógica para detener la simulación si está corriendo
    if (typeof timerInterval !== 'undefined') {
        clearInterval(timerInterval);
    }
    
    // Ocultar elementos de la interfaz de simulación
    const inbdeHeader = document.querySelector('.inbde-header');
    const inbdeFooter = document.querySelector('.inbde-footer');
    const mainContainer = document.getElementById('main-container');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const quizContent = document.getElementById('quiz-content');
    const reviewModal = document.getElementById('review-modal');

    if (inbdeHeader) inbdeHeader.classList.add('hidden');
    if (inbdeFooter) inbdeFooter.classList.add('hidden');
    
    // Ocultar paneles de juego
    if (mainContainer) mainContainer.style.display = 'block';
    if (leftPanel) leftPanel.classList.add('hidden');
    if (rightPanel) rightPanel.style.width = '100%'; // Usar ancho completo
    if (quizContent) quizContent.classList.add('hidden');
    if (reviewModal) reviewModal.style.display = 'none';
    
    // 1. Cálculos de Aciertos (Score Técnico)
    let correct = 0;
    const total = typeof quizData !== 'undefined' ? quizData.length : 0;
    
    // Generar lista de revisión detallada
    let listHTML = '';
    if (typeof quizData !== 'undefined' && quizData.length > 0) {
        quizData.forEach((q, idx) => {
            const userAns = userAnswers[q.id];
            const isCorrect = userAns && q.correct_answer && 
                                userAns.trim().includes(q.correct_answer.trim());
            
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

    // 2. Cálculos de Semáforo (Self-Assessment)
    const totalStatus = typeof userStatus !== 'undefined' ? userStatus.learning + userStatus.reviewing + userStatus.mastered : 0; 
    const safeTotal = totalStatus > 0 ? totalStatus : 1; 
    
    const pctLearning = Math.round((userStatus.learning / safeTotal) * 100);
    const pctReviewing = Math.round((userStatus.reviewing / safeTotal) * 100);
    const pctMastered = Math.round((userStatus.mastered / safeTotal) * 100);

    // 3. Inyectar HTML de Resultados
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


// --- LÓGICA DE ACTIVIDAD (Funciones auxiliares para el dashboard) ---

// Función auxiliar para obtener días del mes
function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

// Datos simulados de actividad (En producción, esto vendría de Supabase 'user_analytics')
// Formato: 'YYYY-MM-DD': true
const mockUserActivity = {
    '2023-10-01': true, '2023-10-02': true, '2023-10-05': true,
    '2023-10-10': true, '2023-10-11': true, '2023-10-12': true,
    '2023-10-25': true,
    '2025-11-25': true // Añadir el día de hoy (ejemplo)
};

// Renderizar los puntos mini en el dashboard
function renderMiniActivity() {
    // CORRECCIÓN: Usar el ID 'activity-dots-container' que existe en dashboard.html
    const container = document.getElementById('activity-dots-container'); 
    if(!container) return;
    
    container.innerHTML = '';
    const today = new Date();
    const daysToShow = 9; // Mostrar 9 días (tamaño del grid original en el HTML)
    
    for (let i = daysToShow - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        // Formato: YYYY-MM-DD
        const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayStr = d.getDate().toString().padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${monthStr}-${dayStr}`;
        
        const dot = document.createElement('div');
        dot.className = 'dot';
        
        if (mockUserActivity[dateStr]) dot.classList.add('active'); 
        
        container.appendChild(dot);
    }
}

// Lógica del Modal de Calendario
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
    // Usamos el mes actual para la demo
    const year = now.getFullYear();
    const month = now.getMonth(); 
    const daysInMonth = getDaysInMonth(year, month);
    
    // Contenido del calendario
    let html = `
        <h4 style="text-align:center; color:var(--accent); margin-bottom:10px; font-weight:bold;">${new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h4>
        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:5px; text-align:center;">`;
    
    // Headers (Días de la semana)
    ['S','M','T','W','T','F','S'].forEach(d => {
        html += `<div style="color:#666; font-size:0.8rem; font-weight:bold;">${d}</div>`;
    });

    // Celdas vacías de relleno
    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }

    // Días del mes
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
   CORE NAVIGATION & UI LOGIC (FIXES)
   ========================================= */

// --- 1. GESTIÓN DE VISTAS (Navegación) ---

// Función genérica para cambiar entre pantallas (Dashboard, Learning, Simulation, etc.)
function switchView(targetId) {
    // 1. Ocultar el Dashboard principal
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard) dashboard.classList.add('hidden');

    // 2. Ocultar todas las sub-vistas conocidas
    const views = [
        'learning-view', 
        'simulation-view', 
        'pomodoro-view', 
        'selection-view', 
        'pomodoro-timer-view',
        'quiz-settings-modal' // Por si acaso quedó abierto
    ];
    
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // 3. Mostrar la vista objetivo
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in'); // Efecto de entrada
    } else {
        console.error(`View with ID '${targetId}' not found.`);
    }
}

// Funciones específicas llamadas por los botones onclick
function showLearningLab() { switchView('learning-view'); }
function showSimulationLab() { switchView('simulation-view'); }
function showPomodoro() { switchView('pomodoro-view'); }

function goBackToDashboard() {
    // Ocultar sub-vistas
    const views = ['learning-view', 'simulation-view', 'pomodoro-view', 'selection-view', 'pomodoro-timer-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Mostrar Dashboard
    const dbContent = document.getElementById('dashboard-content');
    if (dbContent) {
        dbContent.classList.remove('hidden');
        dbContent.classList.add('fade-in');
    }
}

function goBackToLearning() { switchView('learning-view'); }
function goBackToPomodoro() { switchView('pomodoro-view'); }


// --- 2. SELECTION VIEW LOGIC (Categorías dinámicas) ---
function openSelectionView(mode) {
    // Cambiar título según el modo
    const titleEl = document.getElementById('selection-mode-title');
    if (titleEl) {
        if (mode === 'standalone') titleEl.innerText = 'Stand Alone Practice';
        else if (mode === 'itemsets') titleEl.innerText = 'Item Sets';
        else if (mode === 'simulation') titleEl.innerText = 'Customize Simulation';
    }

    // Aquí simularíamos carga de categorías (o llamarías a Supabase)
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

// Abrir configuración del Quiz (cantidad de preguntas)
function openQuizSettings() {
    const modal = document.getElementById('quiz-settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        
        // Rellenar select si está vacío
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

function startQuiz() {
    const count = document.getElementById('quiz-count').value;
    // Redirigir al engine con los parámetros
    window.location.href = `quiz_engine.html?mode=practice&count=${count}`;
}

// Función genérica para botones de "Start" directo
function startQuizEngine(mode) {
    window.location.href = `quiz_engine.html?mode=${mode}&count=50`; // Default count
}


// --- 3. QUICK NOTES LOGIC ---
function openNotesModal() {
    const modal = document.getElementById('notes-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active'); // Clase para opacidad CSS
        loadNotes(); // Cargar notas guardadas
    }
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if(modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function saveNote() {
    const input = document.getElementById('new-note-input');
    const text = input.value.trim();
    if (!text) return;

    // Guardar en LocalStorage (Persistencia básica)
    let notes = JSON.parse(localStorage.getItem('inbde_user_notes') || '[]');
    notes.push({ text: text, date: new Date().toISOString() });
    localStorage.setItem('inbde_user_notes', JSON.stringify(notes));

    input.value = ''; // Limpiar
    loadNotes(); // Recargar lista
}

function loadNotes() {
    const container = document.getElementById('notes-list-container');
    if(!container) return;

    const notes = JSON.parse(localStorage.getItem('inbde_user_notes') || '[]');
    
    if (notes.length === 0) {
        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">No notes yet. Start typing above!</div>';
        return;
    }

    // Renderizar notas (más recientes primero)
    container.innerHTML = notes.reverse().map(n => `
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; margin-bottom:8px; border-left:3px solid var(--accent);">
            <div style="color:#eee;">${n.text}</div>
            <div style="color:#666; font-size:0.7rem; margin-top:5px;">${new Date(n.date).toLocaleDateString()} ${new Date(n.date).toLocaleTimeString()}</div>
        </div>
    `).join('');
}


// --- 4. IA LAB LOGIC ---
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

async function callGemini() {
    const inputEl = document.getElementById('ai-input');
    const outputEl = document.getElementById('ai-output');
    
    if(!inputEl || !inputEl.value.trim()) return;
    
    // UI de carga
    outputEl.style.display = 'block';
    outputEl.innerHTML = '<div style="color:var(--accent);">🤖 Thinking...</div>';

    // Simulación (Aquí conectarías tu API Key real si la tienes segura en backend)
    setTimeout(() => {
        outputEl.innerHTML = `
            <strong>AI Result:</strong><br>
            I found 3 relevant questions related to "<em>${inputEl.value}</em>".<br><br>
            <button class="btn-start" onclick="startQuizEngine('ai_generated')" style="padding:5px 10px; font-size:0.8rem;">Start Generated Quiz</button>
        `;
    }, 1500);
}


// --- 5. POMODORO TIMER LOGIC ---
let pomoInterval;
let pomoTime = 25 * 60; // 25 minutos
let isPomoRunning = false;

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
        // Pausar
        clearInterval(pomoInterval);
        isPomoRunning = false;
        if(btn) btn.innerText = "▶";
    } else {
        // Iniciar
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
    pomoTime = 25 * 60;
    updatePomoDisplay();
    const btn = document.getElementById('play-icon');
    if(btn) btn.innerText = "▶";
}


// --- 6. AUTHENTICATION (Logout) ---
async function logout() {
    if(typeof _supabase !== 'undefined') {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    } else {
        // Fallback si supabase no está definido globalmente
        window.location.href = 'index.html';
    }
}
