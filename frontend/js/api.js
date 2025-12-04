// --- API Interaction ---

import { state } from './state.js';
import { showCustomModal } from './dom.js';

// --- API Base URL (MUST match your Flask backend API prefix) ---
//export const API_BASE_URL = 'http://127.0.0.1:7878/api';
export const API_BASE_URL = window.location.origin + '/api';


/**
 * Fetches data from a given endpoint.
 * @param {string} endpoint - The API endpoint to fetch from (e.g., '/licenses', '/tickets').
 * @param {Object} [queryParams={}] - Optional query parameters.
 * @returns {Promise<Array|Object>} The fetched data.
 */
export async function fetchData(endpoint, queryParams = {}) {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.keys(queryParams).forEach(key => {
        if (queryParams[key]) {
            url.searchParams.append(key, queryParams[key]);
        }
    });

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(`HTTP error! status: ${response.status} - ${errorBody.message || response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        showCustomModal('Error', `Failed to load data. Please check console: ${error.message}`);
        return [];
    }
}

/**
 * Sends data to a given endpoint (POST, PUT, DELETE).
 * @param {string} endpoint - The API endpoint.
 * @param {string} method - HTTP method (POST, PUT).
 * @param {Object} [data=null] - Data to send in the request body.
 * @returns {Promise<Object>} The response data.
 */
export async function sendData(endpoint, method, data = null) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: data ? JSON.stringify(data) : null
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(`HTTP error! status: ${response.status} - ${errorBody.message || response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error sending data to ${endpoint}:`, error);
        showCustomModal('Error', `Failed to perform action. Please check console: ${error.message}`);
        return { success: false, message: `Action failed: ${error.message}` };
    }
}



/**
 * Fetches all necessary data (licenses, tickets) from the backend API.
 * Updates the shared state.
 */
export async function loadInitialData() {
    state.licenses = await fetchData('/licenses');
    state.tickets = await fetchData('/tickets');
    console.log("Data fetched from backend:", { licenses: state.licenses, tickets: state.tickets });
}

export async function fetchSystemAnalytics(systemName) {
    return await fetchData('/system-analytics', { system: systemName });
}

export async function fetchAndUpdateAllData() {
    await loadInitialData();
}
