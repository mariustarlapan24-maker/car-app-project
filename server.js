// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
// Permite accesul la folderul 'public' (Frontend-ul)
app.use(express.static('public')); 

// 1. CONECTARE LA BAZA DE DATE (MongoDB Local - asigură-te că e pornit)
// 1. CONECTARE LA BAZA DE DATE (Ignorăm erorile pentru a menține serverul Express activ)
const DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/carAppDB';

mongoose.connect(DB_URI)
  .then(() => console.log('✅ Conectat la MongoDB Atlas!'))
  .catch(err => console.error('❌ Eroare conectare la bază de date:', err));

// 2. CREAREA SCHEMEI (Cum arată datele unei mașini)
const CarSchema = new mongoose.Schema({
    // Date Autentificare
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // Date Generale Mașină
    carPlate: String,
    carModel: String,
    country: String,
    imageUrl: String, // Link către poză (URL)
    status: { type: String, enum: ['FOR_SALE', 'NOT_FOR_SALE'] },
    description: String,

    // Date Specifice (vizibile doar la NOT_FOR_SALE)
    year: Number,
    mileage: Number,
    fuelType: String,
    color: String,
    
    // Date Contact (setate de proprietar)
    contactMethod: { type: String, enum: ['Chat', 'Call', 'Both'] },
    contactPhone: String, // Folosit doar dacă e Call sau Both
    
    addedDate: { type: Date, default: Date.now }
});

const Car = mongoose.model('Car', CarSchema);

// 3. RUTELE (API-ul)

// POST /api/register: Înregistrare Mașină și Utilizator
app.post('/api/register', async (req, res) => {
    try {
        const newCar = new Car(req.body);
        await newCar.save();
        // Trimitem ID-ul înapoi pentru a-l memora în browser (localStorage)
        res.json({ message: 'Succes!', carId: newCar._id }); 
    } catch (error) {
        res.status(500).json({ error: 'Eroare la înregistrare. Email-ul poate exista deja.' });
    }
});

// GET /api/cars: Ia toate mașinile (pentru Home Page)
app.get('/api/cars', async (req, res) => {
    try {
        const cars = await Car.find().sort({ addedDate: -1 });
        res.json(cars);
    } catch (error) {
        res.status(500).json({ error: 'Eroare la preluarea mașinilor.' });
    }
});

// GET /api/cars/:id: Ia o singură mașină (pentru Profile Page)
app.get('/api/cars/:id', async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) {
            return res.status(404).json({ error: 'Mașina nu a fost găsită.' });
        }
        res.json(car);
    } catch (error) {
        res.status(500).json({ error: 'Eroare la preluarea mașinii.' });
    }
});


// 4. PORNIT SERVER
const PORT = process.env.PORT || 3000; // Ia portul dat de platforma de hosting, sau 3000 local
app.listen(PORT, () => {
    console.log(`🚀 Serverul rulează la http://localhost:${PORT}`);
});