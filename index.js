const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const passwordHash = require('password-hash');
const multer = require('multer');
const serviceAccount = require('./key.json');
const app = express();
const port = process.env.PORT || 2025;

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://public-fswd-project.appspot.com',
});

const db = admin.firestore();
const storage = admin.storage().bucket();

// Multer configuration for file uploads
const storageOptions = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
};

const upload = multer(storageOptions);

// Middleware and configuration
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');

app.use('/static', express.static(__dirname + '/public'));
app.use('/assets', express.static(__dirname + '/public/assets'));

// Routes

app.get('/', (req, res) => {
  res.render(__dirname + '/views/dash');
});

app.get('/dash', (req, res) => {
  res.render(__dirname + '/views/dash');
});

app.get('/signup', (req, res) => {
  res.render(__dirname + '/views/signup.ejs');
});

app.get('/upload', (req, res) => {
  res.render(__dirname + '/views/upload.ejs');
});

app.get('/home', (req, res) => {
  res.render(__dirname + '/views/home.ejs');
});

app.get('/carted-items', (req, res) => {
  res.render(__dirname + '/views/carted-items.ejs');
});

app.get('/about', (req, res) => {
  res.render(__dirname + '/views/about.ejs');
});


app.get('/books', (req, res) => {
  const books = [];

  db.collection('books')
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        books.push(doc.data());
      });

      res.render('books', { books });
    })
    .catch((error) => {
      console.error('Error retrieving book data:', error);
      res.send('Error retrieving book data.');
    });
});

app.post('/signupsubmit', (req, res) => {
  const email = req.body.email;
  const username = req.body.username;
  db.collection('Users')
    .where('email', '==', email)
    .get()
    .then((emailDocs) => {
      db.collection('Users')
        .where('username', '==', username)
        .get()
        .then((usernameDocs) => {
          if (emailDocs.size > 0 || usernameDocs.size > 0) {
            res.render('wrong');
          } else {
            db.collection('Users')
              .add({
                username: username,
                email: email,
                password: passwordHash.generate(req.body.password),

              })
              .then(() => {
                res.render('signup.ejs');
              })
              .catch(() => {
                res.send('Something went wrong.');
              });
          }
        })
        .catch(() => {
          res.send('Something went wrong.');
        });
    })
    .catch(() => {
      res.send('Something went wrong.');
    });
});

app.post('/loginsubmit', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  db.collection('Users')
    .where('email', '==', email)
    .get()
    .then((docs) => {
      if (docs.size === 0) {
        res.render('fail.ejs');
      } else {
        const userDoc = docs.docs[0];
        const hashedPassword = userDoc.data().password;
        if (passwordHash.verify(password, hashedPassword)) {
          res.render('home');
        } else {
          res.render('fail.ejs');
        }
      }
    })
    .catch(() => {
      res.send('Something went wrong.');
    });
});

app.post('/cartsubmit', (req, res) => {
  const title = req.body.title;
  const price = req.body.price;
  const quantity = req.body.quantity;

  const cartItem = {
      title,
      price,
      quantity,
  };
  const cartCollection = db.collection('cart');

  cartCollection.add(cartItem)
      .then(() => {
  
          setTimeout(() => {
              res.render('addcart');
          }, 500);
      })
      .catch((error) => {
          console.error('Error adding to cart:', error);
          res.status(500).json({ error: 'Internal server error' });
      });
});
app.post('/carted-items', (req, res) => {
  const cartItems = [];

  db.collection('cart')
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        cartItems.push(doc.data());
      });

      // Render your "carted-items" template and pass the cartItems to it.
      res.render('carted-items', { cartItems });
    })
    .catch((error) => {
      console.error('Error retrieving carted items:', error);
      res.send('Error retrieving carted items.');
    });
});



app.post('/addToOrders', (req, res) => {
  const title = req.body.title;
  const price = req.body.price;
  const quantity = req.body.quantity;

  const orderItem = {
      title,
      price,
      quantity,
  };
  res.status(200).json({ message: 'Order placed successfully' });
});

app.post('/getUserData', (req, res) => {
  const userUid = req.body.userUid;


  if (!userUid) {
    res.status(400).json({ error: 'User UID is missing in the request' });
    return;
  }

  const userRef = db.collection('Users').doc(userUid);

  
  userRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        
        const userData = doc.data();
        res.status(200).json(userData);
      } else {
    
        res.status(404).json({ error: 'User not found' });
      }
    })
    .catch((error) => {
      console.error('Error fetching user data:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
});


app.post('/booksubmit', upload.single('image'), (req, res) => {
  const title = req.body.title;
  const author = req.body.author;
  const price = req.body.price;
  const phoneNumber = req.body.phone_number;
  const location = req.body.location;
  const department = req.body.department;
  const image = req.file;

  if (!title || !author || !price || !image) {
    res.send('Missing book information.');
    return;
  }

  const imageFile = storage.file(image.originalname);

  const stream = imageFile.createWriteStream({
    metadata: {
      contentType: image.mimetype,
    },
  });

  stream.on('error', (err) => {
    console.error(err);
    res.send('Error uploading the image.');
  });

  stream.on('finish', () => {
    imageFile.makePublic().then(() => {
      const imageUrl = `https://storage.googleapis.com/${storage.name}/${imageFile.name}`;
      db.collection('books')
        .add({
          title,
          author,
          price,
          phoneNumber,
          location,
          department,
          imageUrl,
        })
        .then(() => {
          res.redirect('/home');
        })
        .catch(() => {
          res.send('Something went wrong while saving book data.');
        });
    });
  });

  stream.end(image.buffer);
});

app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
