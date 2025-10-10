const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { ObjectId } = require("mongodb");
require("dotenv").config();
const connectDB = require("./DBconnection.js");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Start server only after DB connection
connectDB().then((client) => {
  const userCollection = client.db("AgriLinker").collection("users");
  const productCollection = client.db("AgriLinker").collection("products");
  const userPreferenceCollection = client
    .db("AgriLinker")
    .collection("userpreferences");

  const profileRoutes = require("./routes/userProfile/pofileImage.js")(client);
  app.use("/profile", profileRoutes);

  //jwt related work
  app.post("/jwt", async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h",
    });
    res.send({ token });
  });

  //middleware for verify jwt token
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

  //user related apis
  app.post("/users", async (req, res) => {
    const user = req.body;
    console.log(user);
    const query = { email: user.email };
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

  // PRODUCT RELATED APIS
  app.post(
    "/api/products",
    verifyToken,
    upload.single("image"),
    async (req, res) => {
      try {
        const { name, quantityValue, quantityUnit, category, price } = req.body;
        const farmerEmail = req.decoded.email;

        if (!req.file) {
          return res
            .status(400)
            .json({ success: false, message: "Image file is required" });
        }

        const product = {
          name,
          image: `/uploads/${req.file.filename}`,
          quantity: {
            value: parseFloat(quantityValue),
            unit: quantityUnit,
          },
          category,
          farmerEmail,
          price: parseFloat(price),
          status: "available",
          createdAt: new Date(),
        };

        const result = await productCollection.insertOne(product);
        res.status(201).json({
          success: true,
          message: "Product added successfully",
          product: { _id: result.insertedId, ...product },
        });
      } catch (error) {
        res.status(400).json({ success: false, message: error.message });
      }
    }
  );

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
      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== SEARCH & RECOMMENDATION SYSTEM ====================

  // Search products and track category preference
  app.post("/api/search-product", verifyToken, async (req, res) => {
    try {
      const { searchTerm } = req.body;
      const userEmail = req.decoded.email;

      if (!searchTerm || !searchTerm.trim()) {
        return res.status(400).json({ message: "Search term is required" });
      }

      // Find products matching the search term (case-insensitive)
      const products = await productCollection
        .find({
          name: { $regex: searchTerm.trim(), $options: "i" },
        })
        .toArray();

      if (products.length === 0) {
        return res.status(404).json({
          message: "No products found",
          products: [],
        });
      }

      // Get the category of the first matched product
      const productCategory = products[0].category;

      // Update user's category preference (increment count by 1)
      const updateField = `categoryPreferences.${productCategory}`;

      await userPreferenceCollection.updateOne(
        { userEmail: userEmail },
        {
          $inc: { [updateField]: 1 },
          $setOnInsert: {
            userEmail: userEmail,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      res.json({
        success: true,
        message: "Search tracked successfully",
        products: products,
        trackedCategory: productCategory,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get recommended products based on user preferences
  app.get("/api/products/recommended/:email", verifyToken, async (req, res) => {
    try {
      const userEmail = req.params.email;

      // Verify user is requesting their own recommendations
      if (userEmail !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }

      // Get user's category preferences
      const userPreference = await userPreferenceCollection.findOne({
        userEmail,
      });

      // If no preferences, return all products
      if (!userPreference) {
        const allProducts = await productCollection.find().toArray();
        return res.json(allProducts);
      }

      // Get all products
      const allProducts = await productCollection.find().toArray();

      // Sort categories by count (highest first)
      const categoryPrefs = userPreference.categoryPreferences;
      const sortedCategories = Object.entries(categoryPrefs)
        .sort((a, b) => b[1] - a[1])
        .filter(([category, count]) => count > 0)
        .map(([category]) => category);

      // Sort products based on category preference
      const sortedProducts = allProducts.sort((a, b) => {
        const indexA = sortedCategories.indexOf(a.category);
        const indexB = sortedCategories.indexOf(b.category);

        // If category not in preferences, put at end
        const priorityA = indexA === -1 ? 999 : indexA;
        const priorityB = indexB === -1 ? 999 : indexB;

        return priorityA - priorityB;
      });

      res.json(sortedProducts);
    } catch (error) {
      console.error("Recommendation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's category preferences (for debugging/display)
  app.get("/api/user-preferences/:email", verifyToken, async (req, res) => {
    try {
      const userEmail = req.params.email;

      if (userEmail !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }

      const userPreference = await userPreferenceCollection.findOne({
        userEmail,
      });

      if (!userPreference) {
        return res.json({
          preferences: {},
          message: "No search history yet",
        });
      }

      // Format preferences for display
      const preferences = Object.entries(userPreference.categoryPreferences)
        .filter(([category, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count }));

      res.json({
        preferences,
        totalSearches: preferences.reduce((sum, p) => sum + p.count, 0),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== END OF SEARCH & RECOMMENDATION ====================

  //make normal user to admin
  app.patch("/users/admin/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        role: "admin",
      },
    };
    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);
  });

  //get all users
  app.get("/users", verifyToken, async (req, res) => {
    // console.log(req.headers);
    const result = await userCollection.find().toArray();
    res.send(result);
  });

  //make normal user to admin
  app.patch("/users/admin/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        role: "admin",
      },
    };
    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);
  });

  app.delete("/users/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    try {
      const query = { _id: new ObjectId(id) };
      const user = await userCollection.findOne(query);
      if (!user) {
        return res
          .status(404)
          .send({ success: false, message: "User not found" });
      }
      // Delete from MongoDB
      const result = await userCollection.deleteOne(query);
      res.send(result);
    } catch (error) {
      console.error("Error deleting user:", error);
      res
        .status(500)
        .send({ success: false, message: "Failed to delete user" });
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
