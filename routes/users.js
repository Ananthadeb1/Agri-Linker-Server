// routes/users.js - Alternative version
router.patch('/update-profile', async (req, res) => {
    try {
        const { displayName, nidNumber, address, userId } = req.body;
        
        console.log("Updating profile for:", userId); // Debug log

        // Find user by email (userId is actually email from frontend)
        const updatedUser = await User.findOneAndUpdate(
            { email: userId }, // Find by email
            {
                $set: {
                    displayName: displayName,
                    nidNumber: nidNumber,
                    address: address,
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: true }
        );

        console.log("Updated user:", updatedUser); // Debug log

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found with email: ' + userId
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                displayName: updatedUser.displayName,
                nidNumber: updatedUser.nidNumber,
                address: updatedUser.address,
                email: updatedUser.email
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});