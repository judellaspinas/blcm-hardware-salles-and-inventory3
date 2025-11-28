import Product from '../models/Product.model.js';
import Supplier from '../models/Supplier.model.js';
import { uploadImage, deleteImage, uploadToCloudinary } from '../config/cloudinary.js';

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Private
 */
export const getProducts = async (req, res, next) => {
  try {
    const { category, supplier, lowStock, isActive } = req.query;
    const filter = {};

    if (supplier) {
      filter.supplier = supplier;
    }

    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
    }

    const products = await Product.find(filter)
      .populate('supplier', 'companyName')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 * @access  Private
 */
export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('supplier');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new product
 * @route   POST /api/products
 * @access  Private/Admin
 */
export const createProduct = async (req, res, next) => {
  try {
    const supplierId = req.body.supplier;

    // Verify supplier exists
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const productData = {
      ...req.body,
      supplier: supplierId
    };

    // Handle Cloudinary image upload
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, 'blcm/products');

      productData.image = {
        url: uploaded.secure_url,
        public_id: uploaded.public_id
      };
    }

    // Set default values for optional fields if not provided
    if (!('price' in req.body) || productData.price === undefined || productData.price === null || productData.price === '') {
      productData.price = 0;
    }
    if (!('markupPercentage' in req.body) || productData.markupPercentage === undefined || productData.markupPercentage === null || productData.markupPercentage === '') {
      productData.markupPercentage = 0;
    }
    if (!('stockQuantity' in req.body) || productData.stockQuantity === undefined || productData.stockQuantity === null || productData.stockQuantity === '') {
      productData.stockQuantity = 0;
    }

    // Add initial pricing history entry
    productData.pricingHistory = [{
      basePrice: productData.price,
      markupPercentage: productData.markupPercentage,
      updatedAt: new Date()
    }];

    const product = await Product.create(productData);
    await product.populate('supplier', 'companyName');

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // If supplier is being updated, verify it exists
    if (req.body.supplier) {
      const supplier = await Supplier.findById(req.body.supplier);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        });
      }
    }

    const updateData = { ...req.body };

    // Handle new image upload
    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (product.image?.public_id) {
        await deleteImage(product.image.public_id);
      }

      const uploaded = await uploadToCloudinary(req.file.buffer);

      updateData.image = {
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      };
    }
    // If price or markup percentage is being updated, add to history
    if (req.body.price !== undefined || req.body.markupPercentage !== undefined) {
      const historyUpdate = {
        basePrice: req.body.price !== undefined ? req.body.price : product.price,
        markupPercentage: req.body.markupPercentage !== undefined
          ? req.body.markupPercentage
          : product.markupPercentage,
        updatedAt: new Date()
      };

      // Add to pricing history
      updateData.$push = { pricingHistory: historyUpdate };
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('supplier', 'companyName');

    res.json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
   
    next(error);
  }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // If product has an image, delete it from Cloudinary
    if (product.image && product.image.public_id) {
      await deleteImage(product.image.public_id);
    }

    // Instead of deleting, mark as inactive
    product.isActive = false;
    await product.save();

    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
