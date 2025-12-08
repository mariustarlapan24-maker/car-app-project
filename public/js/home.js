document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('plateSearchInput');
    const searchResults = document.getElementById('searchResults');
    const clearBtn = document.getElementById('clearSearch');

    let timeout = null;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();

        if (query.length === 0) {
            searchResults.innerHTML = '';
            clearBtn.style.display = 'none';
            return;
        }

        clearBtn.style.display = 'inline-block';

        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?plate=${query}`);
                const cars = await res.json();

                searchResults.innerHTML = '';
                if (cars.length === 0) {
                    searchResults.innerHTML = `<div class="list-group-item">Nu s-au găsit rezultate.</div>`;
                    return;
                }

                cars.forEach(car => {
                    const item = document.createElement('div');
                    item.classList.add('list-group-item');
                    item.textContent = `${car.plateNumber} - ${car.make} ${car.model}`;
                    searchResults.appendChild(item);
                });
            } catch (error) {
                console.error('Eroare la căutare:', error);
            }
        }, 300);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchResults.innerHTML = '';
        clearBtn.style.display = 'none';
    });
});
