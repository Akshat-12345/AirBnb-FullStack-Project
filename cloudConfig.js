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

        // 🚀 Fallback for normal listings upload (Images) with Compression Enabled
        return {
            folder: 'airbnb_dev', // Purana folder bilkul safe hai
            resource_type: 'image',
            allowed_formats: ["png", "jpg", "jpeg"],
            // 🔥 LINE ADDED HERE: Auto compress large images instantly during upload stream
            transformation: [
                { 
                    width: 1200,          // Image ka max width 1200px lock kiya
                    height: 1200,         // Image ka max height 1200px lock kiya
                    crop: 'limit',        // Choti photos ko kharab nahi karega, badi photos ko downscale karega
                    quality: 'auto:good', // Visual quality safe rakhte hue file size drastically reduce karega
                    fetch_format: 'auto'  // WebP/AVIF format automatically select karega optimized rendering ke liye
                }
            ]
        };
    },
});

module.exports = { cloudinary, storage };