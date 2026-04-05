// PWA Configuration & Application Logic

const SECTIONS = {
    summary: {
        title: "Executive Summary",
        fields: [
            { id: "problem", label: "Problem Statement", placeholder: "What pain point are you solving?" },
            { id: "solution", label: "Solution", placeholder: "Describe your product/service and why it's indispensable." },
            { id: "value-prop", label: "Value Proposition", placeholder: "What makes your solution better than alternatives?" }
        ]
    },
    market: {
        title: "Market Intelligence",
        fields: [
            { id: "market-size", label: "Market Size (TAM/SAM/SOM)", placeholder: "Include data-backed estimates." },
            { id: "audience", label: "Target Audience", placeholder: "Define your ideal customer profiles." },
            { id: "competitors", label: "Competitive Analysis", placeholder: "Identify competitors and your advantages." }
        ]
    },
    product: {
        title: "Product Vision",
        fields: [
            { id: "roadmap", label: "Development Roadmap", placeholder: "Short and long term goals." },
            { id: "features", label: "Key Features", placeholder: "What are the core pillars of the product?" },
            { id: "ip", label: "Intellectual Property", placeholder: "Patents, proprietary tech, or unique assets." }
        ]
    },
    ops: {
        title: "Operations & Revenue",
        fields: [
            { id: "revenue", label: "Revenue Streams", placeholder: "How will you make money?" },
            { id: "pricing", label: "Pricing Strategy", placeholder: "Business model and margins." },
            { id: "ops-model", label: "Operating Model", placeholder: "Systems and infrastructure." }
        ]
    },
    team: {
        title: "Team & Growth",
        fields: [
            { id: "founders", label: "Founding Team", placeholder: "Experience and capabilities." },
            { id: "hiring", label: "Hiring Plan", placeholder: "Next key hires and roles." },
            { id: "advisors", label: "Advisors", placeholder: "Mentors or industry experts." }
        ]
    },
    financials: {
        title: "Financial Projections",
        fields: [
            { id: "forecast", label: "3-5 Year Forecast", placeholder: "High-level financials." },
            { id: "funding", label: "Funding Request", placeholder: "How much and what terms?" },
            { id: "use-of-funds", label: "Use of Funds", placeholder: "Specific allocation breakdown." }
        ]
    },
    "build-log": {
        title: "Build Log & Progress",
        type: "log",
        fields: [
            { id: "build-entry", label: "New Progress Report", placeholder: "Describe build stage, research results, or milestones achieved..." }
        ]
    }
};

let currentState = {
    activeSection: "summary",
    data: JSON.parse(localStorage.getItem('freightcode_pwa_data')) || {
        summary: {},
        market: {},
        product: {},
        ops: {},
        team: {},
        financials: {},
        "build-log": []
    }
};

// DOM Elements
const contentArea = document.getElementById('content-area');
const sectionTitleEl = document.getElementById('section-title');
const navItems = document.querySelectorAll('.nav-item');
const saveBtn = document.getElementById('save-btn');
const exportBtn = document.getElementById('export-btn');
const toast = document.getElementById('offline-toast');

// Initialize App
function init() {
    renderSection(currentState.activeSection);
    
    // Nav Click Handling
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');
            if (sectionId) switchSection(sectionId);
        });
    });

    saveBtn.addEventListener('click', saveActiveData);
    exportBtn.addEventListener('click', exportData);
    
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(reg => {
                console.log('SW Registered');
            }).catch(err => {
                console.error('SW Registration failed', err);
            });
        });
    }

    // Auto-save on delay
    let timeout = null;
    contentArea.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(saveActiveData, 2000);
    });

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function switchSection(sectionId) {
    if (sectionId === currentState.activeSection) return;
    
    // Save current before switching
    saveActiveData();
    
    currentState.activeSection = sectionId;
    
    // Update Sidebar UI
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
    });
    
    renderSection(sectionId);
}

function renderSection(sectionId) {
    const config = SECTIONS[sectionId];
    sectionTitleEl.textContent = config.title;
    
    if (config.type === "log") {
        renderLogPage(sectionId);
    } else {
        renderStandardPage(sectionId);
    }
    
    if (window.lucide) lucide.createIcons();
}

function renderStandardPage(sectionId) {
    const config = SECTIONS[sectionId];
    const sectionData = currentState.data[sectionId] || {};
    
    contentArea.innerHTML = `
        <div class="glass-card">
            ${config.fields.map(field => `
                <div class="field-group">
                    <label>${field.label}</label>
                    <textarea id="field-${field.id}" placeholder="${field.placeholder}">${sectionData[field.id] || ""}</textarea>
                </div>
            `).join('')}
        </div>
    `;
}

function renderLogPage(sectionId) {
    const logs = currentState.data[sectionId] || [];
    
    contentArea.innerHTML = `
        <div class="glass-card" style="max-width: 900px;">
            <div class="field-group" style="border-bottom: 1px solid var(--gray-200); padding-bottom: 24px; margin-bottom: 32px;">
                <label>Add Progress Report</label>
                <div style="display: flex; gap: 12px; flex-direction: column;">
                    <textarea id="new-log-content" placeholder="Describe the build stage, development milestone, or research findings..."></textarea>
                    <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center;">
                        <select id="log-status-select" style="padding: 8px; border-radius: 6px; border: 1px solid var(--gray-200); font-size: 13px;">
                            <option value="progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="research">Research/Researching</option>
                        </select>
                        <button onclick="addLogEntry()" class="btn btn-primary">Add Report Entry</button>
                    </div>
                </div>
            </div>
            
            <div id="log-list">
                ${logs.length === 0 ? '<p style="text-align: center; color: var(--gray-400); padding: 40px;">No progress reports yet.</p>' : 
                  logs.slice().reverse().map((log, index) => `
                    <div class="log-item">
                        <div class="log-item-header">
                            <span class="log-date">${log.date}</span>
                            <span class="log-status ${log.status === 'completed' ? 'completed' : 'progress'}">${log.status}</span>
                        </div>
                        <div class="log-content" style="font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${log.content}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Global scope for onclick
window.addLogEntry = function() {
    const content = document.getElementById('new-log-content').value;
    const status = document.getElementById('log-status-select').value;
    
    if (!content.trim()) return;
    
    const entry = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        status: status,
        content: content
    };
    
    currentState.data["build-log"].push(entry);
    saveData();
    renderSection("build-log");
};

function saveActiveData() {
    const config = SECTIONS[currentState.activeSection];
    if (config.type === "log") return; // Logs save on "Add"

    const sectionData = {};
    config.fields.forEach(field => {
        const el = document.getElementById(`field-${field.id}`);
        if (el) sectionData[field.id] = el.value;
    });
    
    currentState.data[currentState.activeSection] = sectionData;
    saveData();
}

function saveData() {
    localStorage.setItem('freightcode_pwa_data', JSON.stringify(currentState.data));
    showToast('Changes Saved Locally');
}

function exportData() {
    const dataStr = JSON.stringify(currentState.data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `freightcode-plan-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function showToast(msg) {
    const toast = document.getElementById('offline-toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function updateOnlineStatus() {
    if (navigator.onLine) {
        showToast('Online - Data Synced');
    } else {
        showToast('Working Offline');
    }
}

// Run init
init();
