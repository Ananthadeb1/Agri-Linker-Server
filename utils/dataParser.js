const XLSX = require('xlsx');

// Sample market prices (in Taka per kg)
const marketPrices = {
    'rice': 35, 'wheat': 30, 'maize': 25, 'barley': 28,
    'lentil': 80, 'gram': 70, 'mung': 60, 'masur': 85, 'motor': 65,
    'mustard': 60, 'groundnut': 80, 'soyabean': 45, 'sunflower': 50,
    'tomato': 25, 'potato': 18, 'onion': 40, 'brinjal': 20,
    'mango': 50, 'banana': 25, 'pineapple': 30, 'jackfruit': 35,
    'chilli': 120, 'turmeric': 80, 'ginger': 60, 'garlic': 70,
    'jute': 25, 'cotton': 45, 'sugarcane': 8, 'tobacco': 100
};

function parseExcelData() {
    return new Promise((resolve, reject) => {
        try {
            console.log('📊 Creating crop database...');

            const cropDatabase = [
                // Rice varieties
                {
                    name: "Aus Rice (Local)",
                    type: "cereal",
                    season: "kharif",
                    sowingMonths: ["mar", "apr"],
                    harvestMonths: ["jul", "aug"],
                    yieldPerAcre: 524,
                    marketPrice: 35,
                    productionCost: 25000,
                    duration: 120
                },
                {
                    name: "Aus Rice (HYV)",
                    type: "cereal",
                    season: "kharif",
                    sowingMonths: ["mar", "apr"],
                    harvestMonths: ["jul", "aug"],
                    yieldPerAcre: 1062,
                    marketPrice: 32,
                    productionCost: 30000,
                    duration: 120
                },
                {
                    name: "Aman Rice (HYV)",
                    type: "cereal",
                    season: "kharif",
                    sowingMonths: ["jun", "jul", "aug"],
                    harvestMonths: ["dec"],
                    yieldPerAcre: 1142,
                    marketPrice: 38,
                    productionCost: 35000,
                    duration: 150
                },
                {
                    name: "Boro Rice (HYV)",
                    type: "cereal",
                    season: "rabi",
                    sowingMonths: ["nov", "dec", "jan"],
                    harvestMonths: ["apr", "may", "jun"],
                    yieldPerAcre: 1635,
                    marketPrice: 36,
                    productionCost: 40000,
                    duration: 160
                },

                // Wheat
                {
                    name: "Wheat",
                    type: "cereal",
                    season: "rabi",
                    sowingMonths: ["nov", "dec"],
                    harvestMonths: ["mar", "apr"],
                    yieldPerAcre: 1135,
                    marketPrice: 30,
                    productionCost: 28000,
                    duration: 120
                },

                // Maize
                {
                    name: "Maize",
                    type: "cereal",
                    season: "rabi",
                    sowingMonths: ["oct", "nov", "dec"],
                    harvestMonths: ["apr", "may"],
                    yieldPerAcre: 3471,
                    marketPrice: 25,
                    productionCost: 32000,
                    duration: 150
                },

                // Pulses
                {
                    name: "Lentil (Masur)",
                    type: "pulse",
                    season: "rabi",
                    sowingMonths: ["oct", "nov"],
                    harvestMonths: ["feb", "mar"],
                    yieldPerAcre: 514,
                    marketPrice: 80,
                    productionCost: 20000,
                    duration: 120
                },
                {
                    name: "Gram",
                    type: "pulse",
                    season: "rabi",
                    sowingMonths: ["oct", "nov"],
                    harvestMonths: ["feb", "mar"],
                    yieldPerAcre: 442,
                    marketPrice: 70,
                    productionCost: 18000,
                    duration: 120
                },

                // Oilseeds
                {
                    name: "Mustard",
                    type: "oilseed",
                    season: "rabi",
                    sowingMonths: ["oct", "nov"],
                    harvestMonths: ["jan", "feb"],
                    yieldPerAcre: 487,
                    marketPrice: 60,
                    productionCost: 22000,
                    duration: 100
                },
                {
                    name: "Groundnut",
                    type: "oilseed",
                    season: "kharif",
                    sowingMonths: ["jun", "jul"],
                    harvestMonths: ["oct", "nov"],
                    yieldPerAcre: 779,
                    marketPrice: 80,
                    productionCost: 35000,
                    duration: 120
                },

                // Vegetables
                {
                    name: "Potato (HYV)",
                    type: "vegetable",
                    season: "rabi",
                    sowingMonths: ["sep", "oct", "nov"],
                    harvestMonths: ["jan", "feb", "mar"],
                    yieldPerAcre: 9212,
                    marketPrice: 18,
                    productionCost: 70000,
                    duration: 120
                },
                {
                    name: "Tomato",
                    type: "vegetable",
                    season: "rabi",
                    sowingMonths: ["aug", "sep", "oct", "nov"],
                    harvestMonths: ["dec", "jan", "feb", "mar"],
                    yieldPerAcre: 6144,
                    marketPrice: 25,
                    productionCost: 60000,
                    duration: 90
                },
                {
                    name: "Onion",
                    type: "vegetable",
                    season: "rabi",
                    sowingMonths: ["oct", "nov"],
                    harvestMonths: ["apr", "may", "jun"],
                    yieldPerAcre: 4725,
                    marketPrice: 40,
                    productionCost: 55000,
                    duration: 180
                },
                {
                    name: "Brinjal",
                    type: "vegetable",
                    season: "rabi",
                    sowingMonths: ["oct", "nov"],
                    harvestMonths: ["dec", "jan", "feb", "mar", "apr"],
                    yieldPerAcre: 4621,
                    marketPrice: 20,
                    productionCost: 45000,
                    duration: 150
                },

                // Fruits
                {
                    name: "Mango",
                    type: "fruit",
                    season: "whole-year",
                    sowingMonths: ["apr", "may", "jun", "sep", "oct", "nov"],
                    harvestMonths: ["apr", "may", "jun"],
                    yieldPerAcre: 70,
                    marketPrice: 50,
                    productionCost: 30000,
                    duration: 365
                },
                {
                    name: "Banana",
                    type: "fruit",
                    season: "whole-year",
                    sowingMonths: ["jan", "feb", "mar", "sep", "oct", "nov"],
                    harvestMonths: ["dec", "jan", "feb"],
                    yieldPerAcre: 6761,
                    marketPrice: 25,
                    productionCost: 50000,
                    duration: 365
                },

                // Cash crops
                {
                    name: "Jute",
                    type: "cash-crop",
                    season: "kharif",
                    sowingMonths: ["mar", "apr"],
                    harvestMonths: ["jul", "aug"],
                    yieldPerAcre: 4.58,
                    marketPrice: 2500,
                    productionCost: 30000,
                    duration: 120
                },
                {
                    name: "Sugarcane",
                    type: "cash-crop",
                    season: "whole-year",
                    sowingMonths: ["oct", "nov", "dec"],
                    harvestMonths: ["oct", "nov", "dec", "jan", "feb", "mar", "apr"],
                    yieldPerAcre: 17328,
                    marketPrice: 8,
                    productionCost: 80000,
                    duration: 365
                }
            ];

            console.log(`✅ Created database with ${cropDatabase.length} crops`);
            resolve(cropDatabase);

        } catch (error) {
            console.error('❌ Error creating crop database:', error);
            reject(error);
        }
    });
}

module.exports = { parseExcelData };
