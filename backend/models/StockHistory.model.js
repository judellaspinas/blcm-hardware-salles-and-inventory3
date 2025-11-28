import mongoose from 'mongoose';

const stockHistorySchema = new mongoose.Schema({
  transactionId: {
    type: String,
    trim: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  productName: {
    type: String,
    trim: true
  },
  stockQuantity: {
    type: Number
  },
  dateDelivered: {
    type: Date
  },
  totalCost: {
    type: Number,
    min: [0, 'Total cost cannot be negative']
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['SALE', 'RESTOCK', 'RETURN', 'WASTAGE', 'ADJUSTMENT'],
    required: false
  },
  quantity: {
    type: Number
  },
  previousQuantity: {
    type: Number
  },
  newQuantity: {
    type: Number
  },
  referenceId: {
    type: String,
    default: null
  },
  remarks: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries

stockHistorySchema.index({ product: 1 });
stockHistorySchema.index({ dateDelivered: -1 });
stockHistorySchema.index({ productName: 1 });
stockHistorySchema.index({ createdAt: -1 });
stockHistorySchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('StockHistory', stockHistorySchema);

