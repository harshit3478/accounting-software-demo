"use client";

import { useEffect, useState } from "react";
import type { Invoice } from "../../hooks/useInvoices";

interface ShipInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess?: (data: any) => void;
  onError?: (err: string) => void;
}

export default function ShipInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
  onError,
}: ShipInvoiceModalProps) {
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");
  const [phone, setPhone] = useState("");
  
  // Package details
  const [weight, setWeight] = useState("1");
  const [length, setLength] = useState("10");
  const [width, setWidth] = useState("10");
  const [height, setHeight] = useState("10");
  
  const [loadingAction, setLoadingAction] = useState<"create" | "update" | "cancel" | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Reset form first
    setName(invoice?.clientName || "");
    setStreet("");
    setCity("");
    setState("");
    setPostalCode("");
    setCountry("US");
    setPhone("");
    setWeight("1");
    setLength("10");
    setWidth("10");
    setHeight("10");

    // Lock body scroll
    document.body.style.overflow = "hidden";

    // If existing shipment, fetch details to prefill
    if (invoice?.shipmentId) {
      fetchShipmentDetails(invoice.id);
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, invoice]);

  const fetchShipmentDetails = async (invoiceId: number) => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/xps/shipments?invoiceId=${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        // XPS often returns { "orders": [ ... ] } or just the order object depending on endpoint
        // Based on our getShipmentFromXps, it targets /orders/{id}, which usually returns the single order object directly
        // But the previous curl showed a list when querying the integrations list.
        // Let's assume the getShipmentFromXps returns the single order object.
        const order = data; // or data.orders?.[0] if specific list endpoint used
        
        if (order && order.destination) {
          setName(order.destination.name || "");
          setStreet(order.destination.address1 || "");
          setCity(order.destination.city || "");
          setState(order.destination.state || "");
          setPostalCode(order.destination.zip || "");
          setCountry(order.destination.country || "US");
          setPhone(order.destination.phone || "");
        }
        
        // XPS items/packages structure can be complex.
        // If we want to prefill package, we look at 'packages' array if available
        // The curl response didn't show "packages" explicitly in the order object, just "items".
        // Often shipping info is in a separate field or implicit. 
        // We will leave package defaults or try to parse if available.
      }
    } catch (e) {
      console.error("Failed to fetch shipment details", e);
    } finally {
      setIsFetching(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!invoice) return;
    setLoadingAction("create");

    try {
      const res = await fetch("/api/xps/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          address: { name, street, city, state, postalCode, country, phone },
          packages: [{
            weight,
            length,
            width,
            height
          }]
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = data?.error || "Failed to send order to XPS";
        onError?.(err);
      } else {
        onSuccess?.(data);
        onClose();
      }
    } catch (err: any) {
      console.error("Ship invoice error", err);
      onError?.(err?.message || "Failed to send order to XPS");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdate = async () => {
    if (!invoice || !invoice.shipmentId) return;
    setLoadingAction("update");
    try {
      const res = await fetch("/api/xps/shipments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: invoice.shipmentId,
          invoiceId: invoice.id,
          address: { name, street, city, state, postalCode, country, phone },
          packages: [{
            weight,
            length,
            width,
            height
          }]
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError?.(data?.error || "Failed to update shipment");
      } else {
        onSuccess?.(data);
        onClose();
      }
    } catch (err: any) {
      console.error("Update shipment error", err);
      onError?.(err?.message || "Failed to update shipment");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!invoice || !invoice.shipmentId) return;
    if (!confirm("Are you sure you want to cancel this shipment?")) return;
    setLoadingAction("cancel");
    try {
      const res = await fetch("/api/xps/shipments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: invoice.shipmentId,
          invoiceId: invoice.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError?.(data?.error || "Failed to cancel shipment");
      } else {
        onSuccess?.(data);
        onClose();
      }
    } catch (err: any) {
      console.error("Cancel shipment error", err);
      onError?.(err?.message || "Failed to cancel shipment");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
        onClick={!loadingAction ? onClose : undefined}
        aria-hidden="true"
      ></div>

      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full animate-scale-in max-h-[80vh] overflow-auto"
        role="dialog"
        aria-modal="true"
      >
        {isFetching && (
          <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-8 w-8 text-sky-600 mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm font-medium text-gray-600">Loading shipment details...</p>
            </div>
          </div>
        )}

        <div className="p-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">
            Create Shipment for {invoice?.invoiceNumber}
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className="md:col-span-1">
              <label
                htmlFor="recipient-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Recipient name
              </label>
              <input
                id="recipient-name"
                className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                placeholder="Recipient name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="md:col-span-1">
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Phone
              </label>
              <input
                id="phone"
                className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="street-address"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Street address
              </label>
              <input
                id="street-address"
                className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                placeholder="Street address"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="city"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                City
              </label>
              <input
                id="city"
                className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="state"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                State
              </label>
              <input
                id="state"
                className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="postal-code"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Postal code
              </label>
              <input
                id="postal-code"
                className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                placeholder="Postal code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="country"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Country
              </label>
              <input
                id="country"
                className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Package Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lb)</label>
                  <input
                    type="number"
                    className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length (in)</label>
                  <input
                    type="number"
                    className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width (in)</label>
                  <input
                    type="number"
                    className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                  <input
                    type="number"
                    className="input h-10 px-3 text-sm w-full border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={!!loadingAction}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          {invoice?.shipmentId ? (
            <>
              <button
                onClick={handleCancel}
                disabled={!!loadingAction}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors"
              >
                {loadingAction === "cancel" ? "Canceling…" : "Cancel Shipment"}
              </button>
              <button
                onClick={handleUpdate}
                disabled={!!loadingAction}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
              >
                {loadingAction === "update" ? "Updating…" : "Update Shipment"}
              </button>
            </>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!!loadingAction}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors"
            >
              {loadingAction === "create" ? "Sending…" : "Create Shipment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
