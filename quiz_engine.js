// quiz_engine.js
// Motor unificado de Quiz para Desktop y Mobile

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
            // Aquí delegamos a una función que puede ser específica si la UI difiere mucho,
            // pero intentaremos compartirla.
            if(typeof loadCategoriesUI === 'function') {
                await loadCategoriesUI(); // Función que dejaremos en el HTML para UI específica
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

    // --- 5. RESULTADOS ---
    finishQuiz() {
        // Ocultar pantallas de quiz
        document.getElementById('prac-quiz-screen')?.classList.add('hidden');
        document.getElementById('sim-screen-quiz')?.classList.remove('active');
        document.getElementById('sim-screen-review')?.classList.remove('active');

        // Mostrar pantalla de resultados
        // Nota: Los IDs de resultados son casi idénticos en ambos HTML
        const resultScreenId = this.mode.includes('simulation') ? 'sim-screen-perf' : 'prac-results-screen';
        const el = document.getElementById(resultScreenId);
        if(el) {
            el.classList.remove('hidden');
            el.style.display = 'flex'; // Forzar flex si estaba hidden
        }

        // Cálculos
        let correct = 0;
        let catMap = {};

        this.data.forEach(q => {
            const ans = this.userAnswers[q.id];
            let isCorr = false;
            
            // Normalizar respuesta (puede ser índice o letra)
            if (ans !== undefined) {
                const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
                // Si es práctica guardamos Letra, si es Sim guardamos Índice (ajustar si es necesario)
                // Aquí asumimos que ans puede ser Letra o Índice, comparamos ambas formas
                const ansChar = typeof ans === 'number' ? String.fromCharCode(65 + ans) : ans;
                const ansText = typeof ans === 'number' ? opts[ans] : opts[ans.charCodeAt(0) - 65];
                
                if (ansChar === q.correct_answer || ansText === q.correct_answer) isCorr = true;
            }

            if (isCorr) correct++;

            const cat = q.subject || "General";
            if (!catMap[cat]) catMap[cat] = { c: 0, t: 0 };
            catMap[cat].t++;
            if (isCorr) catMap[cat].c++;
        });

        const total = this.data.length;
        const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
        const prefix = this.mode.includes('simulation') ? 'sim' : 'prac';

        // Renderizar DOM de resultados
        this.setText(`${prefix}-acc-val`, acc + "%");
        this.setText(`${prefix}-correct-val`, correct);
        this.setText(`${prefix}-incorrect-val`, total - correct);

        // Gráfico Circular (Pie Chart)
        // Usamos lógica de colores de práctica o simulación
        const pie = document.getElementById(`${prefix}-perf-pie`);
        if (pie) {
            if (this.mode.includes('simulation')) {
                const deg = Math.round((acc / 100) * 360);
                pie.style.background = `conic-gradient(#22c55e 0deg ${deg}deg, #ef4444 ${deg}deg 360deg)`;
            } else {
                // Modo práctica: 3 colores (Easy, Med, Hard)
                const totDif = this.stats.easy + this.stats.medium + this.stats.hard || 1;
                const pEasy = (this.stats.easy / totDif) * 360;
                const pMed = (this.stats.medium / totDif) * 360;
                pie.style.background = `conic-gradient(#22c55e 0deg ${pEasy}deg, #facc15 ${pEasy}deg ${pEasy + pMed}deg, #ef4444 ${pEasy + pMed}deg 360deg)`;
            }
        }

        // Renderizar Lista Categorías
        const catDiv = document.getElementById(`${prefix}-cat-list`);
        if (catDiv) {
            catDiv.innerHTML = '';
            for (const [name, d] of Object.entries(catMap)) {
                catDiv.innerHTML += `
                    <div class="cat-item">
                        <span>${name}</span>
                        <span style="font-family:monospace;">
                            <span style="color:#22c55e">${d.c}</span> / <span style="color:#ef4444">${d.t - d.c}</span>
                        </span>
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
