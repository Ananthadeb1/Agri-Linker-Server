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

connectDB().then((client) => {
  const userCollection = client.db("AgriLinker").collection("users");
  const productCollection = client.db("AgriLinker").collection("products");
  const userPreferenceCollection = client.db("AgriLinker").collection("userpreferences");
  const cartCollection = client.db("AgriLinker").collection("carts");
  const orderCollection = client.db("AgriLinker").collection("ordered_Items");
  const ratingReviewCollection = client.db("AgriLinker").collection("rating_review");
  const loanRequestCollection = client.db("AgriLinker").collection("loanrequests");
  const orderTrackCollection = client.db("AgriLinker").collection("ordertracks");
  const investmentsCollection = client.db("AgriLinker").collection("investments");

  // ADD FARMERS COLLECTION FOR VERIFICATION
  const farmersCollection = client.db("AgriLinker").collection("farmers");

  // Set collections for routes to use
  app.set("cartCollection", cartCollection);
  app.set("orderCollection", orderCollection);
  app.set("ratingReviewCollection", ratingReviewCollection);
  app.set("orderTrackCollection", orderTrackCollection);
  app.set("productCollection", productCollection);
  app.set("farmersCollection", farmersCollection);
  app.set("loanRequestCollection", loanRequestCollection);
  app.set("investmentsCollection", investmentsCollection);

  // Mount all routes AFTER database connection
  app.use("/api/OrderTrack", require("./routes/OrderTrack.js"));
  app.use("/api/rating-review", require("./routes/ratingReview"));
  app.use("/api/orders", require("./routes/orders"));
  app.use("/api/cart", require("./routes/cart"));
  app.use("/profile", require("./routes/userProfile/profileImage.js")(client));
  app.use('/api/crop-recommendation', require('./routes/cropRecommendation'));

  // JWT token related work
  app.post("/jwt", async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h",
    });
    res.send({ token });
  });

  // Middleware for verifying JWT token
  const verifyToken = (req, res, next) => {
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

  // Verify admin middleware
  const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === "admin";
    if (!isAdmin) {
      return res.status(403).send({ message: "forbidden access" });
    }
    next();
  };

  // ========== ADMIN ORDERS MANAGEMENT ROUTES ==========

  // Get all orders for admin panel
  app.get('/api/admin/orders', verifyToken, verifyAdmin, async (req, res) => {
    try {
      console.log("📋 Fetching all orders for admin...");
      const orders = await orderCollection.find({}).sort({ orderedDate: -1 }).toArray();
      
      console.log(`✅ Found ${orders.length} orders`);
      
      res.json({
        success: true,
        orders: orders,
        total: orders.length,
        delivered: orders.filter(order => order.delivered).length,
        pending: orders.filter(order => !order.delivered).length,
        totalRevenue: orders.reduce((sum, order) => sum + order.totalPrice, 0)
      });
    } catch (error) {
      console.error("❌ Error fetching orders:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch orders: " + error.message
      });
    }
  });

  // ✅ FIXED: Update order status and sync between collections
  app.patch('/api/admin/orders/:id/deliver', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log("🔄 Marking order as delivered:", id);
      
      // Update in ordered_Items collection
      const result = await orderCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            delivered: true,
            deliveredAt: new Date()
          } 
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }

      // ✅ SYNC: Also update in ordertracks collection
      const order = await orderCollection.findOne({ _id: new ObjectId(id) });
      if (order && order.orderId) {
        const trackResult = await orderTrackCollection.updateOne(
          { orderId: order.orderId },
          { 
            $set: { 
              status: 'Delivered',
              deliveredAt: new Date()
            },
            $push: { 
              statusHistory: {
                status: 'Delivered',
                date: new Date(),
                note: 'Order delivered to customer'
              }
            }
          }
        );
        
        if (trackResult.modifiedCount > 0) {
          console.log("✅ Order status synced to ordertracks collection");
        } else {
          console.log("⚠️ Order not found in ordertracks collection for orderId:", order.orderId);
        }
      } else {
        console.log("⚠️ No orderId found for order:", id);
      }

      res.json({ 
        success: true, 
        message: 'Order marked as delivered successfully' 
      });
    } catch (error) {
      console.error("❌ Error updating order:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update order: " + error.message 
      });
    }
  });

  // Get order statistics for admin dashboard
  app.get('/api/admin/orders/stats', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const totalOrders = await orderCollection.countDocuments();
      const deliveredOrders = await orderCollection.countDocuments({ delivered: true });
      const pendingOrders = await orderCollection.countDocuments({ delivered: false });
      
      // Calculate total revenue
      const revenueResult = await orderCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalPrice" }
          }
        }
      ]).toArray();
      
      const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

      res.json({
        success: true,
        stats: {
          totalOrders,
          delivered: deliveredOrders,
          pending: pendingOrders,
          totalRevenue
        }
      });
    } catch (error) {
      console.error("❌ Error fetching order stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch order statistics: " + error.message
      });
    }
  });

  // ========== FARMER VERIFICATION ROUTES ==========

  // Get pending farmer verifications
  app.get('/api/farmers/pending-verification', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const farmers = await farmersCollection.find({ status: 'pending' }).toArray();
      res.json(farmers);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve farmer
  app.patch('/api/farmers/:id/approve', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await farmersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'verified', verifiedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: 'Farmer not found' });
      }

      res.json({ success: true, message: 'Farmer approved successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reject farmer
  app.patch('/api/farmers/:id/reject', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await farmersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected', rejectionReason: reason, rejectedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: 'Farmer not found' });
      }

      res.json({ success: true, message: 'Farmer application rejected' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== LOAN MANAGEMENT ROUTES ==========

  // Get all loans
  app.get('/api/loans/all', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const loans = await loanRequestCollection.find().toArray();
      res.json(loans);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve loan
  app.patch('/api/loans/:id/approve', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await loanRequestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved', approvedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: 'Loan not found' });
      }

      res.json({ success: true, message: 'Loan approved successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reject loan
  app.patch('/api/loans/:id/reject', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await loanRequestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected', rejectionReason: reason, rejectedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: 'Loan not found' });
      }

      res.json({ success: true, message: 'Loan application rejected' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Disburse loan
  app.patch('/api/loans/:id/disburse', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await loanRequestCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'disbursed', disbursedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: 'Loan not found' });
      }

      res.json({ success: true, message: 'Loan funds disbursed successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== INVESTMENT MANAGEMENT ROUTES ==========

  // Get all investments
  app.get('/api/admin/investments', verifyToken, verifyAdmin, async (req, res) => {
    try {
      const investments = await investmentsCollection.find().toArray();
      res.json(investments);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user by email
  app.get("/users/:email", verifyToken, async (req, res) => {
    const email = req.params.email;
    if (email !== req.decoded.email) {
      return res.status(403).send({ message: "unauthorized access" });
    }
    const query = { email: email };
    const user = await userCollection.findOne(query);
    res.send(user);
  });

  // User-related APIs
  app.post("/users", async (req, res) => {
    const user = req.body;
    const query = { email: user.email };
    const existingUser = await userCollection.findOne(query);
    if (existingUser) {
      return res.send({ message: "User already exists", insertedId: null });
    }
    const result = await userCollection.insertOne(user);
    res.send(result);
  });

  // Check if user is admin
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

  // Product related APIs
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

  // Search & Recommendation system APIs
  app.post("/api/search-product", verifyToken, async (req, res) => {
    try {
      const { searchTerm } = req.body;
      const userEmail = req.decoded.email;

      if (!searchTerm || !searchTerm.trim()) {
        return res.status(400).json({ message: "Search term is required" });
      }

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

      const productCategory = products[0].category;

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

  app.get("/api/products/recommended/:email", verifyToken, async (req, res) => {
    try {
      const userEmail = req.params.email;

      if (userEmail !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }

      const userPreference = await userPreferenceCollection.findOne({
        userEmail,
      });

      if (!userPreference) {
        const allProducts = await productCollection.find().toArray();
        return res.json(allProducts);
      }

      const allProducts = await productCollection.find().toArray();

      const categoryPrefs = userPreference.categoryPreferences;
      const sortedCategories = Object.entries(categoryPrefs)
        .sort((a, b) => b[1] - a[1])
        .filter(([category, count]) => count > 0)
        .map(([category]) => category);

      const sortedProducts = allProducts.sort((a, b) => {
        const indexA = sortedCategories.indexOf(a.category);
        const indexB = sortedCategories.indexOf(b.category);

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

  // Make normal user to admin
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

  // Get all users
  app.get("/users", verifyToken, async (req, res) => {
    const result = await userCollection.find().toArray();
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
      const result = await userCollection.deleteOne(query);
      res.send(result);
    } catch (error) {
      res
        .status(500)
        .send({ success: false, message: "Failed to delete user" });
    }
  });

  // Loan request endpoints
  app.post("/api/loans", async (req, res) => {
    try {
      const {
        farmerId,
        amount,
        purpose,
        repaymentPeriod,
        preferredStartDate,
        previousLoans,
        collateral,
        notes,
      } = req.body;

      if (
        !farmerId ||
        !amount ||
        !purpose ||
        !repaymentPeriod ||
        !preferredStartDate
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      const newLoanRequest = {
        farmerId,
        amount: parseFloat(amount),
        purpose,
        repaymentPeriod: parseInt(repaymentPeriod),
        preferredStartDate,
        previousLoans,
        collateral,
        notes,
        status: "pending",
        requestedAt: new Date(),
      };

      const result = await loanRequestCollection.insertOne(newLoanRequest);
      res.status(201).json({
        success: true,
        message: "Loan request submitted",
        loanId: result.insertedId,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create investment
  app.post('/api/investments', verifyToken, async (req, res) => {
    try {
      const { loanId, farmerId, amount, investorId } = req.body;

      const investment = {
        loanId,
        farmerId,
        investorId,
        amount,
        status: 'active',
        investedAt: new Date(),
        expectedReturn: amount * 1.1 // 10% return example
      };

      const result = await investmentsCollection.insertOne(investment);
      res.json({ success: true, investmentId: result.insertedId });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/loans/all", async (req, res) => {
    try {
      const loans = await loanRequestCollection.find().toArray();
      res.json(loans);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Basic route
  app.get("/", (req, res) => {
    res.send("Hello from Agri Linker Server!");
  });

  app.listen(port, () => {
    console.log(`🚀 Server is running on port: ${port}`);
  });
});