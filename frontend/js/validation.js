// Form Validation
class FormValidator {
  constructor(form) {
    this.form = form;
    this.rules = {};
    this.init();
  }

  init() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.form.addEventListener('input', (e) => this.handleInput(e));
  }

  addRule(field, rules) {
    this.rules[field] = rules;
    return this;
  }

  handleSubmit(e) {
    e.preventDefault();
    if (this.validateAll()) {
      this.form.classList.add('loading');
      // Form is valid, proceed with submission
      this.onSubmit();
    }
  }

  handleInput(e) {
    if (e.target.name && this.rules[e.target.name]) {
      this.validateField(e.target.name, e.target.value);
    }
  }

  validateField(name, value) {
    const rules = this.rules[name];
    const field = this.form.querySelector(`[name="${name}"]`);
    const errorEl = field.parentNode.querySelector('.error-message');

    for (let rule of rules) {
      const result = rule.test(value);
      if (!result.valid) {
        this.showError(field, errorEl, result.message);
        return false;
      }
    }

    this.clearError(field, errorEl);
    return true;
  }

  validateAll() {
    let isValid = true;
    for (let fieldName in this.rules) {
      const field = this.form.querySelector(`[name="${fieldName}"]`);
      if (field && !this.validateField(fieldName, field.value)) {
        isValid = false;
      }
    }
    return isValid;
  }

  showError(field, errorEl, message) {
    field.classList.add('error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
  }

  clearError(field, errorEl) {
    field.classList.remove('error');
    if (errorEl) {
      errorEl.classList.remove('show');
    }
  }

  onSubmit() {
    // Override in implementation
  }
}

// Validation Rules
const ValidationRules = {
  required: (message = 'This field is required') => ({
    test: (value) => ({
      valid: value && value.trim().length > 0,
      message
    })
  }),

  email: (message = 'Please enter a valid email') => ({
    test: (value) => ({
      valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message
    })
  }),

  minLength: (min, message) => ({
    test: (value) => ({
      valid: value && value.length >= min,
      message: message || `Must be at least ${min} characters`
    })
  }),

  password: (message = 'Password must be at least 8 characters with uppercase, lowercase, and number') => ({
    test: (value) => ({
      valid: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(value),
      message
    })
  }),

  match: (fieldName, message) => ({
    test: (value) => {
      const matchField = document.querySelector(`[name="${fieldName}"]`);
      return {
        valid: matchField && value === matchField.value,
        message: message || 'Passwords do not match'
      };
    }
  })
};

// Password Strength Indicator
function updatePasswordStrength(password, strengthEl) {
  const strength = calculatePasswordStrength(password);
  strengthEl.className = `password-strength ${strength.class}`;
  strengthEl.textContent = strength.text;
}

function calculatePasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z\d]/.test(password)) score++;

  const levels = [
    { class: 'weak', text: 'Weak' },
    { class: 'weak', text: 'Weak' },
    { class: 'fair', text: 'Fair' },
    { class: 'good', text: 'Good' },
    { class: 'strong', text: 'Strong' }
  ];

  return levels[score] || levels[0];
}