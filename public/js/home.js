// public/js/home.js

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('plateSearchInput');
    const resultsContainer = document.getElementById('searchResults');
    const clearButton = document.getElementById('clearSearch');

    // --- 1. Logica de Validare a Inputului ---
    searchInput.addEventListener('input', (e) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Aplică formatul LLL CCC
        if (value.length > 3 && !value.includes(' ')) {
            value = value.substring(0, 3) + ' ' + value.substring(3);
        }
        if (value.length > 8) { 
            value = value.substring(0, 8);
        }

        e.target.value = value;
        clearButton.style.display = value.length > 0 ? 'block' : 'none';

        if (value.length > 2) {
            handleSearch(value);
        } else {
            resultsContainer.innerHTML = '';
        }
    });
    
    // Butonul X (Clear)
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        resultsContainer.innerHTML = '';
        clearButton.style.display = 'none';
        searchInput.focus();
    });

    // --- 2. Funcția AJAX de Căutare ---
    async function handleSearch(query) {
        const plate = query.trim().replace(/\s/g, ''); 

        try {
            const response = await fetch(`/api/search?plate=${plate}`);
            const results = await response.json();
            renderResults(results);
        } catch (error) {
            resultsContainer.innerHTML = `<div class="error-message">A apărut o eroare la server.</div>`;
        }
    }

    // --- 3. Funcția de Randare a Rezultatelor ---
    function renderResults(cars) {
        if (cars.length === 0) {
            resultsContainer.innerHTML = `<div class="no-results-message">Nicio mașină găsită.</div>`;
            return;
        }

        resultsContainer.innerHTML = cars.map(car => `
            <a href="/cars/${car._id}" class="car-result-card">
                <div class="result-info">
                    <span class="md-tag">MD</span>
                    <span class="plate-number">${car.plateNumber}</span>
                    <span class="car-details">${car.make} ${car.model}</span>
                </div>
                <div class="result-status">
                    VÂNZARE
                    <span class="arrow">→</span>
                </div>
            </a>
        `).join('');
    }
});