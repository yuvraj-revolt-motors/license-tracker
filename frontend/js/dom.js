// --- DOM Manipulation ---

import { state, licenseCapacity, resultsPerPageOptions } from './state.js';
import { formatDate } from './utils.js';
import { fetchSystemAnalytics } from './api.js';
import { fetchAndUpdateAllData } from './api.js';
import { applyReportsFilters, searchLicenses } from './events.js';

// We will import event handlers dynamically or circularly. 
// For now, we'll assume they are available or imported.
// To avoid circular dependency issues at top-level, we might need to attach them inside functions
// or use a setup function.
// However, for simple functions, it's fine.

/**
 * Shows the custom modal with a message and sets up confirm/cancel actions.
 * @param {string} title - The title of the modal.
 * @param {string} message - The message to display.
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled.
 */
export function showCustomModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm-button');
        const cancelBtn = document.getElementById('modal-cancel-button');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.classList.remove('hidden');

        const handleConfirm = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

let toastTimeout;
/**
 * Shows a toast notification.
 * @param {string} message - The message to display in the toast.
 * @param {string} [type='success'] - The type of toast ('success', 'error', 'info').
 */
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = toast.querySelector('i');

    clearTimeout(toastTimeout);
    toast.classList.remove('show');

    toastMessage.textContent = message;

    toast.className = 'fixed bottom-4 right-4 p-4 rounded-xl shadow-lg text-white max-w-sm z-[70] flex items-center space-x-3';
    toastIcon.className = 'lucide w-6 h-6';

    switch (type) {
        case 'success':
            toast.style.backgroundColor = '#22C55E';
            toastIcon.classList.add('lucide-check-circle');
            break;
        case 'error':
            toast.style.backgroundColor = '#EF4444';
            toastIcon.classList.add('lucide-x-circle');
            break;
        case 'info':
            toast.style.backgroundColor = '#3B82F6';
            toastIcon.classList.add('lucide-info');
            break;
        default:
            toast.style.backgroundColor = '#22C55E';
            toastIcon.classList.add('lucide-check-circle');
    }

    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Renders pagination controls for a given table.
 * @param {HTMLElement} container - The HTML element to render controls into.
 * @param {number} totalItems - Total number of items to paginate.
 * @param {number} currentPage - The current page number (1-indexed).
 * @param {number} resultsPerPage - Number of items per page.
 * @param {function(number, number): void} onPageChange - Callback for page or results per page change.
 * @param {string} type - 'dashboard-recent', 'reports', or 'tickets' to manage specific state.
 */
export function renderPaginationControls(container, totalItems, currentPage, resultsPerPage, onPageChange, type) {
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / resultsPerPage);

    if (totalItems === 0) {
        return;
    }

    const selectHtml = `
        <select class="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm" data-pagination-type="${type}-results-per-page">
            ${resultsPerPageOptions.map(option => `<option value="${option}" ${option === resultsPerPage ? 'selected' : ''}>${option} per page</option>`).join('')}
        </select>
    `;
    container.insertAdjacentHTML('beforeend', selectHtml);

    const navHtml = `
        <button class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''} data-pagination-type="${type}-prev">Previous</button>
        <span class="text-gray-700 text-sm">Page ${currentPage} of ${totalPages}</span>
        <button class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''} data-pagination-type="${type}-next">Next</button>
    `;
    container.insertAdjacentHTML('beforeend', navHtml);

    container.querySelector(`[data-pagination-type="${type}-results-per-page"]`).addEventListener('change', (e) => {
        const newResultsPerPage = parseInt(e.target.value);
        const newTotalPages = Math.ceil(totalItems / newResultsPerPage);
        const newPage = Math.min(currentPage, newTotalPages || 1);
        onPageChange(newPage, newResultsPerPage);
    });

    container.querySelector(`[data-pagination-type="${type}-prev"]`).addEventListener('click', () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1, resultsPerPage);
        }
    });

    container.querySelector(`[data-pagination-type="${type}-next"]`).addEventListener('click', () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1, resultsPerPage);
        }
    });
}

/**
 * Updates the dashboard with license capacity data and chart.
 */
export function updateDashboard() {
    const systemCapacityCardsContainer = document.getElementById('system-capacity-cards');
    const licensePieChartCanvas = document.getElementById('licensePieChart');

    Object.keys(licenseCapacity).forEach(systemKey => {
        licenseCapacity[systemKey].occupied = state.licenses.filter(
            l => l.system === systemKey && l.status === 'Active'
        ).length;
    });

    systemCapacityCardsContainer.innerHTML = '';
    Object.keys(licenseCapacity).forEach(systemKey => {
        const system = licenseCapacity[systemKey];
        const available = system.total - system.occupied;
        const cardHtml = `
            <div class="p-6 rounded-xl shadow-lg flex flex-col justify-between text-white cursor-pointer hover:shadow-xl transform hover:scale-105 transition duration-200 ease-in-out" 
                 style="background-color: ${system.color};" data-system-name="${systemKey}">
                <h3 class="text-xl font-bold mb-4">${systemKey} Licenses</h3>
                <div class="grid grid-cols-3 gap-2 text-center mt-auto">
                    <div>
                        <p class="text-sm opacity-90">Total</p>
                        <p class="text-2xl font-bold mt-1">${system.total}</p>
                    </div>
                    <div>
                        <p class="text-sm opacity-90">Occupied</p>
                        <p class="text-2xl font-bold mt-1">${system.occupied}</p>
                    </div>
                    <div>
                        <p class="text-sm opacity-90">Available</p>
                        <p class="text-2xl font-bold mt-1">${available}</p>
                    </div>
                </div>
            </div>
        `;
        systemCapacityCardsContainer.insertAdjacentHTML('beforeend', cardHtml);
    });

    // Update Pie Chart
    const chartLabels = Object.keys(licenseCapacity);
    const chartData = chartLabels.map(systemKey => licenseCapacity[systemKey].occupied);
    const chartColors = chartLabels.map(systemKey => licenseCapacity[systemKey].color);

    // Note: licensePieChart needs to be stored in state or module scope if we want to update it.
    // In original code it was a global variable.
    // We'll attach it to state or a module-level variable.
    // For now, let's assume we can re-create it or check if it exists on the canvas instance?
    // Chart.js attaches to the canvas. We can store the instance in state.

    if (state.licensePieChart) {
        state.licensePieChart.data.labels = chartLabels;
        state.licensePieChart.data.datasets[0].data = chartData;
        state.licensePieChart.data.datasets[0].backgroundColor = chartColors;
        state.licensePieChart.update();
    } else {
        const ctx = licensePieChartCanvas.getContext('2d');
        state.licensePieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: chartColors,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 14,
                                family: 'Inter'
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderRecentLicenses(state.dashboardRecentCurrentPage, state.dashboardRecentResultsPerPage);
}

/**
 * Renders the table of recently added licenses on the dashboard with pagination.
 * @param {number} page - The current page number.
 * @param {number} limit - The number of items per page.
 */
export function renderRecentLicenses(page, limit) {
    const recentLicensesTableBody = document.getElementById('recent-licenses-table-body');
    const noRecentLicensesMsg = document.getElementById('no-recent-licenses');
    const dashboardRecentPaginationContainer = document.getElementById('dashboard-recent-pagination');

    recentLicensesTableBody.innerHTML = '';
    const allRecent = [...state.licenses]
        .sort((a, b) => new Date(b.assignment_date) - new Date(a.assignment_date));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRecent = allRecent.slice(startIndex, endIndex);

    if (paginatedRecent.length === 0) {
        noRecentLicensesMsg.classList.remove('hidden');
    } else {
        noRecentLicensesMsg.classList.add('hidden');
        paginatedRecent.forEach(license => {
            const row = `
                <tr class="hover:bg-gray-100">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${license.ticket_id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${license.system}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${license.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDate(license.assignment_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${license.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${license.status}
                        </span>
                    </td>
                </tr>
            `;
            recentLicensesTableBody.insertAdjacentHTML('beforeend', row);
        });
    }
    renderPaginationControls(dashboardRecentPaginationContainer, allRecent.length, page, limit, (newPage, newLimit) => {
        state.dashboardRecentCurrentPage = newPage;
        state.dashboardRecentResultsPerPage = newLimit;
        renderRecentLicenses(newPage, newLimit);
    }, 'dashboard-recent');
}

/**
 * Handles the display of dependent fields in the Add License form
 * based on the selected system. Also clears values and manages 'required' attributes.
 */
export function handleDependentFields() {
    const systemSelect = document.getElementById('system');
    const dependentFieldsPlaceholder = document.getElementById('dependent-fields-placeholder');
    const dmsFields = document.getElementById('dms-fields');
    const lsqFields = document.getElementById('lsq-fields');
    const crmFields = document.getElementById('crm-fields');
    const zohoFields = document.getElementById('zoho-fields');

    const selectedSystem = systemSelect.value;
    const fieldsToShow = {
        'DMS': dmsFields,
        'LSQ': lsqFields,
        'CRM': crmFields,
        'ZOHO': zohoFields
    };

    Object.values(fieldsToShow).forEach(el => {
        el.classList.add('hidden');
        el.querySelectorAll('input, select, textarea').forEach(input => {
            input.value = '';
            input.removeAttribute('required');
        });
    });
    dependentFieldsPlaceholder.classList.remove('hidden');

    if (selectedSystem && fieldsToShow[selectedSystem]) {
        fieldsToShow[selectedSystem].classList.remove('hidden');
        if (selectedSystem === 'LSQ') {
            document.getElementById('lsqLicenseType').setAttribute('required', 'true');
            document.getElementById('lsqTeam').setAttribute('required', 'true');
        }
        dependentFieldsPlaceholder.classList.add('hidden');
    } else {
        dependentFieldsPlaceholder.classList.remove('hidden');
    }
}

/**
 * Switches the active content section in the main area.
 * @param {string} sectionId - The ID of the section to show (e.g., 'dashboard-section').
 * @param {string} [systemName=null] - Optional system name if navigating to analytics.
 */
export async function showSection(sectionId, systemName = null) {
    const mainContentSections = document.querySelectorAll('.main-content-section');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const searchQueryInput = document.getElementById('search-query');
    const removeFilterSystemSelect = document.getElementById('removeFilterSystem');
    const removeFilterStatusSelect = document.getElementById('removeFilterStatus');
    const removeFilterStartDateInput = document.getElementById('removeFilterStartDate');
    const removeFilterEndDateInput = document.getElementById('removeFilterEndDate');
    const removeLicenseDetailsCard = document.getElementById('remove-license-details-card');

    mainContentSections.forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    localStorage.setItem('lastActiveSection', sectionId);
    if (systemName) {
        localStorage.setItem('lastActiveSystemAnalytics', systemName);
    } else {
        localStorage.removeItem('lastActiveSystemAnalytics');
    }

    sidebarLinks.forEach(link => {
        link.classList.remove('bg-gray-700', 'text-indigo-300');
        link.classList.add('text-white');
    });
    const activeLink = document.querySelector(`[data-section="${sectionId.replace('-section', '')}"]`);
    if (activeLink) {
        activeLink.classList.add('bg-gray-700', 'text-indigo-300');
        activeLink.classList.remove('text-white');
    }

    if (sectionId === 'dashboard-section') {
        await fetchAndUpdateAllData();
        updateDashboard();
    } else if (sectionId === 'system-analytics-section') { // Generic analytics section
        state.currentSystemViewing = systemName || localStorage.getItem('lastActiveSystemAnalytics') || 'LSQ'; // Default if direct link
        await fetchSystemAnalytics(state.currentSystemViewing);
    } else if (sectionId === 'reports-section') {
        await applyReportsFilters();
    } else if (sectionId === 'tickets-section') {
        await loadInitialData();
        renderTickets(state.ticketsCurrentPage, state.ticketsResultsPerPage);
    } else if (sectionId === 'remove-license-section') {
        searchQueryInput.value = '';
        removeFilterSystemSelect.value = '';
        removeFilterStatusSelect.value = '';
        removeFilterStartDateInput.value = '';
        removeFilterEndDateInput.value = '';
        removeLicenseDetailsCard.classList.add('hidden');
        await searchLicenses(true);
    }
}

/**
 * Renders the analytics charts for the current system.
 * @param {string} systemName - The system name (e.g., 'DMS', 'LSQ').
 */
export function renderSystemAnalyticsCharts(systemName) {
    const systemTypePieChartCanvas = document.getElementById('systemTypePieChart');
    const systemAssignmentLineChartCanvas = document.getElementById('systemAssignmentLineChart');
    const noSystemTypeDataMsg = document.getElementById('no-system-type-data');
    const noSystemTrendDataMsg = document.getElementById('no-system-trend-data');

    // Destroy existing charts if they exist
    if (state.systemTypePieChart) state.systemTypePieChart.destroy();
    if (state.systemAssignmentLineChart) state.systemAssignmentLineChart.destroy();

    // Pie Chart for Type Distribution
    const typeLabels = state.systemAnalyticsData.distribution.map(item => item.category || 'Unspecified/N/A');
    const typeCounts = state.systemAnalyticsData.distribution.map(item => item.count);
    const typeColors = typeLabels.map((_, i) => `hsl(${i * 100}, 70%, 50%)`);

    if (typeLabels.length === 0 || typeCounts.every(c => c === 0)) {
        noSystemTypeDataMsg.classList.remove('hidden');
        systemTypePieChartCanvas.classList.add('hidden');
    } else {
        noSystemTypeDataMsg.classList.add('hidden');
        systemTypePieChartCanvas.classList.remove('hidden');
        const ctxType = systemTypePieChartCanvas.getContext('2d');
        state.systemTypePieChart = new Chart(ctxType, {
            type: 'pie',
            data: {
                labels: typeLabels,
                datasets: [{
                    data: typeCounts,
                    backgroundColor: typeColors,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Line Chart for Assignment Trend
    const trendLabels = state.systemAnalyticsData.assignment_trends.map(item => item.month);
    const trendCounts = state.systemAnalyticsData.assignment_trends.map(item => item.count);

    if (trendLabels.length === 0 || trendCounts.every(c => c === 0)) {
        noSystemTrendDataMsg.classList.remove('hidden');
        systemAssignmentLineChartCanvas.classList.add('hidden');
    } else {
        noSystemTrendDataMsg.classList.add('hidden');
        systemAssignmentLineChartCanvas.classList.remove('hidden');
        const ctxTrend = systemAssignmentLineChartCanvas.getContext('2d');
        state.systemAssignmentLineChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: `Active ${systemName} Licenses Assigned`,
                    data: trendCounts,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#4F46E5',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: false }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Month-Year'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Licenses'
                        },
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            callback: function (value) { if (value % 1 === 0) return value; }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Renders the table for all licenses of the current system.
 * @param {number} page - The current page number.
 * @param {number} limit - The number of items per page.
 * @param {string} systemName - The system name (e.g., 'DMS', 'LSQ').
 */
export function renderSystemLicensesTable(page, limit, systemName) {
    const systemTableHeader = document.getElementById('system-table-header');
    const systemTableBody = document.getElementById('system-table-body');
    const noSystemLicensesDataMsg = document.getElementById('no-system-licenses-data');
    const systemPaginationContainer = document.getElementById('system-pagination');

    systemTableHeader.innerHTML = '';
    systemTableBody.innerHTML = '';

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSystemLicenses = state.currentSystemLicenses.slice(startIndex, endIndex);

    if (paginatedSystemLicenses.length === 0) {
        noSystemLicensesDataMsg.classList.remove('hidden');
        systemPaginationContainer.innerHTML = '';
        return;
    } else {
        noSystemLicensesDataMsg.classList.add('hidden');
    }

    // Define all possible columns for the combined report (same as reports for consistency)
    const allColumns = [
        { key: 'ticket_id', label: 'Ticket ID' },
        { key: 'system', label: 'System' },
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email Address' },
        { key: 'mobile', label: 'Mobile Number' },
        { key: 'request_type', label: 'Request Type' },
        { key: 'requested_date', label: 'Requested Date' },
        { key: 'requestor_name', label: 'Requestor Name' },
        { key: 'assignment_date', label: 'Assignment Date' },
        { key: 'expiry_date', label: 'Expiry Date' },
        { key: 'created_at', label: 'Created At' },
        { key: 'updated_at', label: 'Last Modified At' },
        { key: 'attachment_data', label: 'Attachment' },
        { key: 'details_json.dms.dealerName', label: 'DMS Dealer Name' },
        { key: 'details_json.dms.dealerCode', label: 'DMS Code' },
        { key: 'details_json.dms.locationCode', label: 'DMS Loc. Code' },
        { key: 'details_json.dms.city', label: 'DMS City' },
        { key: 'details_json.dms.hubName', label: 'DMS Hub Name' },
        { key: 'details_json.lsq.licenseType', label: 'LSQ License Type' },
        { key: 'details_json.lsq.team', label: 'LSQ Team' },
        { key: 'details_json.lsq.salesExecutiveName', label: 'LSQ Sales Exec.' },
        { key: 'details_json.lsq.mobileNumber', label: 'LSQ Mobile' },
        { key: 'details_json.lsq.hubName', label: 'LSQ Hub Name' },
        { key: 'details_json.lsq.city', label: 'LSQ City' },
        { key: 'details_json.crm.dealerName', label: 'CRM Dealer Name' },
        { key: 'details_json.crm.hubName', label: 'CRM Hub Name' },
        { key: 'details_json.crm.city', label: 'CRM City' },
        { key: 'details_json.zoho.firstName', label: 'ZOHO First Name' },
        { key: 'details_json.zoho.lastName', label: 'ZOHO Last Name' },
        { key: 'details_json.zoho.emailAddress', label: 'ZOHO Email' },
        { key: 'details_json.zoho.role', label: 'ZOHO Role' },
        { key: 'details_json.zoho.accountCreatedTime', label: 'ZOHO Creation Date' },
        { key: 'removal_details_json.ticketId', label: 'Removal Ticket ID' },
        { key: 'removal_details_json.date', label: 'Removal Date' },
        { key: 'removal_details_json.reason', label: 'Removal Reason' },
        { key: 'removal_details_json.remover', label: 'Remover Name' }
    ];

    // Filter columns to only show relevant ones for the current system, plus common ones
    const systemSpecificColumns = allColumns.filter(col => {
        // Always include common columns
        if (!col.key.includes('details_json.') && !col.key.includes('removal_details_json.')) return true;
        // Include system-specific details and removal details
        if (col.key.startsWith(`details_json.${systemName.toLowerCase()}.`) || col.key.startsWith('removal_details_json.')) return true;
        return false;
    });

    systemSpecificColumns.forEach(col => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = col.label;
        systemTableHeader.appendChild(th);
    });

    paginatedSystemLicenses.forEach(license => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-100';

        systemSpecificColumns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';

            let value = '';
            if (col.key.startsWith('details_json.')) {
                const parts = col.key.split('.');
                let current = license.details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            } else if (col.key.startsWith('removal_details_json.')) {
                const parts = col.key.split('.');
                let current = license.removal_details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            }
            else if (license[col.key]) {
                value = license[col.key];
            }

            if (['assignment_date', 'expiry_date', 'requested_date', 'removal_details_json.date'].includes(col.key)) {
                value = formatDate(value);
            } else if (['created_at', 'updated_at', 'details_json.zoho.accountCreatedTime'].includes(col.key)) {
                if (value) {
                    try {
                        value = new Date(value).toLocaleString();
                    } catch (e) {
                        value = String(value);
                    }
                }
            }

            if (col.key === 'status') {
                td.innerHTML = `
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${value === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${value}
                    </span>
                `;
            } else if (col.key === 'attachment_data') {
                td.innerHTML = license.attachment_data ? `<button class="text-blue-600 hover:underline view-attachment-btn-system" data-license-id="${license.id}" data-license-name="${license.name}">View</button>` : 'N/A';
            } else {
                td.textContent = value || 'N/A'; // Default to N/A for empty cells
            }
            row.appendChild(td);
        });
        systemTableBody.appendChild(row);
    });

    systemTableBody.querySelectorAll('.view-attachment-btn-system').forEach(button => {
        button.addEventListener('click', (event) => {
            const licenseId = event.target.dataset.licenseId;
            const license = state.currentSystemLicenses.find(l => l.id === licenseId);
            if (license && license.attachment_data) {
                const fileName = `${license.name}_${license.system}_attachment`;
                viewAttachment(license.attachment_data, fileName);
            } else {
                showCustomModal('No Attachment', 'No attachment data found for this license.');
            }
        });
    });

    renderPaginationControls(systemPaginationContainer, state.currentSystemLicenses.length, page, limit, (newPage, newLimit) => {
        state.systemAnalyticsCurrentPage = newPage;
        state.systemAnalyticsResultsPerPage = newLimit;
        renderSystemLicensesTable(newPage, newLimit, systemName);
    }, 'system-analytics');
}

/**
 * Renders the comprehensive reports table with pagination based on `filteredLicenses`.
 */
export function renderReportsTable(page, limit) {
    const reportsTableHeader = document.getElementById('reports-table-header');
    const reportsTableBody = document.getElementById('reports-table-body');
    const noReportsDataMsg = document.getElementById('no-reports-data');
    const reportsPaginationContainer = document.getElementById('reports-pagination');

    reportsTableHeader.innerHTML = '';
    reportsTableBody.innerHTML = '';

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLicenses = state.filteredLicenses.slice(startIndex, endIndex);

    if (paginatedLicenses.length === 0) {
        noReportsDataMsg.classList.remove('hidden');
        reportsPaginationContainer.innerHTML = '';
        return;
    } else {
        noReportsDataMsg.classList.add('hidden');
    }

    // Define all possible columns for the combined report
    const allColumns = [
        { key: 'ticket_id', label: 'Ticket ID' },
        { key: 'system', label: 'System' },
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email Address' },
        { key: 'mobile', label: 'Mobile Number' },
        { key: 'request_type', label: 'Request Type' },
        { key: 'requested_date', label: 'Requested Date' },
        { key: 'requestor_name', label: 'Requestor Name' },
        { key: 'assignment_date', label: 'Assignment Date' },
        { key: 'expiry_date', label: 'Expiry Date' },
        { key: 'created_at', label: 'Created At' },
        { key: 'updated_at', label: 'Last Modified At' },
        { key: 'attachment_data', label: 'Attachment' },
        { key: 'details_json.dms.dealerName', label: 'DMS Dealer Name' },
        { key: 'details_json.dms.dealerCode', label: 'DMS Code' },
        { key: 'details_json.dms.locationCode', label: 'DMS Loc. Code' },
        { key: 'details_json.dms.city', label: 'DMS City' },
        { key: 'details_json.dms.hubName', label: 'DMS Hub Name' },
        { key: 'details_json.lsq.licenseType', label: 'LSQ License Type' },
        { key: 'details_json.lsq.team', label: 'LSQ Team' },
        { key: 'details_json.lsq.salesExecutiveName', label: 'LSQ Sales Exec.' },
        { key: 'details_json.lsq.mobileNumber', label: 'LSQ Mobile' },
        { key: 'details_json.lsq.hubName', label: 'LSQ Hub Name' },
        { key: 'details_json.lsq.city', label: 'LSQ City' },
        { key: 'details_json.crm.dealerName', label: 'CRM Dealer Name' },
        { key: 'details_json.crm.hubName', label: 'CRM Hub Name' },
        { key: 'details_json.crm.city', label: 'CRM City' },
        { key: 'details_json.zoho.firstName', label: 'ZOHO First Name' },
        { key: 'details_json.zoho.lastName', label: 'ZOHO Last Name' },
        { key: 'details_json.zoho.emailAddress', label: 'ZOHO Email' },
        { key: 'details_json.zoho.role', label: 'ZOHO Role' },
        { key: 'details_json.zoho.accountCreatedTime', label: 'ZOHO Creation Date' },
        { key: 'removal_details_json.ticketId', label: 'Removal Ticket ID' },
        { key: 'removal_details_json.date', label: 'Removal Date' },
        { key: 'removal_details_json.reason', label: 'Removal Reason' },
        { key: 'removal_details_json.remover', label: 'Remover Name' }
    ];

    allColumns.forEach(col => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = col.label;
        reportsTableHeader.appendChild(th);
    });

    paginatedLicenses.forEach(license => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-100';

        allColumns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';

            let value = '';
            if (col.key.startsWith('details_json.')) {
                const parts = col.key.split('.');
                let current = license.details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            } else if (col.key.startsWith('removal_details_json.')) {
                const parts = col.key.split('.');
                let current = license.removal_details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            }
            else if (license[col.key]) {
                value = license[col.key];
            }

            if (['assignment_date', 'expiry_date', 'requested_date', 'removal_details_json.date'].includes(col.key)) {
                value = formatDate(value);
            } else if (['created_at', 'updated_at', 'details_json.zoho.accountCreatedTime'].includes(col.key)) {
                if (value) {
                    try {
                        value = new Date(value).toLocaleString();
                    } catch (e) {
                        value = String(value);
                    }
                }
            }

            if (col.key === 'status') {
                td.innerHTML = `
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${value === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${value}
                    </span>
                `;
            } else if (col.key === 'attachment_data') {
                td.innerHTML = license.attachment_data ? `<button class="text-blue-600 hover:underline view-attachment-btn-reports" data-license-id="${license.id}" data-license-name="${license.name}">View</button>` : 'N/A';
            } else {
                td.textContent = value;
            }
            row.appendChild(td);
        });
        reportsTableBody.appendChild(row);
    });

    reportsTableBody.querySelectorAll('.view-attachment-btn-reports').forEach(button => {
        button.addEventListener('click', (event) => {
            const licenseId = event.target.dataset.licenseId;
            const license = state.licenses.find(l => l.id === licenseId);
            if (license && license.attachment_data) {
                const fileName = `${license.name}_${license.system}_attachment`;
                viewAttachment(license.attachment_data, fileName);
            } else {
                showCustomModal('No Attachment', 'No attachment data found for this license.');
            }
        });
    });

    renderPaginationControls(reportsPaginationContainer, state.filteredLicenses.length, page, limit, (newPage, newLimit) => {
        state.reportsCurrentPage = newPage;
        state.reportsResultsPerPage = newLimit;
        renderReportsTable(newPage, newLimit);
    }, 'reports');
}

/**
 * Exports the current report data to a CSV file.
 */
export async function exportReportsToCsv(exportFiltered) {
    const dataToExport = exportFiltered ? state.filteredLicenses : state.licenses;

    if (dataToExport.length === 0) {
        showCustomModal('Export Error', 'No data to export.');
        return;
    }

    const allColumns = [
        { key: 'ticket_id', label: 'Ticket ID' },
        { key: 'system', label: 'System' },
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email Address' },
        { key: 'mobile', label: 'Mobile Number' },
        { key: 'request_type', label: 'Request Type' },
        { key: 'requested_date', label: 'Requested Date' },
        { key: 'requestor_name', label: 'Requestor Name' },
        { key: 'assignment_date', label: 'Assignment Date' },
        { key: 'expiry_date', label: 'Expiry Date' },
        { key: 'created_at', label: 'Created At' },
        { key: 'updated_at', label: 'Last Modified At' },
        { key: 'attachment_data', label: 'Attachment Data (Base64)' },
        { key: 'details_json.dms.dealerName', label: 'DMS Dealer Name' },
        { key: 'details_json.dms.dealerCode', label: 'DMS Code' },
        { key: 'details_json.dms.locationCode', label: 'DMS Loc. Code' },
        { key: 'details_json.dms.city', label: 'DMS City' },
        { key: 'details_json.dms.hubName', label: 'DMS Hub Name' },
        { key: 'details_json.lsq.licenseType', label: 'LSQ License Type' },
        { key: 'details_json.lsq.team', label: 'LSQ Team' },
        { key: 'details_json.lsq.salesExecutiveName', label: 'LSQ Sales Exec.' },
        { key: 'details_json.lsq.mobileNumber', label: 'LSQ Mobile' },
        { key: 'details_json.lsq.hubName', label: 'LSQ Hub Name' },
        { key: 'details_json.lsq.city', label: 'LSQ City' },
        { key: 'details_json.crm.dealerName', label: 'CRM Dealer Name' },
        { key: 'details_json.crm.hubName', label: 'CRM Hub Name' },
        { key: 'details_json.crm.city', label: 'CRM City' },
        { key: 'details_json.zoho.firstName', label: 'ZOHO First Name' },
        { key: 'details_json.zoho.lastName', label: 'ZOHO Last Name' },
        { key: 'details_json.zoho.emailAddress', label: 'ZOHO Email' },
        { key: 'details_json.zoho.role', label: 'ZOHO Role' },
        { key: 'details_json.zoho.accountCreatedTime', label: 'ZOHO Creation Date' },
        { key: 'removal_details_json.ticketId', label: 'Removal Ticket ID' },
        { key: 'removal_details_json.date', label: 'Removal Date' },
        { key: 'removal_details_json.reason', label: 'Removal Reason' },
        { key: 'removal_details_json.remover', label: 'Remover Name' }
    ];

    let csvContent = allColumns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',') + '\n';

    dataToExport.forEach(license => {
        const row = allColumns.map(col => {
            let value = '';
            if (col.key.startsWith('details_json.')) {
                const parts = col.key.split('.');
                let current = license.details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            } else if (col.key.startsWith('removal_details_json.')) {
                const parts = col.key.split('.');
                let current = license.removal_details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            }
            else if (license[col.key]) {
                value = license[col.key];
            }

            if (['assignment_date', 'expiry_date', 'requested_date', 'removal_details_json.date'].includes(col.key)) {
                value = formatDate(value);
            } else if (['created_at', 'updated_at', 'details_json.zoho.accountCreatedTime'].includes(col.key)) {
                if (value) {
                    try {
                        value = new Date(value).toLocaleString();
                    } catch (e) {
                        value = String(value);
                    }
                }
            }
            return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = exportFiltered ? 'filtered_license_report.csv' : 'full_license_report.csv';
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${dataToExport.length} records to ${filename}!`);
}

/**
 * Exports all licenses of the current system to a CSV file.
 */
export function exportSystemToCsv() {
    if (state.currentSystemLicenses.length === 0) {
        showCustomModal('Export Error', `No ${state.currentSystemViewing} data to export.`);
        return;
    }

    // Use the same column definition as renderSystemLicensesTable for consistency
    const allColumns = [
        { key: 'ticket_id', label: 'Ticket ID' },
        { key: 'system', label: 'System' },
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email Address' },
        { key: 'mobile', label: 'Mobile Number' },
        { key: 'request_type', label: 'Request Type' },
        { key: 'requested_date', label: 'Requested Date' },
        { key: 'requestor_name', label: 'Requestor Name' },
        { key: 'assignment_date', label: 'Assignment Date' },
        { key: 'expiry_date', label: 'Expiry Date' },
        { key: 'created_at', label: 'Created At' },
        { key: 'updated_at', label: 'Last Modified At' },
        { key: 'attachment_data', label: 'Attachment Data (Base64)' },
        { key: 'details_json.dms.dealerName', label: 'DMS Dealer Name' },
        { key: 'details_json.dms.dealerCode', label: 'DMS Code' },
        { key: 'details_json.dms.locationCode', label: 'DMS Loc. Code' },
        { key: 'details_json.dms.city', label: 'DMS City' },
        { key: 'details_json.dms.hubName', label: 'DMS Hub Name' },
        { key: 'details_json.lsq.licenseType', label: 'LSQ License Type' },
        { key: 'details_json.lsq.team', label: 'LSQ Team' },
        { key: 'details_json.lsq.salesExecutiveName', label: 'LSQ Sales Exec.' },
        { key: 'details_json.lsq.mobileNumber', label: 'LSQ Mobile' },
        { key: 'details_json.lsq.hubName', label: 'LSQ Hub Name' },
        { key: 'details_json.lsq.city', label: 'LSQ City' },
        { key: 'details_json.crm.dealerName', label: 'CRM Dealer Name' },
        { key: 'details_json.crm.hubName', label: 'CRM Hub Name' },
        { key: 'details_json.crm.city', label: 'CRM City' },
        { key: 'details_json.zoho.firstName', label: 'ZOHO First Name' },
        { key: 'details_json.zoho.lastName', label: 'ZOHO Last Name' },
        { key: 'details_json.zoho.emailAddress', label: 'ZOHO Email' },
        { key: 'details_json.zoho.role', label: 'ZOHO Role' },
        { key: 'details_json.zoho.accountCreatedTime', label: 'ZOHO Creation Date' },
        { key: 'removal_details_json.ticketId', label: 'Removal Ticket ID' },
        { key: 'removal_details_json.date', label: 'Removal Date' },
        { key: 'removal_details_json.reason', label: 'Removal Reason' },
        { key: 'removal_details_json.remover', label: 'Remover Name' }
    ];

    const systemSpecificColumnsForExport = allColumns.filter(col => {
        if (!col.key.includes('details_json.') && !col.key.includes('removal_details_json.')) return true;
        if (col.key.startsWith(`details_json.${state.currentSystemViewing.toLowerCase()}.`) || col.key.startsWith('removal_details_json.')) return true;
        return false;
    });

    let csvContent = systemSpecificColumnsForExport.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',') + '\n';

    state.currentSystemLicenses.forEach(license => {
        const row = systemSpecificColumnsForExport.map(col => {
            let value = '';
            if (col.key.startsWith('details_json.')) {
                const parts = col.key.split('.');
                let current = license.details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            } else if (col.key.startsWith('removal_details_json.')) {
                const parts = col.key.split('.');
                let current = license.removal_details_json;
                for (let i = 1; i < parts.length; i++) {
                    if (current && typeof current === 'object' && current[parts[i]] !== undefined) {
                        current = current[parts[i]];
                    } else {
                        current = '';
                        break;
                    }
                }
                value = current;
            }
            else if (license[col.key]) {
                value = license[col.key];
            }

            if (['assignment_date', 'requested_date', 'expiry_date', 'removal_details_json.date'].includes(col.key)) {
                value = formatDate(value);
            } else if (['created_at', 'updated_at', 'details_json.zoho.accountCreatedTime'].includes(col.key)) {
                if (value) {
                    try {
                        value = new Date(value).toLocaleString();
                    } catch (e) {
                        value = String(value);
                    }
                }
            }
            return `"${String(value || '').replace(/"/g, '""')}"`; // Ensure empty string for null/undefined
        }).join(',');
        csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = `${state.currentSystemViewing.toLowerCase()}_license_report.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${state.currentSystemLicenses.length} ${state.currentSystemViewing} records to ${filename}!`);
}

/**
 * Renders the tickets table with pagination.
 */
export function renderTickets(page, limit) {
    const ticketsTableBody = document.getElementById('tickets-table-body');
    const noTicketsMsg = document.getElementById('no-tickets-msg');
    const ticketsPaginationContainer = document.getElementById('tickets-pagination');

    ticketsTableBody.innerHTML = '';
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTickets = state.tickets.slice(startIndex, endIndex);

    if (paginatedTickets.length === 0) {
        noTicketsMsg.classList.remove('hidden');
        ticketsPaginationContainer.innerHTML = '';
    } else {
        noTicketsMsg.classList.add('hidden');
        paginatedTickets.forEach(ticket => {
            const row = `
                <tr class="hover:bg-gray-100">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${ticket.ticket_id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${ticket.action_description}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${new Date(ticket.timestamp).toLocaleString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <select class="px-2 py-1 text-xs font-semibold rounded-full border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 ticket-status-select" data-ticket-id="${ticket.ticket_id}">
                            <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
                            <option value="Pending" ${ticket.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Closed" ${ticket.status === 'Closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">${ticket.notes || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 space-x-2">
                        <button class="py-1 px-3 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 transition update-ticket-status" data-ticket-id="${ticket.ticket_id}">Update</button>
                        <button class="py-1 px-3 bg-indigo-500 text-white rounded-md text-xs hover:bg-indigo-600 transition edit-ticket-notes" data-ticket-id="${ticket.ticket_id}">Notes</button>
                    </td>
                </tr>
            `;
            ticketsTableBody.insertAdjacentHTML('beforeend', row);
        });

        // We need to attach event listeners here because they are dynamic
        // We will import the handlers from events.js. 
        // Note: This requires events.js to export handleTicketStatusUpdate and handleTicketNotesUpdate
        // And we need to import them at the top of this file.
        // Since we haven't imported them yet, we will assume they are available or we will dynamically import them?
        // No, dynamic import is async.
        // We will add them to the imports at the top of the file later or rely on the fact that we will fix imports.
        // For now, let's use a global or assume they are imported as `handleTicketStatusUpdate`.

        // Actually, let's use a custom event or just dispatch it?
        // Or better, we can just attach the listener to call the imported function.
        // I will add the import to the top of the file in a separate step or just assume it's there.
        // Wait, I can't assume. I need to add it.
        // I will add `import { handleTicketStatusUpdate, handleTicketNotesUpdate } from './events.js';` to the top later.

        ticketsTableBody.querySelectorAll('.update-ticket-status').forEach(button => {
            button.addEventListener('click', (e) => {
                // We need to dispatch this to the handler in events.js
                // But we can't easily call it if not imported.
                // Let's dispatch a custom event on the document?
                // Or just import it. I will add the import.
                const event = new CustomEvent('ticket-status-update-click', { detail: { originalEvent: e } });
                document.dispatchEvent(event);
            });
        });

        ticketsTableBody.querySelectorAll('.edit-ticket-notes').forEach(button => {
            button.addEventListener('click', (e) => {
                const event = new CustomEvent('ticket-notes-edit-click', { detail: { originalEvent: e } });
                document.dispatchEvent(event);
            });
        });
    }
    renderPaginationControls(ticketsPaginationContainer, state.tickets.length, page, limit, (newPage, newLimit) => {
        state.ticketsCurrentPage = newPage;
        state.ticketsResultsPerPage = newLimit;
        renderTickets(newPage, newLimit);
    }, 'tickets');
}

/**
 * Views an attachment in a new window.
 * @param {string} base64Data - The Base64 data of the attachment.
 * @param {string} fileName - The filename for the attachment.
 */
export function viewAttachment(base64Data, fileName) {
    const newWindow = window.open();
    if (newWindow) {
        newWindow.document.write(
            `<iframe src="${base64Data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
        newWindow.document.title = fileName;
    } else {
        showCustomModal('Error', 'Popup blocked! Please allow popups for this site to view attachments.');
    }
}

/**
 * Renders search results in the Remove License section.
 * This was extracted from searchLicenses to separate DOM logic.
 */
export function renderSearchResults(results) {
    const searchResultsTableBody = document.getElementById('search-results-table-body');
    const noSearchResultsMsg = document.getElementById('no-search-results');
    const removeLicenseDetailsCard = document.getElementById('remove-license-details-card');

    searchResultsTableBody.innerHTML = '';

    if (results.length === 0) {
        noSearchResultsMsg.classList.remove('hidden');
        removeLicenseDetailsCard.classList.add('hidden');
    } else {
        noSearchResultsMsg.classList.add('hidden');
        results.forEach(license => {
            const row = `
                <tr class="hover:bg-gray-100 cursor-pointer select-license-row" data-license-id="${license.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${license.system}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${license.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDate(license.assignment_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                         <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${license.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${license.status}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${license.status === 'Inactive' ?
                    `<button class="text-indigo-600 hover:text-indigo-900 reactivate-license-btn" data-license-id="${license.id}" data-license-name="${license.name}">Reactivate</button>` :
                    ''
                }
                        ${license.attachment_data ?
                    `<button class="text-blue-600 hover:underline ml-2 view-attachment-btn" data-license-id="${license.id}">View Attachment</button>` :
                    ''
                }
                    </td>
                </tr>
            `;
            searchResultsTableBody.insertAdjacentHTML('beforeend', row);
        });

        // Add event listeners for row selection
        searchResultsTableBody.querySelectorAll('.select-license-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Prevent triggering if button clicked
                if (e.target.tagName === 'BUTTON') return;

                // Dispatch event for row selection
                const event = new CustomEvent('license-row-selected', { detail: { licenseId: row.dataset.licenseId } });
                document.dispatchEvent(event);
            });
        });

        // Add event listeners for reactivate and view attachment
        searchResultsTableBody.querySelectorAll('.reactivate-license-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const event = new CustomEvent('reactivate-license-click', { detail: { originalEvent: e } });
                document.dispatchEvent(event);
            });
        });

        searchResultsTableBody.querySelectorAll('.view-attachment-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const licenseId = e.target.dataset.licenseId;
                const license = results.find(l => l.id === licenseId);
                if (license && license.attachment_data) {
                    const fileName = `${license.name}_${license.system}_attachment`;
                    viewAttachment(license.attachment_data, fileName);
                } else {
                    showCustomModal('No Attachment', 'No attachment data found for this license.');
                }
            });
        });
    }
}


