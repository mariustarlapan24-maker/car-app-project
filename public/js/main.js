require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const ImageKit = require('imagekit');
const session = require('express-session'); // Adăugat pentru SESSION_SECRET

const app = express();

// ==========================================
// 1. CONFIGURARE IMAGEKIT.IO (Folosind ID-ul tău)
// ==========================================
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: `https://ik.imagekit.io/${process.env.IMAGEKIT_ID}/` 
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// 2. SESIUNE ȘI SECURITATE
// ==========================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-cheie-temporara',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Pune true dacă folosești HTTPS/SSL
}));

// ==========================================
// 3. CONECTARE BAZĂ DE DATE
// ==========================================
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/car_db';
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Conectat la baza de date!'))
    .catch(err => console.error('❌ Eroare DB:', err));

// ==========================================
// 4. MODELE BAZĂ DE DATE
// ==========================================
const carSchema = new mongoose.Schema({
    plateNumber: { type: String, required: true, uppercase: true },
    make: String,
    model: String,
    ownerEmail: String,
    imageUrls: [String],
    createdAt: { type: Date, default: Date.now }
});
const Car = mongoose.model('Car', carSchema);

const messageSchema = new mongoose.Schema({
    senderEmail: String,
    receiverEmail: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// ==========================================
// 5. CONFIGURĂRI EXPRESS
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware pentru a trimite variabilele globale către EJS
app.use((req, res, next) => {
    res.locals.isGuest = !req.session.user; // Exemplu de logică pentru isGuest
    res.locals.title = "Car-App";
    next();
});

// ==========================================
// 6. RUTE SITE
// ==========================================

app.get('/', async (req, res) => {
    try {
        const cars = await Car.find().sort({ createdAt: -1 });
        res.render('home', { cars, title: 'Acasă' });
    } catch (err) {
        res.status(500).send("Eroare la încărcare");
    }
});

app.get('/add-car', (req, res) => {
    res.render('add-car', { title: 'Adaugă Mașină' });
});

app.post('/add-car', upload.array('carImage', 3), async (req, res) => {
    try {
        const uploadedImages = [];
        for (const file of req.files) {
            const response = await imagekit.upload({
                file: file.buffer,
                fileName: `car-${Date.now()}.jpg`,
                folder: "/masini"
            });
            uploadedImages.push(response.url);
        }

        const newCar = new Car({
            plateNumber: req.body.plateNumber,
            make: req.body.make,
            model: req.body.model,
            ownerEmail: req.body.ownerEmail,
            imageUrls: uploadedImages
        });

        await newCar.save();
        res.redirect('/?success=true');
    } catch (err) {
        res.render('add-car', { error: "Eroare la upload.", title: 'Adaugă Mașină' });
    }
});

app.get('/car/:id', async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.status(404).send("Mașina nu există.");
        res.render('car-details', { 
            car, 
            isOwner: false, 
            title: 'Detalii Mașină' 
        });
    } catch (err) {
        res.status(500).send("Eroare server.");
    }
});

app.get('/chat/private/:receiverEmail', async (req, res) => {
    try {
        const receiverEmail = req.params.receiverEmail;
        const messages = await Message.find({
            $or: [
                { senderEmail: 'utilizator@test.com', receiverEmail: receiverEmail },
                { senderEmail: receiverEmail, receiverEmail: 'utilizator@test.com' }
            ]
        }).sort({ createdAt: 1 });

        res.render('chat-private', { receiverEmail, messages, title: 'Chat' });
    } catch (err) {
        res.status(500).send("Eroare chat.");
    }
});

app.get('/api/search', async (req, res) => {
    let q = (req.query.plate || '').toUpperCase().replace(/\s/g, '');
    if (q.length < 2) return res.json([]);
    let regex = new RegExp(`^${q.substring(0,3)}\\s?${q.substring(3)}`, 'i');
    const cars = await Car.find({ plateNumber: regex }).limit(5);
    res.json(cars);
});

// ==========================================
// 7. PORNIRE SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server activ pe portul ${PORT}`));