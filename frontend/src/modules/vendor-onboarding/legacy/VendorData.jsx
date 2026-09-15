/* fm3-converted */
/* Alamtri Geo Admin — Vendor master data.
   Source: Vendor10.xlsx (vendor registry). This is the source-of-truth list of
   vendors who can transact in the procurement modules. */

const VENDOR_STATUS = {
  APPR1: { code: "APPR1", en: "On Approval", id: "Proses Approval", tone: "info" },
  DRAFT: { code: "DRAFT", en: "Draft", id: "Draf", tone: "neutral" },
  REPIR: { code: "REPIR", en: "Needs Revision", id: "Perlu Revisi", tone: "warning" },
  ACTIVE: { code: "ACTIVE", en: "Active", id: "Aktif", tone: "success" },
};

const VENDORS = [
  {
    "id": "00E6CD3686",
    "name": "PT PRIMARI INRAHM UTAMA",
    "active": true,
    "website": "www.primariutama.com",
    "address": "Jl. Desa Burangkeng, RT.003/002, Mustika Jaya, Kota Bekasi, Jawa Barat",
    "address2": "",
    "pic": {
      "name": "VARIAN IQBAL YUNANTO",
      "email": "salesmktdeptro@primariutama.com",
      "phone": "+628999774461",
      "phone2": "+6281298674684",
      "position": "Sales Support"
    },
    "logo": "Vendor Logo PT PIU.png",
    "npwp": "0811895614005000",
    "nib": "1250002431169",
    "pkp": "S-172PKP/WPJ.20/KP.0603/2017",
    "registeredDate": "2017-01-03",
    "scale": "M",
    "products": [
      "Gorong-Gorong"
    ],
    "kbliCodes": [
      "25119",
      "46523",
      "46100",
      "46900",
      "46512",
      "25932",
      "46511",
      "46495",
      "25111",
      "25920",
      "25920"
    ],
    "kbliDesc": [
      "Industri Barang dari Logam Siap Pasang untuk Konstruksi Lainnya",
      "Perdagangan Besar Peralatan Telekomunikasi",
      "Perdagangan Besar Atas Dasar Balas Jasa (Fee) Atau Kontrak",
      "Perdagangan Besar Berbagai Macam Barang",
      "Perdagangan Besar Piranti Lunak",
      "Industri Alat Potong dan Perkakas Tangan Pertukangan",
      "Perdagangan Besar Komputer Dan Perlengkapan Komputer",
      "Perdagangan Besar Alat Permainan Dan Mainan Anak-anak",
      "Industri Barang Dari Logam Bukan Aluminium Siap Pasang Untuk Bangunan",
      "Jasa Industri Untuk Berbagai Pengerjaan Khusus Logam Dan Barang Dari Logam",
      "Jasa Industri Untuk Berbagai Pengerjaan Khusus Logam Dan Barang Dari Logam"
    ],
    "statusCode": "APPR1",
    "statusLabel": "Approval1",
    "statusDetail": "Waiting for approver 2's approval",
    "reviewer": "SITI FATIMAH",
    "updatedAt": "2026-06-03 09:59",
    "clients": [
      "Merdeka Copper Gold",
      "PT Jaya Abadi Semesta",
      "PT Salim Ivomas Pratama",
      "PT Musim Mas",
      "Gozco Plantations",
      "PT Pelsart Tambang Kencana",
      "PT Mega Sumber Logam"
    ],
    "experience": [
      "Nestable Flange 1500 mm dan Multi Plate Pipe 1500 mm",
      "Pipa Baja Schedule/ Pipa Baja Spiral Hitam",
      "MPP 2100 mm",
      "Gorong-Gorong HDPE 1500 mm dan Flapgate Gorong-Gorong HDPE 1500 mm",
      "Gorong-Gorong HDPE 400 mm dan Gorong-Gorong HDPE 600 mm",
      "MPP 2100 mm x 4.0 mm dan NF 1000 mm x 3.0 mm",
      "NF 1000 mm x 3.5 mm x 350 m"
    ],
    "certNumbers": [],
    "certNames": [],
    "principals": [
      "PRIMARI"
    ],
    "relationships": [
      "Reseller/Agen"
    ]
  },
  {
    "id": "041DFB21AC",
    "name": "PT GLOBAL UTAMA TEKNIK",
    "active": true,
    "website": "https://www.globalutamateknik.com",
    "address": "Jl. Raya Kalimalang Gang Jembatan Besi No. 1A. Cilampayan Pasirtanjung, Cikarang Pusat Kab. Bekasi - Jawa Barat.",
    "address2": "",
    "pic": {
      "name": "ANDI RAEHAN",
      "email": "admin@globalutamateknik.com",
      "phone": "",
      "phone2": "",
      "position": "Komisaris"
    },
    "logo": "Logo GUT.jpg",
    "npwp": "0210643920413000",
    "nib": "9120200992656",
    "pkp": "PEM-00195/WPJ.22/KP.0203/2009",
    "registeredDate": "2008-11-03",
    "scale": "S",
    "products": [
      "Industrial Building Construction (Workshop & Warehouse)",
      "Office Building Construction (Gedung)",
      "Other Residential and Non-Residential Building Construction (Tangki Timbun,dll)",
      "Solid, Liquid, and Gas Waste Treatment Systems (TPS, LB3, IPAL Domestik)"
    ],
    "kbliCodes": [
      "41012",
      "41013",
      "41019",
      "42203",
      "42202",
      "41016"
    ],
    "kbliDesc": [
      "Konstruksi Gedung Perkantoran",
      "Konstruksi Gedung Industri",
      "Konstruksi Gedung Lainnya",
      "Konstruksi Bangunan Sipil Prasarana dan Sarana Sistem Pengolahan Limbah Padat, Cair, dan Gas",
      "Konstruksi Bangunan Sipil Pengolahan Air Bersih",
      "Konstruksi Gedung Pendidikan"
    ],
    "statusCode": "APPR1",
    "statusLabel": "Approval1",
    "statusDetail": "Waiting for approver 2's approval",
    "reviewer": "SITI FATIMAH",
    "updatedAt": "2026-05-29 09:09",
    "clients": [
      "PT. PERTAMINA MAINTENANCE AND CONTRUCTION",
      "PT. SEMEN BATURAJA tbk.",
      "Yayasan Pesona Cahaya Abadi",
      "PT. Hankook Casting Indonesia",
      "PT. SOZIO DESCOLLONGES INDONESIA",
      "PT. Wiraswasta Gemilang Indonesia",
      "PT. Wiraswasta Gemilang Indonesia"
    ],
    "experience": [
      "Pekerjaan Emergency Pembangunan Pagar dalam ( Tahap I - Buffersone ) Plumpang - Jakarta Utara",
      "Proyek Pekerjaan MEP ( Instalasi Listik , AC , Plumbing ), Pengolahan Air Bersih dan Air Limbah",
      "Pembanguan Mesjid Menara Pensil Cileungsi",
      "Pekerjaan Gedung Assembling",
      "Pekerjaan Renovasi Gedung PT. Sozio Descollonges Indonesia",
      "Pembangunan GC Lampung",
      "Pembangunan GC Balikpapan"
    ],
    "certNumbers": [
      "73421 3257 0016488 2024",
      "73421 1323.02 6 00032498 2022",
      "74321 2142.06 8 00054288 2024",
      "78429 8113 0005045 2024",
      "017025022/K-TPRC/32/VII/2022",
      "74321 1323.02 6 00024183 2022",
      "74321 2142.02 7 00024282 2022",
      "5/003468/AS.01.04/I/2026",
      "14559/SKN/IX/2025",
      "24193.0721.3.0021328.2024",
      "24193.0721.3.0021330.2024",
      "24193.0721.3.0021331.2024",
      "24193.0721.3.0021329.2024",
      "24193.0721.3.0021327.2024",
      "74321 1323.01 4 00040220 2025",
      "74321 1323.01 4 00040221 2025"
    ],
    "certNames": [
      "Sertifikat Ahli K3 Umum",
      "Sertifikat Ahli Konstruksi",
      "SKK Ahli Madya Konstruksi",
      "Ahli K3 Perancah",
      "Teknisi K3 Perancah",
      "Sertifikat Ahli Gedung",
      "SKK Ahli Gedung",
      "Teknisi Kerja Bangunan Tinggi Tingkat II",
      "Teknisi Kerja Bangunan Tinggi Tingkat II",
      "Welder",
      "Welder",
      "Welder",
      "Welder",
      "Welder",
      "SKK J4 Bangunan Air Minum",
      "SKK J4 Bangunan Air Limbah"
    ],
    "principals": [],
    "relationships": []
  },
  {
    "id": "0523B53BD7",
    "name": "PT KOTRACK MACHINERY INDONESIA",
    "active": true,
    "website": "https://www.kotrack.com",
    "address": "Jl. Raya Narogong no.09 RT.001 RW.006, Cikiwul, Kec. Bantar Gebang, Kota Bekasi, Jawa Barat 17152",
    "address2": "",
    "pic": {
      "name": "SABAR",
      "email": "sabar@kotrack.co.id",
      "phone": "+622122049531",
      "phone2": "+6285814578239",
      "position": "Chief Operating Officer"
    },
    "logo": "Logo Kotrack PT.KMI.jpeg",
    "npwp": "9439127250080000",
    "nib": "0220109201598",
    "pkp": "S-10/PKP/KPP.200703/2023",
    "registeredDate": "2020-02-14",
    "scale": "M",
    "products": [
      "Bucket Teeth & Adapters",
      "Cutting Edge & End Bits",
      "Rippers"
    ],
    "kbliCodes": [
      "46599"
    ],
    "kbliDesc": [
      "Perdagangan Besar Mesin, Peralatan Dan Perlengkapan Lainnya"
    ],
    "statusCode": "DRAFT",
    "statusLabel": "Draft",
    "statusDetail": "Waiting for data to be submitted",
    "reviewer": "SABAR",
    "updatedAt": "2026-03-16 03:54",
    "clients": [],
    "experience": [],
    "certNumbers": [],
    "certNames": [],
    "principals": [
      "QLOK",
      "QLOK"
    ],
    "relationships": [
      "Authorized distributor",
      "Authorized distributor"
    ]
  },
  {
    "id": "05DC7CCEDD",
    "name": "PT HAERDE DWIPAYANA",
    "active": true,
    "website": "dwipayana.com",
    "address": "",
    "address2": "",
    "pic": {
      "name": "Fitri Yulia",
      "email": "dwipayana@dwipayana.com",
      "phone": "+6222-4205247",
      "phone2": "+6285100418468",
      "position": "Kepala Kantor"
    },
    "logo": "WhatsApp Image 2026-04-08 at 9.29.43 AM.jpeg",
    "npwp": "0021074851428000",
    "nib": "9120108770051",
    "pkp": "PEM-03986/WPJ.09/KP.0103/2013",
    "registeredDate": "2002-01-25",
    "scale": "S",
    "products": [
      "Psikotest/Assesment"
    ],
    "kbliCodes": [
      "70209"
    ],
    "kbliDesc": [
      "Aktivitas Konsultasi Manajemen Lainnya"
    ],
    "statusCode": "REPIR",
    "statusLabel": "Repairing",
    "statusDetail": "Waiting for data to be corrected",
    "reviewer": "SITI FATIMAH",
    "updatedAt": "2026-04-10 03:56",
    "clients": [],
    "experience": [],
    "certNumbers": [],
    "certNames": [],
    "principals": [],
    "relationships": []
  },
  {
    "id": "05EDB4332A",
    "name": "PT APTI ADHI ANANTA",
    "active": true,
    "website": "www.tripla.id",
    "address": "Jl. Pegangsaan Dua No.78",
    "address2": "",
    "pic": {
      "name": "VENDRY",
      "email": "vendry.liarto@tripla.id",
      "phone": "+622138865122",
      "phone2": "",
      "position": "Direktur"
    },
    "logo": "LOGO TRIPLA.png",
    "npwp": "0804695518452000",
    "nib": "1221001442486",
    "pkp": "S-380/PKP/KPP.080903/2024",
    "registeredDate": "2016-06-15",
    "scale": "S",
    "products": [
      "Air Compressor",
      "Backhoe Loader",
      "Battery / Accumulator",
      "Bearing",
      "Bulldozer",
      "Calibration",
      "Compactor",
      "Component and Sub Component",
      "Crane Truck",
      "Crushing & Handling Facility",
      "Cylinder Handler",
      "Dolly",
      "Drilling Machine",
      "Dump Truck",
      "Electrical",
      "Excavator",
      "Fastener",
      "Filter",
      "Forklift",
      "Friction Part (Disc, Plate Etc)",
      "Fuel Truck",
      "Genset",
      "Grease Truck",
      "Heavy Equipment",
      "Hose",
      "Lowboy Truck",
      "Lube Truck",
      "Magnetic Sweeper",
      "Man Haul Bus",
      "Man Lift",
      "Man Platform",
      "Mechanic",
      "Motor Grader",
      "Other Spareparts",
      "Pin, Bushing",
      "Portable Tower BTS",
      "Prime Mover",
      "Prime Mover For Jocky",
      "Prime Mover For Small DT",
      "Repair Maintenance",
      "Rim",
      "Rubber Part",
      "Sarana/LV (sales/dealer)",
      "Seal, O-Ring, Gasket",
      "Service Truck",
      "Sleipner",
      "Spesific Preventive Maintenance",
      "Spring",
      "Tower Lamp",
      "Trailer",
      "Tyre",
      "Tyre Accessories",
      "Tyre Handler",
      "V-Belt",
      "Vessel Trailer",
      "Washing Truck",
      "Waste Oil Truck",
      "Water Mist",
      "Water Pump",
      "Water Truck",
      "Welding Machine",
      "Wheel Dozer",
      "Wheel Loader"
    ],
    "kbliCodes": [
      "28240",
      "33122",
      "46530",
      "46593",
      "46599",
      "77100",
      "77393",
      "77395",
      "28160",
      "43905"
    ],
    "kbliDesc": [
      "Industri Mesin Penambangan, Penggalian Dan Konstruksi",
      "Reparasi Mesin Untuk Keperluan Khusus",
      "Perdagangan Besar Mesin, Peralatan Dan Perlengkapan Pertanian",
      "Perdagangan Besar Alat Transportasi Darat (Bukan Mobil, Sepeda Motor, Dan Sejenisnya), Suku Cadang Dan Perlengkapannya",
      "Perdagangan Besar Mesin, Peralatan Dan Perlengkapan Lainnya",
      "Aktivitas Penyewaan dan Sewa Guna Usaha Tanpa Hak Opsi Mobil, Bus, Truk Dan Sejenisnya",
      "Aktivitas Penyewaan dan Sewa Guna Usaha Tanpa Hak Opsi Mesin Dan Peralatan Konstruksi Dan Teknik Sipil",
      "Aktivitas Penyewaan dan Sewa Guna Tanpa Hak Opsi Mesin Pertambangan dan Energi serta Peralatannya",
      "Industri Alat Pengangkat Dan Pemindah",
      "Penyewaan Alat Konstruksi Dengan Operator"
    ],
    "statusCode": "DRAFT",
    "statusLabel": "Draft",
    "statusDetail": "Waiting for data to be submitted",
    "reviewer": "VENDRY",
    "updatedAt": "2026-04-13 08:41",
    "clients": [],
    "experience": [],
    "certNumbers": [
      "Sertifikasi ISO 14001",
      "Sertifikasi ISO 45001",
      "Sertifikasi ISO 9001"
    ],
    "certNames": [
      "Sertifikasi ISO 14001",
      "Sertifikasi ISO 45001",
      "Sertifikasi ISO 9001"
    ],
    "principals": [
      "MAGNI",
      "HYUNDAI"
    ],
    "relationships": [
      "Authorized distributor",
      "Reseller/Agen"
    ]
  },
  {
    "id": "063B105F6F",
    "name": "PT MASAJI TATANAN KONTAINER IND",
    "active": true,
    "website": "",
    "address": "JL. RAYA CAKUNG NO.15 RT.004 RW.010 SEMPER TIMUR, CILINCING, JAKARTA UTARA, DKI JAKARTA",
    "address2": "",
    "pic": {
      "name": "UNIK DWI LESTARI",
      "email": "unik.lestari@samudera.id",
      "phone": "+62214401592",
      "phone2": "+6281314486260",
      "position": "NON DEPOT DIVISION HEAD"
    },
    "logo": "LOGO SAMUDERA.png",
    "npwp": "0831660907045000",
    "nib": "9120305531456",
    "pkp": "S-776PKP/WPJ.21/KP.0403/2019",
    "registeredDate": "2018-11-05",
    "scale": "S",
    "products": [
      "Container (Office, Workshop, Camp, etc)",
      "Land",
      "Repair Maintenance",
      "Residential Building Construction (Mess)",
      "Skid-Mounted for Machine (Genset, Compressor, Pump, etc)",
      "Skid-Mounted Infrastructure (Pos Pantau, Pos Medis, Shelter, etc)",
      "Transportation Equipment",
      "Trucking"
    ],
    "kbliCodes": [
      "52109"
    ],
    "kbliDesc": [
      "Pergudangan dan Penyimpanan Lainnya"
    ],
    "statusCode": "DRAFT",
    "statusLabel": "Draft",
    "statusDetail": "Waiting for data to be submitted",
    "reviewer": "UNIK DWI LESTARI",
    "updatedAt": "2026-03-11 02:54",
    "clients": [],
    "experience": [],
    "certNumbers": [],
    "certNames": [],
    "principals": [],
    "relationships": []
  },
  {
    "id": "06BC349F30",
    "name": "PT ETI FIRE SYSTEMS",
    "active": true,
    "website": "www.etifireandlubrication.com",
    "address": "Jl. Magelang – Kopeng Km 11, Tegalrejo Magelang  56192 Central Java Indonesia",
    "address2": "",
    "pic": {
      "name": "BOAS RIVALDO",
      "email": "aldo@etifiresystems.com",
      "phone": "+62622933148890",
      "phone2": "",
      "position": "Admin"
    },
    "logo": "etilogo.png",
    "npwp": "0025198292524000",
    "nib": "8120212260269",
    "pkp": "PEM-01956/WPJ.32/KP.0403/2011",
    "registeredDate": "2006-02-01",
    "scale": "M",
    "products": [
      "Autolube",
      "Fire Suppression"
    ],
    "kbliCodes": [
      "25120",
      "33121",
      "33122",
      "46599"
    ],
    "kbliDesc": [
      "Industri Tangki, Tandon Air Dan Wadah Dari Logam",
      "Reparasi Mesin Untuk Keperluan Umum",
      "Reparasi Mesin Untuk Keperluan Khusus",
      "Perdagangan Besar Mesin, Peralatan Dan Perlengkapan Lainnya"
    ],
    "statusCode": "REPIR",
    "statusLabel": "Repairing",
    "statusDetail": "Waiting for data to be corrected",
    "reviewer": "SITI FATIMAH",
    "updatedAt": "2026-05-13 10:35",
    "clients": [
      "PT. Merdeka Pani Gold",
      "PT. VALE",
      "PT. Riung Mitra Lestari",
      "PT. Sany Perkasa"
    ],
    "experience": [
      "VHS & Servis Kontrak",
      "Servis Kontrak",
      "Consignment",
      "Penyediaan & Instalasi FSS & ALS"
    ],
    "certNumbers": [
      "203-18-000050",
      "LI-036-IDN",
      "GC-6-123444/09",
      "1892388 ( AU276TM/MJ )",
      "QEC28709",
      "HSM41954"
    ],
    "certNames": [
      "Sertifikat ASPANJI",
      "Sertifikat LI ( Inspectoin Service Body )",
      "Certificate Of Plant Design Registration",
      "Certificate Of Registration - ETI FIRE AND LUBRICATION",
      "Sertifikat QEC28709 ISO 9001",
      "Sertifikat HSM41954 ISO 45001"
    ],
    "principals": [],
    "relationships": []
  },
  {
    "id": "06CBB440FE",
    "name": "PT OSMIRA GEMILANG JAYA",
    "active": true,
    "website": "www.osmira.co.id",
    "address": "KOMPLEK RUKO BORNEO PARADISO CLUSTER EBONY BLOK A-I NO 5",
    "address2": "JL. A. YANI, MABURAI, KALSEL",
    "pic": {
      "name": "THESSIE SINDHURA",
      "email": "thessie.sindhura@osmira.co.id",
      "phone": "+628115400137",
      "phone2": "+628115400137",
      "position": "DIREKTUR"
    },
    "logo": "images.jpeg",
    "npwp": "0420802126721000",
    "nib": "1224000512554",
    "pkp": "S-229/KPP.14010312023",
    "registeredDate": "2021-03-22",
    "scale": "M",
    "products": [
      "Garment (Shirt, Pants, Jackets Etc)",
      "Other Merchandise",
      "Safety Signs",
      "Sticker Unit"
    ],
    "kbliCodes": [
      "46900",
      "46591",
      "46511",
      "46523",
      "46413",
      "18111",
      "46412",
      "78300",
      "46637",
      "46599"
    ],
    "kbliDesc": [
      "Perdagangan Besar Berbagai Macam Barang",
      "Perdagangan Besar Mesin Kantor dan Industri Pengolahan, Suku Cadang Dan Perlengkapannya",
      "Perdagangan Besar Komputer Dan Perlengkapan Komputer",
      "Perdagangan Besar Peralatan Telekomunikasi",
      "Perdagangan Besar Alas Kaki",
      "Industri Pencetakan Umum",
      "Perdagangan Besar Pakaian",
      "Penyediaan Sumber Daya Manusia Dan Manajemen Fungsi Sumber Daya Manusia",
      "Perdagangan Besar Cat",
      "Perdagangan Besar Mesin, Peralatan Dan Perlengkapan Lainnya"
    ],
    "statusCode": "REPIR",
    "statusLabel": "Repairing",
    "statusDetail": "Waiting for data to be corrected",
    "reviewer": "SITI FATIMAH",
    "updatedAt": "2026-03-06 10:40",
    "clients": [
      "ADARO INDONESIA",
      "SAPTAINDRA SEJATI",
      "PETROSEA"
    ],
    "experience": [
      "SAFETY SIGN, STICKER, PRINTING",
      "SAFETY SIGN, STICKER / PRINTING, MEDICAL SUPPLY, GARMENT",
      "STICKERS, SAFETY SIGN, PRINTING ETC"
    ],
    "certNumbers": [],
    "certNames": [],
    "principals": [
      "3M",
      "PERCETAKAN"
    ],
    "relationships": [
      "Reseller/Agen",
      "Reseller/Agen"
    ]
  },
  {
    "id": "0700CF7089",
    "name": "PT TEKNOLOGI CERDAS BERDAULAT INDONESIA",
    "active": true,
    "website": "https://inaai.ai/",
    "address": "",
    "address2": "",
    "pic": {
      "name": "BILLY BACHTIAR GUNAWAN",
      "email": "billy@inaai.ai",
      "phone": "",
      "phone2": "+6281296481500",
      "position": "Direktur Bisnis"
    },
    "logo": "Logo TCBI.png",
    "npwp": "1000000005015207",
    "nib": "2508250084577",
    "pkp": "KET-00307/PP23-CT/KPP.0401/2025",
    "registeredDate": "2025-08-07",
    "scale": "S",
    "products": [
      "IT (Information & Technology)"
    ],
    "kbliCodes": [
      "70209",
      "62019",
      "62015",
      "72102"
    ],
    "kbliDesc": [
      "Aktivitas Konsultasi Manajemen Lainnya",
      "Aktivitas Pemrograman Komputer Lainnya",
      "Aktivitas Pemrograman Berbasis Kecerdasan Artifisial",
      "Penelitian Dan Pengembangan Ilmu Pengetahuan Alam"
    ],
    "statusCode": "DRAFT",
    "statusLabel": "Draft",
    "statusDetail": "Waiting for data to be submitted",
    "reviewer": "BILLY BACHTIAR GUNAWAN",
    "updatedAt": "2026-06-04 04:57",
    "clients": [],
    "experience": [],
    "certNumbers": [],
    "certNames": [],
    "principals": [],
    "relationships": []
  },
  {
    "id": "088A0B40E5",
    "name": "PT HALO INDAH PERMAI",
    "active": true,
    "website": "https://halorobotics.com/",
    "address": "Jl. Raya Kompas No.166, Pd. Ranji, Kec. Ciputat Tim., Kota Tangerang Selatan, Banten 15412",
    "address2": "",
    "pic": {
      "name": "LINA",
      "email": "lina@halo-robotics.com",
      "phone": "+62217699123",
      "phone2": "+6281119090088",
      "position": "Sales Engineer - Mining & Infrastructure Construction"
    },
    "logo": "LOGO Halo Robotics (High Resolution) (1).png",
    "npwp": "7464671900130000",
    "nib": "8120314171762",
    "pkp": "S-240PKP/WPJ.30/KP.0503/2016",
    "registeredDate": "2015-11-11",
    "scale": "M",
    "products": [
      "Autonomous Robotic",
      "LiDAR"
    ],
    "kbliCodes": [
      "46599",
      "74202",
      "09900",
      "46530",
      "46521",
      "46512"
    ],
    "kbliDesc": [
      "Perdagangan Besar Mesin, Peralatan Dan Perlengkapan Lainnya",
      "Aktivitas Angkutan Udara Khusus Pemotretan, Survei Dan Pemetaan",
      "Aktivitas Penunjang Pertambangan Dan Penggalian Lainnya",
      "Perdagangan Besar Mesin, Peralatan Dan Perlengkapan Pertanian",
      "Perdagangan Besar Suku Cadang Elektronik",
      "Perdagangan Besar Piranti Lunak"
    ],
    "statusCode": "APPR1",
    "statusLabel": "Approval1",
    "statusDetail": "Waiting for approver 2's approval",
    "reviewer": "SITI FATIMAH",
    "updatedAt": "2026-05-29 09:12",
    "clients": [
      "Indonesia Morowali Industrial Park",
      "Puncak Emas Tani Sejahtera (Merdeka Copper Gold)",
      "PT Bumi alam Seraya (Alamtri Geo)",
      "Indonesia Weda Bay Industrial Park",
      "Freeport"
    ],
    "experience": [
      "Pengadaan Drone dan Software",
      "Pembelian barang",
      "Pengadaan Drone dan Software",
      "Pengadaan Drone dan Software",
      "Pengadaan Drone dan Software"
    ],
    "certNumbers": [
      "812031417176200000014"
    ],
    "certNames": [
      "STP"
    ],
    "principals": [
      "Unitree",
      "EMLID",
      "DJI Enterprise",
      "SHARE",
      "Terrasolid"
    ],
    "relationships": [
      "Authorized distributor",
      "Authorized distributor",
      "Authorized distributor",
      "Authorized distributor",
      "Authorized distributor"
    ]
  }
];

/* ---- Vendor Registry (real backend, Fase 4) ----
   Reviewer-facing registry + approval workflow. Full lifecycle status map (mirrors the
   domain VendorStatuses / legacy MSTR_STATUS_T) with label + tone for badges. */
const VM_STATUS = {
  INITL: { en: "Initial", id: "Awal", tone: "neutral" },
  INVTD: { en: "Invited", id: "Diundang", tone: "info" },
  RSPND: { en: "Responded", id: "Merespons", tone: "info" },
  DRAFT: { en: "Draft", id: "Draf", tone: "neutral" },
  SBMIT: { en: "Submitted", id: "Terkirim", tone: "brand" },
  APPR1: { en: "Department Head Review", id: "Review Department Head", tone: "brand" },
  APPR2: { en: "Division Head Review", id: "Review Division Head", tone: "brand" },
  APPRV: { en: "Approved", id: "Disetujui", tone: "success" },
  RGSTD: { en: "Registered", id: "Terdaftar", tone: "success" },
  REPIR: { en: "Revision", id: "Revisi", tone: "warning" },
  RJCTD: { en: "Rejected", id: "Ditolak", tone: "danger" },
  BLACK: { en: "Blacklisted", id: "Blacklist", tone: "danger" },
};

const VM_REGISTRY_API = "/api/v1/vendor-onboarding/vendors";

async function VmApiJson(url, options) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json", ...(options && options.headers ? options.headers : {}) },
    ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error((data && (data.message || data.title || data.code)) || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

async function VmApiListVendors(params) {
  const q = new URLSearchParams();
  if (params && params.status && params.status !== "all") q.set("status", params.status);
  if (params && params.search) q.set("search", params.search);
  const qs = q.toString();
  const data = await VmApiJson(`${VM_REGISTRY_API}${qs ? `?${qs}` : ""}`);
  return Array.isArray(data) ? data : [];
}
async function VmApiVendorRegistryPage(path, params) {
  const q = new URLSearchParams();
  const value = params || {};
  if (value.status && value.status !== "all") q.set("status", value.status);
  if (value.search) q.set("search", value.search);
  q.set("page", String(value.page || 1));
  q.set("pageSize", String(value.pageSize || 50));
  if (value.overdueOnly) q.set("overdueOnly", "true");
  if (value.sortBy) q.set("sortBy", value.sortBy);
  if (value.sortDir) q.set("sortDir", value.sortDir);
  const data = await VmApiJson(`${VM_REGISTRY_API}/${path}?${q.toString()}`);
  return {
    items: data && Array.isArray(data.items) ? data.items : [],
    total: Number((data && data.total) || 0),
    page: Number((data && data.page) || value.page || 1),
    pageSize: Number((data && data.pageSize) || value.pageSize || 50),
  };
}
async function VmApiVendorDatabase(params) { return VmApiVendorRegistryPage("database", params); }
async function VmApiApprovalQueue(params) { return VmApiVendorRegistryPage("approval-queue", params); }
async function VmApiApprovalContext(id) { return VmApiJson(`${VM_REGISTRY_API}/${id}/approval-context`); }
/** How many vendors wait on the signed-in user's approval roles — drives the sidebar badge. */
async function VmApiApprovalQueueCount() {
  const data = await VmApiJson(`${VM_REGISTRY_API}/approval-queue/count`);
  return Number((data && data.count) || 0);
}
/** Fired after a review decision so anything showing a pending count can refresh itself. */
const VM_APPROVAL_CHANGED_EVENT = "ag:vendor-approval-changed";
/* ---- Status labels from Master Data ▸ Vendor Status ----
   The master is the source of the label; VM_STATUS below stays as the fallback (and always owns the
   badge tone, which is presentation, not configuration). Hydrated once per session into a module-level
   cache so a badge render never waits on a request. */
let VM_STATUS_MASTER = null;
async function VmApiVendorStatuses() {
  const data = await VmApiJson(`${VM_REGISTRY_API}/statuses`);
  return Array.isArray(data) ? data : [];
}
async function VmHydrateVendorStatuses() {
  try {
    const rows = await VmApiVendorStatuses();
    VM_STATUS_MASTER = Object.fromEntries(rows.map((row) => [row.code, row]));
  } catch (error) {
    VM_STATUS_MASTER = null; // keep the built-in labels rather than blanking every badge
  }
  return VM_STATUS_MASTER;
}
function VmStatusMasterEntry(code) {
  return (VM_STATUS_MASTER && code && VM_STATUS_MASTER[code]) || null;
}

/* Shared SLA presentation: one tone/label map so the queue and the dossier trail cannot drift apart.
   Status values mirror ApprovalSlaStatuses. */
const VM_SLA_TONES = { OnTrack: "success", DueToday: "warning", Overdue: "danger", NotTracked: "neutral" };
function VmSlaMeta(status) {
  return {
    tone: VM_SLA_TONES[status] || "neutral",
    en: { OnTrack: "On track", DueToday: "Due today", Overdue: "Overdue", NotTracked: "No SLA" }[status] || "No SLA",
    id: { OnTrack: "Tepat waktu", DueToday: "Jatuh tempo hari ini", Overdue: "Terlambat", NotTracked: "Tanpa SLA" }[status] || "Tanpa SLA",
  };
}
async function VmApiMasterSet(setKey, take) {
  const data = await VmApiJson(`/api/v1/master-data/sets/${setKey}?take=${take || 20000}`);
  return data && Array.isArray(data.records) ? data.records : [];
}
async function VmApiGetVendor(id) { return VmApiJson(`${VM_REGISTRY_API}/${id}`); }
async function VmApiVendorDocs(id) { const d = await VmApiJson(`${VM_REGISTRY_API}/${id}/documents`); return Array.isArray(d) ? d : []; }
async function VmApiVendorDocDownloadUrl(vendorId, documentId) {
  const data = await VmApiJson(`${VM_REGISTRY_API}/${vendorId}/documents/${documentId}/download`);
  return (data && data.url) || "";
}
async function VmApiVendorHistory(id) { const d = await VmApiJson(`${VM_REGISTRY_API}/${id}/history`); return Array.isArray(d) ? d : []; }
async function VmApiGetCertificate(id) { return VmApiJson(`${VM_REGISTRY_API}/${id}/certificate`); }
async function VmApiIssueCertificate(id) {
  return VmApiJson(`${VM_REGISTRY_API}/${id}/issue-certificate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}
async function VmApiReviewAction(id, action, reason) {
  return VmApiJson(`${VM_REGISTRY_API}/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason || null }),
  });
}
/* Login-account lock state for a vendor (returns [] when no account is registered yet). */
async function VmApiGetVendorAccount(id) {
  const d = await VmApiJson(`${VM_REGISTRY_API}/${id}/account`);
  return Array.isArray(d) ? d : [];
}
/* Admin clears the lockout for a locked-out vendor account before the auto-unlock window elapses. */
async function VmApiUnlockVendor(id) {
  return VmApiJson(`${VM_REGISTRY_API}/${id}/unlock-account`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
}
async function VmApiSendVendorActivation(id) {
  return VmApiJson(`${VM_REGISTRY_API}/${id}/send-activation-link`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
}

async function VmApiSaveOfficerPortfolio(vendorId, body, portfolioId) {
  const url = portfolioId
    ? `${VM_REGISTRY_API}/${vendorId}/portfolios/${portfolioId}`
    : `${VM_REGISTRY_API}/${vendorId}/portfolios`;
  return VmApiJson(url, {
    method: portfolioId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function VmApiDeleteOfficerPortfolio(vendorId, portfolioId) {
  return VmApiJson(`${VM_REGISTRY_API}/${vendorId}/portfolios/${portfolioId}`, { method: "DELETE" });
}

async function VmApiUploadOfficerPortfolioDoc(vendorId, file, ownerKey, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${VM_REGISTRY_API}/${vendorId}/portfolio-documents`);
    xhr.withCredentials = true;
    if (typeof onProgress === "function" && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !event.total) return;
        onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
      };
    }
    xhr.onload = () => {
      let data = null;
      if (xhr.responseText) {
        try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      reject(new Error((data && (data.message || data.code)) || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed (network)."));
    const form = new FormData();
    form.append("file", file);
    form.append("ownerKey", ownerKey || "");
    xhr.send(form);
  });
}

async function VmApiDeleteOfficerPortfolioDoc(vendorId, documentId) {
  return VmApiJson(`${VM_REGISTRY_API}/${vendorId}/portfolio-documents/${documentId}`, { method: "DELETE" });
}
/* Resolve a master-data region CODE to its display name (province/city/district/village), cached. */
const _vmRegionCache = {};
async function VmResolveRegion(setKey, code) {
  if (!code) return "";
  const ck = `${setKey}:${code}`;
  if (_vmRegionCache[ck] !== undefined) return _vmRegionCache[ck];
  try {
    const data = await VmApiJson(`/api/v1/master-data/sets/${setKey}?search=${encodeURIComponent(code)}&take=50`);
    const recs = (data && data.records) || [];
    const hit = recs.find((r) => String(r.code) === String(code));
    const name = hit ? hit.name : code;
    _vmRegionCache[ck] = name;
    return name;
  } catch (e) { return code; }
}

/* Internal document view — reuse the generic InternalUser download endpoint (SAS redirect). */
async function VmOpenDoc(container, blobKey) {
  const data = await VmApiJson(`/api/v1/documents/download?container=${encodeURIComponent(container)}&key=${encodeURIComponent(blobKey)}`);
  if (data && data.url) window.open(data.url, "_blank", "noopener");
}

/* Azure SAS URLs can sit in an iframe. Same-origin stream fallbacks cannot when the
   portal sends X-Frame-Options, so fetch the bytes and use a blob: URL instead. */
async function VmResolveFramedDocumentUrl(url) {
  if (!url) return "";
  if (/^https?:\/\/[^/]*blob\.core\.windows\.net\b/i.test(url)) return url;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`preview_unavailable (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

Object.assign(window, {
  VENDORS, VENDOR_STATUS, VM_STATUS, VM_REGISTRY_API,
  VmApiListVendors, VmApiVendorDatabase, VmApiApprovalQueue, VmApiApprovalContext, VmApiMasterSet,
  VmApiGetVendor, VmApiVendorDocs, VmApiVendorDocDownloadUrl, VmApiVendorHistory, VmApiReviewAction, VmOpenDoc, VmResolveFramedDocumentUrl, VmResolveRegion,
  VmApiGetCertificate, VmApiIssueCertificate, VmApiGetVendorAccount, VmApiUnlockVendor,
  VmApiSendVendorActivation, VmApiJson,
  VmApiSaveOfficerPortfolio, VmApiDeleteOfficerPortfolio, VmApiUploadOfficerPortfolioDoc, VmApiDeleteOfficerPortfolioDoc,
  VmSlaMeta,
  VmApiVendorStatuses, VmHydrateVendorStatuses, VmStatusMasterEntry,
  VmApiApprovalQueueCount, VM_APPROVAL_CHANGED_EVENT,
});
export { VENDORS, VENDOR_STATUS, VM_STATUS, VM_REGISTRY_API, VmApiListVendors, VmApiVendorDatabase, VmApiApprovalQueue, VmApiApprovalContext, VmApiMasterSet, VmApiGetVendor, VmApiVendorDocs, VmApiVendorDocDownloadUrl, VmApiVendorHistory, VmApiReviewAction, VmOpenDoc, VmResolveFramedDocumentUrl, VmResolveRegion, VmApiGetCertificate, VmApiIssueCertificate, VmApiGetVendorAccount, VmApiUnlockVendor, VmApiSendVendorActivation, VmApiJson, VmApiSaveOfficerPortfolio, VmApiDeleteOfficerPortfolio, VmApiUploadOfficerPortfolioDoc, VmApiDeleteOfficerPortfolioDoc, VmSlaMeta, VmApiVendorStatuses, VmHydrateVendorStatuses, VmStatusMasterEntry, VmApiApprovalQueueCount, VM_APPROVAL_CHANGED_EVENT };
