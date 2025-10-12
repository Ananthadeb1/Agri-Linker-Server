// routes/users.js (backend)
router.patch('/update-profile', async (req, res) => {
    try {
        const { displayName, nidNumber, address } = req.body;
        const userId = req.user.uid; // Assuming you have authentication middleware

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    displayName,
                    nidNumber,
                    address,
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});