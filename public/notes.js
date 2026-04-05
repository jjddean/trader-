(function() {
    const editor = document.getElementById('editor');
    const pageTitle = document.getElementById('page-title');
    const pageList = document.getElementById('page-list');
    const newPageBtn = document.getElementById('new-page-btn');
    const deletePageBtn = document.getElementById('delete-page-btn');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const expandSidebarBtn = document.getElementById('expand-sidebar');
    const savedIndicator = document.getElementById('saved-indicator');
    const wordCount = document.getElementById('word-count');

    let pages = JSON.parse(localStorage.getItem('notes-pages')) || [];
    let activePageId = localStorage.getItem('notes-active-id') || null;

    // Initial Setup
    if (pages.length === 0) {
        createNewPage('Welcome to Minimalist Pages');
    } else if (!activePageId || !pages.find(p => p.id === activePageId)) {
        activePageId = pages[0].id;
    }

    renderPageList();
    loadActivePage();
    updateWordCount();

    // Event Listeners
    editor.addEventListener('input', () => {
        const page = pages.find(p => p.id === activePageId);
        if (page) {
            page.content = editor.value;
            page.updatedAt = Date.now();
            saveToLocalStorage();
            showSavedIndicator();
            updateWordCount();
        }
    });

    pageTitle.addEventListener('input', () => {
        const page = pages.find(p => p.id === activePageId);
        if (page) {
            page.title = pageTitle.value;
            page.updatedAt = Date.now();
            saveToLocalStorage();
            renderPageList();
            showSavedIndicator();
        }
    });

    newPageBtn.addEventListener('click', () => {
        createNewPage();
    });

    deletePageBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this page?')) {
            deleteActivePage();
        }
    });

    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        expandSidebarBtn.classList.remove('hidden');
    });

    expandSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        expandSidebarBtn.classList.add('hidden');
    });

    // Core Functions
    function createNewPage(title = 'Untitled Page') {
        const newPage = {
            id: 'page_' + Date.now(),
            title: title,
            content: '',
            updatedAt: Date.now()
        };
        pages.unshift(newPage);
        activePageId = newPage.id;
        saveToLocalStorage();
        renderPageList();
        loadActivePage();
        editor.focus();
    }

    function deleteActivePage() {
        pages = pages.filter(p => p.id !== activePageId);
        if (pages.length === 0) {
            createNewPage();
        } else {
            activePageId = pages[0].id;
            saveToLocalStorage();
            renderPageList();
            loadActivePage();
        }
    }

    function renderPageList() {
        pageList.innerHTML = '';
        pages.forEach(page => {
            const div = document.createElement('div');
            div.className = `page-item ${page.id === activePageId ? 'active' : ''}`;
            div.textContent = page.title || 'Untitled Page';
            div.onclick = () => {
                activePageId = page.id;
                saveToLocalStorage();
                renderPageList();
                loadActivePage();
            };
            pageList.appendChild(div);
        });
    }

    function loadActivePage() {
        const page = pages.find(p => p.id === activePageId);
        if (page) {
            pageTitle.value = page.title;
            editor.value = page.content;
            localStorage.setItem('notes-active-id', activePageId);
            updateWordCount();
        }
    }

    function saveToLocalStorage() {
        localStorage.setItem('notes-pages', JSON.stringify(pages));
    }

    function showSavedIndicator() {
        savedIndicator.classList.add('visible');
        setTimeout(() => {
            savedIndicator.classList.remove('visible');
        }, 1500);
    }

    function updateWordCount() {
        const text = editor.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    }

    // Auto-focus editor if it's main view
    if (window.innerWidth > 768) {
        editor.focus();
    }
})();
