import Sale from '../models/Sale.model.js';
import Product from '../models/Product.model.js';
import User from '../models/User.model.js';
import StockHistory from '../models/StockHistory.model.js';
import mongoose from 'mongoose';
/**
 * @desc    Get sales report
 * @route   GET /api/reports/sales
 * @access  Private/Admin
 */
export const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, cashier } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const cashierId = cashier;
    end.setHours(23, 59, 59, 999);

    const hasCashierFilter =
      cashierId && mongoose.Types.ObjectId.isValid(cashierId);

    const baseMatch = {
      createdAt: { $gte: start, $lte: end },
      isVoid: false
    };

    if (hasCashierFilter) {
      baseMatch.cashier = new mongoose.Types.ObjectId(cashierId);
    }

    const [summaryResult, salesByDateResult, sales, bestStaffResult] =
      await Promise.all([
        // SUMMARY
        Sale.aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: null,
              totalSales: { $sum: 1 },
              totalRevenue: { $sum: '$total' },
              totalVAT: { $sum: '$tax' }
            }
          }
        ]),

        // SALES BY DATE
        Sale.aggregate([
          { $match: baseMatch },
          {
            $addFields: {
              localDate: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: process.env.TZ || 'Asia/Manila'
                }
              }
            }
          },
          {
            $group: {
              _id: '$localDate',
              count: { $sum: 1 },
              revenue: { $sum: '$total' }
            }
          },
          { $sort: { _id: 1 } }
        ]),

        // SALES LIST
        Sale.find(baseMatch)
          .populate('cashier', 'username')
          .populate('items.product', 'name')
          .sort({ createdAt: -1 })
          .limit(100),

        // BEST STAFF
        Sale.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              isVoid: false,
              cashier: hasCashierFilter
                ? new mongoose.Types.ObjectId(cashierId)
                : { $exists: true, $ne: null }
            }
          },
          {
            $group: {
              _id: '$cashier',
              totalSales: { $sum: 1 },
              totalRevenue: { $sum: '$total' },
              totalProfit: {
                $sum: {
                  $subtract: [
                    '$total',
                    { $multiply: ['$total', 0.12] }
                  ]
                }
              }
            }
          },
          { $sort: { totalRevenue: -1 } },
          ...(hasCashierFilter ? [] : [{ $limit: 1 }]),
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'cashierInfo'
            }
          },
          { $unwind: '$cashierInfo' },
          {
            $project: {
              _id: 1,
              username: '$cashierInfo.username',
              totalSales: 1,
              totalRevenue: 1,
              totalProfit: 1
            }
          }
        ])
      ]);


    const summary = summaryResult[0] || { totalSales: 0, totalRevenue: 0, totalVAT: 0 };

    const bestStaff = bestStaffResult.length > 0 ? bestStaffResult[0] : null;

    const formattedSalesByDate = salesByDateResult.map(item => ({
      date: item._id,
      total: item.revenue,
      count: item.count
    }));

    // Calculate Cost of Goods Sold (COGS) for the period
    // COGS = sum of (base price × quantity) for all items sold in the period
    let totalCOGS = 0;
    if (sales.length > 0) {
      // Get all product IDs from sales items
      const productIds = [];
      sales.forEach(sale => {
        sale.items.forEach(item => {
          const productId = item.product?._id || item.product;
          if (productId && !productIds.includes(productId.toString())) {
            productIds.push(productId.toString());
          }
        });
      });

      // Fetch products to get base prices
      if (productIds.length > 0) {
        const products = await Product.find({ _id: { $in: productIds } });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        // Calculate COGS for each sale
        sales.forEach(sale => {
          sale.items.forEach(item => {
            const productId = (item.product?._id || item.product)?.toString();
            const product = productMap.get(productId);
            if (product) {
              // Base price is the price field (what company paid supplier)
              totalCOGS += product.price * item.quantity;
            }
          });
        });
      }
    }

    // Calculate profit = Revenue - COGS
    const profit = summary.totalRevenue - totalCOGS;

    res.json({
      success: true,
      period: { startDate, endDate },
      summary: {
        totalSales: summary.totalSales,
        totalRevenue: summary.totalRevenue,
        totalVAT: summary.totalVAT,
        totalCOGS: totalCOGS,
        profit: profit
      },
      salesByDate: formattedSalesByDate,
      data: sales,
      bestStaff
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory report
 * @route   GET /api/reports/inventory
 * @access  Private/Admin
 */
export const getInventoryReport = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate('supplier', 'companyName')
      .sort({ category: 1, name: 1 });

    const totalProducts = products.length;
    const totalStockValue = products.reduce((sum, p) => sum + (p.price * p.stockQuantity), 0);
    const lowStockProducts = products.filter(p => p.stockQuantity <= p.lowStockThreshold);
    const outOfStockProducts = products.filter(p => p.stockQuantity === 0);

    // Group by category
    const byCategory = {};
    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = { count: 0, totalValue: 0 };
      }
      byCategory[category].count += 1;
      byCategory[category].totalValue += product.price * product.stockQuantity;
    });

    res.json({
      success: true,
      summary: {
        totalProducts,
        totalStockValue,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length
      },
      byCategory,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p._id,
        name: p.name,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold,
        supplier: p.supplier
      })),
      outOfStockProducts: outOfStockProducts.map(p => ({
        id: p._id,
        name: p.name,
        supplier: p.supplier
      })),
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get top selling products
 * @route   GET /api/reports/top-products
 * @access  Private/Admin
 */
export const getTopProducts = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const matchFilter = { isVoid: false };
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include full end date

      matchFilter.createdAt = {
        $gte: start,
        $lte: end
      };
    }

    // Use aggregation pipeline for better performance
    const topProducts = await Sale.aggregate([
      {
        $match: matchFilter
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' },
          saleCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          totalQuantity: 1,
          totalRevenue: 1,
          saleCount: 1
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json({
      success: true,
      count: topProducts.length,
      data: topProducts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get revenue trends
 * @route   GET /api/reports/revenue-trends
 * @access  Private/Admin
 */
export const getRevenueTrends = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Determine date format based on groupBy
    let dateFormat;
    if (groupBy === 'day') {
      dateFormat = '%Y-%m-%d';
    } else if (groupBy === 'week') {
      dateFormat = '%Y-%U'; // Year-Week number
    } else if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    } else {
      dateFormat = '%Y-%m-%d';
    }

    // Get timezone from environment or default to Asia/Manila (Philippines)
    const timezone = process.env.TZ || 'Asia/Manila';

    // Use aggregation pipeline for better performance
    const trendData = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          isVoid: false
        }
      },
      {
        $addFields: {
          // Convert UTC date to local date string for grouping
          localDate: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
              timezone: timezone
            }
          }
        }
      },
      {
        $group: {
          _id: '$localDate',
          revenue: { $sum: '$total' },
          sales: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id',
          revenue: 1,
          sales: 1,
          _id: 0
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    res.json({
      success: true,
      period: { startDate, endDate, groupBy },
      data: trendData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory movement report
 * @route   GET /api/reports/inventory-movement
 * @access  Private/Admin
 */
export const getInventoryMovementReport = async (req, res, next) => {
  try {
    const { start, end, productId, type } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Start and end dates are required'
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const match = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      match.product = new mongoose.Types.ObjectId(productId);
    }

    if (type) {
      match.type = type;
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $addFields: {
          productName: '$productInfo.name',
          productBrand: '$productInfo.brand',
          productCategory: '$productInfo.category',
          movementDate: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: process.env.TZ || 'Asia/Manila'
            }
          }
        }
      }
    ];

    const [entries, summaryByProduct, dailyNetMovement] = await Promise.all([
      // Raw ordered entries
      StockHistory.aggregate([
        ...pipeline,
        { $sort: { createdAt: 1 } }
      ]),

      // Summary per product
      StockHistory.aggregate([
        ...pipeline,
        {
          $group: {
            _id: '$product',
            productId: { $first: '$product' },
            productName: { $first: '$productName' },
            productBrand: { $first: '$productBrand' },
            productCategory: { $first: '$productCategory' },
            totalStockIn: {
              $sum: {
                $cond: [{ $gt: ['$quantity', 0] }, '$quantity', 0]
              }
            },
            totalStockOut: {
              $sum: {
                $cond: [{ $lt: ['$quantity', 0] }, '$quantity', 0]
              }
            },
            beginningQuantity: { $min: '$previousQuantity' },
            endingQuantity: { $max: '$newQuantity' }
          }
        },
        {
          $project: {
            _id: 0,
            productId: 1,
            productName: 1,
            productBrand: 1,
            productCategory: 1,
            beginningQuantity: 1,
            totalStockIn: 1,
            totalStockOut: 1,
            endingQuantity: 1
          }
        }
      ]),

      // Daily net movement for charting
      StockHistory.aggregate([
        ...pipeline,
        {
          $group: {
            _id: '$movementDate',
            netMovement: { $sum: '$quantity' }
          }
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            netMovement: 1
          }
        },
        { $sort: { date: 1 } }
      ])
    ]);

    const totalStockIn = entries.reduce((sum, e) => sum + (e.quantity > 0 ? e.quantity : 0), 0);
    const totalStockOut = entries.reduce((sum, e) => sum + (e.quantity < 0 ? -e.quantity : 0), 0);
    const netMovement = totalStockIn - totalStockOut;

    res.json({
      success: true,
      period: { start, end },
      summary: {
        totalStockIn,
        totalStockOut,
        netMovement
      },
      dailyNetMovement,
      byProduct: summaryByProduct,
      entries
    });
  } catch (error) {
    next(error);
  }
};

