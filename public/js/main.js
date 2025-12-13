const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const app = express();

// 1. CONECTARE MONGODB
mongoose.connect('mongodb://127.0.0.1:27017/nume_baza_ta')
    .then(() => console.log('Baza de date conectata!'))
    .catch(err => console.error('Eroare DB:', err));

// 2. MODEL MAȘINĂ (Limitat la 6 caractere)
const carSchema = new mongoose.Schema({
    plateNumber: { type: String, required: true, uppercase: true, minlength: 6, maxlength: 6 },
    make: String,
    model: String,
    imageUrls: [String]
});
const Car = mongoose.model('Car', carSchema);

// 3. CONFIGURĂRI
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 4. RUTE
app.get('/', async (req, res) => {
    const cars = await Car.find();
    res.render('home', { cars, success: req.query.success });
});

app.get('/add-car', (req, res) => res.render('add-car', { error: null }));

app.post('/add-car', upload.array('carImage', 3), async (req, res) => {
    try {
        let { plateNumber, make, model } = req.body;
        let cleanPlate = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (cleanPlate.length !== 6) {
            return res.render('add-car', { error: 'Numărul trebuie să aibă exact 6 caractere!' });
        }

        const newCar = new Car({
            plateNumber: cleanPlate,
            make, model,
            imageUrls: req.files.map(f => `/uploads/${f.filename}`)
        });
        await newCar.save();
        res.redirect('/?success=1');
    } catch (err) {
        res.render('add-car', { error: 'Eroare la salvare!' });
    }
});

app.get('/api/search', async (req, res) => {
    const q = (req.query.plate || '').toUpperCase().replace(/\s/g, '');
    const cars = await Car.find({ plateNumber: { $regex: q, $options: 'i' } }).limit(5);
    res.json(cars);
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));