const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const ImageKit = require('imagekit');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =================================================================
// 1. CONFIGURARE
// =================================================================

// Variabile de mediu (ESTE CRITIC să le setezi pe Render)
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/carapp';
const SESSION_SECRET = process.env.SESSION_SECRET || 'secret_key_foarte_secret';

// Configurare ImageKit
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});
const upload = multer({ storage: multer.memoryStorage() });

// Conectare la MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB conectat'))
    .catch(err => console.error('Eroare conectare MongoDB:', err));

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 de ore
}));

// =================================================================
// 2. SCHEME MONGOOSE
// =================================================================

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const carSchema = new mongoose.Schema({
    plateNumber: { type: String, required: true, unique: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    imageUrls: [{ type: String }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
const Car = mongoose.model('Car', carSchema);


// =================================================================
// 3. MIDDLEWARE: Variabile Globale EJS
// =================================================================
app.use((req, res, next) => {
    // Variabile esențiale pentru header, footer (Tab Bar) și logica de acces
    res.locals.isGuest = !req.session.userId;
    res.locals.username = req.session.username || 'Invitat';
    res.locals.userId = req.session.userId || null;
    next();
});

// Middleware pentru a proteja rutele care necesită autentificare
const requireLogin = (req, res, next) => {
    if (res.locals.isGuest) {
        return res.redirect('/login');
    }
    next();
};

// =================================================================
// 4. LOGICĂ CHAT PRIVAT (Socket.IO)
// =================================================================

const messages = {}; // Stocare temporară a mesajelor în RAM
// Funcție pentru a genera un ID de cameră consistent între 2 utilizatori
function getRoomId(user1Id, user2Id) {
    const sortedIds = [user1Id, user2Id].sort();
    return sortedIds.join('_');
}

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);
        
        // Trimiterea istoricului camerei
        if (messages[roomId]) {
            messages[roomId].forEach(msg => {
                socket.emit('message', msg);
            });
        }
    });

    socket.on('chatMessage', ({ message, senderId, senderName, roomId }) => {
        const time = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        const data = { senderId, sender: senderName, text: message, time };

        if (!messages[roomId]) {
            messages[roomId] = [];
        }
        messages[roomId].push(data);
        
        io.to(roomId).emit('message', data);
    });

    socket.on('disconnect', () => {
        // console.log('User disconnected');
    });
});


// =================================================================
// 5. RUTE DE AUTENTIFICARE ȘI SESIUNE (Cerințele 2 & 3)
// =================================================================

// RUTA LOGIN (GET)
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login', error: null });
});

// RUTA LOGIN (POST)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id.toString();
            req.session.username = user.fullName;
            // Redirecționare după login (Cerința 4.1)
            return res.redirect('/'); 
        }
        res.render('login', { title: 'Login', error: 'Email sau parolă incorecte.' });
    } catch (err) {
        console.error(err);
        res.render('login', { title: 'Login', error: 'Eroare la autentificare.' });
    }
});

// RUTA CONTINUĂ CA INVITAT (Simulare login guest)
app.post('/guest-login', (req, res) => {
    // Nu se setează userId, rămâne 'isGuest = true'
    res.redirect('/');
});

// RUTA REGISTER (GET)
app.get('/register', (req, res) => {
    res.render('register', { title: 'Creează Cont', error: null });
});

// RUTA REGISTER (POST)
app.post('/register', async (req, res) => {
    const { fullName, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
        return res.render('register', { title: 'Creează Cont', error: 'Parolele nu se potrivesc.' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ fullName, email, password: hashedPassword });
        await newUser.save();
        
        req.session.userId = newUser._id.toString();
        req.session.username = newUser.fullName;
        res.redirect('/');
        
    } catch (err) {
        let errorMessage = 'Eroare la înregistrare.';
        // Eroare specifică MongoDB (Email existent - Cerința 3)
        if (err.code === 11000) { 
            errorMessage = 'Acest email este deja înregistrat.';
        }
        res.render('register', { title: 'Creează Cont', error: errorMessage });
    }
});

// RUTA LOGOUT (Cerința 7.3)
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).send('Eroare la delogare.');
        }
        res.redirect('/'); // Redirecționează la Acasă (Invitat)
    });
});

// =================================================================
// 6. RUTE MAȘINI ȘI PAGINI (Cerințele 1, 5, 7, 8)
// =================================================================

// RUTA PAGINA ACASĂ (Home - Cerința 1)
app.get('/', async (req, res) => {
    try {
        const cars = await Car.find().populate('owner', 'email');
        res.render('home', { title: 'Acasă', cars, error: null });
    } catch (err) {
        console.error(err);
        res.render('home', { title: 'Acasă', cars: [], error: 'Eroare la încărcarea mașinilor.' });
    }
});

// RUTA ADADUGĂ MAȘINĂ (GET)
app.get('/add-car', requireLogin, (req, res) => {
    res.render('add-car', { title: 'Adaugă Mașină', error: null });
});

// RUTA ADADUGĂ MAȘINĂ (POST - Cerința 5)
app.post('/add-car', requireLogin, upload.array('carImage', 3), async (req, res) => {
    const { plateNumber, make, model } = req.body;
    const files = req.files;

    if (!plateNumber || !make || !model || files.length === 0) {
        // Eroare câmpuri incomplete (Cerința 5.5)
        return res.render('add-car', { title: 'Adaugă Mașină', error: 'Trebuie să completezi toate spațiile și să încarci minim o imagine.' });
    }

    try {
        const uploadPromises = files.map(file => {
            return imagekit.upload({
                file: file.buffer,
                fileName: `${plateNumber}-${Date.now()}`,
                folder: '/car-app'
            });
        });

        const uploadResults = await Promise.all(uploadPromises);
        const imageUrls = uploadResults.map(result => result.url);
        
        const newCar = new Car({
            plateNumber: plateNumber.toUpperCase().replace(/\s/g, ''), // Salvează fără spațiu
            make,
            model,
            imageUrls,
            owner: req.session.userId
        });
        await newCar.save();

        // Mesaj de succes și redirecționare (Cerința 5.5)
        // Redirecționarea imediată după succes (fără mesaj vizibil de 2s) este mai simplă
        res.redirect('/?success=MasinaÎnregistrată');

    } catch (err) {
        let errorMessage = 'Eroare la salvarea mașinii.';
        // Eroare Număr de Înmatriculare existent (Cerința 5.5)
        if (err.code === 11000) { 
            errorMessage = `Numărul de înmatriculare ${plateNumber} este deja înregistrat.`;
        }
        res.render('add-car', { title: 'Adaugă Mașină', error: errorMessage });
    }
});

// RUTA PAGINA DETALII MAȘINĂ (Cerința 8)
app.get('/car/:carId', async (req, res) => {
    try {
        const car = await Car.findById(req.params.carId).populate('owner', 'email fullName');
        if (!car) {
            return res.status(404).render('404', { title: 'Mașină negăsită' });
        }
        
        const isOwner = res.locals.userId && car.owner._id.toString() === res.locals.userId;
        let chatRoomId = null;

        if (res.locals.userId && !isOwner) {
            // Generarea ID-ului camerei pentru chat privat (Cerința 8.3)
            chatRoomId = getRoomId(res.locals.userId, car.owner._id.toString());
        }

        res.render('car-details', { 
            title: 'Detalii Mașină', 
            car, 
            isOwner,
            ownerId: car.owner._id, // Necesare pentru butonul de Chat
            ownerFullName: car.owner.fullName
        });

    } catch (err) {
        console.error(err);
        res.status(500).render('error', { title: 'Eroare Server' });
    }
});

// RUTA PAGINA PROFIL/GARAG (Cerința 7)
app.get('/profile', requireLogin, async (req, res) => {
    try {
        // Obține doar mașinile utilizatorului curent
        const userCars = await Car.find({ owner: req.session.userId });
        res.render('profile', { title: 'Garajul Meu', cars: userCars });
    } catch (err) {
        console.error(err);
        res.render('profile', { title: 'Garajul Meu', cars: [], error: 'Eroare la încărcarea mașinilor proprii.' });
    }
});


// =================================================================
// 7. RUTE CHAT (Cerința 6)
// =================================================================

// RUTA PRINCIPALĂ MESAJE (LISTA DE CONVERSAȚII)
app.get('/chat', requireLogin, async (req, res) => {
    // NOTĂ: Pentru a afișa lista reală de conversații (Cerința 6.2),
    // ar trebui să interogăm o colecție de "Conversations" din DB.
    // Deoarece nu ai furnizat modelul de chat, lăsăm o pagină placeholder.
    res.render('chat', { 
        title: 'Mesaje',
    });
});

// RUTA CHAT PRIVAT (Deschisă de pe Detalii Mașină - Cerința 6.3)
app.get('/chat/private/:ownerId', requireLogin, async (req, res) => {
    const targetUser = await User.findById(req.params.ownerId);
    
    if (!targetUser) {
        return res.redirect('/chat'); 
    }
    
    const roomId = getRoomId(res.locals.userId, targetUser._id.toString());

    res.render('chat-private', { 
        title: `Chat cu ${targetUser.fullName}`, 
        roomId, 
        targetUserId: targetUser._id.toString(),
        targetUserName: targetUser.fullName
    });
});

// =================================================================
// 8. RUTA API PENTRU CĂUTARE (Cerința 1.3)
// =================================================================
app.get('/api/search', async (req, res) => {
    const query = req.query.plate ? req.query.plate.toUpperCase().replace(/\s/g, '') : '';
    
    if (query.length < 2) {
        return res.json([]);
    }
    
    try {
        const cars = await Car.find({
            plateNumber: { $regex: '^' + query, $options: 'i' }
        }).select('plateNumber make model'); // returnăm doar câmpurile necesare
        
        res.json(cars);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Eroare la căutare.' });
    }
});


// =================================================================
// 9. PORNIRE SERVER
// =================================================================

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});