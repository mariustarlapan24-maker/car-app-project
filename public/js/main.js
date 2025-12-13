// =================================================================
// 1. LOGICĂ UNICĂ: FORMAT PLĂCI MD (LLL NNN) - STABILĂ
// =================================================================
document.querySelectorAll('input[name="plateNumber"], #plate-search').forEach(input => {
    input.addEventListener('input', e => {
        let el = e.target;
        let cursor = el.selectionStart;
        
        // Luăm doar literele și cifrele, eliminăm restul
        let raw = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Separăm literele (primele 3) de cifre (restul)
        let letters = raw.replace(/[0-9]/g, '').substring(0, 3);
        let numbers = raw.replace(/[A-Z]/g, '').substring(0, 3);

        let finalValue = letters;
        // Punem spațiul DOAR dacă avem deja 3 litere și începem să scriem cifre
        if (letters.length === 3 && numbers.length > 0) {
            finalValue += ' ' + numbers;
        } else {
            finalValue += numbers;
        }

        // Aplicăm valoarea
        let oldLength = el.value.length;
        el.value = finalValue;

        // Corecție cursor: dacă s-a adăugat un spațiu automat, mutăm cursorul cu o poziție
        if (finalValue.length > oldLength && finalValue.charAt(cursor - 1) === ' ') {
            cursor++;
        }
        el.setSelectionRange(cursor, cursor);
    });
});

// =================================================================
// 2. LOGICĂ PENTRU CĂUTAREA DINAMICĂ (HOME.EJS)
// =================================================================
const searchInput = document.getElementById('plate-search');
const resultsList = document.getElementById('search-results');
const clearBtn = document.getElementById('clear-search');

if (searchInput && clearBtn) {
    clearBtn.addEventListener('click', () => { 
        searchInput.value = ''; 
        resultsList.innerHTML = ''; 
        resultsList.classList.remove('show');
        // Resetăm și grid-ul de mașini dacă există
        document.querySelectorAll('.car-item').forEach(item => item.style.display = 'block');
    });

    searchInput.addEventListener('input', async () => {
        // Trimitem la server varianta fără spațiu pentru compatibilitate maximă
        const query = searchInput.value.replace(/\s/g, '').trim();
        
        if (query.length < 2) { 
            resultsList.innerHTML = ''; 
            resultsList.classList.remove('show');
            return; 
        }
        
        try {
            const res = await fetch(`/api/search?plate=${query}`);
            const cars = await res.json();
            
            if (cars.length > 0) {
                resultsList.innerHTML = cars.map(car => `
                    <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2">
                        <div class="d-flex flex-column align-items-center me-3">
                            <img src="/img/drapel-md.png" alt="MD" style="width: 20px;">
                            <span class="fw-bold text-dark" style="font-size: 0.7em;">MD</span>
                        </div>
                        <div class="flex-grow-1">
                            <div class="fw-bold text-primary">${car.plateNumber}</div>
                            <small class="text-muted">${car.make} ${car.model}</small>
                        </div>
                        <a href="/car/${car._id}" class="text-primary fs-5 text-decoration-none">
                            <i class="bi bi-chevron-right"></i>
                        </a>
                    </li>
                `).join('');
                resultsList.classList.add('show');
            } else {
                resultsList.innerHTML = '<li class="list-group-item text-muted text-center">Nicio mașină găsită</li>';
                resultsList.classList.add('show');
            }
        } catch (err) {
            console.error("Eroare la căutare:", err);
        }
    });
}