import { useState, useEffect } from 'react';
import { formatCurrencyDisplay, formatCurrency, formatDate, formatPaymentMethod } from '../utils/utils';

const VOID_REASONS = [
    'Wrong item',
    'Customer changed their mind',
    'Product defect or damage',
    'Size or specification issue',
    'System error',
    'Other'
];

const ReturnRequestModal = ({
    products,
    isOpen,
    onClose,
    onConfirm,
    sales,
    isLoading = false
}) => {
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [returnItems, setReturnItems] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // Reset all modal state when opened so nothing leaks from a previous sale
            setSelectedReason('');
            setCustomReason('');
            setProductSearchQuery('');
            setCart([]);
            setReturnItems([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (sales) {
            console.log("sales: ", sales);
        }
    }, [sales])

    if (!isOpen) return null;

    const handleConfirm = () => {
        const reason = selectedReason === 'Other' ? customReason : selectedReason;
        const hasReturnItems = returnItems.length > 0;

        if (!reason.trim() || !hasReturnItems || isLoading) {
            return;
        }

        onConfirm({
            returnItems,
            replacementItems: cart,
            reason: reason.trim()
        });
    };

    const handleReturnQtyChange = (productId, value, item) => {
        const qty = Math.max(0, Math.min(Number(value), item.quantity)); // clamp

        setReturnItems(prev => {
            const exists = prev.find(r => r.productId === productId);
            if (exists) {
                if (qty === 0) {
                    return prev.filter(r => r.productId !== productId);
                }
                return prev.map(r =>
                    r.productId === productId ? { ...r, returnQty: qty } : r
                );
            }

            if (qty > 0) {
                return [
                    ...prev,
                    {
                        productId,
                        name: item.product.name,
                        price: item.price,
                        originalQty: item.quantity,
                        returnQty: qty,
                    },
                ];
            }

            return prev;
        });
    };
    const hasReturnItems = returnItems.length > 0;
    const isFormValid =
        hasReturnItems &&
        selectedReason &&
        (selectedReason !== 'Other' || customReason.trim());

    const addToCart = (product) => {
        const existingItem = cart.find(item => item.product._id === product._id);
        // Calculate selling price: base price + (base price * markup percentage / 100)
        const basePrice = product.price || 0;
        const markupPercentage = product.markupPercentage || 0;
        const sellingPrice = basePrice + (basePrice * (markupPercentage / 100));
        if (existingItem) {
            setCart(cart.map(item =>
                item.product._id === product._id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { product, quantity: 1, price: sellingPrice }]);
        }
    };

    const updateCartQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            setCart(cart.filter(item => item.product._id !== productId));
        } else {
            setCart(cart.map(item =>
                item.product._id === productId
                    ? { ...item, quantity }
                    : item
            ));
        }
    };
    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
                if (!isLoading) {
                    onClose();
                }
            }}
        >
            <div
                className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center space-x-4 mb-4">
                    <div className="text-4xl">⚠️</div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">Request to Return Item</h3>
                    </div>
                </div>

                <p className="text-gray-600 mb-4">
                    Choose the item(s) and quantity to return, optionally add replacement items, and provide a reason.
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason for Return *
                    </label>
                    <select
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    >
                        <option value="">Select a reason...</option>
                        {VOID_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                                {reason}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedReason === 'Other' && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Please specify the reason *
                        </label>
                        <textarea
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            placeholder="Enter the reason for return..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
                        />
                    </div>
                )}
               
                {/* Sales Items – Select which item to return */}
                <div className="border rounded-lg p-4 mb-4">
                    <h3 className="font-semibold mb-2">Items Purchased</h3>

                    {!sales?.items?.length ? (
                        <p className="text-gray-500">No items found in this sale.</p>
                    ) : (
                        <div className="space-y-3 max-h-40 overflow-y-auto">
                            {sales.items.map(item => (
                                <div
                                    key={item.product._id}
                                    className="flex justify-between items-center bg-gray-50 p-3 rounded"
                                >
                                    {/* Item Info */}
                                    <div>
                                        <div className="font-semibold">{item.product.name}</div>
                                        <div className="text-sm text-gray-600">
                                            {formatCurrencyDisplay(item.price)} each
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Purchased: {item.quantity}
                                        </div>
                                    </div>

                                    {/* Return Quantity Selector */}
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">Return:</span>

                                        <button
                                            className="px-2 py-1 bg-gray-200 rounded"
                                            onClick={() =>
                                                handleReturnQtyChange(
                                                    item.product._id,
                                                    (returnItems.find(r => r.productId === item.product._id)?.returnQty || 0) - 1,
                                                    item
                                                )
                                            }
                                        >
                                            -
                                        </button>

                                        <input
                                            type="number"
                                            min={0}
                                            max={item.quantity}
                                            value={
                                                returnItems.find(r => r.productId === item.product._id)?.returnQty || 0
                                            }
                                            onChange={(e) =>
                                                handleReturnQtyChange(item.product._id, e.target.value, item)
                                            }
                                            className="w-14 text-center border rounded px-1 py-1"
                                        />

                                        <button
                                            className="px-2 py-1 bg-gray-200 rounded"
                                            onClick={() =>
                                                handleReturnQtyChange(
                                                    item.product._id,
                                                    (returnItems.find(r => r.productId === item.product._id)?.returnQty || 0) + 1,
                                                    item
                                                )
                                            }
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Products list */}
                <div className="space-y-4 mb-4">
                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Add Products</h3>
                        <div className="mb-3">
                            <input
                                type="text"
                                value={productSearchQuery}
                                onChange={(e) => setProductSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                            {products
                                .filter(p => p.stockQuantity > 0)
                                .filter(p =>
                                    productSearchQuery === '' ||
                                    p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
                                )
                                .map((product) => {
                                    // Calculate selling price: base price + (base price * markup percentage / 100)
                                    const basePrice = product.price || 0;
                                    const markupPercentage = product.markupPercentage || 0;
                                    const sellingPrice = basePrice + (basePrice * (markupPercentage / 100));
                                    return (
                                        <button
                                            key={product._id}
                                            type="button"
                                            onClick={() => addToCart(product)}
                                            className="text-left p-2 border rounded hover:bg-gray-50"
                                        >
                                            <div className="font-semibold">{product.name}</div>
                                            <div className="text-sm text-gray-600">{formatCurrencyDisplay(sellingPrice)}</div>
                                            <div className="text-xs text-gray-500">Stock: {product.stockQuantity}</div>
                                        </button>
                                    );
                                })}
                            {productSearchQuery !== '' && products
                                .filter(p => p.stockQuantity > 0)
                                .filter(p =>
                                    p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
                                ).length === 0 && (
                                    <div className="col-span-full text-center text-gray-500 py-4">
                                        No products found matching "{productSearchQuery}"
                                    </div>
                                )}
                        </div>
                    </div>

                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Cart Summary</h3>
                        {cart.length === 0 ? (
                            <p className="text-gray-500">No items in cart</p>
                        ) : (
                            <div className="space-y-2">
                                {cart.map((item) => (
                                    <div key={item.product._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div>
                                            <div className="font-semibold">{item.product.name}</div>
                                            <div className="text-sm text-gray-600">{formatCurrencyDisplay(item.price)} each</div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                                                className="px-2 py-1 bg-gray-200 rounded"
                                            >
                                                -
                                            </button>
                                            <span className="w-12 text-center">{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                                                disabled={item.quantity >= item.product.stockQuantity}
                                                className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50"
                                            >
                                                +
                                            </button>
                                            <span className="w-20 text-right font-semibold">
                                                {formatCurrencyDisplay(item.price * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex space-x-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isFormValid || isLoading}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium ${!isFormValid || isLoading
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                            }`}
                    >
                        {isLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReturnRequestModal;

