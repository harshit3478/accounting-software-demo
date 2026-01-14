import { useState, useEffect } from "react";
import { Invoice } from "../../hooks/useInvoices";

interface ShipmentDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ShipmentDetailsModal({
  invoice,
  onClose,
  onUpdate,
}: ShipmentDetailsModalProps) {
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShipment = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/xps/shipments?invoiceId=${invoice.id}`);
        if (!res.ok) throw new Error("Failed to fetch shipment details");
        const data = await res.json();
        setShipment(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (invoice.id) {
      fetchShipment();
    }
  }, [invoice.id]);

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900">
            Shipment Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 rounded-full p-2 hover:bg-gray-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>Error loading shipment: {error}</p>
            </div>
          ) : shipment ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Booking Number (Shipment ID)</p>
                  <p className="font-mono font-medium text-gray-900">{shipment.bookNumber || shipment.orderId || invoice.shipmentId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tracking Number</p>
                  {shipment.trackingNumber ? (
                    <p className="font-mono font-medium text-blue-600">{shipment.trackingNumber}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Not generated yet</p>
                  )}
                </div>
                <div>
                    <p className="text-sm text-gray-500">Carrier / Service</p>
                    <p className="font-medium text-gray-900">
                        {shipment.carrierCode || shipment.shippingService || "-"} {shipment.serviceCode ? `- ${shipment.serviceCode}` : ""}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                        ${shipment.orderStatus === 'shipped' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {shipment.orderStatus || "Pending"}
                    </span>
                </div>
              </div>

              {/* Addresses */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Receiver (Destination)</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                        {/* Handle both direct 'receiver' object or 'destination' object from search API */}
                        {(() => {
                           const rcvr = shipment.receiver || shipment.destination || {};
                           return (
                             <>
                                <p className="font-medium text-gray-800">{rcvr.name || "Unknown"}</p>
                                {rcvr.company && <p>{rcvr.company}</p>}
                                <p>{rcvr.address1}</p>
                                {rcvr.address2 && <p>{rcvr.address2}</p>}
                                <p>{rcvr.city}{rcvr.city && rcvr.state ? ", " : ""}{rcvr.state} {rcvr.zip}</p>
                                <p>{rcvr.country}</p>
                                {rcvr.phone && <p>📞 {rcvr.phone}</p>}
                                {rcvr.email && <p>✉️ {rcvr.email}</p>}
                             </>
                           );
                        })()}
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                     <h3 className="font-semibold text-gray-900 mb-2">Package Details</h3>
                     <div className="text-sm text-gray-600 space-y-2">
                        {/* Attempt to show packages from 'packages' array or 'items' array if packages missing */}
                        {(() => {
                            const pkgs = (shipment.packages && shipment.packages.length > 0) 
                                ? shipment.packages 
                                : (shipment.items || []);
                            
                            if (!pkgs || pkgs.length === 0) {
                                return <p className="italic text-gray-400">No package details available</p>;
                            }

                            return pkgs.map((pkg: any, idx: number) => (
                                <div key={idx} className="bg-gray-50 p-2 rounded">
                                    <p className="font-medium text-gray-800">Item/Package {idx + 1}</p>
                                    {/* Handle weight which might be 'weight' or 'shippingWeight' */}
                                    <p>Weight: {pkg.weight || pkg.shippingWeight || "0"} {shipment.weightUnit || "lb"}</p>
                                    
                                    {(pkg.length && pkg.width && pkg.height) && (
                                        <p>Dims: {pkg.length}x{pkg.width}x{pkg.height} {shipment.dimUnit || "in"}</p>
                                    )}
                                    
                                    {/* If it's an item, show title */}
                                    {pkg.title && <p className="text-xs text-gray-500">Item: {pkg.title} (Qty: {pkg.quantity})</p>}
                                </div>
                            ));
                        })()}
                     </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
               No details found on remote server.
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Close
          </button>
          <button
            onClick={() => {
                onUpdate();
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Update / Edit Shipment
          </button>
        </div>
      </div>
    </div>
  );
}
