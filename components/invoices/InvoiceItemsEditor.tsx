import { InvoiceItem } from './types';

interface InvoiceItemsEditorProps {
  items: InvoiceItem[];
  onChange: (items: InvoiceItem[]) => void;
}

export default function InvoiceItemsEditor({ items, onChange }: InvoiceItemsEditorProps) {
  const addItem = () => {
    onChange([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    let finalValue: string | number = value;
    
    // Prevent leading zeros for numeric fields
    if (field === 'quantity' || field === 'price') {
      if (typeof value === 'string' && value.startsWith('0') && value.length > 1 && value[1] !== '.') {
        finalValue = parseFloat(value);
      }
    }
    
    newItems[index] = { ...newItems[index], [field]: finalValue };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      onChange(items.filter((_, i) => i !== index));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Invoice Items <span className="text-red-500">*</span>
        </label>
        <button
          onClick={addItem}
          type="button"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Item
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Item name or description"
              />
            </div>
            <div className="w-24">
              <input
                type="number"
                min="1"
                value={item.quantity || ''}
                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    updateItem(index, 'quantity', val);
                  } else {
                    updateItem(index, 'quantity', 1);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Qty"
              />
            </div>
            <div className="w-32">
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.price || ''}
                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    updateItem(index, 'price', parseFloat(val.toFixed(2)));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Price"
              />
            </div>
            <div className="w-32 px-3 py-2 bg-gray-100 rounded-lg text-right font-medium text-gray-700">
              ${(item.quantity * item.price).toFixed(2)}
            </div>
            <button
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
              type="button"
              className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
