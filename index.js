const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const connectDB = require("./DBconnection.js");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


//tanvir
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});
//ends here


// Start server only after DB connection
connectDB().then((client) => {
  // keep the collections here
  const userCollection = client.db("AgriLinker").collection("users");
  const productCollection = client.db("AgriLinker").collection("products");

  //jwt releted work
  app.post("/jwt", async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h",
    });
    res.send({ token });
  });

  //midleware for verify jwt token
  const verifyToken = (req, res, next) => {
    console.log("inside verify token", req.headers);
    if (!req.headers.authorization) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    const token = req.headers.authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      req.decoded = decoded;
      next();
    });
  };

  // verify admin middleware
  const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    console.log("user from db in verifyAdmin", user);
    const isAdmin = user?.role === "admin";
    console.log("isAdmin in verifyAdmin", isAdmin);
    if (!isAdmin) {
      return res.status(403).send({ message: "forbidden access" });
    }
    next();
  };

  //get user by email
  app.get("/users/:email", verifyToken, async (req, res) => {
    const email = req.params.email;
    if (email !== req.decoded.email) {
      return res.status(403).send({ message: "unauthorized access" });
    }
    const query = { email: email };
    const user = await userCollection.findOne(query);
    res.send(user);
  });

  //user releated apis

  //add user data to db
  app.post("/users", async (req, res) => {
    const user = req.body;
    console.log(user);
    const query = { email: user.email }; //check if user already exists
    const existingUser = await userCollection.findOne(query);
    if (existingUser) {
      return res.send({ message: "User already exists", insertedId: null });
    }
    const result = await userCollection.insertOne(user);
    res.send(result);
  });

  //check if user is admin or not
  app.get("/users/admin/:email", verifyToken, async (req, res) => {
    const email = req.params.email;
    if (email !== req.decoded.email) {
      return res.status(403).send({ message: "unauthorized access" });
    }
    const query = { email: email };
    const user = await userCollection.findOne(query);
    let admin = false;
    if (user) {
      admin = user?.role === "admin";
    }
    res.send({ admin });
  });

  //tanvir

  // PRODUCT RELATED APIS - NEW ADDITIONS

  // Add new product (only logged in users)
  app.post("/api/products", verifyToken, upload.single('image'), async (req, res) => {
    try {
      const { name, quantityValue, quantityUnit, category, price } = req.body;
      const farmerEmail = req.decoded.email; // Get email from token

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Image file is required' });
      }

      const product = {
        name,
        image: `/uploads/${req.file.filename}`,
        quantity: {
          value: parseFloat(quantityValue),
          unit: quantityUnit
        },
        category,
        farmerEmail,
        price: parseFloat(price),
        status: 'available',
        createdAt: new Date()
      };

      const result = await productCollection.insertOne(product);
      res.status(201).json({
        success: true,
        message: 'Product added successfully',
        product: { _id: result.insertedId, ...product }
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Get all products (public access)
  app.get("/api/products", async (req, res) => {
    try {
      const products = await productCollection.find().toArray();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get products by logged in farmer
  app.get("/api/my-products", verifyToken, async (req, res) => {
    try {
      const farmerEmail = req.decoded.email;
      const products = await productCollection.find({ farmerEmail }).toArray();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single product by ID
  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await productCollection.findOne({ _id: new ObjectId(id) });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  //ends here
  //basic route
  app.get("/", (req, res) => {
    res.send("Hello from Agri Linker Server!");
  });

  app.listen(port, () => {
    console.log(`🚀 Server is running on port: ${port}`);
  });
});