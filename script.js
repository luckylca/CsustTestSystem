const app = {
    data: [], // All questions flattened
    currentMode: 'practice', // 'practice' or 'sim'
    currentIndex: 0,
    score: 0,
    userAnswers: [], // Array to store user choices
    simCount: 20,
    partName: '',

    // State for UI
    questionsToAsk: [], // Subset for simulation or full set for practice

    init() {
        // Setup initial listeners if any
        document.getElementById('questionCount').addEventListener('change', (e) => {
            this.simCount = parseInt(e.target.value);
        });
    },

    async selectPart(filename) {
        this.partName = filename;
        // Show loading or transition?
        try {
            const response = await fetch(filename);
            if (!response.ok) throw new Error('Network response was not ok');

            // We need to handle JSON with comments if we didn't fix it fully, 
            // but we assume it's fixed on disk. 
            // However, fetch().json() will fail on comments. 
            // Since we are fixing the file on disk, standard json() should work.
            const rawData = await response.json();

            this.processData(rawData);

            // Transition UI
            document.getElementById('mainSelection').classList.add('hidden');
            document.getElementById('modeSelection').classList.remove('hidden');
            document.getElementById('homeBtn').classList.remove('hidden');
            document.getElementById('homeBtn').onclick = () => location.reload();

        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading question bank. Ensure the JSON file is valid and accessible.');
        }
    },

    processData(rawData) {
        // Normalize data to a flat array of questions
        // Check if structure is flat (Part 1) or nested (Part 2)

        let allQuestions = [];

        if (Array.isArray(rawData)) {
            // Check first element
            if (rawData.length > 0 && rawData[0].questions) {
                // Nested structure (Part 2)
                rawData.forEach(exercise => {
                    const title = exercise.exercise_title;
                    exercise.questions.forEach(q => {
                        // Inject source title for context if needed
                        q._source = title;
                        allQuestions.push(q);
                    });
                });
            } else {
                // Flat structure (Part 1)
                allQuestions = rawData;
            }
        }

        this.data = allQuestions;
        console.log(`Loaded ${this.data.length} questions.`);
    },

    setMode(mode) {
        this.currentMode = mode;
        if (mode === 'practice') {
            this.questionsToAsk = [...this.data];
            this.startQuiz();
        } else if (mode === 'sim') {
            this.showSimConfig();
        }
    },

    showSimConfig() {
        document.getElementById('modeSelection').classList.add('hidden');
        document.getElementById('simConfig').classList.remove('hidden');
    },

    showSimulationConfig() { // Alias for button
        this.setMode('sim');
    },

    startSimulation() {
        // Randomly select N questions
        const count = Math.min(this.simCount, this.data.length);
        const shuffled = [...this.data].sort(() => 0.5 - Math.random());
        this.questionsToAsk = shuffled.slice(0, count);

        document.getElementById('simConfig').classList.add('hidden');
        this.startQuiz();
    },

    startQuiz() {
        // Reset state
        this.currentIndex = 0;
        this.score = 0;
        this.userAnswers = new Array(this.questionsToAsk.length).fill(null);

        // UI Reset
        document.getElementById('modeSelection').classList.add('hidden');
        document.getElementById('quizInterface').classList.remove('hidden');

        this.renderQuestion();
    },

    renderQuestion() {
        const question = this.questionsToAsk[this.currentIndex];
        const displayNum = this.currentIndex + 1;
        const total = this.questionsToAsk.length;

        // Update Status
        document.getElementById('progressText').textContent = `Question ${displayNum} / ${total}`;
        document.getElementById('scoreText').textContent = `Score: ${this.score}`;
        document.getElementById('qNumber').textContent = `Question ${displayNum}`;

        // Render Content
        // Convert newlines to <br> if needed, or rely on CSS
        const contentDiv = document.getElementById('qContent');
        contentDiv.innerHTML = this.processText(question.content || question.question);

        // Image
        const imgEl = document.getElementById('qImage');
        if (question.image) {
            imgEl.src = question.image;
            imgEl.classList.remove('hidden');
        } else {
            imgEl.classList.add('hidden');
        }

        // Options
        const optionsList = document.getElementById('optionsList');
        optionsList.innerHTML = '';

        // Determine options array (Part 1 vs Part 2 structure diff?)
        // Part 1: "options": ["...", "..."]
        // Part 2: "options": ["(A) ...", ...]
        const options = question.options;

        options.forEach((optText, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D...
            const div = document.createElement('div');
            div.className = 'option-item';
            // Check if selected
            if (this.userAnswers[this.currentIndex] === letter) {
                div.classList.add('selected');
            }

            // Process text for MathJax
            div.innerHTML = `<span style="font-weight: 500; margin-right: 12px;">${letter}.</span> ${this.processText(optText)}`;

            div.onclick = () => this.selectOption(letter);
            optionsList.appendChild(div);
        });

        // Toggle Buttons
        document.getElementById('prevBtn').disabled = this.currentIndex === 0;
        document.getElementById('nextBtn').textContent = this.currentIndex === total - 1 ? 'Finish' : 'Next';

        // Re-render MathJax
        if (window.MathJax) {
            MathJax.typesetPromise([contentDiv, optionsList]).then(() => { });
        }
    },

    processText(text) {
        if (!text) return '';
        // If text contains "（A）" type prefixes in options, we leave them or strip them?
        // The display logic adds A. B. C. manually. 
        // Part 1: "options": ["$\\frac{dr}{dt}$", ...] -> No prefix.
        // Part 2: "options": ["（A）处处为零", ...] -> Has prefix.
        // We might want to strip the prefix for consistency, but it's optional.
        return text;
    },

    selectOption(letter) {
        // If already answered correctly/incorrectly and shown answer? 
        // For now, allow changing answer until "Show Answer" or "Next"?
        // Let's just save the selection.
        this.userAnswers[this.currentIndex] = letter;
        this.renderQuestion(); // Re-render to update styling
    },

    showAnswer() {
        const question = this.questionsToAsk[this.currentIndex];
        const correctAnswer = (question.answer || '').trim().toUpperCase();

        if (!correctAnswer) {
            alert("No answer key available for this question.");
            return;
        }

        // Highlight correct and wrong
        const options = document.querySelectorAll('.option-item');
        options.forEach((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            if (letter === correctAnswer) {
                opt.classList.add('correct');
            } else if (opt.classList.contains('selected') && letter !== correctAnswer) {
                opt.classList.add('wrong');
            }
        });

        // Update score if first time checking?
        // Simple logic: If current selection is correct, good.
    },

    nextQuestion() {
        if (this.currentIndex < this.questionsToAsk.length - 1) {
            this.currentIndex++;
            this.renderQuestion();
        } else {
            // Finish
            alert(`Test Finished!`);
        }
    },

    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderQuestion();
        }
    }
};

app.init();
