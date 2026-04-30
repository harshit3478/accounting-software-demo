"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  }) => void;
  forceEmailAndAddress?: boolean;
  defaultName?: string;
}

export default function AddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
  forceEmailAndAddress = false,
  defaultName = "",
}: AddCustomerModalProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Update name when defaultName prop changes
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
    }
  }, [defaultName, isOpen]);

  const resetForm = () => {
    setName(defaultName);
    setEmail("");
    setPhone("");
    setAddress("");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreateCustomer = async () => {
    setError("");

    if (!name.trim()) {
      setError("Customer name is required");
      return;
    }

    if (forceEmailAndAddress) {
      if (!email.trim()) {
        setError("Email is required");
        return;
      }
      if (!address.trim()) {
        setError("Address is required");
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data);
        resetForm();
        onClose();
      } else {
        setError(data.error || "Failed to create customer");
      }
    } catch (err) {
      console.error("Error creating customer:", err);
      setError("An error occurred while creating customer");
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
        onClick={handleCreateCustomer}
        disabled={
          isLoading ||
          !name.trim() ||
          (forceEmailAndAddress && (!email.trim() || !address.trim()))
        }
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
      >
        {isLoading ? "Creating..." : "Create Customer"}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        forceEmailAndAddress ? "Add Customer (Required Fields)" : "Add Customer"
      }
      footer={footer}
    >
      <div className="flex flex-col space-y-4 max-w-md">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {forceEmailAndAddress && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
            All fields marked with * are required to create an invoice
          </div>
        )}

        {/* Name Field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Customer Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter customer name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={isLoading}
            autoFocus
          />
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Email {forceEmailAndAddress && "*"}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
        </div>

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
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Address {forceEmailAndAddress && "*"}
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

        <div className="text-xs text-gray-500 pt-2">* Required fields</div>
      </div>
    </Modal>
  );
}
