// services/fileService.js
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

exports.uploadToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

exports.deleteFromCloudinary = async (publicId) => {
  await cloudinary.uploader.destroy(publicId);
};