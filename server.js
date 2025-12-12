// === IMPORTURI NECESARE ===
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

// === CONFIG SERVER & SOCKET.IO ===
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// === CHEI IMAGEKIT (din Render) ===
const IK_URL_ENDPOINT = 'https://upload.imagekit.io';
const IK_SECRET = process.env.IMAGEKIT_PRIVATE_KEY;
const IK_PUBLIC = process.env.IMAGEKIT_PUBLIC_KEY;

// === MULTER MEMORY STORAGE ===
const storage = multer.memoryStorage();
const upload = multer({ storage });

// === CONEXIUNE MONGODB ===
const DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/carAppDB';
mongoose.connect(DB_URI)
    .then(() => console.log('✅ Conectat la MongoDB Atlas!'))
    .catch(err => console.error('❌ Eroare conectare la baza de date:', err));

// === MIDDLEWARE ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// EJS și fișiere statice
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// SESIUNI
const store = new MongoDBStore({ uri: DB_URI, collection: 'sessions' });
app.use(session({
    secret: 'CHIE_SECRETA_SUPER_COMPLEXA_2025',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// UTILIZATOR GLOBAL
app.use((req, res, next) => {
    res.locals.isLoggedIn = !!req.session.userId;
    res.locals.isGuest = !!req.session.isGuest && !req.session.userId;
    next();
});

// === MODELE ===
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
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

// === RUTE ===
// --- Pagina Acasă ---
app.get('/', async (req, res) => {
    const cars = await Car.find().sort({ addedDate: -1 });
    res.render('home', { title: 'Car-App - Acasă', cars });
});

// --- Login / Register ---
app.get('/login', (req, res) => res.render('login', { title: 'Login Car-App', error: null }));
app.get('/register', (req, res) => res.render('register', { title: 'Creează Cont', error: null }));

// --- Adaugă Mașină ---
app.get('/add-car', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('add-car', { title: 'Adaugă mașină', error: null });
});

// --- Profil ---
app.get('/profile', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId).populate('cars');
        res.render('profile', { title: 'Garajul Meu', cars: user.cars });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// --- Chat ---
app.get('/chat', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('chat', {
        title: 'Chat',
        userId: req.session.userId,
        username: 'User_' + req.session.userId.substring(0, 4),
        roomId: 'defaultCarRoom'
    });
});

// --- Căutare API ---
app.get('/api/search', async (req, res) => {
    const { plate } = req.query;
    if (!plate) return res.json([]);
    const cars = await Car.find({ plateNumber: { $regex: '^' + plate, $options: 'i' } })
        .limit(10).select('plateNumber make model');
    res.json(cars);
});

// --- POST REGISTER ---
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

// --- POST LOGIN ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { error: 'Email sau parolă incorectă.', title: 'Login Car-App' });
        }
        req.session.userId = user._id;
        req.session.isGuest = false;
        res.redirect('/');
    } catch (err) {
        res.render('login', { error: 'Eroare server.', title: 'Login Car-App' });
    }
});

// --- POST GUEST LOGIN ---
app.post('/guest-login', (req, res) => {
    req.session.userId = null;
    req.session.isGuest = true;
    res.redirect('/');
});

// --- POST LOGOUT ---
app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// === POST ADD CAR (ImageKit Direct) ===
app.post('/add-car', upload.single('carImage'), async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { plateNumber, make, model } = req.body;
    const file = req.file;
    if (!file) return res.render('add-car', { error: 'Vă rugăm să încărcați o imagine.', title: 'Adaugă mașină' });

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
        if (!uploadResponse.ok) throw new Error(result.message || 'Eroare la încărcarea imaginii.');

        const newCar = new Car({
            plateNumber: plateNumber.toUpperCase().trim(),
            make,
            model,
            imageUrls: [result.url],
            owner: req.session.userId
        });

        await newCar.save();
        await User.findByIdAndUpdate(req.session.userId, { $push: { cars: newCar._id } });
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.render('add-car', { error: 'A apărut o eroare la salvare.', title: 'Adaugă mașină' });
    }
});

// === SOCKET.IO CHAT ===
io.on('connection', (socket) => {
    socket.on('joinRoom', roomId => socket.join(roomId));
    socket.on('chatMessage', data => {
        io.to(data.roomId).emit('message', {
            text: data.message,
            sender: data.senderName,
            time: new Date().toLocaleTimeString('ro-RO')
        });
    });
});

// === START SERVER ===
server.listen(PORT, () => console.log(`Server rulând pe port ${PORT}`));
