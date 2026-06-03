class ToastManager {
    constructor() {
        this.toast = document.getElementById('toast');
        this.message = document.getElementById('toastMessage');
        this.timeoutId = null;
    }

    show(message, type = 'default', duration = 2500) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.message.textContent = message;
        this.toast.className = 'toast show';
        if (type === 'success') {
            this.toast.classList.add('success');
        } else if (type === 'error') {
            this.toast.classList.add('error');
        }
        this.timeoutId = setTimeout(() => {
            this.hide();
        }, duration);
    }

    hide() {
        this.toast.classList.remove('show', 'success', 'error');
    }
}

class TabManager {
    constructor(onTabChange) {
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.onTabChange = onTabChange;
        this.currentTab = 'pomodoro';
        this.init();
    }

    init() {
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    switchTab(tab) {
        if (tab === this.currentTab) return;
        this.currentTab = tab;
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tab}-content`);
        });
        if (this.onTabChange) {
            this.onTabChange(tab);
        }
        this.saveLastUsedTab(tab);
    }

    saveLastUsedTab(tab) {
        try {
            const settings = this.loadAppSettings();
            settings.lastUsedTab = tab;
            localStorage.setItem('appSettings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save last used tab:', e);
        }
    }

    loadAppSettings() {
        try {
            const saved = localStorage.getItem('appSettings');
            return saved ? JSON.parse(saved) : { theme: 'light', lastUsedTab: 'pomodoro' };
        } catch (e) {
            return { theme: 'light', lastUsedTab: 'pomodoro' };
        }
    }
}

class PomodoroTimer {
    constructor(toastManager, statsManager) {
        this.toastManager = toastManager;
        this.statsManager = statsManager;
        this.timerDisplay = document.getElementById('timerDisplay');
        this.timerStatus = document.getElementById('timerStatus');
        this.progressRing = document.getElementById('progressRing');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.taskInput = document.getElementById('taskName');
        this.tomatoDisplay = document.getElementById('tomatoDisplay');
        this.tomatoCount = document.getElementById('tomatoCount');
        this.focusDurationInput = document.getElementById('focusDuration');
        this.shortBreakDurationInput = document.getElementById('shortBreakDuration');
        this.longBreakDurationInput = document.getElementById('longBreakDuration');
        this.tomatoesUntilLongBreakInput = document.getElementById('tomatoesUntilLongBreak');
        this.soundEnabledInput = document.getElementById('soundEnabled');
        this.timerId = null;
        this.isRunning = false;
        this.isPaused = false;
        this.currentTime = 25 * 60;
        this.totalTime = 25 * 60;
        this.completedPomodoros = 0;
        this.currentMode = 'focus';
        this.settings = {
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            tomatoesUntilLongBreak: 4,
            soundEnabled: true
        };
        this.circumference = 2 * Math.PI * 90;
        this.progressRing.style.strokeDasharray = this.circumference;
        this.progressRing.style.strokeDashoffset = this.circumference;
        this.audioContext = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
        this.updateDisplay();
        this.updateTomatoDisplay();
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.focusDurationInput.addEventListener('change', () => this.updateSettings());
        this.shortBreakDurationInput.addEventListener('change', () => this.updateSettings());
        this.longBreakDurationInput.addEventListener('change', () => this.updateSettings());
        this.tomatoesUntilLongBreakInput.addEventListener('change', () => this.updateSettings());
        this.soundEnabledInput.addEventListener('change', () => this.updateSettings());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning) {
                this.pause();
            }
        });
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('pomodoroSettings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            } catch (e) {
                console.warn('Failed to load settings:', e);
            }
        }
        this.focusDurationInput.value = this.settings.focusDuration;
        this.shortBreakDurationInput.value = this.settings.shortBreakDuration;
        this.longBreakDurationInput.value = this.settings.longBreakDuration;
        this.tomatoesUntilLongBreakInput.value = this.settings.tomatoesUntilLongBreak;
        this.soundEnabledInput.checked = this.settings.soundEnabled;
        const savedDate = localStorage.getItem('pomodoroDate');
        const today = new Date().toDateString();
        if (savedDate === today) {
            const savedCount = localStorage.getItem('pomodoroCount');
            if (savedCount) {
                this.completedPomodoros = parseInt(savedCount, 10) || 0;
            }
        } else {
            this.completedPomodoros = 0;
            this.saveProgress();
        }
        this.currentTime = this.settings.focusDuration * 60;
        this.totalTime = this.currentTime;
    }

    saveSettings() {
        try {
            localStorage.setItem('pomodoroSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    saveProgress() {
        try {
            localStorage.setItem('pomodoroDate', new Date().toDateString());
            localStorage.setItem('pomodoroCount', this.completedPomodoros.toString());
        } catch (e) {
            console.warn('Failed to save progress:', e);
        }
    }

    updateSettings() {
        this.settings.focusDuration = Math.max(1, Math.min(60, parseInt(this.focusDurationInput.value, 10) || 25));
        this.settings.shortBreakDuration = Math.max(1, Math.min(30, parseInt(this.shortBreakDurationInput.value, 10) || 5));
        this.settings.longBreakDuration = Math.max(1, Math.min(60, parseInt(this.longBreakDurationInput.value, 10) || 15));
        this.settings.tomatoesUntilLongBreak = Math.max(2, Math.min(10, parseInt(this.tomatoesUntilLongBreakInput.value, 10) || 4));
        this.settings.soundEnabled = this.soundEnabledInput.checked;
        this.focusDurationInput.value = this.settings.focusDuration;
        this.shortBreakDurationInput.value = this.settings.shortBreakDuration;
        this.longBreakDurationInput.value = this.settings.longBreakDuration;
        this.tomatoesUntilLongBreakInput.value = this.settings.tomatoesUntilLongBreak;
        this.saveSettings();
        if (!this.isRunning && !this.isPaused) {
            this.setMode(this.currentMode);
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.timerDisplay.classList.add('running');
        this.timerId = setInterval(() => {
            this.tick();
        }, 1000);
    }

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.isPaused = true;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.timerDisplay.classList.remove('running');
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    reset() {
        this.isRunning = false;
        this.isPaused = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.timerDisplay.classList.remove('running');
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.setMode('focus');
    }

    tick() {
        this.currentTime--;
        if (this.currentTime <= 0) {
            this.currentTime = 0;
            this.onTimerComplete();
        }
        this.updateDisplay();
    }

    onTimerComplete() {
        if (this.currentMode === 'focus') {
            this.completedPomodoros++;
            this.saveProgress();
            this.updateTomatoDisplay();
            this.statsManager.incrementStat('pomodoroCount');
            this.playSound();
            this.toastManager.show(`🍅 完成一个番茄！共 ${this.completedPomodoros} 个`, 'success');
            if (this.completedPomodoros % this.settings.tomatoesUntilLongBreak === 0) {
                this.setMode('longBreak');
            } else {
                this.setMode('shortBreak');
            }
        } else {
            this.setMode('focus');
        }
    }

    playSound() {
        if (!this.settings.soundEnabled) return;
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (e) {
            console.warn('Failed to play sound:', e);
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        this.progressRing.classList.remove('break', 'long-break');
        let duration;
        switch (mode) {
            case 'focus':
                duration = this.settings.focusDuration;
                break;
            case 'shortBreak':
                duration = this.settings.shortBreakDuration;
                this.progressRing.classList.add('break');
                break;
            case 'longBreak':
                duration = this.settings.longBreakDuration;
                this.progressRing.classList.add('long-break');
                break;
            default:
                duration = this.settings.focusDuration;
        }
        this.currentTime = duration * 60;
        this.totalTime = this.currentTime;
        this.updateDisplay();
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        this.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        const modeLabels = {
            focus: '专注中',
            shortBreak: '短休息',
            longBreak: '长休息'
        };
        this.timerStatus.textContent = modeLabels[this.currentMode] || '准备开始';
        const progress = this.totalTime > 0 ? (this.totalTime - this.currentTime) / this.totalTime : 0;
        this.progressRing.style.strokeDashoffset = this.circumference * (1 - progress);
    }

    updateTomatoDisplay() {
        this.tomatoCount.textContent = this.completedPomodoros;
        const displayCount = Math.min(this.completedPomodoros, 3);
        const tomatoes = this.tomatoDisplay.querySelectorAll('.tomato');
        tomatoes.forEach((tomato, index) => {
            tomato.classList.toggle('active', index < displayCount);
        });
    }
}

class TodoManager {
    constructor(toastManager, statsManager) {
        this.toastManager = toastManager;
        this.statsManager = statsManager;
        this.todoInput = document.getElementById('todoInput');
        this.addTodoBtn = document.getElementById('addTodoBtn');
        this.todoList = document.getElementById('todoList');
        this.todoEmpty = document.getElementById('todoEmpty');
        this.todoTotalCount = document.getElementById('todoTotalCount');
        this.todoCompletedCount = document.getElementById('todoCompletedCount');
        this.todoTabBtns = document.querySelectorAll('.todo-tab-btn');
        this.todos = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.loadTodos();
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        this.addTodoBtn.addEventListener('click', () => this.addTodo());
        this.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTodo();
            }
        });
        this.todoTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.dataset.filter;
                this.todoTabBtns.forEach(b => b.classList.toggle('active', b === btn));
                this.render();
            });
        });
    }

    loadTodos() {
        try {
            const saved = localStorage.getItem('todoItems');
            if (saved) {
                this.todos = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load todos:', e);
            this.todos = [];
        }
    }

    saveTodos() {
        try {
            localStorage.setItem('todoItems', JSON.stringify(this.todos));
        } catch (e) {
            console.warn('Failed to save todos:', e);
        }
    }

    addTodo(text = null) {
        const todoText = text || this.todoInput.value.trim();
        if (!todoText) {
            this.toastManager.show('请输入待办事项内容', 'error');
            return;
        }
        const todo = {
            id: Date.now(),
            text: todoText,
            completed: false,
            createdAt: new Date().toISOString()
        };
        this.todos.unshift(todo);
        this.saveTodos();
        this.todoInput.value = '';
        this.render();
        this.statsManager.incrementStat('todoAddCount');
        this.toastManager.show('待办事项已添加', 'success');
    }

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            const wasCompleted = todo.completed;
            todo.completed = !todo.completed;
            if (todo.completed) {
                todo.completedAt = new Date().toISOString();
                this.statsManager.incrementStat('todoCompleteCount');
            } else {
                delete todo.completedAt;
            }
            this.saveTodos();
            this.render();
            if (!wasCompleted && todo.completed) {
                this.toastManager.show('待办事项已完成 ✓', 'success');
            }
        }
    }

    deleteTodo(id) {
        const item = this.todoList.querySelector(`[data-id="${id}"]`);
        if (item) {
            item.classList.add('removing');
            setTimeout(() => {
                this.todos = this.todos.filter(t => t.id !== id);
                this.saveTodos();
                this.render();
            }, 300);
        }
    }

    getFilteredTodos() {
        switch (this.currentFilter) {
            case 'active':
                return this.todos.filter(t => !t.completed);
            case 'completed':
                return this.todos.filter(t => t.completed);
            default:
                return this.todos;
        }
    }

    render() {
        const filtered = this.getFilteredTodos();
        const completedCount = this.todos.filter(t => t.completed).length;
        this.todoTotalCount.textContent = this.todos.length;
        this.todoCompletedCount.textContent = completedCount;
        if (this.todos.length === 0) {
            this.todoList.innerHTML = '';
            this.todoEmpty.classList.add('show');
        } else {
            this.todoEmpty.classList.remove('show');
            this.todoList.innerHTML = filtered.map(todo => `
                <div class="todo-item" data-id="${todo.id}">
                    <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-id="${todo.id}"></div>
                    <span class="todo-text ${todo.completed ? 'completed' : ''}">${this.escapeHtml(todo.text)}</span>
                    <button class="todo-delete" data-id="${todo.id}">×</button>
                </div>
            `).join('');
            this.todoList.querySelectorAll('.todo-checkbox').forEach(checkbox => {
                checkbox.addEventListener('click', () => {
                    this.toggleTodo(parseInt(checkbox.dataset.id));
                });
            });
            this.todoList.querySelectorAll('.todo-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.deleteTodo(parseInt(btn.dataset.id));
                });
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

class PasswordGenerator {
    constructor(toastManager, statsManager) {
        this.toastManager = toastManager;
        this.statsManager = statsManager;
        this.passwordDisplay = document.getElementById('passwordDisplay');
        this.copyBtn = document.getElementById('copyPasswordBtn');
        this.generateBtn = document.getElementById('generatePasswordBtn');
        this.refreshBtn = document.getElementById('refreshPasswordBtn');
        this.lengthInput = document.getElementById('passwordLength');
        this.uppercaseInput = document.getElementById('includeUppercase');
        this.lowercaseInput = document.getElementById('includeLowercase');
        this.numbersInput = document.getElementById('includeNumbers');
        this.symbolsInput = document.getElementById('includeSymbols');
        this.historyList = document.getElementById('passwordHistory');
        this.historyEmpty = document.getElementById('historyEmpty');
        this.settings = {
            length: 16,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: false
        };
        this.history = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
        this.loadHistory();
        this.renderHistory();
    }

    bindEvents() {
        this.generateBtn.addEventListener('click', () => this.generate());
        this.refreshBtn.addEventListener('click', () => this.generate());
        this.copyBtn.addEventListener('click', () => this.copyPassword());
        this.lengthInput.addEventListener('change', () => this.updateSettings());
        this.uppercaseInput.addEventListener('change', () => this.updateSettings());
        this.lowercaseInput.addEventListener('change', () => this.updateSettings());
        this.numbersInput.addEventListener('change', () => this.updateSettings());
        this.symbolsInput.addEventListener('change', () => this.updateSettings());
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('passwordSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load password settings:', e);
        }
        this.lengthInput.value = this.settings.length;
        this.uppercaseInput.checked = this.settings.uppercase;
        this.lowercaseInput.checked = this.settings.lowercase;
        this.numbersInput.checked = this.settings.numbers;
        this.symbolsInput.checked = this.settings.symbols;
    }

    saveSettings() {
        try {
            localStorage.setItem('passwordSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save password settings:', e);
        }
    }

    updateSettings() {
        this.settings.length = Math.max(4, Math.min(64, parseInt(this.lengthInput.value, 10) || 16));
        this.settings.uppercase = this.uppercaseInput.checked;
        this.settings.lowercase = this.lowercaseInput.checked;
        this.settings.numbers = this.numbersInput.checked;
        this.settings.symbols = this.symbolsInput.checked;
        this.lengthInput.value = this.settings.length;
        this.saveSettings();
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('passwordHistory');
            if (saved) {
                this.history = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load password history:', e);
            this.history = [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('passwordHistory', JSON.stringify(this.history));
        } catch (e) {
            console.warn('Failed to save password history:', e);
        }
    }

    generate() {
        const chars = [];
        if (this.settings.uppercase) chars.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
        if (this.settings.lowercase) chars.push('abcdefghijklmnopqrstuvwxyz');
        if (this.settings.numbers) chars.push('0123456789');
        if (this.settings.symbols) chars.push('!@#$%^&*()_+-=[]{}|;:,.<>?');
        
        if (chars.length === 0) {
            this.toastManager.show('请至少选择一种字符类型', 'error');
            return;
        }

        const allChars = chars.join('');
        let password = '';
        const array = new Uint32Array(this.settings.length);
        crypto.getRandomValues(array);
        
        for (let i = 0; i < this.settings.length; i++) {
            password += allChars[array[i] % allChars.length];
        }

        this.passwordDisplay.value = password;
        this.copyBtn.disabled = false;
        
        this.history.unshift({
            password: password,
            timestamp: new Date().toISOString()
        });
        
        if (this.history.length > 10) {
            this.history = this.history.slice(0, 10);
        }
        
        this.saveHistory();
        this.renderHistory();
        this.statsManager.incrementStat('passwordGenerateCount');
    }

    copyPassword() {
        const password = this.passwordDisplay.value;
        if (!password) return;
        
        navigator.clipboard.writeText(password).then(() => {
            this.toastManager.show('密码已复制到剪贴板', 'success');
            this.copyBtn.textContent = '已复制';
            setTimeout(() => {
                this.copyBtn.textContent = '复制';
            }, 2000);
        }).catch(() => {
            this.toastManager.show('复制失败，请手动复制', 'error');
        });
    }

    copyFromHistory(password) {
        navigator.clipboard.writeText(password).then(() => {
            this.toastManager.show('密码已复制到剪贴板', 'success');
        }).catch(() => {
            this.toastManager.show('复制失败，请手动复制', 'error');
        });
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '';
            this.historyEmpty.style.display = 'block';
        } else {
            this.historyEmpty.style.display = 'none';
            this.historyList.innerHTML = this.history.map((item, index) => `
                <div class="history-item">
                    <span class="history-index">${index + 1}.</span>
                    <span class="history-password">${item.password}</span>
                    <button onclick="window.app.passwordGenerator.copyFromHistory('${item.password}')">复制</button>
                </div>
            `).join('');
        }
    }
}

class ThemeManager {
    constructor() {
        this.darkModeToggle = document.getElementById('darkMode');
        this.currentTheme = 'light';
        this.init();
    }

    init() {
        this.loadTheme();
        this.bindEvents();
    }

    loadTheme() {
        try {
            const settings = localStorage.getItem('appSettings');
            if (settings) {
                const parsed = JSON.parse(settings);
                this.currentTheme = parsed.theme || 'light';
            }
        } catch (e) {
            console.warn('Failed to load theme:', e);
        }
        this.applyTheme();
        this.darkModeToggle.checked = this.currentTheme === 'dark';
    }

    saveTheme() {
        try {
            const settings = localStorage.getItem('appSettings');
            const parsed = settings ? JSON.parse(settings) : {};
            parsed.theme = this.currentTheme;
            localStorage.setItem('appSettings', JSON.stringify(parsed));
        } catch (e) {
            console.warn('Failed to save theme:', e);
        }
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveTheme();
    }

    bindEvents() {
        this.darkModeToggle.addEventListener('change', () => {
            this.toggleTheme();
        });
    }
}

class StatsManager {
    constructor() {
        this.stats = {
            pomodoroCount: 0,
            todoAddCount: 0,
            todoCompleteCount: 0,
            passwordGenerateCount: 0
        };
        this.loadStats();
    }

    loadStats() {
        try {
            const saved = localStorage.getItem('usageStats');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.stats = { ...this.stats, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load stats:', e);
        }
    }

    saveStats() {
        try {
            localStorage.setItem('usageStats', JSON.stringify(this.stats));
        } catch (e) {
            console.warn('Failed to save stats:', e);
        }
    }

    incrementStat(statName) {
        if (this.stats[statName] !== undefined) {
            this.stats[statName]++;
            this.saveStats();
        }
    }

    getStats() {
        return { ...this.stats };
    }

    resetStats() {
        this.stats = {
            pomodoroCount: 0,
            todoAddCount: 0,
            todoCompleteCount: 0,
            passwordGenerateCount: 0
        };
        this.saveStats();
    }
}

class StatsModal {
    constructor(statsManager, toastManager) {
        this.statsManager = statsManager;
        this.toastManager = toastManager;
        this.modal = document.getElementById('statsModal');
        this.closeBtn = document.getElementById('statsModalClose');
        this.statPomodoro = document.getElementById('statPomodoro');
        this.statTodoAdded = document.getElementById('statTodoAdded');
        this.statTodoCompleted = document.getElementById('statTodoCompleted');
        this.statPassword = document.getElementById('statPassword');
        this.init();
    }

    init() {
        this.closeBtn.addEventListener('click', () => this.hide());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    show() {
        const stats = this.statsManager.getStats();
        this.statPomodoro.textContent = stats.pomodoroCount;
        this.statTodoAdded.textContent = stats.todoAddCount;
        this.statTodoCompleted.textContent = stats.todoCompleteCount;
        this.statPassword.textContent = stats.passwordGenerateCount;
        this.modal.classList.add('show');
    }

    hide() {
        this.modal.classList.remove('show');
    }
}

class QuickTodoModal {
    constructor(todoManager, toastManager) {
        this.todoManager = todoManager;
        this.toastManager = toastManager;
        this.modal = document.getElementById('quickTodoModal');
        this.closeBtn = document.getElementById('quickTodoModalClose');
        this.cancelBtn = document.getElementById('quickTodoCancel');
        this.addBtn = document.getElementById('quickTodoAdd');
        this.input = document.getElementById('quickTodoInput');
        this.init();
    }

    init() {
        this.closeBtn.addEventListener('click', () => this.hide());
        this.cancelBtn.addEventListener('click', () => this.hide());
        this.addBtn.addEventListener('click', () => this.addTodo());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTodo();
            }
        });
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    show() {
        this.input.value = '';
        this.input.focus();
        this.modal.classList.add('show');
    }

    hide() {
        this.modal.classList.remove('show');
        this.input.value = '';
    }

    addTodo() {
        const text = this.input.value.trim();
        if (!text) {
            this.toastManager.show('请输入待办事项内容', 'error');
            return;
        }
        this.todoManager.addTodo(text);
        this.hide();
    }
}

class DataExporter {
    constructor(pomodoroTimer, todoManager, passwordGenerator, toastManager) {
        this.pomodoroTimer = pomodoroTimer;
        this.todoManager = todoManager;
        this.passwordGenerator = passwordGenerator;
        this.toastManager = toastManager;
    }

    exportJSON() {
        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            data: {
                pomodoroSettings: this.pomodoroTimer.settings,
                pomodoroCount: localStorage.getItem('pomodoroCount') || '0',
                pomodoroDate: localStorage.getItem('pomodoroDate') || '',
                todoItems: this.todoManager.todos,
                passwordSettings: this.passwordGenerator.settings,
                passwordHistory: this.passwordGenerator.history,
                appSettings: this.loadAppSettings(),
                usageStats: this.loadUsageStats()
            }
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, `productivity-toolbox-backup-${this.getDateString()}.json`);
        this.toastManager.show('JSON 数据导出成功', 'success');
    }

    exportCSV() {
        const rows = [];
        rows.push(['类型', '内容', '状态', '创建时间']);
        this.todoManager.todos.forEach(todo => {
            rows.push([
                '待办事项',
                `"${todo.text.replace(/"/g, '""')}"`,
                todo.completed ? '已完成' : '未完成',
                new Date(todo.createdAt).toLocaleString('zh-CN')
            ]);
        });
        rows.push([]);
        rows.push(['番茄钟统计']);
        rows.push(['完成次数', localStorage.getItem('pomodoroCount') || '0']);
        rows.push(['专注时长设置', this.pomodoroTimer.settings.focusDuration, '分钟']);
        rows.push(['短休息时长', this.pomodoroTimer.settings.shortBreakDuration, '分钟']);
        rows.push(['长休息时长', this.pomodoroTimer.settings.longBreakDuration, '分钟']);
        rows.push([]);
        rows.push(['密码生成历史']);
        this.passwordGenerator.history.forEach((item, index) => {
            rows.push([`密码${index + 1}`, item.password, new Date(item.timestamp).toLocaleString('zh-CN')]);
        });
        const csvContent = rows.map(row => row.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        this.downloadBlob(blob, `productivity-toolbox-backup-${this.getDateString()}.csv`);
        this.toastManager.show('CSV 数据导出成功', 'success');
    }

    importJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.data) {
                    throw new Error('无效的数据格式');
                }
                
                if (data.data.pomodoroSettings) {
                    localStorage.setItem('pomodoroSettings', JSON.stringify(data.data.pomodoroSettings));
                }
                if (data.data.pomodoroCount !== undefined) {
                    localStorage.setItem('pomodoroCount', String(data.data.pomodoroCount));
                }
                if (data.data.pomodoroDate) {
                    localStorage.setItem('pomodoroDate', data.data.pomodoroDate);
                }
                if (data.data.todoItems) {
                    localStorage.setItem('todoItems', JSON.stringify(data.data.todoItems));
                }
                if (data.data.passwordSettings) {
                    localStorage.setItem('passwordSettings', JSON.stringify(data.data.passwordSettings));
                }
                if (data.data.passwordHistory) {
                    localStorage.setItem('passwordHistory', JSON.stringify(data.data.passwordHistory));
                }
                if (data.data.appSettings) {
                    localStorage.setItem('appSettings', JSON.stringify(data.data.appSettings));
                }
                if (data.data.usageStats) {
                    localStorage.setItem('usageStats', JSON.stringify(data.data.usageStats));
                }
                
                this.toastManager.show('数据导入成功，页面将刷新', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } catch (e) {
                this.toastManager.show(`导入失败: ${e.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }

    loadAppSettings() {
        try {
            const saved = localStorage.getItem('appSettings');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    loadUsageStats() {
        try {
            const saved = localStorage.getItem('usageStats');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

class App {
    constructor() {
        this.toastManager = new ToastManager();
        this.statsManager = new StatsManager();
        this.themeManager = new ThemeManager();
        this.tabManager = new TabManager((tab) => this.onTabChange(tab));
        this.pomodoroTimer = new PomodoroTimer(this.toastManager, this.statsManager);
        this.todoManager = new TodoManager(this.toastManager, this.statsManager);
        this.passwordGenerator = new PasswordGenerator(this.toastManager, this.statsManager);
        this.statsModal = new StatsModal(this.statsManager, this.toastManager);
        this.quickTodoModal = new QuickTodoModal(this.todoManager, this.toastManager);
        this.dataExporter = new DataExporter(this.pomodoroTimer, this.todoManager, this.passwordGenerator, this.toastManager);
        this.initSettings();
        this.initQuickActions();
        this.initImport();
        this.loadLastTab();
    }

    initSettings() {
        const settingsToggle = document.getElementById('settingsToggle');
        const settingsPanel = document.getElementById('settingsPanel');
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const showStatsBtn = document.getElementById('showStatsBtn');
        
        settingsToggle.addEventListener('click', () => {
            settingsToggle.classList.toggle('active');
            settingsPanel.classList.toggle('show');
        });
        
        exportJsonBtn.addEventListener('click', () => {
            this.dataExporter.exportJSON();
        });
        
        exportCsvBtn.addEventListener('click', () => {
            this.dataExporter.exportCSV();
        });
        
        showStatsBtn.addEventListener('click', () => {
            this.statsModal.show();
        });
    }

    initQuickActions() {
        const quickStartPomodoro = document.getElementById('quickStartPomodoro');
        const quickAddTodo = document.getElementById('quickAddTodo');
        const quickGeneratePassword = document.getElementById('quickGeneratePassword');
        
        quickStartPomodoro.addEventListener('click', () => {
            this.tabManager.switchTab('pomodoro');
            this.pomodoroTimer.start();
        });
        
        quickAddTodo.addEventListener('click', () => {
            this.tabManager.switchTab('todo');
            this.quickTodoModal.show();
        });
        
        quickGeneratePassword.addEventListener('click', () => {
            this.tabManager.switchTab('password');
            this.passwordGenerator.generate();
        });
    }

    initImport() {
        const importBtn = document.getElementById('importJsonBtn');
        const importFile = document.getElementById('importFile');
        
        importBtn.addEventListener('click', () => {
            importFile.click();
        });
        
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.dataExporter.importJSON(file);
            }
            importFile.value = '';
        });
    }

    loadLastTab() {
        try {
            const settings = localStorage.getItem('appSettings');
            if (settings) {
                const parsed = JSON.parse(settings);
                if (parsed.lastUsedTab) {
                    setTimeout(() => {
                        this.tabManager.switchTab(parsed.lastUsedTab);
                    }, 100);
                }
            }
        } catch (e) {
            console.warn('Failed to load last tab:', e);
        }
    }

    onTabChange(tab) {
        if (tab === 'todo') {
            this.pomodoroTimer.pause();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});