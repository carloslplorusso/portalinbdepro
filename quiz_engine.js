const QuizEngine = {
    // --- ESTADO DEL QUIZ ---
    data: [],
    currentIndex: 0,
    userAnswers: {}, // { questionId: indexOrLetter }
    mode: 'practice',
    stats: { easy: 0, medium: 0, hard: 0 },
    markedQuestions: new Set(),
    simTimerInterval: null,
    simTotalTime: 0,
    isMobile: window.innerWidth <= 768 || /Android|webOS|iPhone/i.test(navigator.userAgent),

    // --- 1. INICIALIZACIÓN ---
    async init() {
        // Leer parámetros de la URL
        const urlParams = new URLSearchParams(window.location.search);
        this.mode = urlParams.get('mode') || 'practice';
        const count = urlParams.get('count') ? parseInt(urlParams.get('count')) : null;
        const term = urlParams.get('term'); // Para búsqueda
        const cats = urlParams.get('cats'); // Categorías seleccionadas
        
        console.log(`QuizEngine iniciado. Modo: ${this.mode}, Mobile: ${this.isMobile}`);

        // Configurar clases en el Body para CSS específico
        const isSimulation = (this.mode.includes('simulation') || this.mode === 'itemsets');
        if (isSimulation) {
            document.body.classList.add('mode-simulation');
            document.getElementById('root-simulation')?.classList.remove('hidden');
            this.simTotalTime = count ? count * 90 : 100 * 90; // 90 segs por pregunta aprox
            this.startSimTimer();
        } else {
            document.body.classList.add('mode-practice');
            document.getElementById('root-practice')?.classList.remove('hidden');
        }

        // Decidir si cargar preguntas o mostrar selección
        if (this.mode === 'random' || this.mode === 'daily' || this.mode === 'search' || cats) {
            // Modos que arrancan directo
            await this.fetchQuestions(count, term, cats);
        } else if (this.mode === 'simulation') {
              await this.fetchQuestions(count);
        } else {
            // Modo standalone sin categorías predefinidas: Cargar lista de categorías
            if(typeof loadCategoriesUI === 'function') {
                await loadCategoriesUI(); 
            } else {
                console.warn("No loadCategoriesUI function found.");
            }
        }
    },

    // --- 2. OBTENCIÓN DE DATOS (SUPABASE) ---
    async fetchQuestions(count, term, catsStr) {
        if (typeof _supabase === 'undefined') { alert("Supabase no inicializado"); return; }

        let query = _supabase.from('questions_bank').select('*, clinical_cases (*)');
        let data = [];

        // Lógica de Filtros
        if (this.mode === 'random' || this.mode === 'daily') {
            // Random real usando IDs
            const { data: allIds } = await _supabase.from('questions_bank').select('id');
            if (allIds) {
                const shuffled = allIds.sort(() => 0.5 - Math.random()).slice(0, 10);
                const ids = shuffled.map(x => x.id);
                const res = await _supabase.from('questions_bank').select('*, clinical_cases (*)').in('id', ids);
                data = res.data;
            }
        } else if (this.mode === 'search' && term) {
            const res = await query.ilike('question_text', `%${term}%`);
            data = res.data;
        } else if (catsStr) {
            const catsArr = catsStr.split(',').map(decodeURIComponent);
            const res = await query.in('category', catsArr).is('case_id', null);
            data = res.data;
        } else {
            // Simulation o Itemsets
            if (this.mode.includes('simulation')) query = query.not('case_id', 'is', null);
            else query = query.is('case_id', null);
            
            if (count) query = query.limit(count);
            else query = query.limit(100); // Límite por defecto
            
            const res = await query;
            data = res.data;
        }

        if (!data || data.length === 0) {
            alert("No questions found.");
            this.goBack();
            return;
        }

        // Mezclar si no es daily (que ya se mezcló arriba)
        if (this.mode !== 'random' && this.mode !== 'daily') {
            this.data = data.sort(() => Math.random() - 0.5);
        } else {
            this.data = data;
        }

        this.startQuiz();
    },

    // --- 3. INICIO Y RENDERIZADO ---
    startQuiz() {
        this.currentIndex = 0;
        // Ocultar pantallas de carga/inicio
        document.getElementById('prac-start-screen')?.classList.add('hidden');
        
        if (this.mode.includes('simulation')) {
            document.getElementById('sim-screen-quiz').classList.add('active');
            this.renderSimQuestion();
        } else {
            document.getElementById('prac-quiz-screen').classList.remove('hidden');
            this.renderPracticeQuestion();
        }
    },

    // --- 3A. RENDER MODO PRÁCTICA ---
    renderPracticeQuestion() {
        const q = this.data[this.currentIndex];
        
        // Elementos comunes en Desktop y Mobile
        document.getElementById('prac-q-text').innerText = q.question_text;
        
        // Reset UI
        document.getElementById('prac-review-area').classList.add('hidden');
        document.getElementById('prac-error-msg')?.classList.add('hidden');
        document.getElementById('btn-prac-next').classList.add('hidden');

        const container = document.getElementById('prac-options-list');
        container.innerHTML = '';

        [q.option_a, q.option_b, q.option_c, q.option_d].forEach((opt, idx) => {
            if (!opt) return;
            const letter = String.fromCharCode(65 + idx);
            const div = document.createElement('div');
            div.className = 'prac-option'; // Clase CSS compartida
            div.id = `prac-opt-${idx}`;
            
            // HTML Interno (Radio visual + Texto)
            div.innerHTML = `<div class="prac-radio"></div><span>${opt}</span>`;
            
            div.onclick = () => this.handlePracticeAnswer(idx, letter, q);
            container.appendChild(div);
        });
    },

    handlePracticeAnswer(idx, letter, q) {
        if (this.userAnswers[q.id]) return; // Ya respondido
        this.userAnswers[q.id] = letter;

        const selectedDiv = document.getElementById(`prac-opt-${idx}`);
        selectedDiv.classList.add('selected');

        // Revelar respuesta
        const allOpts = document.getElementById('prac-options-list').children;
        Array.from(allOpts).forEach((div, i) => {
            div.classList.add('answered'); // Clase para CSS
            const optLet = String.fromCharCode(65 + i);
            const optText = [q.option_a, q.option_b, q.option_c, q.option_d][i];

            if (optLet === q.correct_answer || optText === q.correct_answer) {
                div.classList.add('correct');
            } else if (i === idx) {
                div.classList.add('incorrect');
            }
        });

        // Mostrar explicación
        const expArea = document.getElementById('prac-explanation');
        expArea.innerHTML = q.explanation ? `<strong>Explanation:</strong><br>${q.explanation}` : "No explanation available.";
        expArea.classList.remove('hidden');
        document.getElementById('prac-review-area').classList.remove('hidden');
    },

    // --- 4. CLASIFICACIÓN (EASY/MED/HARD) ---
    async classifyQuestion(status) {
        // Guardar stats locales
        if (status === 'learning') this.stats.hard++;
        if (status === 'reviewing') this.stats.medium++;
        if (status === 'mastered') this.stats.easy++;

        // Feedback Visual en botones
        const btns = document.querySelectorAll('.btn-classify');
        btns.forEach(b => b.classList.remove('active'));
        
        const btnMap = { 'learning': '.btn-hard', 'reviewing': '.btn-medium', 'mastered': '.btn-easy' };
        document.querySelector(btnMap[status])?.classList.add('active');

        // Guardar en DB
        const q = this.data[this.currentIndex];
        const { data: { session } } = await _supabase.auth.getSession();
        
        if (session) {
            // Fire and forget (no esperamos el await para agilidad visual)
            _supabase.from('user_progress').insert([{
                user_id: session.user.id,
                question_id: q.id,
                status: status,
                quiz_mode: this.mode,
                timestamp: new Date()
            }]).then(() => console.log('Progress saved'));
        }

        document.getElementById('btn-prac-next').classList.remove('hidden');
        document.getElementById('prac-error-msg')?.classList.add('hidden');
    },

    nextQuestion() {
        if (this.currentIndex < this.data.length - 1) {
            this.currentIndex++;
            if(this.mode.includes('simulation')) this.renderSimQuestion();
            else this.renderPracticeQuestion();
        } else {
            this.finishQuiz();
        }
    },

    // --- 5. RESULTADOS (UNIFICADO) ---

    // --- FUNCIÓN UNIFICADA: Renderizar lista de revisión (Practice & Sim) ---
    renderFinalReview(prefix) {
        // 'prefix' será 'prac' o 'sim'
        const listContainer = document.getElementById(`${prefix}-review-list`);
        if (!listContainer) return;
        
        listContainer.innerHTML = ''; // Limpiar lista anterior

        // Definir estilos según el modo (Dark vs Light)
        const isSim = (prefix === 'sim');
        
        // Colores Dark (Practice)
        const styleDark = {
            cardBg: '#27272a', border: '#333', text: 'white', 
            headerBg: '#18181b', hoverBg: '#222', detailBg: '#111', detailText: '#ccc'
        };
        // Colores Light (Simulation)
        const styleLight = {
            cardBg: '#ffffff', border: '#e5e7eb', text: '#1f2937', 
            headerBg: '#f9fafb', hoverBg: '#f3f4f6', detailBg: '#f9fafb', detailText: '#4b5563'
        };

        const theme = isSim ? styleLight : styleDark;

        this.data.forEach((q, index) => {
            // 1. OBTENER RESPUESTA DEL USUARIO
            const userAns = this.userAnswers[q.id];

            // --- FILTRO: SI NO FUE RESPONDIDA, NO LA MOSTRAMOS ---
            if (userAns === undefined || userAns === null) return; 

            // 2. Lógica de Corrección (Normalizar indice vs letra)
            const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
            const ansChar = typeof userAns === 'number' ? String.fromCharCode(65 + userAns) : userAns;
            const ansText = typeof userAns === 'number' ? opts[userAns] : (userAns ? opts[ansChar.charCodeAt(0) - 65] : null);
            
            const isCorrect = (ansChar === q.correct_answer || ansText === q.correct_answer);
            
            const statusText = isCorrect ? 'Correct' : 'Incorrect';
            const statusColor = isCorrect ? '#22c55e' : '#ef4444'; // Verde o Rojo
            const icon = isCorrect ? '✓' : '✕';

            // 3. Crear elementos HTML con estilos dinámicos
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `background: ${theme.cardBg}; border-radius: 8px; overflow: hidden; border: 1px solid ${theme.border}; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);`;

            // Header (La fila visible)
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = `padding: 15px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: ${theme.headerBg}; transition: background 0.2s;`;
            
            headerDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; font-weight:bold; color:${theme.text};">
                    <span style="opacity:0.6;">Q ${index + 1}</span>
                    <span style="color:${statusColor}; display:flex; align-items:center; gap:6px; font-size:0.95rem;">
                        ${icon} ${statusText}
                    </span>
                </div>
                <div style="color:${isSim ? '#d97706' : '#facc15'}; font-size:0.8rem; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                    Explain this <span>▼</span>
                </div>
            `;

            // Detalle (Oculto inicialmente)
            const detailDiv = document.createElement('div');
            detailDiv.className = 'hidden';
            detailDiv.style.cssText = `padding: 20px; background: ${theme.detailBg}; border-top: 1px solid ${theme.border}; color: ${theme.detailText}; line-height: 1.6; font-size: 0.95rem;`;
            
            // Contenido del detalle
            detailDiv.innerHTML = `
                <div style="margin-bottom:15px; font-weight:700; color:${theme.text}; font-size:1rem;">${q.question_text}</div>
                
                <div style="background:${isSim ? '#fffbeb' : 'rgba(250, 204, 21, 0.1)'}; border-left:4px solid ${isSim ? '#d97706' : '#facc15'}; padding:15px; border-radius:4px;">
                    <strong style="color:${isSim ? '#d97706' : '#facc15'}; text-transform:uppercase; font-size:0.8rem;">Explanation:</strong><br>
                    <span style="color:${theme.text}">${q.explanation || 'No explanation available.'}</span>
                </div>
            `;

            // Lógica Toggle (Expandir/Colapsar)
            headerDiv.onclick = () => {
                const isHidden = detailDiv.classList.contains('hidden');
                if (isHidden) {
                    detailDiv.classList.remove('hidden');
                    headerDiv.style.background = theme.hoverBg;
                } else {
                    detailDiv.classList.add('hidden');
                    headerDiv.style.background = theme.headerBg;
                }
            };

            itemDiv.appendChild(headerDiv);
            itemDiv.appendChild(detailDiv);
            listContainer.appendChild(itemDiv);
        });
    },

    // --- FUNCIÓN PRINCIPAL DE FINALIZACIÓN MODIFICADA ---
    finishQuiz() {
        // Detener timers si existen
        if (this.simTimerInterval) clearInterval(this.simTimerInterval);

        // Ocultar pantallas de quiz activas
        document.getElementById('prac-quiz-screen')?.classList.add('hidden');
        document.getElementById('sim-screen-quiz')?.classList.remove('active');
        document.getElementById('sim-screen-review')?.classList.remove('active');

        // LÓGICA DE VISUALIZACIÓN SEGÚN MODO
        if (this.mode.includes('simulation')) {
            // --- MODO SIMULACIÓN ---
            const el = document.getElementById('sim-screen-perf');
            if(el) {
                el.classList.remove('hidden');
                el.style.display = 'flex'; // Forzar display flex para simulación
            }
            // Mantenemos los gráficos para Simulación
            this.calculateAndRenderCharts('sim'); 
            // Llamamos a la nueva función de lista de revisión
            this.renderFinalReview('sim');

        } else {
            // --- MODO PRÁCTICA (NUEVA LISTA) ---
            const el = document.getElementById('prac-results-screen');
            if(el) {
                el.classList.remove('hidden');
                // Aseguramos que se muestre, el display lo maneja CSS o flex
                el.style.display = 'flex'; 
            }
            // Llamamos a la nueva función de lista de revisión
            this.renderFinalReview('prac');
        }
    },
    
    // Helper para mantener compatibilidad de gráficos con Simulación
    calculateAndRenderCharts(prefix) {
        let correct = 0;
        let catMap = {};

        this.data.forEach(q => {
            const ans = this.userAnswers[q.id];
            let isCorr = false;
            
            // Lógica de corrección unificada (Soporta indice o letra)
            const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
            // Normalizar a letra o texto para comparar
            const ansChar = typeof ans === 'number' ? String.fromCharCode(65 + ans) : ans;
            const ansText = typeof ans === 'number' ? opts[ans] : (ans ? opts[ans.charCodeAt(0) - 65] : null);
            
            if (ansChar === q.correct_answer || ansText === q.correct_answer) isCorr = true;
            if (isCorr) correct++;

            const cat = q.subject || "General";
            if (!catMap[cat]) catMap[cat] = { c: 0, t: 0 };
            catMap[cat].t++;
            if (isCorr) catMap[cat].c++;
        });

        const total = this.data.length;
        const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        this.setText(`${prefix}-acc-val`, acc + "%");
        this.setText(`${prefix}-correct-val`, correct);
        this.setText(`${prefix}-incorrect-val`, total - correct);
        
        // Render Pie solo si existe el elemento (Simulación)
        const pie = document.getElementById(`${prefix}-perf-pie`);
        if (pie) {
            const deg = Math.round((acc / 100) * 360);
            pie.style.background = `conic-gradient(#22c55e 0deg ${deg}deg, #ef4444 ${deg}deg 360deg)`;
        }
        
        // Render Categorías
        const catDiv = document.getElementById(`${prefix}-cat-list`);
        if (catDiv) {
            catDiv.innerHTML = '';
            for (const [name, d] of Object.entries(catMap)) {
                catDiv.innerHTML += `
                    <div class="cat-item">
                        <span>${name}</span>
                        <span style="font-family:monospace;">${d.c}/${d.t}</span>
                    </div>`;
            }
        }
    },

    // --- 6. SIMULACIÓN (Lógica Específica) ---
    startSimTimer() {
        this.simTimerInterval = setInterval(() => {
            this.simTotalTime--;
            const h = Math.floor(this.simTotalTime / 3600);
            const m = Math.floor((this.simTotalTime % 3600) / 60);
            const s = this.simTotalTime % 60;
            const tStr = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            
            this.setText('sim-timer', tStr);
            this.setText('sim-timer-rev', tStr);
            
            if (this.simTotalTime <= 0) this.finishQuiz();
        }, 1000);
    },

    renderSimQuestion() {
        const q = this.data[this.currentIndex];
        this.setText('sim-q-counter', `Question ${this.currentIndex + 1} of ${this.data.length}`);
        this.setText('sim-q-text', q.question_text);

        // Parsear Paciente
        let pData = { patient: "N/A", cc: "-", history: "-", findings: "-" };
        if (q.clinical_cases) {
            const c = Array.isArray(q.clinical_cases) ? q.clinical_cases[0] : q.clinical_cases;
            if (c && c.patient_data) {
                try {
                    const parsed = typeof c.patient_data === 'string' ? JSON.parse(c.patient_data) : c.patient_data;
                    pData = {
                        patient: parsed.patient || parsed.age || "N/A",
                        cc: parsed.cc || parsed.complaint || "-",
                        history: parsed.history || "-",
                        findings: parsed.findings || "-"
                    };
                } catch (e) {}
            }
        }
        
        // Renderizar Tablas
        const setTable = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = `<tr><td>${val}</td></tr>`; };
        setTable('sim-pat-demo', pData.patient);
        setTable('sim-pat-cc', pData.cc);
        setTable('sim-pat-hist', pData.history);
        setTable('sim-pat-find', pData.findings);

        // Renderizar Opciones
        const container = document.getElementById('sim-options-container');
        container.innerHTML = '';
        [q.option_a, q.option_b, q.option_c, q.option_d].forEach((opt, idx) => {
            if (!opt) return;
            const div = document.createElement('div');
            div.className = 'sim-option';
            // Simulación guarda el índice de la opción
            if (this.userAnswers[q.id] === idx) div.classList.add('selected'); 
            
            div.innerHTML = `<div class="sim-radio"></div> ${opt}`;
            div.onclick = () => {
                this.userAnswers[q.id] = idx; // Guardamos índice en simulación
                this.renderSimQuestion(); // Re-render para mostrar selección
            };
            container.appendChild(div);
        });

        // Botón Mark
        const btnMark = document.getElementById('btn-sim-mark');
        if (this.markedQuestions.has(this.currentIndex)) {
            btnMark.classList.add('active');
            btnMark.innerText = "UNMARK";
        } else {
            btnMark.classList.remove('active');
            btnMark.innerText = "MARK";
        }
    },

    goToSimReview() {
        document.getElementById('sim-screen-quiz').classList.remove('active');
        document.getElementById('sim-screen-review').classList.add('active');
        const body = document.getElementById('sim-review-body');
        body.innerHTML = '';
        
        this.data.forEach((q, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Q ${i + 1}</td>
                <td style="text-align:center;">${this.markedQuestions.has(i) ? '✓' : ''}</td>
                <td style="text-align:center;">${this.userAnswers[q.id] !== undefined ? 'Done' : '-'}</td>
            `;
            tr.onclick = () => { this.currentIndex = i; this.returnToSimQuiz(); };
            body.appendChild(tr);
        });
    },

    returnToSimQuiz() {
        document.getElementById('sim-screen-review').classList.remove('active');
        document.getElementById('sim-screen-quiz').classList.add('active');
        this.renderSimQuestion();
    },

    toggleSimMark() {
        if (this.markedQuestions.has(this.currentIndex)) this.markedQuestions.delete(this.currentIndex);
        else this.markedQuestions.add(this.currentIndex);
        this.renderSimQuestion();
    },

    // --- 7. UTILIDADES ---
    setText(id, txt) {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    },

    goBack() {
        // Redirección inteligente basada en dispositivo
        if (this.isMobile) window.location.href = 'mobile.html';
        else window.location.href = 'dashboard.html';
    }
};

// Exponer funciones globales para que los botones HTML "onclick" sigan funcionando
window.classifyPractice = (s) => QuizEngine.classifyQuestion(s);
window.nextPracticeQuestion = () => QuizEngine.nextQuestion();
window.finishPracticeQuiz = () => QuizEngine.finishQuiz();
window.nextSimQuestion = () => QuizEngine.nextQuestion();
window.toggleSimMark = () => QuizEngine.toggleSimMark();
window.goToSimReview = () => QuizEngine.goToSimReview();
window.returnToSimQuiz = () => QuizEngine.returnToSimQuiz();
window.finishSimExam = () => QuizEngine.finishQuiz();
window.goToDashboard = () => QuizEngine.goBack();

// Iniciar al cargar
document.addEventListener('DOMContentLoaded', () => QuizEngine.init());
