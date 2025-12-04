// --- Main Entry Point ---

console.log("main.js loaded");
import { initEvents } from './events.js';
import { loadInitialData } from './api.js';
import { handleDependentFields, showSection, updateDashboard } from './dom.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize date inputs to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayFormatted = `${year}-${month}-${day}`;

    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) {
            input.value = todayFormatted;
        }
    });

    // Initialize UI state
    handleDependentFields();

    // Initialize Event Listeners
    initEvents();

    // Check Login Status and Load Data
    if (localStorage.getItem('isLoggedIn') === 'true') {
        console.log("Found isLoggedIn in localStorage.");
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        await loadInitialData();

        const lastSection = localStorage.getItem('lastActiveSection') || 'dashboard-section';
        const lastSystemAnalytics = localStorage.getItem('lastActiveSystemAnalytics');

        if (lastSection === 'system-analytics-section' && lastSystemAnalytics) {
            console.log(`Navigating to last active section: ${lastSection} for system: ${lastSystemAnalytics}`);
            showSection(lastSection, lastSystemAnalytics);
        } else {
            console.log(`Navigating to last active section: ${lastSection}`);
            showSection(lastSection);
        }
    } else {
        console.log("No isLoggedIn found in localStorage. Showing login page.");
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});