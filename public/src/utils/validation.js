// ==============================================================================
// VALIDATION UTILITIES - Validation et sanitization
// ==============================================================================

/**
 * Validateurs pour différents types de données
 */
export const validators = {
    /**
     * Valide un email
     */
    email(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    /**
     * Valide un mot de passe
     * Minimum 6 caractères (simplifié pour éviter les blocages)
     */
    password(password) {
        if (!password || password.length < 6) {
            return { valid: false, message: 'Le mot de passe doit contenir au moins 6 caractères' };
        }
        return { valid: true, message: 'Mot de passe valide' };
    },

    /**
     * Valide un numéro de téléphone
     */
    phone(phone) {
        // Format: +XXX XXX XXX XXX ou XXX XXX XXX
        const cleaned = phone.replace(/\s+/g, '');
        const regex = /^\+?[0-9]{8,15}$/;
        return regex.test(cleaned);
    },

    /**
     * Valide une adresse
     */
    address(address) {
        return address && address.trim().length >= 10;
    },

    /**
     * Valide un nom d'hôpital
     */
    hospitalName(name) {
        return name && name.trim().length >= 3;
    },

    /**
     * Valide des coordonnées GPS
     */
    coordinates(lat, lng) {
        return (
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        );
    },

    /**
     * Valide un nombre positif
     */
    positiveNumber(value) {
        const num = Number(value);
        return !isNaN(num) && num >= 0;
    },

    /**
     * Valide une URL
     */
    url(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
};

/**
 * Sanitize HTML pour éviter XSS
 */
export function sanitizeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Sanitize input text
 */
export function sanitizeInput(str) {
    return str
        .trim()
        .replace(/[<>]/g, '') // Retire < et >
        .replace(/javascript:/gi, '') // Retire javascript:
        .replace(/on\w+=/gi, ''); // Retire les event handlers
}

/**
 * Valide un formulaire complet
 */
export function validateForm(formData, rules) {
    const errors = {};
    
    for (const [field, value] of Object.entries(formData)) {
        const rule = rules[field];
        if (!rule) continue;

        // Champ requis
        if (rule.required && (!value || value.toString().trim() === '')) {
            errors[field] = rule.message || `Le champ ${field} est requis`;
            continue;
        }

        // Validation personnalisée
        if (rule.validator && value) {
            const result = rule.validator(value);
            // Si le validateur retourne un objet {valid: false}, c'est une erreur
            if (typeof result === 'object' && result.valid === false) {
                errors[field] = result.message || rule.message || `Le champ ${field} est invalide`;
            }
            // Si le validateur retourne false (booléen), c'est une erreur
            else if (result === false) {
                errors[field] = rule.message || `Le champ ${field} est invalide`;
            }
        }

        // Min length
        if (rule.minLength && value && value.length < rule.minLength) {
            errors[field] = `Le champ ${field} doit contenir au moins ${rule.minLength} caractères`;
        }

        // Max length
        if (rule.maxLength && value && value.length > rule.maxLength) {
            errors[field] = `Le champ ${field} ne doit pas dépasser ${rule.maxLength} caractères`;
        }

        // Pattern
        if (rule.pattern && value && !rule.pattern.test(value)) {
            errors[field] = rule.message || `Le champ ${field} a un format invalide`;
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Affiche les erreurs de validation sur un formulaire
 */
export function displayFormErrors(errors) {
    // Nettoie les erreurs précédentes
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.invalid-feedback').forEach(el => el.remove());

    // Affiche les nouvelles erreurs
    for (const [field, message] of Object.entries(errors)) {
        const input = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
        if (input) {
            input.classList.add('is-invalid');
            
            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.textContent = message;
            
            input.parentNode.appendChild(feedback);
        }
    }
}

/**
 * Nettoie les erreurs de validation
 */
export function clearFormErrors() {
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.invalid-feedback').forEach(el => el.remove());
}

export default {
    validators,
    sanitizeHtml,
    sanitizeInput,
    validateForm,
    displayFormErrors,
    clearFormErrors
};
