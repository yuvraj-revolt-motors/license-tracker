// --- State Management ---

export const state = {
    licenses: [],
    tickets: [],
    filteredLicenses: [], // To store filtered data for reports
    currentSystemLicenses: [], // To store system-specific licenses for analytics table

    // Pagination State
    dashboardRecentCurrentPage: 1,
    dashboardRecentResultsPerPage: 10,
    reportsCurrentPage: 1,
    reportsResultsPerPage: 10,
    ticketsCurrentPage: 1,
    ticketsResultsPerPage: 10,
    systemAnalyticsCurrentPage: 1,
    systemAnalyticsResultsPerPage: 10,

    // Analytics State
    currentSystemViewing: null,
    systemAnalyticsData: {},

    // Modal/Form State
    selectedLicenseToRemove: null,
    licenseToReactivate: null,
    selectedTicketForNotes: null
};

export const licenseCapacity = {
    DMS: { total: 100, occupied: 0, color: '#4F46E5' }, // Indigo
    LSQ: { total: 75, occupied: 0, color: '#22C55E' }, // Green
    CRM: { total: 50, occupied: 0, color: '#EF4444' }, // Red
    ZOHO: { total: 120, occupied: 0, color: '#EAB308' }  // Yellow
};

export const resultsPerPageOptions = [10, 20, 50, 100, 200];
