const Joi = require('joi');

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        category: Joi.string().valid(
            'Trending', 'Rooms', 'Amazing views', 'Mansions', 
            'Amazing pools', 'Beach', 'Cabins', 'Camping', 'Farms'
        ).default('Trending'), // Category index validation bhi clean kar di
        
        // 🚀 Updated Images Array with Tag Mapping Validation
        images: Joi.array().items(
            Joi.object({
                url: Joi.string().uri().allow("", null),
                filename: Joi.string().allow("", null),
                tag: Joi.string().valid('General', 'Bedroom', 'Kitchen', 'Bathroom', 'Exterior').default('General')
            })
        ).optional() 
    }).required(),
    
    // 📸 Frontend Form se dynamic dropdowns 'imageTags' ke array format mein aayenge
    imageTags: Joi.alternatives().try(
        Joi.array().items(Joi.string().valid('General', 'Bedroom', 'Kitchen', 'Bathroom', 'Exterior')),
        Joi.string().valid('General', 'Bedroom', 'Kitchen', 'Bathroom', 'Exterior')
    ).optional()
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(0).max(5),
        comment: Joi.string().required(),
    }).required()
});