// routes/profile.js
const express = require("express");
const { ObjectId } = require("mongodb");
const FormData = require("form-data"); // ✅ Correct way to import FormData
const fetch = require("node-fetch"); // ✅ Add this

const router = express.Router();

module.exports = function (client) {
  const db = client.db("AgriLinker");
  const userCollection = db.collection("users");

  // ✅ NEW: imgBB upload endpoint
  router.post("/upload/imgbb", async (req, res) => {
    try {
      const { imageData } = req.body; // base64 image data

      console.log("Received upload request");

      if (!imageData) {
        return res.status(400).json({
          success: false,
          message: "Image data is required",
        });
      }

      // Extract base64 data (remove data:image/... prefix)
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

      // Create FormData for imgBB
      const formData = new FormData();
      formData.append("image", base64Data);

      console.log("Uploading to imgBB...");

      const imgbbResponse = await fetch(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const imgbbData = await imgbbResponse.json();
      console.log("ImgBB response:", imgbbData);

      if (imgbbData.success) {
        res.json({
          success: true,
          imageUrl: imgbbData.data.url,
          message: "Image uploaded successfully",
        });
      } else {
        throw new Error(imgbbData.error?.message || "Upload failed");
      }
    } catch (error) {
      console.error("ImgBB upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload image to imgBB",
      });
    }
  });

  // User profile update endpoint (for imgBB) - WITHOUT verifyToken
  router.patch("/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const updateData = req.body;

      console.log("Profile update request:", { uid, updateData });

      // Remove _id from update data if present
      delete updateData._id;

      const result = await userCollection.updateOne(
        { uid: uid },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  });

  // Update user by MongoDB _id - WITHOUT verifyToken
  router.patch("/id/:_id", async (req, res) => {
    try {
      const { _id } = req.params;
      const updateData = req.body;

      console.log("Profile update by ID:", { _id, updateData });

      const result = await userCollection.updateOne(
        { _id: new ObjectId(_id) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Update user by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  });

  return router;
};
