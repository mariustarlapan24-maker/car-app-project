// --- IMPORTURI NECESARE ---
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fetch = require('node-fetch'); 
const { URLSearchParams } = require('url'); 
const MongoDBStore = require('connect-mongodb-session')(session);
 
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// =================================================================
// 1. CONFIGURARE ȘI VARIABILE DE MEDIU
// =================================================================

const PORT = process.env.PORT || 3000;
const DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/carAppDB';
const SESSION_SECRET = process.env.SESSION_SECRET || 'CHIE_SECRETA_SUPER_COMPLEXA_2025';

const IK_URL_ENDPOINT = 'https://upload.imagekit.io'; 
const IK_SECRET = process.env.IMAGEKIT_PRIVATE_KEY; 
const IK_PUBLIC = process.env.IMAGEKIT_PUBLIC_KEY; 

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
 
// --- CONEXIUNE LA MONGODB ATLAS ---
mongoose.connect(DB_URI)
  .then(()=> console.log('✅ Conectat la MongoDB Atlas!'))
  .catch(err => console.error('❌ Eroare conectare la bază de date:', err));
 
// --- CONFIGURARE MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
 
// --- SESIUNI PERSISTENTE ---
const store = new MongoDBStore({
    uri: DB_URI,
    collection: 'sessions',
});
 
app.use(session({
    secret: SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } 
}));
 
// --- MIDDLEWARE UTILIZATOR ---
app.use((req, res, next)=> {
    res.locals.isLoggedIn = !!req.session.userId;
    res.locals.isGuest = !!req.session.isGuest && !req.session.userId;
    res.locals.userId = req.session.userId || null;
    next();
});
 
// ==========================================================
// --- MODELE (SCHEMAS) ---
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, default: '' },
    cars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Car' }]
});
const User = mongoose.model('User', userSchema);
 
const carSchema = new mongoose.Schema({
    plateNumber: { type: String, required: true, unique: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    imageUrls: [{ type: String, required: true }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedDate: { type: Date, default: Date.now }
});
const Car = mongoose.model('Car', carSchema);
 
// ==========================================================
// --- RUTE GET & AUTH ---

app.get('/', async (req, res) => {
    try {
        const cars = await Car.find({}); 
        res.render('home', { 
            title: 'Car-App - Acasă',
            cars: cars 
        });
    } catch (err) {
        console.error("Eroare home:", err);
        res.render('home', { title: 'Car-App - Acasă', cars: [] });
    }
});

// --- RUTA NOUĂ: DETALII MAȘINĂ ---
app.get('/car/:id', async (req, res) => {
    try {
        const carId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).send("ID invalid.");
        }

        const car = await Car.findById(carId).populate('owner');
        if (!car) return res.status(404).send("Mașina nu a fost găsită.");

        // Verificăm dacă vizitatorul este proprietarul mașinii
        const isOwner = req.session.userId && car.owner && req.session.userId.toString() === car.owner._id.toString();

        res.render('car-details', { 
            car: car, 
            isOwner: isOwner, 
            title: 'Detalii Mașină' 
        });
    } catch (err) {
        console.error("Eroare la detalii:", err);
        res.status(500).send("Eroare server.");
    }
});

app.get('/login', (req, res)=> {
    res.render('login', { title: 'Login Car-App', error: null });
});

app.get('/register', (req, res)=> {
    res.render('register', { title: 'Creează Cont', error: null });
});

app.get('/add-car', (req, res)=> {
    if (!req.session.userId) return res.redirect('/login');
    res.render('add-car', { title: 'Adaugă mașină', error: null });
});

app.get('/profile', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId).populate('cars');
        res.render('profile', { title: 'Profilul Meu', user: user, cars: user.cars });
    } catch (err) {
        console.error("Eroare la profil:", err);
        res.redirect('/');
    }
});

app.get('/chat', (req, res)=> {
    if (!req.session.userId) return res.redirect('/login');
    res.render('chat', {
        title: 'Chat',
        userId: req.session.userId,
        username: 'User_' + req.session.userId.substring(0, 4),
        roomId: 'defaultCarRoom'
    });
});

app.get('/api/search', async (req, res) => {
    const { plate } = req.query;
    if (!plate) return res.json([]);
    try {
        const cars = await Car.find({
            plateNumber: { $regex: '^' + plate, $options: 'i' }
        }).limit(10).select('plateNumber make model');
        res.json(cars);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/register', async (req, res) => {
    const { fullName, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) return res.render('register', { error: 'Parolele nu se potrivesc.', title: 'Creează Cont' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ fullName, email, password: hashedPassword });
        await newUser.save();
        req.session.userId = newUser._id;
        res.redirect('/');
    } catch (error) {
        if (error.code === 11000) return res.render('register', { error: 'Acest email este deja înregistrat.', title: 'Creează Cont' });
        res.render('register', { error: 'A apărut o eroare la înregistrare.', title: 'Creează Cont' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { error: 'Email sau parolă incorectă.', email, title: 'Login Car-App' });
        }
        req.session.userId = user._id;
        req.session.isGuest = false;
        res.redirect('/');
    } catch (error) {
        console.error("Eroare la login:", error);
        res.render('login', { error: 'A apărut o eroare de server.', title: 'Login Car-App' });
    }
});

app.post('/guest-login', (req, res) => {
    req.session.userId = null;
    req.session.isGuest = true;
    res.redirect('/');
});

app.post('/logout', (req, res) => {
    req.session.destroy(()=> {
        res.redirect('/');
    });
});
 
app.post('/add-car', upload.single('carImage'), async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { plateNumber, make, model } = req.body;
    const file = req.file;
    if (!file) return res.render('add-car', { title: 'Adaugă mașină', error: 'Vă rugăm să încărcați o imagine.' });
    try {
        const base64File = file.buffer.toString('base64');
        const auth = Buffer.from(IK_SECRET + ":").toString("base64");
        const formData = new URLSearchParams();
        formData.append('file', base64File);
        formData.append('fileName', `${Date.now()}-${file.originalname}`);
        formData.append('folder', 'car-app-uploads');
        const uploadResponse = await fetch(`${IK_URL_ENDPOINT}/api/v1/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`, 
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });
        const result = await uploadResponse.json();
        const imageUrl = result.url; 
        const newCar = new Car({
            plateNumber: plateNumber.toUpperCase().trim(),
            make,
            model,
            imageUrls: [imageUrl],
            owner: req.session.userId
        });
        await newCar.save();
        await User.findByIdAndUpdate(req.session.userId, { $push: { cars: newCar._id } });
        res.redirect('/profile');
    } catch (error) {
        res.render('add-car', { title: 'Adaugă mașină', error: 'Eroare la salvare.' });
    }
});
 
io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => socket.join(roomId));
    socket.on('chatMessage', (data) => {
        io.to(data.roomId).emit('message', {
            text: data.message,
            sender: data.senderName,
            time: new Date().toLocaleTimeString('ro-RO')
        });
    });
});
 
server.listen(PORT, () => {
    console.log(`🚀 Server activ la: http://localhost:${PORT}`);
});