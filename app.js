// app.js

// =========================================================
// 1. CONFIGURACIÓN CENTRAL Y VARIABLES GLOBALES
// =========================================================
const SUPABASE_URL = 'https://arumiloijqsxthlswojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydW1pbG9panFzeHRobHN3b2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzUzNTEsImV4cCI6MjA3OTAxMTM1MX0.5EaB81wglbbtNi8FOzJoDMNd_aOmMULzm27pDClJDSg';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables de Navegación y Quiz
let currentSelectionMode = 'practice';
if (typeof userStatus === 'undefined') var userStatus = { learning: 0, reviewing: 0, mastered: 0 };

// Variables de Calendario y Actividad
let currentCalMonth = new Date().getMonth();
let currentCalYear = new Date().getFullYear();
let userActivityDates = new Set(); // Almacena fechas formato 'YYYY-MM-DD'

// Variables Pomodoro
let pomoInterval;
let pomoTime = 25 * 60;
let isPomoRunning = false;

// =========================================================
// 2. FUNCIONES AUXILIARES Y AUTH
// =========================================================
// Función reutilizable para notificaciones elegantes (Toastify)
function showToast(message, type = 'info') {
    let background = "#333";
    if (type === 'success') background = "linear-gradient(to right, #00b09b, #96c93d)";
    if (type === 'error') background = "linear-gradient(to right, #ff5f6d, #ffc371)";
    if (type === 'warning') background = "#facc15";

    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
        style: {
            background: background,
            borderRadius: "8px",
            boxShadow: "0 3px 6px rgba(0,0,0,0.16)",
            fontWeight: "600",
            color: type === 'warning' ? '#000' : '#fff'
        },
        onClick: function () { }
    }).showToast();
}

function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = text;
}

// Generic Modal Functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

async function getCurrentUserId() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.user.id : null;
}

async function logout() {
    await _supabase.auth.signOut();
    window.location.href = 'index.html';
}

async function loadUserData() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user && user.email) {
        const name = user.email.split('@')[0];
        safeSetText('user-name-display', name.charAt(0).toUpperCase() + name.slice(1));
        initCountdown();
    }
}

// =========================================================
// 3. LÓGICA DE ACTIVIDAD Y CALENDARIO (NUEVO)
// =========================================================

// 3.1 Registrar Login Diario
async function trackDailyLogin() {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0];

    // Upsert: Inserta si no existe conflicto con la restricción UNIQUE (user_id, login_date)
    await _supabase.from('user_activity_logs').upsert(
        { user_id: userId, login_date: today },
        { onConflict: 'user_id, login_date', ignoreDuplicates: true }
    );

    // Recargar datos para actualizar UI inmediatamente
    await loadActivityData();
}

// 3.2 Cargar datos históricos
async function loadActivityData() {
    // 1. Mostrar skeleton y ocultar real
    const skeleton = document.getElementById('activity-skeleton');
    const content = document.getElementById('activity-real-content');

    if (skeleton) skeleton.classList.remove('hidden');
    if (content) content.classList.add('hidden');

    const userId = await getCurrentUserId();
    if (!userId) {
        if (skeleton) skeleton.classList.add('hidden');
        if (content) content.classList.remove('hidden');
        return;
    }

    const { data, error } = await _supabase
        .from('user_activity_logs')
        .select('login_date')
        .eq('user_id', userId);

    if (!error && data) {
        userActivityDates.clear();
        data.forEach(log => userActivityDates.add(log.login_date));
        updateActivityCard(); // Actualizar gráfico circular en el Dashboard
    }

    // 3. Ocultar skeleton, mostrar real con delay
    setTimeout(() => {
        if (skeleton) skeleton.classList.add('hidden');
        if (content) {
            content.classList.remove('hidden');
            content.classList.add('fade-in');
        }
    }, 500);
}

// 3.3 Actualizar Gráfico Circular (Card del Dashboard)
function updateActivityCard() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    // const daysInMonth = new Date(year, month + 1, 0).getDate(); // Opcional si queremos % del mes total
    const todayDate = now.getDate(); // Día actual (ej: 15)

    // Contar cuántos días de ESTE mes y año ha entrado el usuario
    let loginsThisMonth = 0;
    userActivityDates.forEach(dateStr => {
        const [y, m, d] = dateStr.split('-').map(Number);
        if (y === year && (m - 1) === month) {
            loginsThisMonth++;
        }
    });

    // Porcentaje basado en los días transcurridos hasta hoy
    // (Logins / Días transcurridos) * 100
    const percentage = todayDate === 0 ? 0 : Math.round((loginsThisMonth / todayDate) * 100);
    const finalPercent = percentage > 100 ? 100 : percentage;

    // Actualizar UI
    const pie = document.getElementById('activity-pie-chart');
    const text = document.getElementById('activity-percent-text');

    if (pie && text) {
        text.innerText = `${finalPercent}%`;
        // Conic gradient para efecto de dona/progreso
        pie.style.background = `conic-gradient(#10b981 0% ${finalPercent}%, #222 ${finalPercent}% 100%)`;
    }
}

// 3.4 Renderizar Calendario Completo (En Modal)
function renderFullCalendar() {
    const container = document.getElementById('full-calendar-container');
    const title = document.getElementById('calendar-month-year');
    if (!container || !title) return;

    container.innerHTML = '';

    // Nombres de meses
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    title.innerText = `${monthNames[currentCalMonth]} ${currentCalYear}`;

    // Headers de días
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    days.forEach(day => {
        container.innerHTML += `<div class="cal-day-header">${day}</div>`;
    });

    // Cálculos de fechas
    const firstDayIndex = new Date(currentCalYear, currentCalMonth, 1).getDay();
    const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();

    // Fecha actual real para comparaciones
    const now = new Date();
    // Usamos local date string para comparar visualmente con lo guardado (YYYY-MM-DD)
    // Ojo: toISOString usa UTC, asegúrate que coincida con cómo guardas. 
    // Aquí construimos manual para evitar problemas de zona horaria.
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();
    const todayKey = `${todayYear}-${(todayMonth + 1).toString().padStart(2, '0')}-${todayDay.toString().padStart(2, '0')}`;

    // Celdas vacías previas al día 1
    for (let i = 0; i < firstDayIndex; i++) {
        container.innerHTML += `<div></div>`;
    }

    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
        // Construir string YYYY-MM-DD (ojo con el +1 en month y padding)
        const currentMonthStr = (currentCalMonth + 1).toString().padStart(2, '0');
        const dayStr = i.toString().padStart(2, '0');
        const dateKey = `${currentCalYear}-${currentMonthStr}-${dayStr}`;

        // Determinar estado visual (CSS class)
        let className = 'cal-day';

        // Objeto fecha para comparar si es futuro
        const checkDate = new Date(currentCalYear, currentCalMonth, i);
        checkDate.setHours(0, 0, 0, 0);

        const realTodayDate = new Date();
        realTodayDate.setHours(0, 0, 0, 0);

        if (checkDate > realTodayDate) {
            className += ' future-day'; // Días futuros
        } else {
            // Es pasado o hoy. ¿Hubo actividad?
            if (userActivityDates.has(dateKey)) {
                className += ' active-day'; // Login registrado
            } else {
                className += ' missed-day'; // No hubo login
            }
        }

        // Borde especial para "HOY"
        if (dateKey === todayKey) {
            className += ' today';
        }

        container.innerHTML += `<div class="${className}">${i}</div>`;
    }
}

// 3.5 Navegación del Calendario
function prevMonth() {
    currentCalMonth--;
    if (currentCalMonth < 0) {
        currentCalMonth = 11;
        currentCalYear--;
    }
    renderFullCalendar();
}

function nextMonth() {
    currentCalMonth++;
    if (currentCalMonth > 11) {
        currentCalMonth = 0;
        currentCalYear++;
    }
    renderFullCalendar();
}

// 3.6 Modales de Actividad
function openActivityModal() {
    openModal('activity-modal');

    // Resetear a mes actual al abrir
    const now = new Date();
    currentCalMonth = now.getMonth();
    currentCalYear = now.getFullYear();

    renderFullCalendar();
}

function closeActivityModal() {
    closeModal('activity-modal');
}

// =========================================================
// 4. NAVEGACIÓN Y VISTAS
// =========================================================
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

    // Actualizar stats del dashboard al volver
    loadDashboardStats();
    loadActivityData();
}

// =========================================================
// 5. SELECCIÓN DE CATEGORÍAS Y QUIZ
// =========================================================
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

            // Selección Múltiple (toggle)
            card.onclick = () => {
                card.classList.toggle('selected');
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

    // Solo cargar categorías si estamos en standalone
    if (mode === 'standalone') {
        renderCategoriesWithProgress();
    }
}

function startRandomRun() {
    const isMobile = window.location.href.includes('mobile.html');
    window.location.href = isMobile ? 'quiz_engine_mobile.html?mode=random&count=10' : 'quiz_engine.html?mode=random&count=10';
}

// =========================================================
// 6. QUICK NOTES
// =========================================================
function openNotesModal() {
    openModal('notes-modal');
    loadNotes();
}

function closeNotesModal() {
    closeModal('notes-modal');
}

async function saveNote() {
    const input = document.getElementById('new-note-input');
    const text = input.value.trim();
    if (!text) return;
    const userId = await getCurrentUserId();
    if (!userId) { showToast("Please log in.", "error"); return; }

    const btn = document.getElementById('btn-save-note');
    btn.innerText = "...";

    const { error } = await _supabase.from('user_notes').insert({ user_id: userId, content: text });
    btn.innerText = "SAVE";

    if (error) console.error(error);
    else { input.value = ''; loadNotes(); }
}

async function loadNotes() {
    const container = document.getElementById('notes-list-container');
    if (!container) return;
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

// =========================================================
// 7. IA LAB
// =========================================================
function openAIModal() {
    openModal('ai-modal');
}

function closeAIModal() {
    closeModal('ai-modal');
}

function callGemini() {
    const input = document.getElementById('ai-input');
    if (!input || !input.value.trim()) return;

    const isMobile = window.location.href.includes('mobile.html');
    const targetPage = isMobile ? 'quiz_engine_mobile.html' : 'quiz_engine.html';

    const output = document.getElementById('ai-output');
    if (output) {
        output.style.display = 'block';
        output.innerHTML = '<div style="color:var(--accent);">🔍 Searching...</div>';
    }

    setTimeout(() => {
        window.location.href = `${targetPage}?mode=search&term=${encodeURIComponent(input.value.trim())}`;
    }, 800);
}

// =========================================================
// 8. POMODORO
// =========================================================
function openPomodoroSession() { switchView('pomodoro-timer-view'); resetPomo(); }

function updatePomoDisplay() {
    const m = Math.floor(pomoTime / 60).toString().padStart(2, '0');
    const s = (pomoTime % 60).toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    if (display) display.innerText = `${m}:${s}`;
}

function toggleTimer() {
    const btn = document.getElementById('btn-pomo-toggle');
    if (isPomoRunning) {
        clearInterval(pomoInterval); isPomoRunning = false; if (btn) btn.innerText = "▶";
    } else {
        isPomoRunning = true; if (btn) btn.innerText = "❚❚";
        pomoInterval = setInterval(() => {
            if (pomoTime > 0) { pomoTime--; updatePomoDisplay(); } else { clearInterval(pomoInterval); isPomoRunning = false; }
        }, 1000);
    }
}

function resetPomo() {
    clearInterval(pomoInterval);
    isPomoRunning = false;
    pomoTime = 25 * 60;
    updatePomoDisplay();
    const btn = document.getElementById('btn-pomo-toggle');
    if (btn) btn.innerText = "▶";
}

// =========================================================
// 9. EXAM DATE / COUNTDOWN
// =========================================================
async function initCountdown() {
    const badge = document.getElementById('countdown-badge');
    if (!badge) return;

    let dateStr = localStorage.getItem('user_exam_date');

    // Try to get from Supabase if logged in
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data } = await _supabase.from('user_settings').select('exam_date').eq('user_id', session.user.id).single();
        if (data && data.exam_date) {
            dateStr = data.exam_date;
            // Sync local
            localStorage.setItem('user_exam_date', dateStr);
        }
    }

    if (dateStr) {
        updateDaysLeftUI(dateStr);
    } else {
        badge.innerText = "Set Date";
    }
}

function updateDaysLeftUI(dateString) {
    const target = new Date(dateString); const today = new Date();
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    const badge = document.getElementById('countdown-badge');
    if (badge) badge.innerText = diff > 0 ? `${diff} Days Left` : "Exam Day!";
}

function openDateModal() {
    openModal('date-setup-modal');
}
function closeDateModal() {
    closeModal('date-setup-modal');
}

async function saveExamDate() {
    const dateInput = document.getElementById('exam-date-input');

    if (!dateInput || !dateInput.value) {
        showToast("Please select a date first.", "warning");
        return;
    }
    const selectedDate = dateInput.value;

    // Save locally first (optimistic and fallback)
    localStorage.setItem('user_exam_date', selectedDate);

    const { data: { session } } = await _supabase.auth.getSession();

    if (session) {
        const { error: upsertError } = await _supabase.from('user_settings').upsert({ user_id: session.user.id, exam_date: selectedDate });
        if (upsertError) {
            console.error("Supabase upsert error:", upsertError);
            showToast("Error saving date to cloud: " + upsertError.message, "error");
            // We don't block the UI update because we saved locally
        } else {
            showToast("Date saved successfully!", "success");
        }
    } else {
        showToast("Saved locally (login to sync)", "info");
    }

    // Update UI generic
    updateDaysLeftUI(selectedDate);
    closeDateModal();
}

// =========================================================
// 10. RECOVERY & PASSWORD RESET
// =========================================================
function checkRecoveryMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isRecovery = urlParams.get('recovery') === 'true';

    if (isRecovery) {
        document.getElementById('dashboard-content')?.classList.add('hidden');
        document.querySelector('.header-area')?.classList.add('hidden');
        document.getElementById('reset-password-view')?.classList.remove('hidden');

        const newUrl = window.location.pathname + window.location.hash;
        history.replaceState(null, '', newUrl);

        const alertContainer = document.getElementById('password-alert-container');
        if (alertContainer) {
            alertContainer.innerHTML = '<div class="password-alert" style="display:block;">⚠️ You are in Password Reset Mode. Please set a new password.</div>';
        }
    } else {
        document.getElementById('dashboard-content')?.classList.remove('hidden');
        document.querySelector('.header-area')?.classList.remove('hidden');
        document.getElementById('reset-password-view')?.classList.add('hidden');
    }
}

async function updatePassword() {
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    const btn = document.getElementById('btn-update-password');
    const msg = document.getElementById('reset-msg');

    if (password.length < 6 || password !== confirm) {
        msg.innerText = password.length < 6 ? 'Password must be at least 6 characters.' : 'Passwords do not match.';
        msg.style.color = '#ef4444';
        return;
    }

    btn.innerText = 'Updating...';
    btn.disabled = true;
    msg.innerText = '';

    if (typeof _supabase === 'undefined') {
        msg.innerText = 'Error: Supabase client not initialized.';
        msg.style.color = '#ef4444';
        btn.innerText = 'Update Password';
        btn.disabled = false;
        return;
    }

    const { error } = await _supabase.auth.updateUser({ password: password });

    if (error) {
        msg.innerText = `Error: ${error.message}. Try logging out and using the recovery link again.`;
        msg.style.color = '#ef4444';
        btn.innerText = 'Update Password';
        btn.disabled = false;
    } else {
        msg.innerText = '✅ Password updated successfully! Redirecting to login.';
        msg.style.color = '#22c55e';

        await _supabase.auth.signOut();

        document.getElementById('reset-form-content').classList.add('hidden');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
}

// =========================================================
// 10. UTILS ESTADÍSTICAS DASHBOARD
// =========================================================
async function loadDashboardStats() {
    // Aquí podrías conectar con supabase para traer el conteo real
    // safeSetText('total-questions', '1,240'); 
}

// =========================================================
// 11. INICIALIZACIÓN PRINCIPAL
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {

    const path = window.location.pathname;
    const isMobilePage = path.includes('mobile.html');

    if (path.includes('dashboard.html') || isMobilePage) {
        console.log("Inicializando App...");

        // 1. Cargar usuario y tracking inicial
        await loadUserData();
        loadDashboardStats();
        trackDailyLogin(); // REGISTRO DIARIO IMPORTANTE

        // 2. Listeners Comunes (Logout, Activity, Notas, IA)
        document.getElementById('btn-logout-desktop')?.addEventListener('click', logout);
        document.getElementById('card-activity-log')?.addEventListener('click', openActivityModal);
        document.getElementById('btn-close-activity-modal')?.addEventListener('click', closeActivityModal);

        // Calendario controles
        document.getElementById('btn-prev-month')?.addEventListener('click', prevMonth);
        document.getElementById('btn-next-month')?.addEventListener('click', nextMonth);

        // Notas
        document.getElementById('card-notes-desktop')?.addEventListener('click', openNotesModal);
        document.getElementById('nav-notes-mobile')?.addEventListener('click', openNotesModal);
        document.getElementById('btn-save-note')?.addEventListener('click', saveNote);
        document.getElementById('btn-close-notes-modal')?.addEventListener('click', closeNotesModal);

        // IA
        document.getElementById('btn-ai-submit')?.addEventListener('click', callGemini);
        document.getElementById('btn-close-ai-modal')?.addEventListener('click', closeAIModal);

        // Fecha Examen
        document.getElementById('countdown-badge')?.addEventListener('click', openDateModal);
        const btnSaveDate = document.querySelector('#date-setup-modal button');
        if (btnSaveDate) btnSaveDate.onclick = saveExamDate;
        const btnCloseDate = document.querySelector('#date-setup-modal .close-btn');
        if (btnCloseDate) btnCloseDate.onclick = closeDateModal;

        // 4. Recovery Check
        checkRecoveryMode();
        // Listener para update password ya estÃ¡ en HTML onclick="updatePassword()", pero podemos moverlo aquÃ­ si quitamos el onclick del HTML. 
        // En este paso, el HTML onclick sigue ahÃ­, asÃ­ que funcionarÃ¡ porque updatePassword ahora es global o accesible.
        // Pero para ser puristas, deberÃ­amos agregar el listener aquÃ­ y quitarlo del HTML. 
        // Como no edite el HTML para quitar 'onclick="updatePassword()"', lo dejarÃ© accesible globalmente.
        // Sin embargo, como estamos en un modulo o script, aseguremonos que sea window.updatePassword = updatePassword si fuera modulo, 
        // pero esto es script plano, asÃ­ que estÃ¡ bien.

        // Agregar listener al boton de update password por si acaso
        document.getElementById('btn-update-password')?.addEventListener('click', updatePassword);

        // 5. Navegación Desktop Específica
        if (!isMobilePage) {
            console.log("Modo Escritorio Detectado.");

            // Navegación principal
            document.getElementById('card-learning-lab')?.addEventListener('click', showLearningLab);
            document.getElementById('card-simulation-lab')?.addEventListener('click', showSimulationLab);
            document.getElementById('card-pomodoro-lab')?.addEventListener('click', showPomodoro);
            document.getElementById('btn-daily-run')?.addEventListener('click', startRandomRun);
            document.getElementById('btn-ia-lab-start')?.addEventListener('click', openAIModal);

            // Botones "Back"
            document.getElementById('btn-back-learning')?.addEventListener('click', goBackToDashboard);
            document.getElementById('btn-back-simulation')?.addEventListener('click', goBackToDashboard);
            document.getElementById('btn-back-pomodoro')?.addEventListener('click', goBackToDashboard);
            document.getElementById('btn-back-selection')?.addEventListener('click', showLearningLab);

            // Opciones Learning/Simulation
            document.getElementById('btn-learn-standalone')?.addEventListener('click', () => openSelectionView('standalone'));
            document.getElementById('btn-learn-itemsets')?.addEventListener('click', () => window.location.href = 'quiz_engine.html?mode=itemsets&count=20');
            document.getElementById('btn-sim-customize')?.addEventListener('click', () => openSelectionView('simulation'));
            document.getElementById('btn-sim-start')?.addEventListener('click', () => window.location.href = 'quiz_engine.html?mode=simulation');

            // Pomodoro
            document.getElementById('btn-pomo-session')?.addEventListener('click', openPomodoroSession);
            document.getElementById('btn-pomo-toggle')?.addEventListener('click', toggleTimer);
            document.getElementById('btn-pomo-reset')?.addEventListener('click', resetPomo);
            document.getElementById('btn-back-timer')?.addEventListener('click', () => switchView('pomodoro-view'));

            // START QUIZ con selección múltiple
            document.getElementById('btn-start-quiz-selection')?.addEventListener('click', () => {

                if (currentSelectionMode === 'standalone') {
                    // Capturar múltiples categorías seleccionadas
                    const selectedCards = document.querySelectorAll('.category-card.selected');

                    if (selectedCards.length > 0) {
                        const selectedCats = Array.from(selectedCards).map(card =>
                            card.querySelector('.cat-name').innerText.trim()
                        );

                        const catsParam = selectedCats.map(c => encodeURIComponent(c)).join(',');
                        window.location.href = `quiz_engine.html?mode=standalone&cats=${catsParam}`;
                    } else {
                        alert("Please select at least one subject.");
                    }
                } else {
                    window.location.href = `quiz_engine.html?mode=${currentSelectionMode}`;
                }
            });
        }
        else {
            console.log("Modo Móvil Detectado.");
        }
    }
});
