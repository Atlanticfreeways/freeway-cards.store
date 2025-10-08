// Internationalization Manager
class I18nManager {
  constructor() {
    this.currentLang = localStorage.getItem('language') || 'en';
    this.translations = {};
    this.init();
  }

  async init() {
    await this.loadTranslations();
    this.applyTranslations();
    this.setupLanguageSelector();
  }

  async loadTranslations() {
    const translations = {
      en: {
        // Navigation
        'nav.dashboard': 'Dashboard',
        'nav.wallet': 'Wallet',
        'nav.profile': 'Profile',
        'nav.logout': 'Logout',
        
        // Common
        'common.loading': 'Loading...',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
        'common.error': 'Error',
        'common.success': 'Success',
        
        // Auth
        'auth.login': 'Login',
        'auth.signup': 'Sign Up',
        'auth.email': 'Email Address',
        'auth.password': 'Password',
        'auth.forgot_password': 'Forgot Password?',
        'auth.create_account': 'Create Account',
        
        // Dashboard
        'dashboard.welcome': 'Welcome back',
        'dashboard.wallet_balance': 'Wallet Balance',
        'dashboard.gift_cards': 'Gift Cards',
        'dashboard.total_spent': 'Total Spent',
        'dashboard.add_funds': 'Add Funds',
        'dashboard.buy_gift_card': 'Buy Gift Card',
        
        // Wallet
        'wallet.add_funds': 'Add Funds',
        'wallet.balance': 'Available Balance',
        'wallet.transactions': 'Recent Transactions',
        'wallet.select_amount': 'Select Amount',
        'wallet.payment_method': 'Payment Method',
        
        // Gift Cards
        'gift_cards.purchase': 'Purchase Gift Card',
        'gift_cards.redeem': 'Redeem Gift Card',
        'gift_cards.balance': 'Check Balance',
        'gift_cards.code': 'Gift Card Code',
        'gift_cards.amount': 'Amount',
        'gift_cards.recipient': 'Recipient'
      },
      es: {
        // Navigation
        'nav.dashboard': 'Panel',
        'nav.wallet': 'Billetera',
        'nav.profile': 'Perfil',
        'nav.logout': 'Cerrar Sesión',
        
        // Common
        'common.loading': 'Cargando...',
        'common.save': 'Guardar',
        'common.cancel': 'Cancelar',
        'common.confirm': 'Confirmar',
        'common.error': 'Error',
        'common.success': 'Éxito',
        
        // Auth
        'auth.login': 'Iniciar Sesión',
        'auth.signup': 'Registrarse',
        'auth.email': 'Correo Electrónico',
        'auth.password': 'Contraseña',
        'auth.forgot_password': '¿Olvidaste tu contraseña?',
        'auth.create_account': 'Crear Cuenta',
        
        // Dashboard
        'dashboard.welcome': 'Bienvenido de nuevo',
        'dashboard.wallet_balance': 'Saldo de Billetera',
        'dashboard.gift_cards': 'Tarjetas de Regalo',
        'dashboard.total_spent': 'Total Gastado',
        'dashboard.add_funds': 'Agregar Fondos',
        'dashboard.buy_gift_card': 'Comprar Tarjeta de Regalo',
        
        // Wallet
        'wallet.add_funds': 'Agregar Fondos',
        'wallet.balance': 'Saldo Disponible',
        'wallet.transactions': 'Transacciones Recientes',
        'wallet.select_amount': 'Seleccionar Cantidad',
        'wallet.payment_method': 'Método de Pago',
        
        // Gift Cards
        'gift_cards.purchase': 'Comprar Tarjeta de Regalo',
        'gift_cards.redeem': 'Canjear Tarjeta de Regalo',
        'gift_cards.balance': 'Verificar Saldo',
        'gift_cards.code': 'Código de Tarjeta de Regalo',
        'gift_cards.amount': 'Cantidad',
        'gift_cards.recipient': 'Destinatario'
      }
    };

    this.translations = translations;
  }

  t(key, params = {}) {
    const translation = this.translations[this.currentLang]?.[key] || 
                      this.translations['en']?.[key] || 
                      key;
    
    // Replace parameters
    return Object.keys(params).reduce((str, param) => {
      return str.replace(`{{${param}}}`, params[param]);
    }, translation);
  }

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('language', lang);
    this.applyTranslations();
    document.documentElement.lang = lang;
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });
  }

  setupLanguageSelector() {
    const selector = document.getElementById('languageSelector');
    if (selector) {
      selector.value = this.currentLang;
      selector.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    }
  }

  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat(this.currentLang, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  formatDate(date) {
    return new Intl.DateTimeFormat(this.currentLang).format(new Date(date));
  }
}

// Initialize i18n
const i18n = new I18nManager();