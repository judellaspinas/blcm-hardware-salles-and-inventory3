import { useState, useEffect } from 'react';

const VOID_REASONS = [
  'Wrong order',
  'Customer changed their mind',
  'Payment issue',
  'Product defect or damage',
  'Duplicate transaction',
  'System error',
  'Other'
];

const VoidRequestModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  saleNumber,
  isLoading = false
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setCustomReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const reason = selectedReason === 'Other' ? customReason : selectedReason;
    if (reason.trim() && !isLoading) {
      onConfirm(reason.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && selectedReason && (selectedReason !== 'Other' || customReason.trim())) {
      handleConfirm();
    }
  };

  const isFormValid = selectedReason && (selectedReason !== 'Other' || customReason.trim());

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
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-4 mb-4">
          <div className="text-4xl">⚠️</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">Request to Void Sale</h3>
          </div>
        </div>
        
        <p className="text-gray-600 mb-4">
          Please provide a reason for voiding sale <strong>{saleNumber}</strong>. This request will be sent to an administrator for approval.
        </p>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Voiding *
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            autoFocus
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
              onKeyPress={handleKeyPress}
              placeholder="Enter the reason for voiding..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
            />
          </div>
        )}
        
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
            className={`px-4 py-2 rounded-lg transition-colors font-medium ${
              !isFormValid || isLoading
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

export default VoidRequestModal;

