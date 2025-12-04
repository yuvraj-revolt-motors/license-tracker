// --- Event Handlers ---

import { state } from './state.js';
import { fileToBase64, formatDate } from './utils.js';
import { fetchData, sendData, loadInitialData, fetchSystemAnalytics } from './api.js';
import {
    showCustomModal, showToast, updateDashboard, renderTickets, renderReportsTable,
    handleDependentFields, showSection, renderSearchResults, viewAttachment
} from './dom.js';

/**
 * Initializes all global event listeners.
 */
export function initEvents() {
    // Login form submission
    const loginForm = document.getElementById('login-form');
    console.log('Binding login form, element =', loginForm);

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const loginResponse = await sendData('/login', 'POST', { username, password });

            if (loginResponse.success) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('lastActiveSection', 'dashboard-section');
                showToast('Successfully Logged In!');
                document.getElementById('login-page').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');
                await loadInitialData();
                updateDashboard(); // Initial dashboard render
                showSection('dashboard-section');
            } else {
                showCustomModal('Login Failed', loginResponse.message || 'Invalid username or password.');
            }
        });
    }

    // Sidebar navigation
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const sectionId = event.currentTarget.dataset.section + '-section';
            showSection(sectionId);
        });
    });

    // Logout button
    // Logout button
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirmed = await showCustomModal('Logout', 'Are you sure you want to log out?');
            if (confirmed) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('lastActiveSection');
                localStorage.removeItem('lastActiveSystemAnalytics');
                state.licenses = [];
                state.tickets = [];
                state.currentSystemLicenses = [];
                document.getElementById('login-page').classList.remove('hidden');
                document.getElementById('app-container').classList.add('hidden');
                state.dashboardRecentCurrentPage = 1;
                state.reportsCurrentPage = 1;
                state.ticketsCurrentPage = 1;
                state.systemAnalyticsCurrentPage = 1;
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                showToast('Logged out successfully!', 'info');
            }
        });
    }
};



document.getElementById('search-query').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        searchLicenses();
    }
});

// Remove License form submission
document.getElementById('remove-license-form').addEventListener('submit', handleRemoveLicenseSubmit);

// Reports filter and export buttons

document.getElementById('apply-filters')?.addEventListener('click', applyReportsFilters);
document.getElementById('clear-filters')?.addEventListener('click', clearReportsFilters);
document.getElementById('export-dump-csv').addEventListener('click', () => import('./dom.js').then(m => m.exportReportsToCsv(false)));
document.getElementById('export-filtered-csv').addEventListener('click', () => import('./dom.js').then(m => m.exportReportsToCsv(true)));

// Reactivate Modal listeners
document.getElementById('reactivate-form')?.addEventListener('submit', handleReactivateSubmit);
document.getElementById('reactivate-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('reactivate-modal').classList.add('hidden');
    state.licenseToReactivate = null;
});

// Ticket Notes Modal listeners
document.getElementById('ticket-notes-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedTicketForNotes) return;

    const newNotes = document.getElementById('ticketNotesContent').value;
    const response = await sendData(`/tickets/${state.selectedTicketForNotes.ticket_id}`, 'PUT', {
        status: state.selectedTicketForNotes.status,
        notes: newNotes
    });

    if (response.success) {
        showToast('Ticket notes saved successfully!');
        document.getElementById('ticket-notes-modal').classList.add('hidden');
        state.selectedTicketForNotes = null;
        await loadInitialData(); // Refresh data
        renderTickets(state.ticketsCurrentPage, state.ticketsResultsPerPage);
    } else {
        showCustomModal('Error', response.message || 'Failed to save ticket notes.');
    }
});
document.getElementById('ticket-notes-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('ticket-notes-modal').classList.add('hidden');
    state.selectedTicketForNotes = null;
});

// Generic System Analytics Export button
document.getElementById('export-system-csv')?.addEventListener('click', () => import('./dom.js').then(m => m.exportSystemToCsv()));

// Generic System Analytics Back to Dashboard button
document.getElementById('back-to-dashboard-button')?.addEventListener('click', () => {
    showSection('dashboard-section');
});


// Custom Events from DOM rendering
document.addEventListener('ticket-status-update-click', async (e) => {
    const originalEvent = e.detail.originalEvent;
    const ticketId = originalEvent.target.dataset.ticketId;
    const selectEl = document.querySelector(`.ticket-status-select[data-ticket-id="${ticketId}"]`);
    const newStatus = selectEl.value;
    const ticketNotes = state.tickets.find(t => t.ticket_id === ticketId)?.notes || null;

    const response = await sendData(`/tickets/${ticketId}`, 'PUT', { status: newStatus, notes: ticketNotes });

    if (response.success) {
        showToast(`Ticket ${ticketId} status changed to ${newStatus}.`);
        await loadInitialData();
        renderTickets(state.ticketsCurrentPage, state.ticketsResultsPerPage);
    } else {
        showCustomModal('Error', response.message || 'Failed to update ticket status.');
    }
});

document.addEventListener('ticket-notes-edit-click', (e) => {
    const originalEvent = e.detail.originalEvent;
    const ticketId = originalEvent.target.dataset.ticketId;
    state.selectedTicketForNotes = state.tickets.find(t => t.ticket_id === ticketId);
    if (state.selectedTicketForNotes) {
        document.getElementById('ticket-notes-id').textContent = state.selectedTicketForNotes.ticket_id;
        document.getElementById('ticket-notes-content').value = state.selectedTicketForNotes.notes || '';
        document.getElementById('ticket-notes-modal').classList.remove('hidden');
    }
});

document.addEventListener('license-row-selected', (e) => {
    const licenseId = e.detail.licenseId;
    state.selectedLicenseToRemove = state.licenses.find(l => l.id === licenseId);

    if (state.selectedLicenseToRemove) {
        document.getElementById('remove-license-details-card').classList.remove('hidden');
        document.getElementById('remove-license-name').textContent = state.selectedLicenseToRemove.name;
        document.getElementById('remove-license-system').textContent = state.selectedLicenseToRemove.system;
        document.getElementById('remove-license-status').textContent = state.selectedLicenseToRemove.status;
        document.getElementById('remove-license-expiry').textContent = formatDate(state.selectedLicenseToRemove.expiry_date);

        // Auto-fill ticket ID for removal
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        document.getElementById('removeTicketId').value = `TKT-${dateStr}-${randomSuffix}`;
        document.getElementById('removalDate').value = today.toISOString().split('T')[0];
    }
});

document.addEventListener('reactivate-license-click', (e) => {
    const originalEvent = e.detail.originalEvent;
    const licenseId = originalEvent.target.dataset.licenseId;
    const licenseName = originalEvent.target.dataset.licenseName;
    state.licenseToReactivate = state.licenses.find(l => l.id === licenseId);
    if (state.licenseToReactivate) {
        document.getElementById('reactivate-license-name').textContent = licenseName;
        document.getElementById('reactivate-modal').classList.remove('hidden');
        document.getElementById('reactivateReason').value = '';
        document.getElementById('newAssignmentDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('reactivateAttachmentFile').value = '';
    }
});


/**
 * Handles the submission of the Add License form.
 */
export async function handleLicenseFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const system = formData.get('system');

    // Basic validation
    if (!system) {
        showCustomModal('Error', 'Please select a System.');
        return;
    }

    const licenseData = {
        ticketId: formData.get('ticketId'),
        system: system,
        name: formData.get('name'),
        mobile: formData.get('mobile'),
        email: formData.get('email'),
        requestType: formData.get('requestType'),
        requestedDate: formData.get('requestedDate'),
        requestorName: formData.get('requestorName'),
        assignmentDate: formData.get('assignmentDate'),
        expiryDate: formData.get('expiryDate'),
        status: 'Active',
        details: {}
    };

    // Collect system-specific details
    if (system === 'DMS') {
        licenseData.details.dms = {
            dealerName: formData.get('dmsDealerName'),
            dealerCode: formData.get('dmsDealerCode'),
            locationCode: formData.get('dmsLocationCode'),
            city: formData.get('dmsCity'),
            hubName: formData.get('dmsHubName')
        };
    } else if (system === 'LSQ') {
        licenseData.details.lsq = {
            licenseType: formData.get('lsqLicenseType'),
            team: formData.get('lsqTeam'),
            salesExecutiveName: formData.get('lsqSalesExecutiveName'),
            mobileNumber: formData.get('lsqMobileNumber'),
            hubName: formData.get('lsqHubName'),
            city: formData.get('lsqCity')
        };
    } else if (system === 'CRM') {
        licenseData.details.crm = {
            dealerName: formData.get('crmDealerName'),
            hubName: formData.get('crmHubName'),
            city: formData.get('crmCity')
        };
    } else if (system === 'ZOHO') {
        licenseData.details.zoho = {
            firstName: formData.get('zohoFirstName'),
            lastName: formData.get('zohoLastName'),
            emailAddress: formData.get('zohoEmailAddress'),
            role: formData.get('zohoRole'),
            accountCreatedTime: formData.get('zohoAccountCreatedTime')
        };
    }

    const attachmentFile = document.getElementById('attachmentFile').files[0];
    licenseData.attachmentData = await fileToBase64(attachmentFile);

    console.log("Submitting license data:", licenseData);

    const response = await sendData('/licenses', 'POST', licenseData);

    if (response.success) {
        // Create a ticket for this action
        await sendData('/tickets', 'POST', {
            ticketId: licenseData.ticketId,
            action: `Add License for ${licenseData.name} (${system})`,
            status: 'Closed',
            timestamp: new Date().toISOString(),
            notes: `License created successfully. Requestor: ${licenseData.requestorName}`
        });

        showToast('License added successfully!');
        form.reset();
        handleDependentFields(); // Reset hidden fields
        document.getElementById('attachmentFile').value = ''; // Clear file input
        await loadInitialData();
        updateDashboard();
        showSection('dashboard-section');
    } else {
        showCustomModal('Error', response.message || 'Failed to add license.');
    }
}

/**
 * Searches for licenses based on query and filters.
 */
export async function searchLicenses(isReset = false) {
    const query = isReset ? '' : document.getElementById('search-query').value.toLowerCase();
    const systemFilter = isReset ? '' : document.getElementById('removeFilterSystem').value;
    const statusFilter = isReset ? '' : document.getElementById('removeFilterStatus').value;
    const startDate = isReset ? '' : document.getElementById('removeFilterStartDate').value;
    const endDate = isReset ? '' : document.getElementById('removeFilterEndDate').value;

    const queryParams = {
        search: query,
        system: systemFilter,
        status: statusFilter,
        assignment_date_start: startDate,
        assignment_date_end: endDate
    };

    const results = await fetchData('/licenses', queryParams);
    renderSearchResults(results);
}

/**
 * Handles the submission of the Remove License form.
 */
export async function handleRemoveLicenseSubmit(event) {
    event.preventDefault();

    if (!state.selectedLicenseToRemove) {
        showCustomModal('Error', 'Please select a license to remove.');
        return;
    }

    const confirmation = await showCustomModal(
        'Confirm Removal',
        `Are you sure you want to set the license for ${state.selectedLicenseToRemove.name} (${state.selectedLicenseToRemove.system}) to Inactive? This will also update its 'updated_at' timestamp.`
    );

    if (!confirmation) {
        console.log("Remove license cancelled by user.");
        return;
    }

    const form = event.target;
    const formData = new FormData(form);

    const attachmentFile = document.getElementById('removeAttachmentFile').files[0];
    const attachmentData = await fileToBase64(attachmentFile);

    const removalDetails = {
        ticketId: formData.get('removeTicketId'),
        date: formData.get('removalDate'),
        reason: formData.get('removalReason'),
        remover: formData.get('removerName')
    };

    console.log("Attempting to send remove license request:", state.selectedLicenseToRemove.id, removalDetails, attachmentData);

    const response = await sendData(`/licenses/${state.selectedLicenseToRemove.id}`, 'PUT', {
        status: 'Inactive',
        removal_details_json: removalDetails,
        attachmentData: attachmentData
    });

    if (response.success) {
        console.log("License removal successful, attempting to add ticket.");
        await sendData('/tickets', 'POST', {
            ticketId: removalDetails.ticketId,
            action: `Remove License for ${state.selectedLicenseToRemove.name} (${state.selectedLicenseToRemove.system})`,
            status: 'Closed',
            timestamp: new Date().toISOString(),
            notes: `License deactivated. Reason: ${removalDetails.reason}, Remover: ${removalDetails.remover}`
        });

        form.reset();
        document.getElementById('removeAttachmentFile').value = '';
        state.selectedLicenseToRemove = null;
        document.getElementById('remove-license-details-card').classList.add('hidden');
        document.getElementById('search-query').value = '';
        showToast(`License for ${state.selectedLicenseToRemove ? state.selectedLicenseToRemove.name : 'User'} successfully set to Inactive.`);
        await loadInitialData();
        searchLicenses();
        updateDashboard();
    } else {
        console.error("License removal failed:", response.message);
        showCustomModal('Error', response.message || 'Failed to remove license.');
    }
}

/**
 * Handles reactivation of a license.
 */
export async function handleReactivateSubmit(event) {
    event.preventDefault();

    if (!state.licenseToReactivate) {
        showCustomModal('Error', 'No license selected for reactivation.');
        return;
    }

    const form = event.target;
    const formData = new FormData(form);
    const reactivateReason = formData.get('reactivateReason');
    const newAssignmentDate = formData.get('newAssignmentDate');

    const attachmentFile = document.getElementById('reactivateAttachmentFile').files[0];
    const attachmentData = await fileToBase64(attachmentFile);

    const confirmation = await showCustomModal(
        'Confirm Reactivation',
        `Are you sure you want to reactivate the license for ${state.licenseToReactivate.name}? This will update its status to 'Active' and its 'updated_at' timestamp.`
    );

    if (!confirmation) {
        return;
    }

    const response = await sendData(`/licenses/${state.licenseToReactivate.id}/reactivate`, 'PUT', {
        reason: reactivateReason,
        newAssignmentDate: newAssignmentDate,
        attachmentData: attachmentData
    });

    if (response.success) {
        document.getElementById('reactivate-modal').classList.add('hidden');
        form.reset();
        state.licenseToReactivate = null;
        showToast('License reactivated successfully!');
        await loadInitialData();
        searchLicenses();
        updateDashboard();
        showSection('dashboard-section');
    } else {
        showCustomModal('Error', response.message || 'Failed to reactivate license.');
    }
}

/**
 * Applies filters to the reports table.
 */
export async function applyReportsFilters() {
    const systemFilter = document.getElementById('filterSystem').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const startDateFilter = document.getElementById('filterStartDate').value;
    const endDateFilter = document.getElementById('filterEndDate').value;

    const queryParams = {
        system: systemFilter,
        status: statusFilter,
        assignment_date_start: startDateFilter,
        assignment_date_end: endDateFilter,
    };
    state.filteredLicenses = await fetchData('/licenses', queryParams);

    renderReportsTable(state.reportsCurrentPage, state.reportsResultsPerPage);
}

/**
 * Clears reports filters.
 */
export async function clearReportsFilters() {
    document.getElementById('filterSystem').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';

    await applyReportsFilters();




}



// Add License form
const systemSelect = document.getElementById('system');
if (systemSelect) {
    systemSelect.addEventListener('change', handleDependentFields);
}

const licenseForm = document.getElementById('license-form');
if (licenseForm) {
    licenseForm.addEventListener('submit', handleLicenseFormSubmit);
}

// Remove License search and filters
const removeApplyBtn = document.getElementById('remove-apply-filters-button');
if (removeApplyBtn) {
    removeApplyBtn.addEventListener('click', () => searchLicenses());
}

const removeClearBtn = document.getElementById('remove-clear-filters-button');
if (removeClearBtn) {
    removeClearBtn.addEventListener('click', () => {
        document.getElementById('search-query').value = '';
        document.getElementById('removeFilterSystem').value = '';
        document.getElementById('removeFilterStatus').value = '';
        document.getElementById('removeFilterStartDate').value = '';
        document.getElementById('removeFilterEndDate').value = '';
        searchLicenses(true);
    });
}

const searchQueryInput = document.getElementById('search-query');
if (searchQueryInput) {
    searchQueryInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            searchLicenses();
        }
    });
}

// Remove License form submission
const removeLicenseForm = document.getElementById('remove-license-form');
if (removeLicenseForm) {
    removeLicenseForm.addEventListener('submit', handleRemoveLicenseSubmit);
}

// Reports filter and export buttons
const applyFiltersBtn = document.getElementById('apply-filters');
if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', applyReportsFilters);
}

const clearFiltersBtn = document.getElementById('clear-filters');
if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearReportsFilters);
}

const exportDumpBtn = document.getElementById('export-dump-csv');
if (exportDumpBtn) {
    exportDumpBtn.addEventListener('click', () =>
        import('./dom.js').then(m => m.exportReportsToCsv(false))
    );
}

const exportFilteredBtn = document.getElementById('export-filtered-csv');
if (exportFilteredBtn) {
    exportFilteredBtn.addEventListener('click', () =>
        import('./dom.js').then(m => m.exportReportsToCsv(true))
    );
}

// Reactivate Modal listeners
const reactivateForm = document.getElementById('reactivate-form');
if (reactivateForm) {
    reactivateForm.addEventListener('submit', handleReactivateSubmit);
}

const reactivateCancelBtn = document.getElementById('reactivate-cancel-btn');
if (reactivateCancelBtn) {
    reactivateCancelBtn.addEventListener('click', () => {
        document.getElementById('reactivate-modal').classList.add('hidden');
        state.licenseToReactivate = null;
    });
}

// Ticket Notes Modal listeners
const ticketNotesForm = document.getElementById('ticket-notes-form');
if (ticketNotesForm) {
    ticketNotesForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!state.selectedTicketForNotes) return;

        const newNotes = document.getElementById('ticketNotesContent').value;
        const response = await sendData(`/tickets/${state.selectedTicketForNotes.ticket_id}`, 'PUT', {
            status: state.selectedTicketForNotes.status,
            notes: newNotes
        });

        if (response.success) {
            showToast('Ticket notes saved successfully!');
            document.getElementById('ticket-notes-modal').classList.add('hidden');
            state.selectedTicketForNotes = null;
            await loadInitialData();
            renderTickets(state.ticketsCurrentPage, state.ticketsResultsPerPage);
        } else {
            showCustomModal('Error', response.message || 'Failed to save ticket notes.');
        }
    });
}

const ticketNotesCancelBtn = document.getElementById('ticket-notes-cancel-btn');
if (ticketNotesCancelBtn) {
    ticketNotesCancelBtn.addEventListener('click', () => {
        document.getElementById('ticket-notes-modal').classList.add('hidden');
        state.selectedTicketForNotes = null;
    });
}

// Generic System Analytics Export button
const exportSystemCsvBtn = document.getElementById('export-system-csv');
if (exportSystemCsvBtn) {
    exportSystemCsvBtn.addEventListener('click', () =>
        import('./dom.js').then(m => m.exportSystemToCsv())
    );
}

// Generic System Analytics Back to Dashboard button
const backToDashboardBtn = document.getElementById('back-to-dashboard-button');
if (backToDashboardBtn) {
    backToDashboardBtn.addEventListener('click', () => {
        showSection('dashboard-section');
    });
}

// Dashboard System Capacity Cards
const systemCapacityCards = document.getElementById('system-capacity-cards');
if (systemCapacityCards) {
    systemCapacityCards.addEventListener('click', (event) => {
        const clickedCard = event.target.closest('[data-system-name]');
        if (clickedCard) {
            const systemName = clickedCard.dataset.systemName;
            showSection('system-analytics-section', systemName);
        }
    });
}

