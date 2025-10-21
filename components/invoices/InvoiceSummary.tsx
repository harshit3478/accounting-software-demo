interface InvoiceSummaryProps {
  subtotal: number;
  tax: number;
  taxType?: 'fixed' | 'percentage';
  discount: number;
  discountType?: 'fixed' | 'percentage';
  total: number;
}

export default function InvoiceSummary({ subtotal, tax, taxType = 'fixed', discount, discountType = 'fixed', total }: InvoiceSummaryProps) {
  const getTaxDisplay = () => {
    if (taxType === 'percentage') {
      return `${tax.toFixed(2)}% (${((subtotal * tax) / 100).toFixed(2)})`;
    }
    return `$${tax.toFixed(2)}`;
  };

  const getDiscountDisplay = () => {
    if (discountType === 'percentage') {
      return `${discount.toFixed(2)}% ($${((subtotal * discount) / 100).toFixed(2)})`;
    }
    return `$${discount.toFixed(2)}`;
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Subtotal:</span>
        <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Tax:</span>
        <span className="font-medium text-gray-900">${(taxType === 'percentage' ? (subtotal * tax) / 100 : tax).toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Discount:</span>
        <span className="font-medium text-red-600">-${(discountType === 'percentage' ? (subtotal * discount) / 100 : discount).toFixed(2)}</span>
      </div>
      <div className="border-t border-gray-300 pt-3 flex justify-between">
        <span className="text-lg font-semibold text-gray-900">Total:</span>
        <span className="text-lg font-bold text-blue-600">${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
