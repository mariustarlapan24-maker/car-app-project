// =================================================================
// 1. LOGICĂ UNICĂ: FORMAT PLĂCI MD AUTOMAT (Cerința 1.2 & 5.2)
// =================================================================

document.querySelectorAll('input[name="plateNumber"]').forEach(input => {
    input.addEventListener('input', e => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        let formattedValue = '';
        
        // Extrage blocurile Litere și Cifre
        let letters = value.match(/[A-Z]{0,3}/);
        let numbers = value.match(/[0-9]{0,3}/);
        
        letters = letters ? letters[0] : '';
        numbers = numbers ? numbers[0] : '';

        // Aplică formatul LLL[SPAȚIU]NNN
        if (letters.length > 0) {
            formattedValue = letters;
            if (numbers.length > 0) {
                formattedValue += ' ' + numbers;
            }
        } else {
            formattedValue = numbers;
        }

        e.target.value = formattedValue.trim();
    });
});


// =================================================================
// 2. LOGICĂ PENTRU CĂUTAREA DINAMICĂ (HOME.EJS - Cerința 1.3)
// =================================================================

const searchInput = document.getElementById('plate-search');
const resultsList = document.getElementById('search-results');
const clearBtn = document.getElementById('clear-search');

if(searchInput && clearBtn){
    // Funcție Clear
    clearBtn.addEventListener('click', () => { 
        searchInput.value=''; 
        resultsList.innerHTML=''; 
        resultsList.classList.remove('show');
    });
    
    // Funcție Căutare Dinamică
    searchInput.addEventListener('input', async () => {
        const query = searchInput.value.toUpperCase().replace(/\s/g, '').trim();
        
        if(query.length < 2) { 
            resultsList.innerHTML=''; 
            resultsList.classList.remove('show');
            return; 
        }
        
        const res = await fetch(`/api/search?plate=${query}`);
        const cars = await res.json();
        
        if(cars.length) {
             resultsList.innerHTML = cars.map(car => `
                <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2">
                    <div class="d-flex flex-column align-items-center me-3">
                        <img src="/images/drapel-md.png" alt="MD" style="width: 20px;">
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
            // Caz Negativ (Cerința 1.3)
            resultsList.innerHTML = '<li class="list-group-item text-muted text-center">Nicio mașină găsită</li>';
            resultsList.classList.add('show');
        }
    });
}