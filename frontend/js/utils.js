// --- Utility Functions ---

import { showCustomModal, showToast } from './dom.js';

/**
 * Converts a File object to a Base64 Data URL.
 * @param {File} file - The File object to convert.
 * @returns {Promise<string|null>} A promise that resolves with the Base64 Data URL, or null if file is not provided.
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Formats a date string into DD-MM-YYYY.
 * @param {string} dateString - The date string (e.g., 'YYYY-MM-DD' or ISO format).
 * @returns {string} Formatted date (DD-MM-YYYY) or empty string if invalid.
 */
export function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            const parts = dateString.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return '';
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return '';
    }
}
