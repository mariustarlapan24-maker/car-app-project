// public/script.js

const API_URL = 'http://localhost:3000/api';

// --- 1. ÎNREGISTRARE ---
async function registerUser() {
    // Colectăm datele din formular
    const data = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        carModel: document.getElementById('carModel').value,
        carPlate: document.getElementById('carPlate').value,
        imageUrl: document.getElementById('imageUrl').value,
        country: document.getElementById('country').value,
        status: document.getElementById('status').value,
        description: document.getElementById('description').value,
        contactMethod: document.getElementById('contactMethod').value,
        contactPhone: document.getElementById('contactPhone').value || "",
        
        // Date opționale
        year: document.getElementById('year').value || null,
        mileage: document.getElementById('mileage').value || null,
        fuelType: document.getElementById('fuelType').value || "",
        color: document.getElementById('color').value || ""
    };

    // Trimitem la server
    const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (result.carId) {
        alert('Înregistrare reușită! Acum poți vedea profilul.');
        // Salvăm ID-ul în browser ca să știm cine suntem (cheia de autentificare)
        localStorage.setItem('myCarId', result.carId);
        window.location.href = 'profile.html?id=' + result.carId; // Mergem la profilul nou creat
    } else {
        alert('Eroare: ' + (result.error || 'A apărut o eroare necunoscută.'));
    }
}

// --- 2. AFIȘARE MAȘINI (HOME) ---
async function loadCars() {
    const response = await fetch(`${API_URL}/cars`);
    const cars = await response.json();
    
    const feed = document.getElementById('feed');
    feed.innerHTML = '';

    if (cars.length === 0) {
        feed.innerHTML = '<p style="text-align: center;">Nu există mașini înregistrate. Fii primul!</p>';
        return;
    }

    cars.forEach(car => {
        feed.innerHTML += `
            <div class="car-card">
                <img src="${car.imageUrl}" alt="Car">
                <div class="car-info">
                    <h3>${car.carModel} <span class="status-badge">${car.status.replace('_', ' ')}</span></h3>
                    <p><strong>Deținut de:</strong> ${car.email}</p>
                    <p><strong>Țara:</strong> ${car.country}</p>
                    <p>${car.description.substring(0, 50)}...</p>
                    <button onclick="window.location.href='profile.html?id=${car._id}'">Vezi Detalii</button>
                </div>
            </div>
        `;
    });
}

// --- 3. AFIȘARE DETALII MAȘINĂ (PROFILE) ---
async function loadCarDetails(id) {
    const response = await fetch(`${API_URL}/cars/${id}`);
    const car = await response.json();
    
    const container = document.getElementById('profileContainer');
    if (!car || car.error) {
         container.innerHTML = `<p style="text-align: center;">Eroare la încărcarea profilului: Mașina nu a fost găsită.</p>`;
         return;
    }

    let detailsHtml = `
        <div class="car-card">
            <img src="${car.imageUrl}" alt="Car Photo">
            <div class="car-info">
                <h2>${car.carModel}</h2>
                <p><strong>Proprietar:</strong> ${car.email}</p>
                <p><strong>Număr:</strong> ${car.carPlate}</p>
                <span class="status-badge">${car.status.replace('_', ' ')}</span>
                <p><strong>Descriere:</strong> ${car.description || 'Nicio descriere adăugată.'}</p>
                
                <hr>
                <h4>Car Information</h4>
                <p><strong>Country:</strong> ${car.country}</p>
                <p><strong>Added:</strong> ${new Date(car.addedDate).toLocaleDateString()}</p>
    `;

    // Dacă NU este de vânzare, arătăm detaliile tehnice, conform cerinței
    if (car.status === 'NOT_FOR_SALE') {
        detailsHtml += `
            <p><strong>Year:</strong> ${car.year || 'N/A'}</p>
            <p><strong>Mileage:</strong> ${car.mileage ? car.mileage + ' km' : 'N/A'}</p>
            <p><strong>Fuel:</strong> ${car.fuelType || 'N/A'}</p>
            <p><strong>Color:</strong> ${car.color || 'N/A'}</p>
        `;
    }

    detailsHtml += `</div></div>`;

    // PANOU CONTACT
    detailsHtml += `<div style="margin-top:20px">
        <h3>Contact Owner</h3>
        <div class="contact-section">
    `;

    if (car.contactMethod === 'Chat' || car.contactMethod === 'Both') {
        detailsHtml += `<button onclick="window.location.href='mailto:${car.email}'">📧 Chat (Email)</button>`;
    }
    if (car.contactMethod === 'Call' || car.contactMethod === 'Both') {
        detailsHtml += `<button class="secondary" onclick="window.location.href='tel:${car.contactPhone}'">📞 Call (${car.contactPhone || 'Număr Ascuns'})</button>`;
    }

    detailsHtml += `</div></div>`;
    
    container.innerHTML = detailsHtml;
}

// Functie pentru navigare la profilul propriu
function goToProfile() {
    const myId = localStorage.getItem('myCarId');
    if (myId) {
        window.location.href = 'profile.html?id=' + myId;
    } else {
        alert("Nu ești înregistrat. Te rugăm să îți adaugi mașina.");
        window.location.href = 'register.html';
    }
}