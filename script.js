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
        this.toast.classList.remove('show');
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
    }
}

class PomodoroTimer {
    constructor() {
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
        this.setMode(this.currentMode);
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
            this.playSound();
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
    constructor(toastManager) {
        this.todoInput = document.getElementById('todoInput');
        this.addTodoBtn = document.getElementById('addTodoBtn');
        this.todoList = document.getElementById('todoList');
        this.todoEmpty = document.getElementById('todoEmpty');
        this.todoTotalCount = document.getElementById('todoTotalCount');
        this.todoCompletedCount = document.getElementById('todoCompletedCount');
        this.todoTabBtns = document.querySelectorAll('.todo-tab-btn');
        this.toastManager = toastManager;
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

    addTodo() {
        const text = this.todoInput.value.trim();
        if (!text) {
            this.toastManager.show('请输入待办事项内容', 'error');
            return;
        }
        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };
        this.todos.unshift(todo);
        this.saveTodos();
        this.todoInput.value = '';
        this.render();
        this.toastManager.show('待办事项已添加', 'success');
    }

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            if (todo.completed) {
                todo.completedAt = new Date().toISOString();
            } else {
                delete todo.completedAt;
            }
            this.saveTodos();
            this.render();
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

class DataExporter {
    constructor(pomodoroTimer, todoManager, toastManager) {
        this.pomodoroTimer = pomodoroTimer;
        this.todoManager = todoManager;
        this.toastManager = toastManager;
    }

    exportJSON() {
        const data = {
            exportDate: new Date().toISOString(),
            pomodoro: {
                completedCount: this.pomodoroTimer.completedPomodoros,
                settings: this.pomodoroTimer.settings
            },
            todos: this.todoManager.todos
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, `productivity-data-${this.getDateString()}.json`);
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
        rows.push(['完成次数', this.pomodoroTimer.completedPomodoros]);
        rows.push(['专注时长设置', this.pomodoroTimer.settings.focusDuration, '分钟']);
        rows.push(['短休息时长', this.pomodoroTimer.settings.shortBreakDuration, '分钟']);
        rows.push(['长休息时长', this.pomodoroTimer.settings.longBreakDuration, '分钟']);
        const csvContent = rows.map(row => row.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        this.downloadBlob(blob, `productivity-data-${this.getDateString()}.csv`);
        this.toastManager.show('CSV 数据导出成功', 'success');
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
        this.tabManager = new TabManager((tab) => this.onTabChange(tab));
        this.pomodoroTimer = new PomodoroTimer();
        this.todoManager = new TodoManager(this.toastManager);
        this.dataExporter = new DataExporter(this.pomodoroTimer, this.todoManager, this.toastManager);
        this.initSettings();
    }

    initSettings() {
        const settingsToggle = document.getElementById('settingsToggle');
        const settingsPanel = document.getElementById('settingsPanel');
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        const exportCsvBtn = document.getElementById('exportCsvBtn');
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