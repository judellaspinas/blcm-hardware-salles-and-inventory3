import express from 'express';
import { body } from 'express-validator';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { handleValidationErrors } from '../utils/validationHandler.js';
import * as salesController from '../controllers/sales.controller.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/sales
 * @desc    Get all sales
 * @access  Private
 */
router.get('/', salesController.getSales);

/**
 * @route   POST /api/sales
 * @desc    Create new sale (Supplier/Staff)
 * @access  Private/Supplier/Staff
 */
router.post('/', authorize('supplier', 'staff', 'admin'), [
  body('customerName').optional().trim(),
  body('customerEmail').optional().isEmail().withMessage('Please provide a valid email'),
  body('customerPhone')
    .optional()
    .trim()
    .isLength({ max: 11 }).withMessage('Phone number must be maximum 11 digits')
    .matches(/^\d+$/).withMessage('Phone number must contain only digits'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('paymentMethod').equals('cash').withMessage('Only cash payments are accepted'),
  body('cashRendered').isFloat({ min: 0 }).withMessage('Cash rendered is required and must be a positive number'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount cannot be negative'),
  body('tax').optional().isFloat({ min: 0 }).withMessage('Tax cannot be negative'),
  handleValidationErrors
], salesController.createSale);

/**
 * @route   POST /api/sales/:id/void-request
 * @desc    Request to void a sale (Staff only)
 * @access  Private/Staff
 */
router.post('/:id/void-request', authorize('staff', 'admin'), [
  body('voidRequestReason')
    .trim()
    .notEmpty()
    .withMessage('Reason for voiding is required'),
  handleValidationErrors
], salesController.requestVoidSale);

/**
 * @route   PATCH /api/sales/:id/void
 * @desc    Void a sale (Admin only - approves void request)
 * @access  Private/Admin
 */
router.patch('/:id/void', authorize('admin'), [
  body('superAdminCode')
    .trim()
    .notEmpty()
    .withMessage('SuperAdmin code is required'),
  handleValidationErrors
], salesController.voidSale);

/**
 * @route   GET /api/sales/:id
 * @desc    Get single sale
 * @access  Private
 */
router.get('/:id', salesController.getSale);

/**
 * @route   GET /api/sales/:id/pdf
 * @desc    Export sale receipt as PDF
 * @access  Private
 */
router.get('/:id/pdf', salesController.exportSalePDF);

export default router;

