export const BUSINESS_CONFIG = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "BARLEY LUX",
  tagline: process.env.NEXT_PUBLIC_BUSINESS_TAGLINE || "18K Saudi Gold Jewelry",
  website: process.env.NEXT_PUBLIC_BUSINESS_WEBSITE || "https://barleylux.com/en",
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || "",
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "",
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "",
  colors: {
    gold: "#D4AF37",
    goldRGB: [212, 175, 55] as [number, number, number],
    cream: "#FFFEF0",
    creamRGB: [255, 254, 240] as [number, number, number],
    charcoal: "#2C2C2C",
    charcoalRGB: [44, 44, 44] as [number, number, number],
  },
};
