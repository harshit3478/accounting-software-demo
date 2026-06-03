"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import UserAvatar from "../UserAvatar";

interface ProfileTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

interface ProfileData {
  id: number;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  displayName: string;
}

export default function ProfileTab({ showSuccess, showError }: ProfileTabProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load profile");
        }
        const data = (await res.json()) as ProfileData;
        setProfile(data);
        setName(data.name?.trim() || "");
        setAvatarUrl(data.avatarUrl ?? null);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to load profile";
        showError(message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [showError]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload photo");
      }

      setAvatarUrl(data.avatarUrl ?? null);
      showSuccess("Profile photo updated");
      window.location.reload();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to upload photo";
      showError(message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove photo");
      }

      setAvatarUrl(null);
      showSuccess("Profile photo removed");
      window.location.reload();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to remove photo";
      showError(message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      showError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      const token = localStorage.getItem("token");
      if (token) {
        document.cookie = `token=${token}; path=/; max-age=${
          60 * 60 * 24 * 7
        }; samesite=lax`;
      }

      setProfile(data);
      setName(data.name?.trim() || "");
      showSuccess("Profile updated. Your name will appear in invoice history.");
      window.location.reload();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    profile?.displayName ||
    (user?.name?.trim() ? user.name : user?.email) ||
    "Unknown";

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">My Profile</h2>
        <p className="text-gray-600 text-sm">
          Set your name and photo. Your photo appears in the top navigation.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading profile...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="max-w-lg space-y-6">
          <div className="flex items-center gap-5">
            <UserAvatar
              src={avatarUrl}
              name={name || profile?.name}
              email={profile?.email || user?.email}
              size="lg"
            />
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingAvatar ? "Uploading..." : "Upload photo"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="block px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
              <p className="text-xs text-gray-500">
                JPEG, PNG, WebP, or GIF. Max 2MB. Without a photo, your initials
                are shown instead.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={profile?.email || user?.email || ""}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
            <p className="mt-1 text-xs text-gray-500">
              Email cannot be changed here. Contact an admin if you need to
              update it.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p>
              <span className="font-medium">Shown in history as:</span>{" "}
              {displayName}
            </p>
            {!name.trim() && profile?.email && (
              <p className="mt-1 text-blue-800">
                Until you save a name, history entries use your email (
                {profile.email}).
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      )}
    </div>
  );
}
