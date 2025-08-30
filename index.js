const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();
const connectDB = require("./DBconnection.js");
const upload = require("./upload"); // import upload.js

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

//serve uploaded images
app.use("/uploads", express.static("uploads"));



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

  // app.get("/users", verifyToken, async (req, res) => {
  //   try {
  //     const users = await userCollection.find().toArray();
  //     res.json(users);
  //     console.log("✅ /users route called");
  //   } catch (error) {
  //     res.status(500).json({ error: "Failed to fetch users" });
  //   }
  // });

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


  // Product upload API
  app.post("/products", verifyToken, upload.single("image"), async (req, res) => {
    try {
      const { name, description, price } = req.body;
      if (!req.file) return res.status(400).send({ message: "No file uploaded" });

      const user = await userCollection.findOne({ email: req.decoded.email });
      if (!user) return res.status(404).send({ message: "User not found" });

      const newProduct = {
        name,
        description,
        price: parseFloat(price),
        image: `/uploads/${req.file.filename}`,
        uid: user.uid,
        createdAt: new Date(),
      };

      const result = await productCollection.insertOne(newProduct);
      res.status(201).send(result);
    } catch (error) {
      console.error("Error uploading product:", error);
      res.status(500).send({ message: "Failed to upload product" });
    }
  });

  //basic route
  app.get("/", (req, res) => {
    res.send("Hello from Agri Linker Server!");
  });

  app.listen(port, () => {
    console.log(`🚀 Server is running on port: ${port}`);
  });
});
