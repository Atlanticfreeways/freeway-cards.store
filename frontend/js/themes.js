// Theme Management
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'auto';
    this.init();
  }

  init() {
    this.applyTheme();
    this.setupThemeToggle();
    this.watchSystemTheme();
  }

  applyTheme() {
    const root = document.documentElement;
    
    if (this.currentTheme === 'dark') {
      root.classList.add('dark-theme');
    } else if (this.currentTheme === 'light') {
      root.classList.remove('dark-theme');
    } else {
      // Auto mode - follow system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark-theme', prefersDark);
    }
  }

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme();
    this.updateThemeToggle();
  }

  setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
      this.updateThemeToggle();
    }
  }

  toggleTheme() {
    const themes = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    this.setTheme(nextTheme);
  }

  updateThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const icons = {
        light: '☀️',
        dark: '🌙',
        auto: '🔄'
      };
      themeToggle.textContent = icons[this.currentTheme];
      themeToggle.title = `Current theme: ${this.currentTheme}`;
    }
  }

  watchSystemTheme() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (this.currentTheme === 'auto') {
          this.applyTheme();
        }
      });
    }
  }
}

// Initialize theme manager
const themeManager = new ThemeManager();