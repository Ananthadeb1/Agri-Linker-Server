const express = require('express');
const router = express.Router();
const { parseExcelData } = require('../utils/dataParser');

// Initialize crop database
let cropDatabase = [];

// Month mapping
const monthMap = {
    'january': 'jan', 'february': 'feb', 'march': 'mar', 'april': 'apr',
    'may': 'may', 'june': 'jun', 'july': 'jul', 'august': 'aug',
    'september': 'sep', 'october': 'oct', 'november': 'nov', 'december': 'dec'
};

// Initialize the database when server starts
const initializeDatabase = async () => {
    try {
        cropDatabase = await parseExcelData();
        console.log('🌱 Crop recommendation system initialized');
    } catch (error) {
        console.error('❌ Failed to initialize crop database:', error);
        // Fallback to empty array if initialization fails
        cropDatabase = [];
    }
};

// Call initialization
initializeDatabase();

// Crop recommendation endpoint
router.post('/recommend', async (req, res) => {
    try {
        const { month, cropType, landSize, budget } = req.body;

        if (!month) {
            return res.status(400).json({
                success: false,
                message: "Month is required"
            });
        }

        const currentMonth = monthMap[month.toLowerCase()];
        if (!currentMonth) {
            return res.status(400).json({
                success: false,
                message: "Invalid month provided"
            });
        }

        console.log(`🔍 Finding crops for month: ${currentMonth}`);

        // Filter crops that can be sown in the given month
        let suitableCrops = cropDatabase.filter(crop => {
            return crop.sowingMonths && crop.sowingMonths.includes(currentMonth);
        });

        console.log(`🌾 Found ${suitableCrops.length} suitable crops`);

        // Filter by crop type if specified
        if (cropType && cropType !== 'all') {
            suitableCrops = suitableCrops.filter(crop =>
                crop.type === cropType
            );
        }

        // Filter by budget if specified
        if (budget) {
            suitableCrops = suitableCrops.filter(crop =>
                crop.productionCost <= budget
            );
        }

        // Calculate profitability for each crop
        const cropsWithProfit = suitableCrops.map(crop => {
            const totalRevenue = crop.yieldPerAcre * crop.marketPrice;
            const totalCost = crop.productionCost;
            const netProfit = totalRevenue - totalCost;
            const profitPerAcre = netProfit;
            const roi = totalCost > 0 ? ((netProfit / totalCost) * 100) : 0;

            return {
                name: crop.name,
                type: crop.type,
                season: crop.season,
                sowingMonths: crop.sowingMonths,
                harvestMonths: crop.harvestMonths,
                yieldPerAcre: Math.round(crop.yieldPerAcre),
                marketPrice: crop.marketPrice,
                productionCost: crop.productionCost,
                duration: crop.duration,
                totalRevenue: Math.round(totalRevenue),
                totalCost: Math.round(totalCost),
                netProfit: Math.round(netProfit),
                profitPerAcre: Math.round(profitPerAcre),
                roi: parseFloat(roi.toFixed(2)),
                estimatedHarvest: getHarvestPeriod(crop, currentMonth)
            };
        });

        // Sort by profitability (ROI)
        const sortedCrops = cropsWithProfit.sort((a, b) => b.roi - a.roi);

        // Get top recommendations
        const topRecommendations = sortedCrops.slice(0, 10);

        res.json({
            success: true,
            currentMonth: month,
            suitableCropsCount: suitableCrops.length,
            totalCropsInDatabase: cropDatabase.length,
            recommendations: topRecommendations,
            analysis: {
                mostProfitable: topRecommendations[0] || null,
                highestYield: [...sortedCrops].sort((a, b) => b.yieldPerAcre - a.yieldPerAcre)[0] || null,
                lowestInvestment: [...sortedCrops].sort((a, b) => a.productionCost - b.productionCost)[0] || null
            }
        });

    } catch (error) {
        console.error("Crop recommendation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate crop recommendations"
        });
    }
});

// Helper function to estimate harvest period
function getHarvestPeriod(crop, sowingMonth) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    if (crop.harvestMonths && crop.harvestMonths.length > 0) {
        return crop.harvestMonths.join(', ');
    }

    // Estimate based on duration
    const sowIndex = months.indexOf(sowingMonth);
    const harvestIndex = (sowIndex + Math.floor(crop.duration / 30)) % 12;
    return months[harvestIndex];
}

// Get all available crops
router.get('/all-crops', (req, res) => {
    const uniqueTypes = [...new Set(cropDatabase.map(crop => crop.type))];

    res.json({
        success: true,
        cropTypes: uniqueTypes,
        totalCrops: cropDatabase.length,
        crops: cropDatabase.map(crop => ({
            name: crop.name,
            type: crop.type,
            yieldPerAcre: crop.yieldPerAcre,
            sowingMonths: crop.sowingMonths,
            harvestMonths: crop.harvestMonths
        }))
    });
});

module.exports = router;