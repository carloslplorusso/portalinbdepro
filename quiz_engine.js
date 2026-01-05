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
        const urlParams = new URLSearchParams(window.location.search);
        this.mode = urlParams.get('mode') || 'practice';
        const count = urlParams.get('count') ? parseInt(urlParams.get('count')) : null;
        const term = urlParams.get('term');
        const cats = urlParams.get('cats');

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
            await this.fetchQuestions(count, term, cats);
        } else if (this.mode === 'simulation' || this.mode === 'itemsets') {
            await this.fetchQuestions(count);
        } else {
            if (typeof loadCategoriesUI === 'function') {
                await loadCategoriesUI();
            } else {
                console.warn("No loadCategoriesUI function found.");
            }
        }
    },

    // --- 2. OBTENCIÓN DE DATOS (SUPABASE) ---
    async fetchQuestions(count, term, catsStr) {
        if (typeof _supabase === 'undefined') { alert("Supabase no inicializado"); return; }

        // Fix for Ambiguous FK: We specify !case_id to tell Supabase which relationship to use.
        let query = _supabase.from('questions_bank').select('*, clinical_cases!case_id (*)');
        let data = [];

        // Lógica de Filtros
        if (this.mode === 'random' || this.mode === 'daily') {
            const { data: allIds } = await _supabase.from('questions_bank').select('id');
            if (allIds) {
                const shuffled = allIds.sort(() => 0.5 - Math.random()).slice(0, 10);
                const ids = shuffled.map(x => x.id);
                // Also fix here
                const res = await _supabase.from('questions_bank').select('*, clinical_cases!case_id (*)').in('id', ids);
                data = res.data;
            }
        } else if (this.mode === 'search' && term) {
            const res = await query.ilike('question_text', `%${term}%`);
            data = res.data;
        } else if (catsStr) {
            const catsArr = catsStr.split(',').map(decodeURIComponent);
            console.log("DEBUG: Searching for categories:", catsArr);

            // Allow both case-based and standalone questions for category practice
            const res = await query.in('category', catsArr);
            if (res.error) {
                console.error("Supabase Error (Cats):", res.error);
                alert("Error fetching category questions: " + res.error.message);
            } else {
                console.log("DEBUG: Query Result Count:", res.data?.length);
            }
            data = res.data;
        } else {
            if (this.mode.includes('simulation') || this.mode === 'itemsets') query = query.not('case_id', 'is', null);
            else query = query.is('case_id', null);

            if (count) query = query.limit(count);
            else query = query.limit(100);

            const res = await query;
            if (res.error) {
                console.error("Supabase Error (Standard):", res.error);
                alert("Error fetching questions: " + res.error.message);
            }
            data = res.data;
        }

        if (!data || data.length === 0) {
            alert("No questions found.");
            this.goBack();
            return;
        }

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
        document.getElementById('prac-start-screen')?.classList.add('hidden');

        if (this.mode.includes('simulation') || this.mode === 'itemsets') {
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

        // Prepare Question Text (with optional Case Context)
        let displayText = q.question_text;

        if (q.clinical_cases) {
            const c = Array.isArray(q.clinical_cases) ? q.clinical_cases[0] : q.clinical_cases;
            if (c) {
                let context = "";
                // Use new fields or fallback
                const cc = c.chief_complaint || (c.patient_data?.cc) || (c.patient_data?.complaint) || "";
                const hist = c.medical_history || (c.patient_data?.history) || "";
                const scen = c.scenario_text || "";

                if (scen) context += `[SCENARIO]: ${scen}\n\n`;
                if (cc) context += `[CHIEF COMPLAINT]: ${cc}\n`;
                if (hist) context += `[HISTORY]: ${hist}\n`;

                if (context) {
                    displayText = context + "\n----------------\n" + displayText;
                }
            }
        }

        document.getElementById('prac-q-text').innerText = displayText;

        document.getElementById('prac-review-area').classList.add('hidden');
        document.getElementById('prac-error-msg')?.classList.add('hidden');
        document.getElementById('btn-prac-next').classList.add('hidden');

        const container = document.getElementById('prac-options-list');
        container.innerHTML = '';

        [q.option_a, q.option_b, q.option_c, q.option_d].forEach((opt, idx) => {
            if (!opt) return;
            const letter = String.fromCharCode(65 + idx);
            const div = document.createElement('div');
            div.className = 'prac-option';
            div.id = `prac-opt-${idx}`;
            div.innerHTML = `<div class="prac-radio"></div><span>${opt}</span>`;
            div.onclick = () => this.handlePracticeAnswer(idx, letter, q);
            container.appendChild(div);
        });
    },

    handlePracticeAnswer(idx, letter, q) {
        if (this.userAnswers[q.id]) return;
        this.userAnswers[q.id] = letter;

        const selectedDiv = document.getElementById(`prac-opt-${idx}`);
        selectedDiv.classList.add('selected');

        const allOpts = document.getElementById('prac-options-list').children;
        Array.from(allOpts).forEach((div, i) => {
            div.classList.add('answered');
            const optLet = String.fromCharCode(65 + i);
            const optText = [q.option_a, q.option_b, q.option_c, q.option_d][i];

            if (optLet === q.correct_answer || optText === q.correct_answer) {
                div.classList.add('correct');
            } else if (i === idx) {
                div.classList.add('incorrect');
            }
        });

        const expArea = document.getElementById('prac-explanation');
        expArea.innerHTML = q.explanation ? `<strong>Explanation:</strong><br>${q.explanation}` : "No explanation available.";
        expArea.classList.remove('hidden');
        document.getElementById('prac-review-area').classList.remove('hidden');
    },

    // --- 4. CLASIFICACIÓN (EASY/MED/HARD) ---
    async classifyQuestion(status) {
        if (status === 'learning') this.stats.hard++;
        if (status === 'reviewing') this.stats.medium++;
        if (status === 'mastered') this.stats.easy++;

        const btns = document.querySelectorAll('.btn-classify');
        btns.forEach(b => b.classList.remove('active'));

        const btnMap = { 'learning': '.btn-hard', 'reviewing': '.btn-medium', 'mastered': '.btn-easy' };
        document.querySelector(btnMap[status])?.classList.add('active');

        const q = this.data[this.currentIndex];
        const { data: { session } } = await _supabase.auth.getSession();

        if (session) {
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
            if (this.mode.includes('simulation') || this.mode === 'itemsets') this.renderSimQuestion();
            else this.renderPracticeQuestion();
        } else {
            this.finishQuiz();
        }
    },

    // --- 5. RENDERIZAR LISTA DE REVISIÓN (SOLO RESPONDIDAS) ---
    renderFinalReview(prefix) {
        const listContainer = document.getElementById(`${prefix}-final-list-content`);
        if (!listContainer) return;

        listContainer.innerHTML = '';

        const isSim = (prefix === 'sim');
        const theme = isSim ? {
            card: '#ffffff', border: '#e5e7eb', text: '#1f2937', header: '#f9fafb', hover: '#f3f4f6', detail: '#f9fafb', detailText: '#4b5563', accent: '#235d88'
        } : {
            card: '#27272a', border: '#333', text: 'white', header: '#18181b', hover: '#222', detail: '#111', detailText: '#ccc', accent: '#facc15'
        };

        let questionsShown = 0;

        this.data.forEach((q, index) => {
            const userAns = this.userAnswers[q.id];
            // --- FILTRO: Solo mostrar si fue respondida ---
            if (userAns === undefined || userAns === null) return;
            questionsShown++;

            const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
            const ansChar = typeof userAns === 'number' ? String.fromCharCode(65 + userAns) : userAns;
            const ansText = typeof userAns === 'number' ? opts[userAns] : (userAns.length > 1 ? userAns : opts[ansChar?.charCodeAt(0) - 65] || null);
            const isCorrect = (ansChar === q.correct_answer || ansText === q.correct_answer);

            const statusText = isCorrect ? 'Correct' : 'Incorrect';
            const statusColor = isCorrect ? '#22c55e' : '#ef4444';
            const icon = isCorrect ? '✓' : '✕';

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `background:${theme.card}; border:1px solid ${theme.border}; border-radius:8px; margin-bottom:10px; overflow:hidden;`;

            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = `padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:${theme.header};`;
            headerDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; color:${theme.text}; font-weight:bold;">
                    <span style="opacity:0.7;">Q ${index + 1}</span>
                    <span style="color:${statusColor}; display:flex; align-items:center; gap:5px;">${icon} ${statusText}</span>
                </div>
                <div style="color:${theme.accent}; font-size:0.8rem; font-weight:700; text-transform:uppercase;">Explain this ▼</div>
            `;

            const detailDiv = document.createElement('div');
            detailDiv.className = 'hidden';
            detailDiv.style.cssText = `padding:20px; background:${theme.detail}; border-top:1px solid ${theme.border}; color:${theme.detailText}; line-height:1.5;`;
            detailDiv.innerHTML = `
                <div style="margin-bottom:15px; font-weight:600; color:${theme.text};">${q.question_text}</div>
                <div style="background:${isSim ? '#fffbeb' : 'rgba(250,204,21,0.1)'}; border-left:4px solid ${theme.accent}; padding:15px; border-radius:4px;">
                    <strong style="color:${theme.accent};">EXPLANATION:</strong><br>${q.explanation || 'No explanation available.'}
                </div>
            `;

            headerDiv.onclick = () => {
                if (detailDiv.classList.contains('hidden')) {
                    detailDiv.classList.remove('hidden');
                    headerDiv.style.background = theme.hover;
                } else {
                    detailDiv.classList.add('hidden');
                    headerDiv.style.background = theme.header;
                }
            };

            itemDiv.appendChild(headerDiv);
            itemDiv.appendChild(detailDiv);
            listContainer.appendChild(itemDiv);
        });

        if (questionsShown === 0) {
            listContainer.innerHTML = `<div style="padding:20px; text-align:center; color:${theme.detailText}">No questions answered yet.</div>`;
        }
    },

    // --- 6. FUNCIÓN DE FINALIZACIÓN (FLUJO: QUIZ -> LISTA DE REVISIÓN) ---
    finishQuiz() {
        if (this.simTimerInterval) clearInterval(this.simTimerInterval);

        // Ocultar Quizzes Activos
        document.getElementById('prac-quiz-screen')?.classList.add('hidden');
        document.getElementById('sim-screen-quiz')?.classList.remove('active');
        document.getElementById('sim-screen-review')?.classList.remove('active');

        const prefix = (this.mode.includes('simulation') || this.mode === 'itemsets') ? 'sim' : 'prac';

        // 1. Calcular Gráficos (Prepara los datos, pero NO muestra la pantalla aún)
        this.calculateAndRenderCharts(prefix);

        // 2. Renderizar Lista
        this.renderFinalReview(prefix);

        // 3. MOSTRAR PANTALLA DE LISTA DE REVISIÓN PRIMERO
        if (prefix === 'sim') {
            document.getElementById('sim-final-review-screen').classList.add('active');
            document.getElementById('sim-final-review-screen').style.display = 'flex';
            // Asegurar que la pantalla de stats esté oculta inicialmente
            document.getElementById('sim-screen-perf').classList.remove('active');
            document.getElementById('sim-screen-perf').style.display = 'none';
        } else {
            // En modo práctica, la pantalla de revisión es 'prac-review-screen'
            document.getElementById('prac-review-screen').classList.remove('hidden');
            // Asegurar que la pantalla de stats esté oculta inicialmente
            document.getElementById('prac-results-screen').classList.add('hidden');
        }
    },

    // --- 7. PASAR DE LISTA A ESTADÍSTICAS (SE LLAMA DESDE EL BOTÓN) ---
    showSessionResults(prefix) {
        if (prefix === 'sim') {
            // Ocultar Lista
            document.getElementById('sim-final-review-screen').classList.remove('active');
            document.getElementById('sim-final-review-screen').style.display = 'none';

            // Mostrar Stats Simulación (Correct/Incorrect)
            const statsScreen = document.getElementById('sim-screen-perf');
            statsScreen.classList.add('active');
            statsScreen.style.display = 'flex';
        } else {
            // Ocultar Lista
            document.getElementById('prac-review-screen').classList.add('hidden');

            // Mostrar Stats Práctica (Easy/Med/Hard)
            document.getElementById('prac-results-screen').classList.remove('hidden');
            document.getElementById('prac-results-screen').style.display = 'flex';
        }
    },

    // --- 8. CÁLCULO DE ESTADÍSTICAS (DIFERENCIADO) ---
    calculateAndRenderCharts(prefix) {
        let correct = 0;
        let catMap = {};

        // 1. Cálculo base
        this.data.forEach(q => {
            const userAns = this.userAnswers[q.id];
            let isCorr = false;

            if (userAns !== undefined && userAns !== null) {
                const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
                const ansChar = typeof userAns === 'number' ? String.fromCharCode(65 + userAns) : userAns;
                const ansText = typeof userAns === 'number' ? opts[userAns] : (userAns.length > 1 ? userAns : opts[ansChar?.charCodeAt(0) - 65]);

                if (ansChar === q.correct_answer || ansText === q.correct_answer) isCorr = true;
            }

            if (isCorr) correct++;

            const cat = q.category || "General";
            if (!catMap[cat]) catMap[cat] = { c: 0, t: 0 };
            catMap[cat].t++;
            if (isCorr) catMap[cat].c++;
        });

        const total = this.data.length;
        const acc = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Renderizar Textos
        this.setText(`${prefix}-acc-val`, acc + "%");
        this.setText(`${prefix}-correct-val`, correct);
        this.setText(`${prefix}-incorrect-val`, total - correct);

        // 2. PIE CHART (LÓGICA ESPECÍFICA)
        const pie = document.getElementById(`${prefix}-perf-pie`);

        if (pie) {
            if (prefix === 'sim') {
                // MODO SIMULACIÓN (LIGHT): CORRECTO vs INCORRECTO
                const deg = Math.round((acc / 100) * 360);
                pie.style.background = `conic-gradient(#22c55e 0deg ${deg}deg, #ef4444 ${deg}deg 360deg)`;

            } else {
                // MODO PRÁCTICA (DARK): EASY / MEDIUM / HARD
                // Usamos this.stats para colorear el gráfico
                const s = this.stats;
                const totalRated = (s.easy + s.medium + s.hard) || 1;

                const degEasy = (s.easy / totalRated) * 360;
                const degMed = (s.medium / totalRated) * 360;
                // degHard es el resto

                pie.style.background = `conic-gradient(
                    #22c55e 0deg ${degEasy}deg, 
                    #facc15 ${degEasy}deg ${degEasy + degMed}deg, 
                    #ef4444 ${degEasy + degMed}deg 360deg
                )`;
            }
        }

        // 3. Renderizar Lista de Categorías
        const catDiv = document.getElementById(`${prefix}-cat-list`);
        if (catDiv) {
            catDiv.innerHTML = '';
            for (const [name, d] of Object.entries(catMap)) {
                catDiv.innerHTML += `
                    <div class="cat-item">
                        <span>${name}</span>
                        <span style="font-family:monospace; font-weight:bold;">
                            <span style="color:#22c55e">${d.c}</span> / <span style="color:#ef4444">${d.t - d.c}</span>
                        </span>
                    </div>`;
            }
        }
    },

    // --- UTILS ---
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
        if (!this.data || this.data.length === 0) {
            console.error("No data to render.");
            return;
        }

        const q = this.data[this.currentIndex];
        if (!q) {
            console.error("Question object is undefined at index " + this.currentIndex);
            return;
        }

        this.setText('sim-q-counter', `Question ${this.currentIndex + 1} of ${this.data.length}`);

        // Ensure text is not null
        const qText = q.question_text || "Question content unavailable.";
        this.setText('sim-q-text', qText);

        // Default Patient Data
        let pData = { patient: "N/A", cc: "-", history: "-", findings: "-" };

        // Process Clinical Case Data Safe
        if (q.clinical_cases) {
            // Handle array vs object return from Supabase
            const c = Array.isArray(q.clinical_cases) ? q.clinical_cases[0] : q.clinical_cases;

            if (c) {
                // 1. Check for specific columns (New Schema)
                // We check if any of the new fields have content.
                if (c.chief_complaint || c.medical_history || c.current_findings || c.patient_age) {
                    const age = c.patient_age ? `${c.patient_age}` : "";
                    const gender = c.patient_gender || "";
                    // Simple logic to format Age/Gender
                    const demo = [age, gender].filter(x => x).join(", ");

                    pData = {
                        patient: demo || "N/A",
                        cc: c.chief_complaint || "-",
                        history: c.medical_history || "-",
                        findings: c.current_findings || "-"
                    };
                }
                // 2. Fallback to 'patient_data' JSON (Old Schema)
                else if (c.patient_data) {
                    try {
                        let parsed;
                        if (typeof c.patient_data === 'object') {
                            parsed = c.patient_data;
                        } else if (typeof c.patient_data === 'string') {
                            parsed = JSON.parse(c.patient_data);
                        }

                        if (parsed) {
                            pData = {
                                patient: parsed.patient || parsed.age || "N/A",
                                cc: parsed.cc || parsed.complaint || "-",
                                history: parsed.history || "-",
                                findings: parsed.findings || "-"
                            };
                        }
                    } catch (e) {
                        console.error("Error parsing patient data:", e);
                    }
                }
            }
        }

        const setTable = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = `<tr><td>${val}</td></tr>`; };
        setTable('sim-pat-demo', pData.patient);
        setTable('sim-pat-cc', pData.cc);
        setTable('sim-pat-hist', pData.history);
        setTable('sim-pat-find', pData.findings);

        const container = document.getElementById('sim-options-container');
        if (container) {
            container.innerHTML = '';
            [q.option_a, q.option_b, q.option_c, q.option_d].forEach((opt, idx) => {
                if (!opt) return;
                const div = document.createElement('div');
                div.className = 'sim-option';
                if (this.userAnswers[q.id] === idx) div.classList.add('selected');

                div.innerHTML = `<div class="sim-radio"></div> ${opt}`;
                div.onclick = () => {
                    this.userAnswers[q.id] = idx;
                    this.renderSimQuestion();
                };
                container.appendChild(div);
            });
        }

        const btnMark = document.getElementById('btn-sim-mark');
        if (btnMark) {
            if (this.markedQuestions.has(this.currentIndex)) {
                btnMark.classList.add('active');
                btnMark.innerText = "UNMARK";
            } else {
                btnMark.classList.remove('active');
                btnMark.innerText = "MARK";
            }
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

    setText(id, txt) {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    },

    goBack() {
        if (this.isMobile) window.location.href = 'mobile.html';
        else window.location.href = 'dashboard.html';
    }
};

window.classifyPractice = (s) => QuizEngine.classifyQuestion(s);
window.nextPracticeQuestion = () => QuizEngine.nextQuestion();
window.finishPracticeQuiz = () => QuizEngine.finishQuiz();
window.nextSimQuestion = () => QuizEngine.nextQuestion();
window.toggleSimMark = () => QuizEngine.toggleSimMark();
window.goToSimReview = () => QuizEngine.goToSimReview();
window.returnToSimQuiz = () => QuizEngine.returnToSimQuiz();
window.finishSimExam = () => QuizEngine.finishQuiz();
window.showPracticeResults = () => QuizEngine.showSessionResults('prac');
window.showSimResults = () => QuizEngine.showSessionResults('sim');
window.goToDashboard = () => QuizEngine.goBack();

document.addEventListener('DOMContentLoaded', () => QuizEngine.init());
