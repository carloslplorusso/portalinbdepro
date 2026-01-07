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

        let data = [];
        let query = _supabase.from('questions_bank')
            .select('*, case_old:clinical_cases!case_id (*), case_new:clinical_cases!clinical_case_id (*)');

        // --- STRATEGY 1: RANDOM / DAILY ---
        if (this.mode === 'random' || this.mode === 'daily') {
            console.log("Fetch Random: Stand Alone Only & Unseen Prioritized");
            let answeredIds = new Set();
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                const { data: progress } = await _supabase.from('user_progress').select('question_id').eq('user_id', session.user.id);
                if (progress) progress.forEach(p => answeredIds.add(p.question_id));
            }

            // Fetch Standalone Cases
            const { data: validCases } = await _supabase.from('clinical_cases')
                .select('id').or('scenario_text.is.null,scenario_text.eq.""');
            const validCaseIds = validCases ? validCases.map(c => c.id) : [];

            let qQuery = _supabase.from('questions_bank').select('id').is('case_id', null).eq('is_active', true);
            if (validCaseIds.length > 0) qQuery = qQuery.in('clinical_case_id', validCaseIds);
            else qQuery = qQuery.is('clinical_case_id', null);

            const { data: allIds } = await qQuery;
            if (allIds && allIds.length > 0) {
                const unseen = allIds.filter(x => !answeredIds.has(x.id));
                let pool = unseen;
                if (unseen.length < 10) pool = allIds;

                const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, 10);
                const ids = shuffled.map(x => x.id);

                const res = await _supabase.from('questions_bank')
                    .select('*, case_old:clinical_cases!case_id (*), case_new:clinical_cases!clinical_case_id (*)')
                    .in('id', ids);
                data = res.data;
            } else {
                alert("No Stand Alone questions found.");
            }

            // --- STRATEGY 2: SEARCH ---
        } else if (this.mode === 'search' && term) {
            const res = await query.ilike('question_text', `%${term}%`);
            data = res.data;

            // --- STRATEGY 3: CATEGORIES ---
        } else if (catsStr) {
            const catsArr = catsStr.split(',').map(decodeURIComponent);
            // Candidates query
            let idQuery = _supabase.from('questions_bank').select('id, category').in('category', catsArr).eq('is_active', true);
            const { data: candidates, error: candError } = await idQuery;

            if (candError || !candidates || candidates.length === 0) {
                alert("No questions found for categories.");
                return;
            }

            let answeredIds = new Set();
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                const { data: progress } = await _supabase.from('user_progress').select('question_id').eq('user_id', session.user.id);
                if (progress) progress.forEach(p => answeredIds.add(p.question_id));
            }

            const unseen = candidates.filter(q => !answeredIds.has(q.id));
            const targetCount = count || 20;
            let selectedIds = [];

            if (unseen.length >= targetCount) {
                selectedIds = unseen.sort(() => 0.5 - Math.random()).slice(0, targetCount).map(q => q.id);
            } else {
                selectedIds.push(...unseen.map(q => q.id));
                const remainder = targetCount - selectedIds.length;
                const seen = candidates.filter(q => answeredIds.has(q.id));
                const filled = seen.sort(() => 0.5 - Math.random()).slice(0, remainder).map(q => q.id);
                selectedIds.push(...filled);
            }
            selectedIds.sort(() => 0.5 - Math.random());

            const res = await _supabase.from('questions_bank')
                .select('*, case_old:clinical_cases!case_id (*), case_new:clinical_cases!clinical_case_id (*)')
                .in('id', selectedIds);
            data = res.data;

            // --- STRATEGY 4: SIMULATION / ITEM SETS ---
        } else if (this.mode.includes('simulation') || this.mode === 'itemsets') {
            console.log("Fetch Sim/ItemSets");
            // Query A & B
            const qA = _supabase.from('questions_bank').select('id, case_id').not('case_id', 'is', null);
            const qB = _supabase.from('questions_bank').select('id, clinical_case_id').not('clinical_case_id', 'is', null);
            const [resA, resB] = await Promise.all([qA, qB]);

            const combined = [...(resA.data || []), ...(resB.data || [])];
            const uniqueIds = new Set(combined.map(x => x.id));
            const allSimIds = Array.from(uniqueIds);

            let answeredIds = new Set();
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                const { data: progress } = await _supabase.from('user_progress').select('question_id').eq('user_id', session.user.id);
                if (progress) progress.forEach(p => answeredIds.add(p.question_id));
            }

            const unseen = allSimIds.filter(id => !answeredIds.has(id));
            const targetCount = count || 70;
            let selectedIds = [];

            if (unseen.length >= targetCount) {
                selectedIds = unseen.sort(() => 0.5 - Math.random()).slice(0, targetCount);
            } else {
                selectedIds.push(...unseen);
                const remainder = targetCount - selectedIds.length;
                const seen = allSimIds.filter(id => answeredIds.has(id));
                const filled = seen.sort(() => 0.5 - Math.random()).slice(0, remainder);
                selectedIds.push(...filled);
            }
            selectedIds.sort(() => 0.5 - Math.random());

            const res = await _supabase.from('questions_bank')
                .select('*, case_old:clinical_cases!case_id (*), case_new:clinical_cases!clinical_case_id (*)')
                .in('id', selectedIds);
            data = res.data;

            // --- STRATEGY 5: PRACTICE FALLBACK ---
        } else {
            // Basic fallback
            console.log("Fetch Fallback");
            const qFallback = query.is('case_id', null).is('clinical_case_id', null).limit(10);
            const res = await qFallback;
            data = res.data;
        }

        // --- POST PROCESSING (Validate & Group) ---
        if (!data || data.length === 0) {
            alert("No questions found.");
            this.goBack();
            return;
        }
        this.data = []; // Reset

        if (this.mode.includes('simulation') || this.mode === 'itemsets') {
            // GROUPING LOGIC
            const cases = {};
            const standalone = [];
            data.forEach(q => {
                let c = q.case_new || q.case_old;
                if (Array.isArray(c)) c = c[0];

                if (c) {
                    let groupKey = c.id;
                    if (c.scenario_text && c.scenario_text.length > 10) groupKey = "SCEN_" + c.scenario_text.trim().substring(0, 50);
                    else if (c.patient_data) {
                        let pStr = (typeof c.patient_data === 'string') ? c.patient_data : JSON.stringify(c.patient_data);
                        groupKey = "PAT_" + pStr.substring(0, 50);
                    }
                    if (!cases[groupKey]) cases[groupKey] = [];
                    cases[groupKey].push(q);
                } else {
                    standalone.push(q);
                }
            });

            let caseKeys = Object.keys(cases);
            if (this.mode === 'itemsets') {
                caseKeys = caseKeys.filter(k => cases[k].length > 1);
                standalone.length = 0; // strict
            }
            const shuffledKeys = caseKeys.sort(() => Math.random() - 0.5);
            shuffledKeys.forEach(k => {
                this.data.push(...cases[k].sort((a, b) => a.id - b.id));
            });
            this.data.push(...standalone.sort(() => Math.random() - 0.5));

        } else {
            // SIMPLE SHUFFLE (Random, Search, Cats, Practice)
            this.data = data.sort(() => Math.random() - 0.5);
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

        // Standalone Mode: Show ONLY the question text (Merged with Scenario if exists)
        // Clinical Case context is intentionally hidden in this mode.

        let displayText = q.question_text;

        // Auto-Merge Scenario for Standalone/Practice Mode
        // If the question has a linked case with scenario text, prepend it.
        if (q.case_new && q.case_new.scenario_text && q.case_new.scenario_text.trim() !== "") {
            displayText = `<div style="margin-bottom:15px; font-weight:500; color:#cbd5e1; border-left:3px solid #facc15; padding-left:12px;">
            ${q.case_new.scenario_text}
        </div>${q.question_text}`;
        }

        document.getElementById('prac-q-text').innerHTML = displayText;

        document.getElementById('prac-review-area').classList.add('hidden');
        document.getElementById('prac-error-msg')?.classList.add('hidden');
        document.getElementById('prac-error-msg')?.classList.add('hidden');
        document.getElementById('btn-prac-next').classList.add('hidden');

        // Report Button Injection for Practice Mode
        // Ensure there is a container or create one if needed, or append to an existing area.
        // Assuming we can append it near the question text or options.
        // Let's add it to the top right of the question area if possible, or below options.
        // Ideally checking if a report button exists or creating one dynamically.
        // For simplicity, let's inject a small link/button in the explanation area or near options container.

        let reportBtn = document.getElementById('prac-report-btn');
        if (!reportBtn) {
            const container = document.getElementById('prac-quiz-screen'); // or specific container
            reportBtn = document.createElement('button');
            reportBtn.id = 'prac-report-btn';
            reportBtn.innerText = '🚩 Report';
            reportBtn.className = 'btn-report-problem';
            // Minimal styling: positioned or float. 
            // Better: Put it in the header/footer of the card.
            // Let's assume user wants it "visible".

            // Cleanest: Append to options container as a footer link
        }

        // Actually, let's add it to the option list container at the bottom
        // Or re-render it every time


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

        // Add Report Button at the bottom of options
        const reportDiv = document.createElement('div');
        reportDiv.style.textAlign = 'right';
        reportDiv.style.marginTop = '10px';
        reportDiv.innerHTML = `<button onclick="reportQuestion(${q.id})" style="background:transparent; border:none; color:#666; font-size:0.8rem; cursor:pointer; text-decoration:underline;">🚩 Report Issue</button>`;
        container.appendChild(reportDiv);
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

        // Process Clinical Case Data Safe (Dual Check)
        const c = Array.isArray(q.case_new || q.case_old) ? (q.case_new || q.case_old)[0] : (q.case_new || q.case_old);

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

        // Add Report Button for Simulation
        const simContainer = document.getElementById('sim-options-container');
        // Note: container is cleared above, so we can just append.
        if (simContainer) {
            const reportDiv = document.createElement('div');
            reportDiv.style.textAlign = 'right';
            reportDiv.style.marginTop = '15px';
            reportDiv.innerHTML = `<button onclick="reportQuestion(${q.id})" style="background:transparent; border:none; color:#888; font-size:0.8rem; cursor:pointer;">🚩 Report Issue</button>`;
            simContainer.appendChild(reportDiv);
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
    },

    // --- 9. REPORTING SYSTEM ---
    // --- 9. REPORTING SYSTEM ---
    injectReportModal() {
        if (document.getElementById('report-modal')) return;

        const modalHTML = `
            <div id="report-modal" class="modal-overlay hidden" style="z-index: 10000;">
                <div class="modal-content" style="background:#121212; border:1px solid #333; padding:25px; border-radius:16px; width:90%; max-width:400px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="margin:0; font-weight:800; color:white; font-size:1.2rem;">🚩 Report Issue</h3>
                        <span class="close-btn" onclick="QuizEngine.closeReportModal()" style="cursor:pointer; font-size:1.5rem; color:#888;">×</span>
                    </div>
                    <p style="color:#a1a1aa; font-size:0.9rem; margin-bottom:15px; line-height:1.4;">
                        Describe the error or problem with this question.
                    </p>
                    <textarea id="report-text" placeholder="E.g. Wrong answer key, typo, display issue..." 
                        style="width:100%; background:#000; border:1px solid #333; color:white; padding:15px; border-radius:12px; font-size:0.95rem; min-height:120px; resize:none; margin-bottom:20px; outline:none; font-family:inherit;"></textarea>
                     <div style="display:flex; gap:10px;">
                        <button onclick="QuizEngine.closeReportModal()" style="flex:1; background:transparent; border:1px solid #333; color:#a1a1aa; padding:12px; border-radius:8px; font-weight:600; cursor:pointer; transition:0.2s;">Cancel</button>
                        <button id="btn-submit-report" onclick="QuizEngine.submitReport()" style="flex:1; background:#facc15; color:black; border:none; padding:12px; border-radius:8px; font-weight:800; cursor:pointer; text-transform:uppercase; font-size:0.9rem; transition:0.2s;">Send Report</button>
                    </div>
                </div>
                <style>
                    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
                    .modal-overlay.active { opacity: 1; pointer-events: auto; }
                    #report-text:focus { border-color: #facc15; }
                </style>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    currentReportQId: null,

    reportQuestion(qId) {
        if (!qId) return;
        this.currentReportQId = qId;
        this.injectReportModal();

        const txt = document.getElementById('report-text');
        if (txt) txt.value = '';

        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('active'), 10);
        }
    },

    closeReportModal() {
        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
        this.currentReportQId = null;
    },

    async submitReport() {
        const text = document.getElementById('report-text').value.trim();
        if (!text) {
            alert("Please enter a description.");
            return;
        }

        const qId = this.currentReportQId;
        if (!qId) return;

        const btn = document.getElementById('btn-submit-report');
        if (btn) {
            btn.innerText = "Sending...";
            btn.disabled = true;
        }

        try {
            const { data: { session } } = await _supabase.auth.getSession();
            const userId = session ? session.user.id : null;

            // Find question text
            const q = this.data.find(item => item.id == qId);
            const qText = q ? q.question_text : "Unknown Question";

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0];

            const payload = {
                created_at: now.toISOString(),
                report_date: dateStr,
                report_time: timeStr,
                user_id: userId,
                question: qText,
                quiz_mode: this.mode,
                report_text: text
            };

            const { error } = await _supabase.from('report_issues').insert(payload);

            if (error) throw error;

            alert("Report sent! Thank you.");
            this.closeReportModal();

        } catch (e) {
            console.error("Error reporting:", e);
            alert("Could not send report. " + e.message);
        } finally {
            if (btn) {
                btn.innerText = "Send Report";
                btn.disabled = false;
            }
        }
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
window.reportQuestion = (id) => QuizEngine.reportQuestion(id);
window.QuizEngine = QuizEngine;

document.addEventListener('DOMContentLoaded', () => QuizEngine.init());
