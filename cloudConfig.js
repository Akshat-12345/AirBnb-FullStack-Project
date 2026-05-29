const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Automatically check if the incoming file is a video stream
        if (file.mimetype.startsWith('video/')) {
            return {
                folder: 'airbnb_dev_verification', // Videos ke liye clean separate folder
                resource_type: 'video', // Tells Cloudinary to use the video upload API
                allowed_formats: ['mp4', 'mov', 'mkv']
            };
        }

        // Default fallback for your normal listings upload (Images)
        return {
            folder: 'airbnb_dev', // Tumhara purana folder safe hai
            resource_type: 'image',
            allowed_formats: ["png", "jpg", "jpeg"]
        };
    },
});

module.exports = { cloudinary, storage };