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
// Variabila esențială pentru criptarea sesiunilor
const SESSION_SECRET = process.env.SESSION_SECRET || 'CHIE_SECRETA_SUPER_COMPLEXA_2025';

// --- DATE ESENȚIALE PENTRU UPLOAD DIRECT HTTP ---
const IK_URL_ENDPOINT = 'https://upload.imagekit.io'; 
const IK_SECRET = process.env.IMAGEKIT_PRIVATE_KEY; 
const IK_PUBLIC = process.env.IMAGEKIT_PUBLIC_KEY; 

// --- BAZA DE DATE MASINI (MUTATĂ AICI PENTRU A FI GLOBALĂ) ---
const carDatabase = {
    "Dacia": ["Logan", "Duster", "Sandero", "Lodgy", "Dokker", "Spring", "Solenza"],
    "Skoda": ["Octavia", "Superb", "Fabia", "Kodiaq", "Karoq", "Rapid", "Scala"],
    "Toyota": ["Corolla", "Camry", "RAV4", "Prius", "Aurion", "Yaris", "Land Cruiser", "Hilux", "C-HR", "Avensis"],
    "Volkswagen": ["Golf", "Passat", "Tiguan", "Touareg", "Jetta", "Polo", "Transporter", "Caddy", "Arteon", "Sharan", "Touran"],
    "BMW": ["Seria 1", "Seria 3", "Seria 5", "Seria 7", "X1", "X3", "X5", "X6", "X7", "M3", "M5"],
    "Mercedes-Benz": ["A-Class", "B-Class", "C-Class", "E-Class", "S-Class", "GLE", "GLC", "GLS", "Sprinter", "Vito", "G-Class", "CLA"],
    "Audi": ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron"],
    "Hyundai": ["Tucson", "Santa Fe", "Kona", "Elantra", "Accent", "Ioniq", "i20", "i30"],
    "Kia": ["Sportage", "Sorento", "Ceed", "Rio", "Niro", "Stonic", "Picanto"],
    "Nissan": ["Qashqai", "X-Trail", "Juke", "Leaf", "Navara", "Micra", "Note"],
    "Renault": ["Megane", "Clio", "Kadjar", "Captur", "Scenic", "Master", "Kangoo", "Fluence", "Zoe"],
    "Ford": ["Focus", "Fiesta", "Kuga", "Mondeo", "Transit", "Ranger", "EcoSport", "Puma"],
    "Volvo": ["XC40", "XC60", "XC90", "S60", "S90", "V60", "V90"],
    "Lexus": ["RX", "NX", "UX", "ES", "LS", "IS", "GX"],
    "Honda": ["Civic", "CR-V", "HR-V", "Accord", "Jazz", "Insight"],
    "Mazda": ["CX-3", "CX-5", "CX-30", "Mazda2", "Mazda3", "Mazda6", "CX-9"],
    "Mitsubishi": ["Outlander", "L200", "ASX", "Pajero", "Eclipse Cross", "Colt"],
    "Suzuki": ["Vitara", "SX4 S-Cross", "Swift", "Jimny", "Ignis"],
    "Opel": ["Astra", "Insignia", "Corsa", "Grandland X", "Mokka", "Zafira", "Vivaro"],
    "Peugeot": ["208", "308", "508", "2008", "3008", "5008", "Partner", "Expert"],
    "Citroen": ["C3", "C4", "C5 Aircross", "Berlingo", "Jumper"],
    "Land Rover": ["Range Rover", "Range Rover Sport", "Discovery", "Defender", "Evoque", "Velar"],
    "Porsche": ["Cayenne", "Macan", "Panamera", "Taycan", "911"],
    "Geely": ["Coolray", "Atlas Pro", "Tugella", "Monjaro"],
    "Haval": ["Jolion", "H6", "Dargo"]
};

// --- CONFIGURARE MULTER (Stocare în memorie) ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- CONEXIUNE LA MONGODB ATLAS ---
mongoose.connect(DB_URI)
  .then(()=> console.log('✅ Conectat la MongoDB Atlas!'))
  .catch(err => console.error('❌ Eroare conectare la bază de date:', err));

// --- CONFIGURARE MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configurare EJS și fișiere statice
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
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 ore
}));

// --- MIDDLEWARE UTILIZATOR ---
app.use((req, res, next)=> {
    res.locals.isLoggedIn = !!req.session.userId;
    res.locals.isGuest = !!req.session.isGuest && !req.session.userId;
    res.locals.userId = req.session.userId || null;
    res.locals.username = req.session.username || null;
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

const messageSchema = new mongoose.Schema({
    roomId: { type: String, required: true }, // 'general' sau ID-ul mașinii
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

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
        console.error("Eroare la încărcarea mașinilor pe ruta home:", err);
        res.render('home', { 
            title: 'Car-App - Acasă',
            cars: [] 
        });
    }
});

app.get('/car/:id', async (req, res) => {
    try {
        const carId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).send("Format ID invalid.");
        }

        const car = await Car.findById(carId).populate('owner');
        if (!car) {
            return res.status(404).send("Mașina nu a fost găsită în baza de date.");
        }

        const isOwner = req.session.userId && car.owner && req.session.userId.toString() === car.owner._id.toString();

        res.render('car-details', { 
            car: car, 
            isOwner: isOwner, 
            title: 'Detalii Mașină' 
        });
    } catch (err) {
        console.error("Eroare la pagina de detalii:", err);
        res.status(500).send("Eroare internă server.");
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

    res.render('add-car', { 
        title: 'Adaugă mașină', 
        error: null, 
        carDatabase: carDatabase 
    });
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

// ==========================================
// --- RUTE CHAT (OPTIMIZAT ȘI CORECTAT) ---
// ==========================================

// 1. Chat General
app.get('/chat', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const generalMessagesRaw = await Message.find({ roomId: 'general' })
            .sort({ timestamp: -1 })
            .limit(50);
        
        const generalMessages = generalMessagesRaw.reverse();

        const myCars = await Car.find({ owner: req.session.userId });
        const myCarIds = myCars.map(c => c._id.toString());

        const privateMessages = await Message.find({
            roomId: { $ne: 'general' },
            $or: [
                { sender: req.session.userId },
                { roomId: { $in: myCarIds } }
            ]
        }).sort({ timestamp: -1 });

        // ✅ CORECTAT: OPTIMIZARE BAZĂ DE DATE
        const uniqueCarIds = [...new Set(privateMessages.map(m => m.roomId))];
        
        // Luăm doar mașinile care NU sunt ale mele (pe ale mele le am deja în myCars)
        const otherCarIds = uniqueCarIds.filter(id => !myCarIds.includes(id));
        const otherCarsInfo = await Car.find({ _id: { $in: otherCarIds } });
        
        // Combinăm listele în memorie
        const allCarsData = [...myCars, ...otherCarsInfo];

        const inboxMap = {};
        for (const msg of privateMessages) {
            if (!inboxMap[msg.roomId]) {
                // Căutăm în lista combinată din memorie
                const car = allCarsData.find(c => c._id.toString() === msg.roomId);
                inboxMap[msg.roomId] = {
                    roomId: msg.roomId,
                    carPlate: car ? car.plateNumber : 'Mașină',
                    lastMessage: msg.text,
                    timestamp: msg.timestamp,
                    isNew: msg.sender ? msg.sender.toString() !== req.session.userId.toString() : false
                };
            }
        }

        res.render('chat', {
            title: 'Mesagerie',
            userId: req.session.userId,
            username: req.session.username || 'Utilizator',
            roomId: 'general',
            oldMessages: generalMessages,
            inbox: Object.values(inboxMap)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Eroare la încărcarea mesageriei.");
    }
});

// 2. Chat Privat
app.get('/chat/private/:carId', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    try {
        const carId = req.params.carId;
        const car = await Car.findById(carId);
        if (!car) return res.status(404).send("Mașina nu există.");

        const oldMessagesRaw = await Message.find({ roomId: carId })
            .sort({ timestamp: -1 })
            .limit(50);
        
        const oldMessages = oldMessagesRaw.reverse();

        const myCars = await Car.find({ owner: req.session.userId });
        const myCarIds = myCars.map(c => c._id.toString());

        const privateMessages = await Message.find({
            roomId: { $ne: 'general' },
            $or: [
                { sender: req.session.userId }, 
                { roomId: { $in: myCarIds } }
            ]
        }).sort({ timestamp: -1 });

        // ✅ CORECTAT: OPTIMIZARE BAZĂ DE DATE
        const uniqueCarIds = [...new Set(privateMessages.map(m => m.roomId))];
        const otherCarIds = uniqueCarIds.filter(id => !myCarIds.includes(id));
        const otherCarsInfo = await Car.find({ _id: { $in: otherCarIds } });
        const allCarsData = [...myCars, ...otherCarsInfo];

        const inboxMap = {};
        for (const msg of privateMessages) {
            if (!inboxMap[msg.roomId]) {
                const c = allCarsData.find(carObj => carObj._id.toString() === msg.roomId);
                inboxMap[msg.roomId] = {
                    roomId: msg.roomId,
                    carPlate: c ? c.plateNumber : 'Mașină',
                    lastMessage: msg.text,
                    timestamp: msg.timestamp,
                    isNew: msg.sender ? msg.sender.toString() !== req.session.userId.toString() : false
                };
            }
        }

        res.render('chat', {
            title: `Chat: ${car.plateNumber}`,
            userId: req.session.userId,
            username: req.session.username || 'Utilizator',
            roomId: carId.toString(),
            oldMessages: oldMessages,
            inbox: Object.values(inboxMap)
        });

    } catch (err) {
        console.error("Eroare la ruta de chat privat:", err);
        res.status(500).send("Eroare server.");
    }
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
        req.session.username = newUser.fullName;
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
        req.session.username = user.fullName;
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
    req.session.destroy((err) => {
        res.clearCookie('connect.sid'); 
        res.redirect('/');
    });
});

// ==========================================================
// --- ADĂUGĂ MAȘINĂ (CU VERIFICARE CORECTĂ) ---
app.post('/add-car', upload.array('carImage', 3), async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    const { plateNumber, make, model } = req.body;
    
    try {
        // ✅ CORECTAT: Verificăm existența ÎNAINTE de a încărca imaginea
        const plate = plateNumber.toUpperCase().trim();
        const existingCar = await Car.findOne({ plateNumber: plate });
        
        if (existingCar) {
            return res.render('add-car', { 
                title: 'Adaugă mașină', 
                error: 'O mașină cu acest număr există deja.',
                carDatabase: carDatabase 
            });
        }

        const files = req.files; // Notă: Multer pune fișierele în req.files (plural)
        if (!files || files.length === 0) {
            return res.render('add-car', { 
                title: 'Adaugă mașină', 
                error: 'Vă rugăm să încărcați cel puțin o imagine.',
                carDatabase: carDatabase 
            });
        }

        const imageUrls = [];
        const auth = Buffer.from(IK_SECRET + ":").toString("base64");

        // Folosim o buclă pentru a încărca fiecare imagine în parte
        for (const file of files) {
            const base64File = file.buffer.toString('base64');
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
            if (!uploadResponse.ok) throw new Error(result.message || 'Eroare la ImageKit');
            
            imageUrls.push(result.url);
        } 

        const newCar = new Car({
            plateNumber: plate,
            make,
            model,
            imageUrls: imageUrls, // Aici folosim array-ul creat în bucla de mai sus
            owner: req.session.userId
        });

        await newCar.save();
        await User.findByIdAndUpdate(req.session.userId, { $push: { cars: newCar._id } });

        res.redirect('/profile');

    } catch (error) {
        console.error('--- EROARE ADD-CAR ---', error);
        res.render('add-car', { 
            title: 'Adaugă mașină', 
            error: error.message || 'A apărut o eroare la salvare.',
            carDatabase: carDatabase
        });
    }
});

// ==========================================================
// --- CHAT (Socket.IO) ---

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
    });

    socket.on('chatMessage', async (data) => {
        if (!data.message || data.message.trim() === '') return;
        try {
            // ✅ CORECTAT: Căutăm userul în DB pentru a obține numele real (SECURITATE)
            const user = await User.findById(data.userId);
            const safeName = user ? user.fullName : "Utilizator";

            const newMessage = new Message({
                roomId: data.roomId,
                sender: data.userId,
                senderName: safeName, // Folosim numele din DB, nu ce trimite browserul
                text: data.message
            });

            const savedMessage = await newMessage.save();

            io.to(data.roomId).emit('message', {
                text: savedMessage.text,
                senderName: savedMessage.senderName,
                timestamp: savedMessage.timestamp
            });
        } catch (err) {
            console.error("Eroare salvare mesaj:", err);
        }
    });
});

// --- SERVER START ---
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul http://localhost:${PORT}`);
});