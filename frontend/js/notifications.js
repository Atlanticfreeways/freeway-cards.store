// Notification System
class NotificationManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.createContainer();
    this.setupPermissions();
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
    `;
    document.body.appendChild(this.container);
  }

  async setupPermissions() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  show(message, type = 'info', duration = 5000) {
    const notification = this.createNotification(message, type);
    this.container.appendChild(notification);

    // Auto remove
    setTimeout(() => {
      this.remove(notification);
    }, duration);

    return notification;
  }

  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      background: ${this.getTypeColor(type)};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      justify-content: space-between;
      align-items: center;
      animation: slideIn 0.3s ease;
    `;

    notification.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()" style="
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 12px;
      ">×</button>
    `;

    return notification;
  }

  getTypeColor(type) {
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#007bff'
    };
    return colors[type] || colors.info;
  }

  remove(notification) {
    if (notification && notification.parentElement) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }

  success(message) {
    return this.show(message, 'success');
  }

  error(message) {
    return this.show(message, 'error');
  }

  warning(message) {
    return this.show(message, 'warning');
  }

  info(message) {
    return this.show(message, 'info');
  }

  // Push notification (requires permission)
  push(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      return new Notification(title, {
        icon: '/images/icon-192.png',
        badge: '/images/icon-192.png',
        ...options
      });
    }
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize notification manager
const notifications = new NotificationManager();