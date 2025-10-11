const express = require("express");
const router = express.Router();

// Get user profile
router.get("/:email", async (req, res) => {
    try {
        const userCollection = req.app.get('userCollection');
        const email = req.params.email;
        
        console.log("Fetching profile for:", email);
        
        const user = await userCollection.findOne({ email: email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Extract profile data from user document
        const profileData = {
            fullName: user.displayName || user.fullName || '',
            nidNumber: user.nidNumber || '',
            phoneNumber: user.phoneNumber || '',
            dateOfBirth: user.dateOfBirth || '',
            gender: user.gender || '',
            address: user.address || '',
            emergencyContact: user.emergencyContact || '',
            bloodGroup: user.bloodGroup || '',
            email: user.email,
            photoURL: user.photoURL || ''
        };

        console.log("Profile data found:", profileData);

        res.json({
            success: true,
            message: 'Profile fetched successfully',
            data: profileData
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching profile'
        });
    }
});

// Update user profile
router.patch("/update/:email", async (req, res) => {
    try {
        const userCollection = req.app.get('userCollection');
        const email = req.params.email;
        const {
            fullName,
            nidNumber,
            phoneNumber,
            dateOfBirth,
            gender,
            address,
            emergencyContact,
            bloodGroup
        } = req.body;

        console.log("Updating profile for:", email, req.body);

        // Update user profile in database
        const updateResult = await userCollection.updateOne(
            { email: email },
            {
                $set: {
                    displayName: fullName?.trim(),
                    fullName: fullName?.trim(),
                    nidNumber: nidNumber?.trim(),
                    phoneNumber: phoneNumber?.trim(),
                    dateOfBirth: dateOfBirth || '',
                    gender: gender || '',
                    address: address?.trim(),
                    emergencyContact: emergencyContact?.trim(),
                    bloodGroup: bloodGroup || '',
                    updatedAt: new Date()
                }
            }
        );

        console.log("Update result:", updateResult);

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get updated user data
        const updatedUser = await userCollection.findOne({ email: email });

        const responseData = {
            fullName: updatedUser.displayName || updatedUser.fullName || '',
            nidNumber: updatedUser.nidNumber || '',
            phoneNumber: updatedUser.phoneNumber || '',
            dateOfBirth: updatedUser.dateOfBirth || '',
            gender: updatedUser.gender || '',
            address: updatedUser.address || '',
            emergencyContact: updatedUser.emergencyContact || '',
            bloodGroup: updatedUser.bloodGroup || ''
        };

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating profile'
        });
    }
});

module.exports = router;