"use client";

import { useState } from "react";
import Modal from "./Modal";

interface UpdateCustomerFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  }) => void;
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  missingFields: ("email" | "address")[];
}

export default function UpdateCustomerFieldsModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
  missingFields,
}: UpdateCustomerFieldsModalProps) {
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setError("");
    onClose();
  };

  const handleUpdate = async () => {
    setError("");

    if (missingFields.includes("email") && !email.trim()) {
      setError("Email is required");
      return;
    }

    if (missingFields.includes("address") && !address.trim()) {
      setError("Address is required");
      return;
    }

    if (!customer) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data);
        onClose();
      } else {
        setError(data.error || "Failed to update customer");
      }
    } catch (err) {
      console.error("Error updating customer:", err);
      setError("An error occurred while updating customer");
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={handleClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isLoading}
      >
        Cancel
      </button>
      <button
        onClick={handleUpdate}
        disabled={
          isLoading ||
          (missingFields.includes("email") && !email.trim()) ||
          (missingFields.includes("address") && !address.trim())
        }
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
      >
        {isLoading ? "Updating..." : "Update & Continue"}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Complete Customer Information"
      footer={footer}
    >
      <div className="flex flex-col space-y-4 max-w-md">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
          To create an invoice for <strong>{customer?.name}</strong>, please
          provide the missing required information:
        </div>

        {/* Email Field */}
        {missingFields.includes("email") && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={isLoading}
              autoFocus
            />
          </div>
        )}

        {/* Phone Field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
        </div>

        {/* Address Field */}
        {missingFields.includes("address") && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address *
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, city, state, zip"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={3}
              disabled={isLoading}
            />
          </div>
        )}

        <div className="text-xs text-gray-500 pt-2">* Required fields</div>
      </div>
    </Modal>
  );
}
