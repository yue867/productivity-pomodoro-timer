/**
 * 专注番茄钟 - JavaScript 逻辑
 */

class PomodoroTimer {
    constructor() {
        // DOM Elements
        this.timerDisplay = document.getElementById('timerDisplay');
        this.timerStatus = document.getElementById('timerStatus');
        this.progressRing = document.getElementById('progressRing');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.taskInput = document.getElementById('taskName');
        this.tomatoDisplay = document.getElementById('tomatoDisplay');
        this.tomatoCount = document.getElementById('tomatoCount');
        this.settingsToggle = document.getElementById('settingsToggle');
        this.settingsPanel = document.getElementById('settingsPanel');

        // Settings inputs
        this.focusDurationInput = document.getElementById('focusDuration');
        this.shortBreakDurationInput = document.getElementById('shortBreakDuration');
        this.longBreakDurationInput = document.getElementById('longBreakDuration');
        this.tomatoesUntilLongBreakInput = document.getElementById('tomatoesUntilLongBreak');
        this.soundEnabledInput = document.getElementById('soundEnabled');

        // Timer state
        this.timerId = null;
        this.isRunning = false;
        this.isPaused = false;
        this.currentTime = 25 * 60;
        this.totalTime = 25 * 60;

        // Pomodoro state
        this.completedPomodoros = 0;
        this.currentMode = 'focus'; // 'focus', 'shortBreak', 'longBreak'

        // Settings
        this.settings = {
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            tomatoesUntilLongBreak: 4,
            soundEnabled: true
        };

        // Progress ring circumference
        this.circumference = 2 * Math.PI * 90;
        this.progressRing.style.strokeDasharray = this.circumference;
        this.progressRing.style.strokeDashoffset = this.circumference;

        // Initialize
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
        this.updateDisplay();
        this.updateTomatoDisplay();
        this.settingsToggle.classList.remove('active');
        this.settingsPanel.classList.remove('show');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());

        this.settingsToggle.addEventListener('click', () => this.toggleSettings());

        // Settings change events
        this.focusDurationInput.addEventListener('change', () => this.updateSettings());
        this.shortBreakDurationInput.addEventListener('change', () => this.updateSettings());
        this.longBreakDurationInput.addEventListener('change', () => this.updateSettings());
        this.tomatoesUntilLongBreakInput.addEventListener('change', () => this.updateSettings());
        this.soundEnabledInput.addEventListener('change', () => this.updateSettings());

        // Handle page visibility to prevent background running
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

        // Apply saved settings to inputs
        this.focusDurationInput.value = this.settings.focusDuration;
        this.shortBreakDurationInput.value = this.settings.shortBreakDuration;
        this.longBreakDurationInput.value = this.settings.longBreakDuration;
        this.tomatoesUntilLongBreakInput.value = this.settings.tomatoesUntilLongBreak;
        this.soundEnabledInput.checked = this.settings.soundEnabled;

        // Load today's completed pomodoros
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

        // Update input values to reflect clamped values
        this.focusDurationInput.value = this.settings.focusDuration;
        this.shortBreakDurationInput.value = this.settings.shortBreakDuration;
        this.longBreakDurationInput.value = this.settings.longBreakDuration;
        this.tomatoesUntilLongBreakInput.value = this.settings.tomatoesUntilLongBreak;

        this.saveSettings();

        // If not running, update the timer display with new duration
        if (!this.isRunning && !this.isPaused) {
            this.setMode(this.currentMode);
        }
    }

    toggleSettings() {
        this.settingsToggle.classList.toggle('active');
        this.settingsPanel.classList.toggle('show');
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
        if (this.currentTime > 0) {
            this.currentTime--;
            this.updateDisplay();
            this.updateProgress();
        } else {
            this.completePhase();
        }
    }

    completePhase() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }

        this.playNotification();

        if (this.currentMode === 'focus') {
            this.completedPomodoros++;
            this.saveProgress();
            this.updateTomatoDisplay();

            // Determine next break type
            if (this.completedPomodoros % this.settings.tomatoesUntilLongBreak === 0) {
                this.setMode('longBreak');
            } else {
                this.setMode('shortBreak');
            }
        } else {
            this.setMode('focus');
        }

        // Auto-start next phase
        this.start();
    }

    setMode(mode) {
        this.currentMode = mode;

        let duration;
        let statusText;
        let ringClass = '';

        switch (mode) {
            case 'focus':
                duration = this.settings.focusDuration;
                statusText = this.taskInput.value ? this.taskInput.value : '专注中';
                ringClass = '';
                break;
            case 'shortBreak':
                duration = this.settings.shortBreakDuration;
                statusText = '短休息';
                ringClass = 'break';
                break;
            case 'longBreak':
                duration = this.settings.longBreakDuration;
                statusText = '长休息';
                ringClass = 'long-break';
                break;
        }

        // Update progress ring color
        this.progressRing.classList.remove('break', 'long-break');
        if (ringClass) {
            this.progressRing.classList.add(ringClass);
        }

        this.totalTime = duration * 60;
        this.currentTime = this.totalTime;

        this.timerStatus.textContent = statusText;
        this.updateDisplay();
        this.updateProgress();
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateProgress() {
        const progress = 1 - (this.currentTime / this.totalTime);
        const offset = this.circumference * (1 - progress);
        this.progressRing.style.strokeDashoffset = offset;
    }

    updateTomatoDisplay() {
        const maxDisplay = 5;
        const displayCount = Math.min(this.completedPomodoros, maxDisplay);

        let html = '';
        for (let i = 0; i < maxDisplay; i++) {
            const isActive = i < displayCount;
            html += `<span class="tomato${isActive ? ' active' : ''}">🍅</span>`;
        }

        this.tomatoDisplay.innerHTML = html;
        this.tomatoCount.textContent = this.completedPomodoros;
    }

    playNotification() {
        if (this.settings.soundEnabled) {
            // Generate a simple beep sound
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
                console.warn('Failed to play notification sound:', e);
            }
        }

        // Visual notification - flash the page title
        const originalTitle = document.title;
        const modeNames = {
            'focus': '专注时间结束！',
            'shortBreak': '短休息结束！',
            'longBreak': '长休息结束！'
        };

        document.title = modeNames[this.currentMode] || '时间到！';

        setTimeout(() => {
            document.title = originalTitle;
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});