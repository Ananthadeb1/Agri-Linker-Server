// routes/users.js - Fixed version
router.patch('/update-profile', async (req, res) => {
    try {
        const { displayName, nidNumber, address, userId } = req.body;
        
        console.log("🔄 UPDATE PROFILE REQUEST:");
        console.log("User Email:", userId);
        console.log("Display Name:", displayName);
        console.log("NID Number:", nidNumber);
        console.log("Address:", address);

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID (email) is required'
            });
        }

        // Check if user exists in MongoDB
        let existingUser = await User.findOne({ email: userId });
        console.log("🔍 User exists in MongoDB:", !!existingUser);
        
        // If user doesn't exist in MongoDB, create them first
        if (!existingUser) {
            console.log("📝 Creating new user in MongoDB...");
            existingUser = await User.create({
                email: userId,
                displayName: displayName,
                nidNumber: nidNumber,
                address: address,
                role: 'user', // Default role
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log("✅ New user created in MongoDB");
        } else {
            // Update existing user
            console.log("📝 Updating existing user...");
            existingUser = await User.findOneAndUpdate(
                { email: userId },
                {
                    $set: {
                        displayName: displayName,
                        nidNumber: nidNumber,
                        address: address,
                        updatedAt: new Date()
                    }
                },
                { 
                    new: true
                }
            );
            console.log("✅ User updated in MongoDB");
        }

        console.log("🎉 PROFILE UPDATE COMPLETED:");
        console.log("Display Name:", existingUser.displayName);
        console.log("NID:", existingUser.nidNumber);
        console.log("Address:", existingUser.address);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                displayName: existingUser.displayName,
                nidNumber: existingUser.nidNumber,
                address: existingUser.address,
                email: existingUser.email,
                role: existingUser.role
            }
        });
        
    } catch (error) {
        console.error('❌ PROFILE UPDATE ERROR:', error);
        console.error('Error Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Failed to update profile: ' + error.message
        });
    }
});
