/**
 * Enhanced UI/UX Components
 * Modals, Loading States, Error Handling, and Interactive Elements
 */

class UIComponents {
    constructor() {
        this.activeModals = [];
        this.loadingStates = new Map();
        this.init();
    }

    init() {
        this.createModalContainer();
        this.createToastContainer();
        this.setupGlobalErrorHandling();
        this.setupLoadingStyles();
    }

    // Modal System
    createModalContainer() {
        if (document.getElementById('modal-container')) return;
        
        const container = document.createElement('div');
        container.id = 'modal-container';
        container.innerHTML = `
            <style>
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .modal-overlay.show {
                    opacity: 1;
                }
                .modal {
                    background: white;
                    border-radius: 12px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                }
                .modal-overlay.show .modal {
                    transform: scale(1);
                }
                .modal-header {
                    padding: 20px 24px 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0;
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                }
                .modal-body {
                    padding: 20px 24px;
                }
                .modal-footer {
                    padding: 0 24px 24px;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }
            </style>
        `;
        document.body.appendChild(container);
    }

    showModal(options) {
        const { title, content, buttons = [], size = 'medium' } = options;
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal modal-${size}">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="ui.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${buttons.length ? `
                    <div class="modal-footer">
                        ${buttons.map(btn => `
                            <button class="btn ${btn.class || 'btn-secondary'}" 
                                    onclick="${btn.onclick || 'ui.closeModal()'}">
                                ${btn.text}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('modal-container').appendChild(overlay);
        this.activeModals.push(overlay);

        // Show with animation
        setTimeout(() => overlay.classList.add('show'), 10);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        return overlay;
    }

    closeModal() {
        if (this.activeModals.length === 0) return;
        
        const modal = this.activeModals.pop();
        modal.classList.remove('show');
        
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }

    // Toast Notifications
    createToastContainer() {
        if (document.getElementById('toast-container')) return;
        
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.innerHTML = `
            <style>
                #toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1100;
                    max-width: 400px;
                }
                .toast {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    margin-bottom: 12px;
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                    border-left: 4px solid #007bff;
                }
                .toast.show {
                    transform: translateX(0);
                }
                .toast.success { border-left-color: #28a745; }
                .toast.error { border-left-color: #dc3545; }
                .toast.warning { border-left-color: #ffc107; }
                .toast.info { border-left-color: #17a2b8; }
                .toast-icon {
                    font-size: 20px;
                }
                .toast-content {
                    flex: 1;
                }
                .toast-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                .toast-message {
                    font-size: 14px;
                    color: #666;
                }
                .toast-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #999;
                }
            </style>
        `;
        document.body.appendChild(container);
    }

    showToast(options) {
        const { type = 'info', title, message, duration = 5000 } = options;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentNode.remove()">&times;</button>
        `;

        document.getElementById('toast-container').appendChild(toast);
        
        // Show with animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }, duration);
        }

        return toast;
    }

    // Loading States
    setupLoadingStyles() {
        if (document.getElementById('loading-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'loading-styles';
        styles.textContent = `
            .loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }
            .loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                margin: -10px 0 0 -10px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .page-loading {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(styles);
    }

    showLoading(element, text = 'Loading...') {
        if (typeof element === 'string') {
            element = document.getElementById(element) || document.querySelector(element);
        }
        
        if (!element) return;
        
        element.classList.add('loading');
        const originalText = element.textContent;
        element.textContent = text;
        
        this.loadingStates.set(element, originalText);
        return element;
    }

    hideLoading(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element) || document.querySelector(element);
        }
        
        if (!element) return;
        
        element.classList.remove('loading');
        const originalText = this.loadingStates.get(element);
        if (originalText) {
            element.textContent = originalText;
            this.loadingStates.delete(element);
        }
    }

    showPageLoading() {
        const existing = document.getElementById('page-loading');
        if (existing) return existing;
        
        const loader = document.createElement('div');
        loader.id = 'page-loading';
        loader.className = 'page-loading';
        loader.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner"></div>
                <div style="margin-top: 16px; font-weight: 500;">Loading...</div>
            </div>
        `;
        
        document.body.appendChild(loader);
        return loader;
    }

    hidePageLoading() {
        const loader = document.getElementById('page-loading');
        if (loader) loader.remove();
    }

    // Error Handling
    setupGlobalErrorHandling() {
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            this.showToast({
                type: 'error',
                title: 'Something went wrong',
                message: 'Please refresh the page or contact support if the issue persists.',
                duration: 8000
            });
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showToast({
                type: 'error',
                title: 'Network Error',
                message: 'Please check your connection and try again.',
                duration: 6000
            });
        });
    }

    // Confirmation Dialogs
    confirm(options) {
        return new Promise((resolve) => {
            const { title, message, confirmText = 'Confirm', cancelText = 'Cancel' } = options;
            
            this.showModal({
                title,
                content: `<p>${message}</p>`,
                buttons: [
                    {
                        text: cancelText,
                        class: 'btn-secondary',
                        onclick: `ui.closeModal(); window.confirmResolve(false);`
                    },
                    {
                        text: confirmText,
                        class: 'btn-primary',
                        onclick: `ui.closeModal(); window.confirmResolve(true);`
                    }
                ]
            });
            
            window.confirmResolve = resolve;
        });
    }

    // Form Validation Enhancement
    enhanceForm(formElement) {
        if (typeof formElement === 'string') {
            formElement = document.getElementById(formElement) || document.querySelector(formElement);
        }
        
        if (!formElement) return;
        
        const inputs = formElement.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            // Real-time validation
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
        
        formElement.addEventListener('submit', (e) => {
            let isValid = true;
            
            inputs.forEach(input => {
                if (!this.validateField(input)) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                this.showToast({
                    type: 'error',
                    title: 'Validation Error',
                    message: 'Please fix the errors in the form before submitting.'
                });
            }
        });
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let message = '';
        
        // Required validation
        if (field.required && !value) {
            isValid = false;
            message = 'This field is required';
        }
        
        // Email validation
        if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            isValid = false;
            message = 'Please enter a valid email address';
        }
        
        // Password validation
        if (field.type === 'password' && value && value.length < 8) {
            isValid = false;
            message = 'Password must be at least 8 characters';
        }
        
        this.showFieldError(field, isValid ? '' : message);
        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        if (message) {
            field.style.borderColor = '#dc3545';
            
            const error = document.createElement('div');
            error.className = 'field-error';
            error.style.cssText = 'color: #dc3545; font-size: 14px; margin-top: 4px;';
            error.textContent = message;
            
            field.parentNode.appendChild(error);
        }
    }

    clearFieldError(field) {
        field.style.borderColor = '';
        const error = field.parentNode.querySelector('.field-error');
        if (error) error.remove();
    }
}

// Initialize UI Components
const ui = new UIComponents();

// Export for global use
window.ui = ui;