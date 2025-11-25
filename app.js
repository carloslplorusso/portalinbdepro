// --- FUNCIONES Y VARIABLES AGREGADAS/MODIFICADAS ---

// 1. NUEVA FUNCIÓN PARA EL DAILY RUN
function startDailyRun() {
    console.log("Starting Daily Run...");
    // Redirige al quiz engine forzando modo 'daily' y 10 preguntas
    window.location.href = 'quiz_engine.html?mode=daily&count=10';
}

// 2. NUEVA VARIABLE DE ESTADO (debe estar cerca de 'let userAnswers')
let userStatus = { learning: 0, reviewing: 0, mastered: 0 }; // NUEVO: Rastreador de semáforo

// 3. FUNCIÓN HANDLESTATUS (para los botones del semáforo)
function handleStatus(status) {
    // Incrementar el contador del estado seleccionado
    if (userStatus[status] !== undefined) {
        userStatus[status]++;
    }
    console.log(`Question marked as: ${status}`);
    // Asegúrate de que 'nextQuestion()' esté definida y avance la pregunta
    if (typeof nextQuestion === 'function') {
        nextQuestion();
    } else {
        console.error("nextQuestion() is not defined!");
    }
}

// 4. FUNCIÓN FINISHQUIZ (MODIFICADA para incluir métricas de Semáforo)
function finishQuiz() {
    // Asegúrate de que estas variables y funciones existan en tu ámbito global:
    // timerInterval, quizData, userAnswers, goBackToHome(), askGemini()

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
    const total = quizData.length;
    
    // Generar lista de revisión detallada
    let listHTML = '';
    quizData.forEach((q, idx) => {
        // Nota: En modo estudio, userAnswers guarda lo que clickearon primero
        const userAns = userAnswers[q.id];
        // Limpiamos strings para comparación segura
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

    // 2. Cálculos de Semáforo (Self-Assessment)
    const totalStatus = userStatus.learning + userStatus.reviewing + userStatus.mastered; 
    // Evitar división por cero si el usuario no terminó o saltó pasos
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
    '2023-10-25': true
};

// Renderizar los puntos mini en el dashboard (debe llamarse 'activity-dots-container' en dashboard.html)
function renderMiniActivity() {
    // Nota: Se asume que el contenedor en dashboard.html se llama 'activity-dots-container'
    const container = document.getElementById('activity-dots-container');
    if(!container) return;
    
    container.innerHTML = '';
    const today = new Date();
    const daysToShow = 14; // Mostrar últimos 14 días
    
    for (let i = daysToShow - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dot = document.createElement('div');
        dot.className = 'dot';
        // Simular si hubo actividad (random para demo, o usar mockUserActivity)
        // En producción: if (mockUserActivity[dateStr]) ...
        if (Math.random() > 0.5) dot.classList.add('active'); 
        
        container.appendChild(dot);
    }
}

// Lógica del Modal de Calendario (Asegúrate de que 'activity-modal' y 'full-calendar-container' existan en dashboard.html)
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
    const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
    
    let html = `<div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:5px; text-align:center; margin-top:10px;">`;
    
    // Headers
    ['S','M','T','W','T','F','S'].forEach(d => {
        html += `<div style="color:#666; font-size:0.8rem; font-weight:bold;">${d}</div>`;
    });

    // Días
    for (let i = 1; i <= daysInMonth; i++) {
        // Generar fecha string para comprobar
        // Lógica simplificada para demo
        const isActive = Math.random() > 0.6; // Simulación
        const color = isActive ? 'background:#10b981; color:black;' : 'background:#222; color:#555;';
        
        html += `<div style="${color} border-radius:4px; padding:8px 0; font-size:0.9rem;">${i}</div>`;
    }
    html += `</div>`;
    
    container.innerHTML = html;
}

// Nota: Asegúrate de llamar a renderMiniActivity() dentro de tu función de inicialización principal (e.g., initApp() o DOMContentLoaded) del dashboard.
// Por ejemplo: document.addEventListener('DOMContentLoaded', renderMiniActivity);
