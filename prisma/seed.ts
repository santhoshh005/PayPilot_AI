import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  // ─── WIRELESS EARBUDS (5 products) ────────────────────────
  {
    name: "boAt Airdopes 141",
    brand: "boAt",
    category: "Wireless Earbuds",
    price: 1299.00,
    description: "True wireless earbuds featuring 42 hours total playback, Beast Mode low latency for gaming, and ENx noise-cancelling mics.",
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "42 hours",
      batteryLifeHours: 42,
      driverSize: "8mm",
      bluetooth: "v5.1",
      latency: "80ms",
      waterResistance: "IPX4",
      chargingTime: "1 hour ASAP charge",
    },
    features: ["42H Total Playtime", "Beast Mode (Low Latency)", "ENx Environmental Noise Cancellation", "ASAP Fast Charge", "IPX4 Sweat Resistant"],
    rating: 4.1,
    inStock: true,
  },
  {
    name: "Noise Buds VS102",
    brand: "Noise",
    category: "Wireless Earbuds",
    price: 1299.00,
    description: "Compact wireless earbuds with an astounding 50 hours of playtime, Flybird design, and clear 11mm sound drivers.",
    imageUrl: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "50 hours",
      batteryLifeHours: 50,
      driverSize: "11mm",
      bluetooth: "v5.3",
      latency: "90ms",
      waterResistance: "IPX5",
      chargingTime: "1.5 hours",
    },
    features: ["50H Playtime", "11mm Speaker Driver", "Instacharge (10 min = 120 min)", "IPX5 Water Resistant", "Sleek Touch Controls"],
    rating: 4.2,
    inStock: true,
  },
  {
    name: "Boult Audio AirBass Propods X",
    brand: "Boult Audio",
    category: "Wireless Earbuds",
    price: 1499.00,
    description: "Ergonomic TWS earbuds with 32 hours battery, booming extra bass, and quad microphones with environmental noise cancellation.",
    imageUrl: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "32 hours",
      batteryLifeHours: 32,
      driverSize: "10mm",
      bluetooth: "v5.2",
      latency: "60ms",
      waterResistance: "IPX5",
      chargingTime: "1 hour",
    },
    features: ["32H Battery Life", "Booming Extra Bass", "Quad Microphones", "Type-C Fast Charging", "Touch Controls"],
    rating: 4.0,
    inStock: true,
  },
  {
    name: "OnePlus Nord Buds 2",
    brand: "OnePlus",
    category: "Wireless Earbuds",
    price: 2499.00,
    description: "Feature-packed TWS with 25dB Active Noise Cancellation, 12.4mm titanium drivers, and 36 hours of total listening time.",
    imageUrl: "https://images.unsplash.com/photo-1598331668826-20cecc596b86?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "36 hours",
      batteryLifeHours: 36,
      driverSize: "12.4mm Titanium",
      bluetooth: "v5.3",
      anc: "25dB Active Noise Cancellation",
      waterResistance: "IP55",
      chargingTime: "10 min charge for 5 hours",
    },
    features: ["25dB Active Noise Cancellation", "12.4mm Dynamic Titanium Drivers", "36 Hours Playback", "Dolby Atmos Support", "IP55 Rating"],
    rating: 4.5,
    inStock: true,
  },
  {
    name: "Realme Buds Air 5",
    brand: "Realme",
    category: "Wireless Earbuds",
    price: 3699.00,
    description: "Flagship-tier 50dB deep active noise cancellation, ultra-wide frequency drivers, and 38 hours playback.",
    imageUrl: "https://images.unsplash.com/photo-1627989580309-bfaf3e58af6f?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "38 hours",
      batteryLifeHours: 38,
      driverSize: "12.4mm Mega Titanizing",
      bluetooth: "v5.3",
      anc: "50dB Deep Active Noise Cancellation",
      waterResistance: "IPX5",
      chargingTime: "1.5 hours",
    },
    features: ["50dB Deep ANC", "12.4mm Titanizing Drivers", "38 Hours Battery", "Dynamic Bass Boost", "6-Mic Call Noise Cancellation"],
    rating: 4.4,
    inStock: true,
  },

  // ─── HEADPHONES (4 products) ──────────────────────────────
  {
    name: "boAt Rockerz 550",
    brand: "boAt",
    category: "Headphones",
    price: 1999.00,
    description: "Over-ear wireless headphones with powerful 50mm dynamic drivers, 20 hours battery backup, and plush memory foam ear cushions.",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "20 hours",
      driverSize: "50mm Dynamic",
      type: "Over-Ear Wireless",
      bluetooth: "v5.0",
      auxSupport: "Yes (3.5mm)",
      weight: "245g",
    },
    features: ["50mm Dynamic Drivers", "20H Playback Time", "Physical Noise Isolation", "Dual Connectivity (BT + AUX)", "Ergonomic Over-Ear Cushions"],
    rating: 4.2,
    inStock: true,
  },
  {
    name: "Sennheiser HD 450SE",
    brand: "Sennheiser",
    category: "Headphones",
    price: 7990.00,
    description: "Audiophile-grade active noise cancellation headphones with superior wireless sound, AAC and aptX Low Latency support, and 30 hours battery.",
    imageUrl: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "30 hours",
      driverSize: "32mm Transducer",
      type: "Over-Ear Wireless",
      bluetooth: "v5.0 with aptX",
      anc: "Active Noise Cancellation",
      weight: "238g",
    },
    features: ["Active Noise Cancellation", "30-Hour Battery Life", "aptX Low Latency Support", "Voice Assistant Integration", "Sennheiser Smart Control App"],
    rating: 4.3,
    inStock: true,
  },
  {
    name: "Sony WH-1000XM5",
    brand: "Sony",
    category: "Headphones",
    price: 26990.00,
    description: "Industry-leading noise canceling headphones with two processors, 8 microphones, Auto NC Optimizer, and exceptional high-res audio quality.",
    imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "30 hours (ANC on) / 40 hours (ANC off)",
      driverSize: "30mm Precision Engineered",
      type: "Over-Ear Wireless",
      bluetooth: "v5.2 with LDAC",
      anc: "Dual Processor V1 & QN1 with 8 Mics",
      weight: "250g",
    },
    features: ["Industry Leading Noise Cancellation", "Speak-to-Chat Technology", "Multipoint Connection", "Crystal Clear Hands-Free Calling", "Hi-Res Wireless Audio (LDAC)"],
    rating: 4.8,
    inStock: true,
  },
  {
    name: "Bose QuietComfort 45",
    brand: "Bose",
    category: "Headphones",
    price: 24990.00,
    description: "Iconic quiet, comfort, and sound. Premium wireless noise-cancelling headphones crafted with plush synthetic leather and impact-resistant materials.",
    imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80",
    specs: {
      battery: "24 hours",
      driverSize: "TriPort Acoustic Architecture",
      type: "Over-Ear Wireless",
      bluetooth: "v5.1",
      anc: "Quiet & Aware Modes",
      weight: "240g",
    },
    features: ["World-Class Noise Cancellation", "Quiet & Aware Modes", "High-Fidelity Audio", "24-Hour Battery Life", "Lightweight All-Day Comfort"],
    rating: 4.7,
    inStock: true,
  },

  // ─── SMARTWATCHES (4 products) ────────────────────────────
  {
    name: "Fire-Boltt Ninja Call Pro Plus",
    brand: "Fire-Boltt",
    category: "Smartwatches",
    price: 1499.00,
    description: "Large 1.83-inch HD display smartwatch with Bluetooth calling, AI voice assistance, and 100+ sports tracking modes.",
    imageUrl: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80",
    specs: {
      display: "1.83 inch HD Display",
      battery: "8 days typical usage",
      calling: "Bluetooth Calling enabled",
      sensors: "SpO2, Heart Rate, Sleep Tracker",
      waterResistance: "IP67",
      sportsModes: "100+ Sports Modes",
    },
    features: ["1.83\" HD Display", "Bluetooth Calling with Inbuilt Speaker", "AI Voice Assistant", "Full Health Suite", "IP67 Water Resistant"],
    rating: 4.0,
    inStock: true,
  },
  {
    name: "boAt Wave Call Smartwatch",
    brand: "boAt",
    category: "Smartwatches",
    price: 1799.00,
    description: "Curved 1.69-inch HD display with dedicated Bluetooth calling dial pad, heart rate monitoring, and 150+ watch faces.",
    imageUrl: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80",
    specs: {
      display: "1.69 inch HD Curved Screen (550 nits)",
      battery: "7 days (2 days with BT calling)",
      calling: "Dedicated Dial Pad & Mic",
      sensors: "Heart Rate & SpO2 Tracker",
      waterResistance: "IP68",
      sportsModes: "Multiple Sports Modes",
    },
    features: ["1.69\" HD Display with 550 Nits", "Advanced Bluetooth Calling", "Live Cricket Scores", "IP68 Dust & Water Proof", "150+ Watch Faces"],
    rating: 4.1,
    inStock: true,
  },
  {
    name: "Noise ColorFit Pro 4",
    brand: "Noise",
    category: "Smartwatches",
    price: 2999.00,
    description: "Advanced calling smartwatch with 1.72-inch TruView TFT display, fully functional digital crown for navigation, and 60Hz refresh rate.",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
    specs: {
      display: "1.72 inch TFT (356x400 px, 60Hz)",
      battery: "7 days battery backup",
      calling: "Instacharge BT Calling",
      crown: "Functional Digital Crown",
      sensors: "Noise Health Suite (SpO2, 24x7 Heart Rate)",
      waterResistance: "IP68",
    },
    features: ["60Hz Smooth Refresh Rate", "Digital Crown Navigation", "TruSync Bluetooth Calling", "Noise Health Suite", "100 Sports Modes"],
    rating: 4.3,
    inStock: true,
  },
  {
    name: "Samsung Galaxy Watch 4",
    brand: "Samsung",
    category: "Smartwatches",
    price: 9999.00,
    description: "Premium Wear OS smartwatch with BioActive body composition sensor, advanced sleep analysis, optical heart rate sensor, and Google app ecosystem.",
    imageUrl: "https://images.unsplash.com/photo-1510017803434-a899398421b3?w=600&auto=format&fit=crop&q=80",
    specs: {
      display: "1.4 inch Super AMOLED (450x450 px)",
      os: "Wear OS Powered by Samsung",
      battery: "40 hours",
      sensors: "BioActive Sensor (BIA, ECG, HR)",
      connectivity: "Bluetooth 5.0, Wi-Fi, NFC, GPS",
      waterResistance: "5ATM + IP68 / MIL-STD-810G",
    },
    features: ["Wear OS by Samsung", "Body Composition Analysis (BIA)", "Advanced Sleep & Snore Tracking", "Google Play & Maps Support", "5ATM Water Resistance"],
    rating: 4.6,
    inStock: true,
  },

  // ─── SMARTPHONES (4 products) ─────────────────────────────
  {
    name: "Redmi Note 13 5G",
    brand: "Xiaomi",
    category: "Smartphones",
    price: 15499.00,
    description: "Super-slim 5G smartphone with 108MP triple camera setup, 120Hz vibrant AMOLED display, and MediaTek Dimensity 6080 processor.",
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "MediaTek Dimensity 6080 (6nm)",
      display: "6.67 inch FHD+ AMOLED 120Hz",
      camera: "108MP + 8MP + 2MP Triple Camera",
      battery: "5000mAh with 33W Fast Charging",
      ramStorage: "6GB RAM / 128GB Storage",
      os: "MIUI 14 (Android 13)",
    },
    features: ["108MP AI Triple Camera", "120Hz AMOLED Screen", "33W Turbo Fast Charge", "Slim 7.6mm Profile", "Corning Gorilla Glass 5"],
    rating: 4.2,
    inStock: true,
  },
  {
    name: "Samsung Galaxy M34 5G",
    brand: "Samsung",
    category: "Smartphones",
    price: 16999.00,
    description: "Monster 6000mAh battery smartphone with 50MP No Shake OIS camera, 120Hz Super AMOLED display, and 4 years of OS upgrades.",
    imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "Exynos 1280 Octa-Core (5nm)",
      display: "6.5 inch FHD+ 120Hz Super AMOLED",
      camera: "50MP OIS Main + 8MP Ultra-Wide + 2MP",
      battery: "6000mAh Massive Battery (25W)",
      ramStorage: "6GB RAM / 128GB Storage",
      os: "One UI 5.1 (Android 13)",
    },
    features: ["50MP No Shake OIS Camera", "Massive 6000mAh Battery", "120Hz Super AMOLED Display", "Voice Focus for Calls", "Knox Security"],
    rating: 4.3,
    inStock: true,
  },
  {
    name: "OnePlus Nord CE 3 Lite 5G",
    brand: "OnePlus",
    category: "Smartphones",
    price: 17499.00,
    description: "Fast and smooth smartphone with 67W SUPERVOOC charging, 108MP camera, Snapdragon 695 5G chipset, and dual stereo speakers.",
    imageUrl: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "Qualcomm Snapdragon 695 5G",
      display: "6.72 inch 120Hz Adaptive Refresh Screen",
      camera: "108MP 3x Lossless Zoom + 2MP Macro + 2MP Depth",
      battery: "5000mAh with 67W Fast Charging",
      ramStorage: "8GB RAM / 128GB Storage",
      os: "OxygenOS 13.1",
    },
    features: ["67W SUPERVOOC Endurance Charge", "108MP Lossless Zoom Camera", "Snapdragon 695 5G Chipset", "Dual Stereo Speakers with 200% Ultra Volume", "OxygenOS 13"],
    rating: 4.4,
    inStock: true,
  },
  {
    name: "Apple iPhone 15",
    brand: "Apple",
    category: "Smartphones",
    price: 69900.00,
    description: "Groundbreaking iPhone featuring Dynamic Island, 48MP main camera with 2x Telephoto, A16 Bionic chip, and durable color-infused glass.",
    imageUrl: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "A16 Bionic Chip (5-core GPU)",
      display: "6.1 inch Super Retina XDR OLED",
      camera: "48MP Main + 12MP Ultra Wide with 2x Telephoto",
      battery: "All-day battery life (Up to 20h video)",
      ramStorage: "128GB Storage",
      os: "iOS 17",
      connector: "USB-C",
    },
    features: ["Dynamic Island Innovation", "48MP Main Camera with 2x Telephoto", "A16 Bionic Powerhouse", "Color-Infused Back Glass", "Universal USB-C Port"],
    rating: 4.8,
    inStock: true,
  },

  // ─── LAPTOPS (4 products) ─────────────────────────────────
  {
    name: "ASUS Vivobook 15",
    brand: "ASUS",
    category: "Laptops",
    price: 38990.00,
    description: "Sleek and portable laptop powered by Intel Core i3 12th Gen, 8GB DDR4 RAM, 512GB NVMe SSD, and 180-degree lay-flat hinge.",
    imageUrl: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "Intel Core i3-1215U (up to 4.4 GHz, 6 Cores)",
      ram: "8GB DDR4 3200MHz",
      storage: "512GB M.2 NVMe PCIe SSD",
      display: "15.6 inch FHD (1920 x 1080) Anti-glare",
      graphics: "Intel UHD Graphics",
      weight: "1.70 kg",
      battery: "Up to 6 hours",
    },
    features: ["12th Gen Intel Core i3", "512GB Fast SSD Storage", "ErgoSense Keyboard", "180-Degree Lay-Flat Hinge", "Lightweight Design"],
    rating: 4.1,
    inStock: true,
  },
  {
    name: "HP 15s Ryzen 5",
    brand: "HP",
    category: "Laptops",
    price: 42990.00,
    description: "Reliable workhorse laptop featuring AMD Ryzen 5 5500U 6-core processor, 16GB RAM, 512GB SSD, and micro-edge anti-glare display.",
    imageUrl: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "AMD Ryzen 5 5500U (6 Cores / 12 Threads)",
      ram: "16GB DDR4 RAM",
      storage: "512GB PCIe NVMe M.2 SSD",
      display: "15.6 inch FHD Micro-Edge Display",
      graphics: "AMD Radeon Graphics",
      weight: "1.69 kg",
      battery: "41Wh Battery (Fast Charge: 50% in 45m)",
    },
    features: ["AMD Ryzen 5 6-Core Processor", "16GB Dual Channel RAM", "HP TrueVision HD Camera", "Fast Charging Support", "Pre-installed MS Office"],
    rating: 4.4,
    inStock: true,
  },
  {
    name: "Lenovo IdeaPad Slim 3",
    brand: "Lenovo",
    category: "Laptops",
    price: 45990.00,
    description: "Slim and stylish everyday laptop with 12th Gen Intel Core i5, military-grade MIL-STD-810H durability, and rapid charging.",
    imageUrl: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "Intel Core i5-12450H (8 Cores, up to 4.4 GHz)",
      ram: "16GB LPDDR5 4800MHz",
      storage: "512GB SSD M.2",
      display: "15.6 inch FHD IPS 300 Nits",
      graphics: "Intel Iris Xe Graphics",
      weight: "1.62 kg",
      battery: "47Wh (Rapid Charge Boost)",
    },
    features: ["High Performance i5-12450H Processor", "16GB Fast LPDDR5 Memory", "Military Grade Toughness", "Privacy Webcam Shutter", "Dolby Audio Speakers"],
    rating: 4.3,
    inStock: true,
  },
  {
    name: "Apple MacBook Air M2",
    brand: "Apple",
    category: "Laptops",
    price: 89900.00,
    description: "Redesigned ultra-thin laptop built around the powerful Apple M2 chip, Liquid Retina display, MagSafe 3 charging, and up to 18 hours battery.",
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80",
    specs: {
      processor: "Apple M2 (8-core CPU, 8-core GPU)",
      ram: "8GB Unified Memory",
      storage: "256GB SSD Storage",
      display: "13.6 inch Liquid Retina Display (500 nits, True Tone)",
      weight: "1.24 kg",
      battery: "Up to 18 hours",
      charging: "MagSafe 3 & Two Thunderbolt Ports",
    },
    features: ["Ultra-fast Apple M2 Chip", "18-Hour Battery Life", "Fanless Silent Operation", "Liquid Retina Display with 1B Colors", "1080p FaceTime HD Camera"],
    rating: 4.9,
    inStock: true,
  },
];

async function main() {
  console.log("🌱 Starting PayPilot AI Product Catalog Seeding...");

  const existingCount = await prisma.product.count();
  if (existingCount > 0) {
    console.log(`ℹ️ Catalog already contains ${existingCount} products. Skipping seed to preserve data.`);
    return;
  }

  console.log(`📦 Seeding ${products.length} products across 5 categories...`);

  let count = 0;
  for (const item of products) {
    await prisma.product.create({
      data: {
        name: item.name,
        brand: item.brand,
        category: item.category,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
        specs: item.specs,
        features: item.features,
        rating: item.rating,
        inStock: item.inStock,
      },
    });
    count++;
  }

  console.log(`✅ Successfully seeded ${count} products into the database!`);

  // Verify breakdown by category
  const categories = await prisma.product.groupBy({
    by: ["category"],
    _count: { id: true },
  });

  console.log("\n📊 Seeded Category Breakdown:");
  for (const cat of categories) {
    console.log(`   - ${cat.category}: ${cat._count.id} products`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
