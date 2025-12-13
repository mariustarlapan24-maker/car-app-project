const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// ==========================================
// 1. CONECTARE MONGODB
// ==========================================
mongoose.connect('mongodb://127.0.0.1:27017/car_db')
    .then(() => console.log('✅ Conectat la MongoDB!'))
    .catch(err => console.error('❌ Eroare conectare DB:', err));

// ==========================================
// 2. MODEL BAZĂ DE DATE
// ==========================================
const carSchema = new mongoose.Schema({
    plateNumber: { type: String, required: true, uppercase: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: Number,
    owner: { type: String, default: "Proprietar Anonim" },
    // Imaginea este acum obligatorie (minim un element în array)
    imageUrls: { 
        type: [String], 
        required: true,
        validate: [v => Array.isArray(v) && v.length > 0, "Imaginea este obligatorie!"]
    },
    createdAt: { type: Date, default: Date.now }
});

const Car = mongoose.model('Car', carSchema);

// ==========================================
// 3. CONFIGURĂRI EXPRESS
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ==========================================
// 4. RUTE (LOGICA SITE-ULUI)
// ==========================================

// --- Pagina principală ---
app.get('/', async (req, res) => {
    try {
        const cars = await Car.find().sort({ createdAt: -1 });
        res.render('home', { 
            cars: cars, 
            title: 'Acasă', 
            isLoggedIn: false // Setează true dacă ai sistem de login
        });
    } catch (err) {
        res.status(500).send("Eroare la încărcare date.");
    }
});

// --- API Căutare Dinamică ---
app.get('/api/search', async (req, res) => {
    try {
        let q = (req.query.plate || '').toUpperCase().replace(/\s/g, '');
        if (q.length < 2) return res.json([]);

        let letters = q.substring(0, 3);
        let numbers = q.substring(3);
        let regex = new RegExp(`^${letters}\\s?${numbers}`, 'i');

        const cars = await Car.find({ plateNumber: regex }).limit(5);
        res.json(cars);
    } catch (err) {
        res.status(500).json([]);
    }
});

// --- Pagina Detalii Mașină (Corectată pentru eroarea Cannot GET) ---
app.get('/car/:id', async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        
        if (!car) {
            return res.status(404).send("Automobilul nu a fost găsit în baza de date.");
        }

        // Simulăm starea utilizatorului (va fi înlocuită de logică de login reală)
        const currentUserId = null; 

        res.render('car-details', { 
            car: car, 
            title: 'Detalii Mașină',
            isLoggedIn: false,
            isOwner: false,    // Modifică aici dacă ai ID-ul userului logat
            isGuest: true,     // Dacă nu e logat, e Guest
            ownerId: car.owner 
        });
    } catch (err) {
        console.error("Eroare la încărcarea paginii /car/:id :", err);
        res.status(500).send("Eroare de server la procesarea cererii.");
    }
});

// --- Adăugare Mașină Nouă (Cu validare de imagine) ---
app.post('/add-car', async (req, res) => {
    try {
        const { plateNumber, make, model, imageUrls } = req.body;

        // Verificăm dacă link-ul imaginii a fost trimis
        if (!imageUrls || imageUrls === "") {
            return res.status(400).send("Eroare: Imaginea este obligatorie!");
        }

        const newCar = new Car({
            plateNumber,
            make,
            model,
            imageUrls: [imageUrls], // Punem URL-ul într-un array conform schemei
            owner: "User_Test"      // De înlocuit cu ID-ul userului logat
        });

        await newCar.save();
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send("Eroare la salvare. Verificați dacă toate câmpurile sunt corecte.");
    }
});

// ==========================================
// 5. PORNIRE SERVER
// ==========================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serverul rulează pe http://localhost:${PORT}`);
});