const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// ==========================================
// 1. CONECTARE MONGODB
// ==========================================
mongoose.connect('mongodb://127.0.0.1:27017/car_db')
    .then(() => console.log('Conectat la MongoDB!'))
    .catch(err => console.error('Eroare conectare DB:', err));

// ==========================================
// 2. MODEL BAZĂ DE DATE
// ==========================================
const carSchema = new mongoose.Schema({
    plateNumber: { type: String, required: true, uppercase: true },
    make: String,
    model: String,
    year: Number,
    owner: String,
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

// Pagina principală
app.get('/', async (req, res) => {
    try {
        const cars = await Car.find().sort({ createdAt: -1 });
        res.render('home', { cars });
    } catch (err) {
        res.status(500).send("Eroare la încărcare");
    }
});

// API CĂUTARE DINAMICĂ (FOARTE IMPORTANT PENTRU BARA DE CĂUTARE)
app.get('/api/search', async (req, res) => {
    try {
        // Curățăm inputul (eliminăm spațiile: "ABC 12" -> "ABC12")
        let q = (req.query.plate || '').toUpperCase().replace(/\s/g, '');

        if (q.length < 2) return res.json([]);

        // Separăm literele de cifre pentru a permite un spațiu opțional (\s?)
        let letters = q.substring(0, 3);
        let numbers = q.substring(3);
        
        // Regex care caută "ABC 123" chiar dacă tu scrii "ABC123"
        let regex = new RegExp(`^${letters}\\s?${numbers}`, 'i');

        const cars = await Car.find({ plateNumber: regex }).limit(5);
        res.json(cars);
    } catch (err) {
        res.status(500).json([]);
    }
});

// Adăugare mașină nouă
app.post('/add-car', async (req, res) => {
    try {
        const newCar = new Car(req.body);
        await newCar.save();
        res.redirect('/');
    } catch (err) {
        res.status(500).send("Eroare la salvare");
    }
});

// Pagina detaliată a mașinii
app.get('/car/:id', async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.status(404).send("Mașina nu a fost găsită");
        res.render('car-details', { car });
    } catch (err) {
        res.status(500).send("Eroare");
    }
});

// ==========================================
// 5. PORNIRE SERVER
// ==========================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
});