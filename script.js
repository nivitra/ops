document.addEventListener('DOMContentLoaded', () => {

    // --- Lock Screen Logic ---
    const lockScreen = document.getElementById('lockScreen');
    const mainContent = document.getElementById('mainContent');
    const passkeyInput = document.getElementById('passkeyInput');
    const unlockBtn = document.getElementById('unlockBtn');
    const lockError = document.getElementById('lockError');

    // Single required password
    const REQUIRED_PASSKEY = "p(V)-M4-03";

    function verifyPasskey() {
        // We trim the input, but we do NOT change the case, as the requested password has both.
        const inputVal = passkeyInput.value.trim();

        if (inputVal === REQUIRED_PASSKEY) {
            lockScreen.style.display = 'none';
            mainContent.style.display = 'block';
            lockError.textContent = "";
            init();
        } else {
            lockError.textContent = "Invalid authorization key.";
            passkeyInput.value = '';
            passkeyInput.focus();
        }
    }

    unlockBtn.addEventListener('click', verifyPasskey);
    passkeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') verifyPasskey();
    });

    // --- Main App Logic ---
    // DOM Elements
    const gridContainer = document.getElementById('ideasGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const riskFilter = document.getElementById('riskFilter');
    const sortFilter = document.getElementById('sortFilter');
    const resetBtn = document.getElementById('resetFiltersBtn');
    const resultsCount = document.getElementById('resultsCount');

    // Modal Elements
    const modal = document.getElementById('ideaModal');
    const modalBody = document.getElementById('modalBody');
    const closeModal = document.querySelector('.close-btn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');

    let currentData = [...startupIdeas];
    let currentIdeaForPdf = null;

    // Initialization
    function init() {
        populateCategories();
        applyFilters(); // Initial render and sort
    }

    function populateCategories() {
        const categories = new Set(startupIdeas.map(i => i.Category).filter(Boolean));
        Array.from(categories).sort().forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            categoryFilter.appendChild(opt);
        });
    }

    // Helper: Generate visual meter bars (1-5 scale)
    function generateMeter(value, max = 5) {
        const num = Math.min(Math.max(parseInt(value) || 0, 0), max);
        let html = '<div class="meter-blocks">';
        for (let i = 0; i < max; i++) {
            html += `<div class="m-block ${i < num ? 'active' : ''}"></div>`;
        }
        html += '</div>';
        return html;
    }

    // Render Cards in the Grid
    function renderCards(data) {
        gridContainer.innerHTML = '';

        if (data.length === 0) {
            gridContainer.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 3rem; color: var(--text-muted);">No opportunities match the current dimensional filters.</p>';
            resultsCount.textContent = '0 results';
            return;
        }

        resultsCount.textContent = `${data.length} opportunit${data.length === 1 ? 'y' : 'ies'} found`;

        const fragment = document.createDocumentFragment();

        data.forEach(idea => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => openModal(idea); // entire card is clickable now

            const score = idea['Overall Score'] ? parseFloat(idea['Overall Score']).toFixed(1) : '—';

            card.innerHTML = `
                <div class="card-top">
                    <span class="badge">${idea.Category || 'Domain Neutral'}</span>
                    <div class="card-score" title="Overall Score">${score}</div>
                </div>
                <h3 class="card-title">${idea['Project Name'] || 'Unnamed Initiative'}</h3>
                <p class="card-desc">${idea['Problem Statement (One Sentence)'] || 'Problem statement data unavailable.'}</p>
                
                <div class="card-meters">
                    <div class="meter">
                        <span class="meter-label">AI Opportunity</span>
                        ${generateMeter(idea['AI Opp Score'])}
                    </div>
                    <div class="meter">
                        <span class="meter-label">Market Vacuum</span>
                        ${generateMeter(idea['Market Vacuum'])}
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        });

        gridContainer.appendChild(fragment);
    }

    // Core Filter & Sort Logic
    function applyFilters() {
        const term = searchInput.value.toLowerCase().trim();
        const cat = categoryFilter.value;
        const risk = riskFilter.value;
        const sort = sortFilter.value;

        currentData = startupIdeas.filter(idea => {
            const matchSearch =
                (idea['Project Name'] || '').toLowerCase().includes(term) ||
                (idea['Problem Statement (One Sentence)'] || '').toLowerCase().includes(term) ||
                (idea['Category'] || '').toLowerCase().includes(term);
            const matchCat = cat === '' || idea['Category'] === cat;
            const matchRisk = risk === '' || idea['Technical Risk'] === risk;
            return matchSearch && matchCat && matchRisk;
        });

        if (sort !== 'default') {
            currentData.sort((a, b) => {
                if (sort === 'scoreHigh') return parseFloat(b['Overall Score'] || 0) - parseFloat(a['Overall Score'] || 0);
                if (sort === 'scoreLow') return parseFloat(a['Overall Score'] || 0) - parseFloat(b['Overall Score'] || 0);
                if (sort === 'nameAsc') return (a['Project Name'] || '').localeCompare(b['Project Name'] || '');
                return 0;
            });
        }

        renderCards(currentData);
    }

    // Bind Filter Events
    [searchInput, categoryFilter, riskFilter, sortFilter].forEach(el => {
        el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', applyFilters);
    });

    resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = '';
        riskFilter.value = '';
        sortFilter.value = 'scoreHigh';
        applyFilters();
    });

    // Modal Dashboard Generator
    function openModal(idea) {
        currentIdeaForPdf = idea;
        // Set Header static info
        document.getElementById('modalTitle').textContent = idea['Project Name'] || 'Project Details';
        document.getElementById('modalCategory').textContent = idea['Category'] || 'General';
        document.getElementById('modalId').textContent = idea['MPS ID'] || 'N/A';

        const safeText = (text) => text ? String(text).replace(/\n/g, '<br>') : '<span style="color:var(--text-muted)">Data unavailable</span>';

        const genBar = (val) => {
            const v = parseInt(val) || 0;
            let bar = '<div class="score-bar-container">';
            for (let i = 0; i < 5; i++) bar += `<div class="s-block ${i < v ? 'fill' : ''}"></div>`;
            bar += '</div>';
            return bar;
        };

        // Left Column (Core Intel & deep dives)
        const leftCol = `
            <div class="modal-left">
                <div class="kb-section">
                    <h3 class="kb-title">Core Hypothesis</h3>
                    <p class="kb-text"><strong>Problem:</strong> ${safeText(idea['Problem Statement (One Sentence)'])}</p>
                    <p class="kb-text"><strong>Solution:</strong> ${safeText(idea['Solution Hypothesis'])}</p>
                    <p class="kb-text"><strong>Competitive Wedge:</strong> ${safeText(idea['Competitive Wedge'])}</p>
                </div>
                
                <div class="kb-section">
                    <h3 class="kb-title">Strategic Deep Dives</h3>
                    
                    ${idea['INDIAN market suggestion'] ? `
                    <div class="deep-dive-card">
                        <div class="dd-header">🇮🇳 India Market Optimization</div>
                        <div class="dd-content">${safeText(idea['INDIAN market suggestion'])}</div>
                    </div>` : ''}
                    
                    ${idea['JUGAAD'] ? `
                    <div class="deep-dive-card">
                        <div class="dd-header">🛠 Jugaad MVP Approach</div>
                        <div class="dd-content">${safeText(idea['JUGAAD'])}</div>
                    </div>` : ''}
                    
                    ${idea['FESTIVAL INTEGRATION'] ? `
                    <div class="deep-dive-card">
                        <div class="dd-header">🎉 Festival Integration Campaign</div>
                        <div class="dd-content">${safeText(idea['FESTIVAL INTEGRATION'])}</div>
                    </div>` : ''}
                    
                    ${idea['LANGUAGE LOCALIZATION'] ? `
                    <div class="deep-dive-card">
                        <div class="dd-header">🗣 Language Localization Strategy</div>
                        <div class="dd-content">${safeText(idea['LANGUAGE LOCALIZATION'])}</div>
                    </div>` : ''}
                    
                    ${idea['family structure fit'] ? `
                    <div class="deep-dive-card">
                        <div class="dd-header">👨‍👩‍👧‍👦 Family Structure Fit</div>
                        <div class="dd-content">${safeText(idea['family structure fit'])}</div>
                    </div>` : ''}
                </div>
            </div>
        `;

        // Right Column (Metrics, Analysis, Timeline)
        const rightCol = `
            <div class="modal-right">
                
                <div class="kb-section">
                    <h3 class="kb-title">Dimensional Scores</h3>
                    <div class="metrics-grid" style="margin-bottom: 1.5rem;">
                        <div class="m-item">
                            <span class="m-label">Overall Score</span>
                            <span class="m-value">${safeText(idea['Overall Score'])}/5</span>
                        </div>
                        <div class="m-item">
                            <span class="m-label">Tech Risk</span>
                            <span class="m-value" style="font-size:1.2rem; margin-top:0.7rem;">${safeText(idea['Technical Risk'])}</span>
                        </div>
                    </div>
                    
                    <div class="score-list">
                        <div class="score-row"><span class="score-name">AI Opp Score</span> ${genBar(idea['AI Opp Score'])}</div>
                        <div class="score-row"><span class="score-name">Infra Gap</span> ${genBar(idea['Infra Gap Score'])}</div>
                        <div class="score-row"><span class="score-name">Market Vacuum</span> ${genBar(idea['Market Vacuum'])}</div>
                        <div class="score-row"><span class="score-name">Problem Specificity</span> ${genBar(idea['Specificity'])}</div>
                        <div class="score-row"><span class="score-name">Problem Frequency</span> ${genBar(idea['Frequency'])}</div>
                        <div class="score-row"><span class="score-name">Problem Intensity</span> ${genBar(idea['Intensity'])}</div>
                    </div>
                </div>

                <div class="kb-section">
                    <h3 class="kb-title">Stakeholder Matrix (Power / Int)</h3>
                    <div class="stakeholder-matrix">
                        <div class="sh-card">
                            <div class="sh-role">End User</div>
                            <div class="sh-stats">
                                <span>Pwr: ${idea['User Power'] || '-'}</span>
                                <span>Int: ${idea['User Interest'] || '-'}</span>
                            </div>
                        </div>
                        <div class="sh-card">
                            <div class="sh-role">Payer</div>
                            <div class="sh-stats">
                                <span>Pwr: ${idea['Payer Power'] || '-'}</span>
                                <span>Int: ${idea['Payer Interest'] || '-'}</span>
                            </div>
                        </div>
                        <div class="sh-card">
                            <div class="sh-role">Partner</div>
                            <div class="sh-stats">
                                <span>Pwr: ${idea['Partner Power'] || '-'}</span>
                                <span>Int: ${idea['Partner Interest'] || '-'}</span>
                            </div>
                        </div>
                        <div class="sh-card">
                            <div class="sh-role">Competitor</div>
                            <div class="sh-stats">
                                <span>Pwr: ${idea['Competitor Power'] || '-'}</span>
                                <span>Int: ${idea['Competitor Interest'] || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="kb-section">
                    <h3 class="kb-title">Execution Engine</h3>
                    <div class="timeline">
                        <div class="tl-item">
                            <div class="tl-phase">In Scope (Pilot)</div>
                            <div class="tl-desc">${safeText(idea['IN SCOPE (3-Month Pilot)'])}</div>
                        </div>
                        <div class="tl-item">
                            <div class="tl-phase">Out of Scope</div>
                            <div class="tl-desc">${safeText(idea['OUT OF SCOPE'])}</div>
                        </div>
                        <div class="tl-item">
                            <div class="tl-phase">Validation Phase</div>
                            <div class="tl-desc">${safeText(idea['Validate Phase (W1-2)'])}</div>
                        </div>
                        <div class="tl-item">
                            <div class="tl-phase">Build Phase</div>
                            <div class="tl-desc">${safeText(idea['Build MVP Phase (W3-8)'])}</div>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle);">
                        <p style="font-size: 0.8rem; text-transform:uppercase; color: var(--text-muted); font-weight:600;">Kill Condition</p>
                        <p style="font-size: 0.95rem; font-weight:500;">${safeText(idea['Kill Condition'])}</p>
                    </div>
                </div>

            </div>
        `;

        modalBody.innerHTML = leftCol + rightCol;

        // Display Modal with animation
        const overlay = document.getElementById('ideaModal');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModalWindow() {
        const overlay = document.getElementById('ideaModal');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    closeModal.addEventListener('click', closeModalWindow);

    downloadPdfBtn.addEventListener('click', () => {
        if (!currentIdeaForPdf) return;
        const idea = currentIdeaForPdf;

        downloadPdfBtn.innerText = 'Generating...';

        const content = [];
        
        // Header
        content.push({ text: idea['Project Name'] || 'Project Details', style: 'header' });
        
        // MPS ID
        content.push({ 
            text: ` MPS ID: ${idea['MPS ID'] || 'N/A'} `, 
            style: 'mpsId' 
        });

        // Add a line separator
        content.push({
            canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#000000' }],
            margin: [0, 10, 0, 20]
        });

        // Group fields into short metrics and long text for a better layout
        const shortFields = [];
        const longFields = [];

        for (const [key, value] of Object.entries(idea)) {
            if (key === 'Project Name' || key === 'MPS ID') continue;
            
            const valStr = String(value || '—');
            if (valStr.length < 50 && !valStr.includes('\n')) {
                shortFields.push({ key, value: valStr });
            } else {
                longFields.push({ key, value: valStr });
            }
        }

        // Add short fields as a neat multi-column grid
        const columns = [];
        for (let i = 0; i < shortFields.length; i += 2) {
            const row = [];
            row.push({
                stack: [
                    { text: shortFields[i].key.toUpperCase(), style: 'fieldLabel' },
                    { text: shortFields[i].value, style: 'fieldValue' }
                ],
                width: '50%'
            });
            if (i + 1 < shortFields.length) {
                row.push({
                    stack: [
                        { text: shortFields[i + 1].key.toUpperCase(), style: 'fieldLabel' },
                        { text: shortFields[i + 1].value, style: 'fieldValue' }
                    ],
                    width: '50%'
                });
            } else {
                row.push({ text: '', width: '50%' });
            }
            content.push({ columns: row, columnGap: 20 });
        }

        if (shortFields.length > 0) {
           content.push({
                canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, lineColor: '#dddddd' }],
                margin: [0, 10, 0, 20]
            });
        }

        // Add long fields
        for (const field of longFields) {
            content.push({ text: field.key.toUpperCase(), style: 'fieldLabel' });
            content.push({ text: field.value, style: 'fieldValue' });
        }

        const docDefinition = {
            info: {
                title: `${idea['MPS ID'] || 'idea'}`,
            },
            content: content,
            styles: {
                header: {
                    fontSize: 24,
                    bold: true,
                    margin: [0, 0, 0, 5],
                    color: '#111111'
                },
                mpsId: {
                    fontSize: 12,
                    bold: true,
                    background: '#ffff00',
                    margin: [0, 0, 0, 10]
                },
                fieldLabel: {
                    fontSize: 9,
                    bold: true,
                    color: '#666666',
                    margin: [0, 10, 0, 4]
                },
                fieldValue: {
                    fontSize: 11,
                    lineHeight: 1.4,
                    margin: [0, 0, 0, 15],
                    color: '#222222'
                }
            },
            defaultStyle: {
                font: 'Roboto'
            },
            pageMargins: [40, 40, 40, 40]
        };

        try {
            pdfMake.createPdf(docDefinition).download(`${idea['MPS ID'] || 'idea'}.pdf`, () => {
                setTimeout(() => {
                    downloadPdfBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download PDF`;
                }, 500);
            });
            // Fallback for browsers exactly where callbacks fail
            setTimeout(() => {
                const btnContent = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download PDF`;
                if(downloadPdfBtn.innerHTML !== btnContent) {
                   downloadPdfBtn.innerHTML = btnContent;
                }
            }, 3000);
        } catch(err) {
            console.error(err);
            downloadPdfBtn.innerHTML = 'Error Generating';
        }
    });

    document.getElementById('ideaModal').addEventListener('click', (e) => {
        if (e.target.id === 'ideaModal') closeModalWindow();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModalWindow();
    });

    // Boot
    // Notice: init() is now called upon successful unlock, not on purely DOM load.
});
