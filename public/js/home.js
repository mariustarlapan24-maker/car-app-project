// --- FORMAT PLĂCI MD AUTOMAT (Input Add Car și orice alt input cu name="plateNumber") ---
document.querySelectorAll('input[name="plateNumber"]').forEach(input => {
    input.addEventListener('input', e => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
        let letters = value.match(/[A-Z]{0,3}/);
        let numbers = value.match(/[0-9]{0,3}/);
        letters = letters ? letters[0] : '';
        numbers = numbers ? numbers[0] : '';
        e.target.value = numbers ? letters + ' ' + numbers : letters;
    });
});

// --- UPDATE MODEL DIN MARCA (Add Car) ---
const makeSelect = document.querySelector('select[name="make"]');
const modelSelect = document.querySelector('select[name="model"]');

const modelsData = {
    "Audi": ["A3","A4","A6","Q5"],
    "BMW": ["X1","X3","X5","M3"],
    "Mercedes": ["C200","E300","S500"],
    "Volkswagen": ["Golf","Passat","Tiguan"]
};

if(makeSelect && modelSelect){
    makeSelect.addEventListener('change', () => {
        modelSelect.innerHTML = '<option value="">Selectează modelul…</option>';
        const models = modelsData[makeSelect.value] || [];
        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.text = m;
            modelSelect.add(option);
        });
    });
}

// --- SEARCH BAR CU CLEAR BUTTON ---
const searchInput = document.getElementById('plateSearchInput');
const clearBtn = document.getElementById('clearSearch');
const resultsList = document.getElementById('searchResults');

if(searchInput && clearBtn && resultsList){
    // Clear button
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        resultsList.innerHTML = '';
        clearBtn.style.display = 'none';
    });

    // Input search
    searchInput.addEventListener('input', async () => {
        const query = searchInput.value.toUpperCase();
        if(!query) {
            resultsList.innerHTML = '';
            clearBtn.style.display = 'none';
            return;
        }
        clearBtn.style.display = 'inline-block';
        try {
            const res = await fetch(`/api/search?plate=${query}`);
            const cars = await res.json();

            resultsList.innerHTML = cars.length ? cars.map(car => `
                <div class="list-group-item d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <div class="me-2 text-center">
                            <img src="/img/drapel-md.png" alt="MD" style="height:20px;"><br>
                            MD
                        </div>
                        <div>
                            <div><strong>${car.plateNumber}</strong></div>
                            <div>${car.make} ${car.model}</div>
                        </div>
                    </div>
                    <div>
                        <a href="/car/${car._id}" class="btn btn-sm btn-outline-primary">></a>
                    </div>
                </div>
            `).join('') : `<div class="list-group-item text-muted">Nicio mașină găsită</div>`;
        } catch(err){
            console.error('Eroare la căutare:', err);
            resultsList.innerHTML = `<div class="list-group-item text-danger">Eroare la căutare</div>`;
        }
    });
}
