// ==============================================================================
// NOTIFICATION SYSTEM - Système de notifications moderne
// ==============================================================================

class NotificationManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Créer le conteneur de notifications s'il n'existe pas
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    /**
     * Affiche une notification
     * @param {string} message - Message à afficher
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Durée en ms (0 = permanent)
     */
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} notification-enter`;
        
        const icon = this.getIcon(type);
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="bi ${icon} notification-icon"></i>
                <div class="notification-message">${message}</div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            ${duration > 0 ? `<div class="notification-progress"></div>` : ''}
        `;

        this.container.appendChild(notification);

        // Animation d'entrée
        setTimeout(() => notification.classList.add('notification-show'), 10);

        // Auto-suppression
        if (duration > 0) {
            const progressBar = notification.querySelector('.notification-progress');
            if (progressBar) {
                progressBar.style.animation = `progress ${duration}ms linear`;
            }

            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }

        return notification;
    }

    remove(notification) {
        notification.classList.remove('notification-show');
        notification.classList.add('notification-exit');
        setTimeout(() => notification.remove(), 300);
    }

    getIcon(type) {
        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-exclamation-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };
        return icons[type] || icons.info;
    }

    // Raccourcis
    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 7000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }

    /**
     * Notification de chargement
     */
    loading(message = 'Chargement...') {
        const notification = this.show(
            `<span class="spinner-border spinner-border-sm me-2"></span>${message}`,
            'info',
            0
        );
        return {
            dismiss: () => this.remove(notification),
            update: (newMessage, type = 'success') => {
                this.remove(notification);
                return this.show(newMessage, type);
            }
        };
    }

    /**
     * Notification de confirmation
     */
    confirm(message, onConfirm, onCancel) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-warning notification-enter notification-confirm';
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="bi bi-question-circle-fill notification-icon"></i>
                <div class="notification-message">${message}</div>
            </div>
            <div class="notification-actions">
                <button class="btn btn-sm btn-success" data-action="confirm">
                    <i class="bi bi-check-lg"></i> Confirmer
                </button>
                <button class="btn btn-sm btn-secondary" data-action="cancel">
                    <i class="bi bi-x-lg"></i> Annuler
                </button>
            </div>
        `;

        this.container.appendChild(notification);
        setTimeout(() => notification.classList.add('notification-show'), 10);

        // Gestion des boutons
        notification.querySelector('[data-action="confirm"]').onclick = () => {
            this.remove(notification);
            if (onConfirm) onConfirm();
        };

        notification.querySelector('[data-action="cancel"]').onclick = () => {
            this.remove(notification);
            if (onCancel) onCancel();
        };

        return notification;
    }

    /**
     * Nettoie toutes les notifications
     */
    clearAll() {
        const notifications = this.container.querySelectorAll('.notification');
        notifications.forEach(n => this.remove(n));
    }
}

// Export singleton
export const notify = new NotificationManager();
export default notify;
