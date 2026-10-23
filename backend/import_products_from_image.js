const { sequelize, Product } = require('./models');

const productsData = [
  { name: 'A1 KBL BAWANG WARNA 2.5KG', purchasePrice: 29500, sellingPrice: 33000 },
  { name: 'A1 KBL PUTIH 2.5KG', purchasePrice: 29500, sellingPrice: 33000 },
  { name: 'A1 KBL UDANG MERAH 2.5KG', purchasePrice: 29500, sellingPrice: 33000 },
  { name: 'AJI TW/TAJ 10X1G', purchasePrice: 135000, sellingPrice: 155000 },
  { name: 'AIDA 250G', purchasePrice: 645000, sellingPrice: 684000 },
  { name: 'AIDA 500G', purchasePrice: 960000, sellingPrice: 990000 },
  { name: 'AIDA RENCENG', purchasePrice: 489000, sellingPrice: 516000 },
  { name: 'AKN LOS 10 X 100GR', purchasePrice: 120000, sellingPrice: 130000 },
  { name: 'AYAM BULAT 709', purchasePrice: 670000, sellingPrice: 700000 },
  { name: 'BAKERA MARGARIN 15KG', purchasePrice: 256000, sellingPrice: 276000 },
  { name: 'BAKERA MARGARIN 250GR', purchasePrice: 274000, sellingPrice: 285000 },
  { name: 'BALADO LOS 10 X 100GR', purchasePrice: 120000, sellingPrice: 128000 },
  { name: 'BANDENG 100X500GR', purchasePrice: 120000, sellingPrice: 130000 },
  { name: 'BIHUN CAP BUMI JAGUNG 250GR', purchasePrice: 56683, sellingPrice: 56000 },
  { name: 'BIHUN CAP BUMI JAGUNG 350GR', purchasePrice: 56683, sellingPrice: 56000 },
  { name: 'BIHUN CAP BUMI JAGUNG 3KG', purchasePrice: 64150, sellingPrice: 65100 },
  { name: 'BIHUN WBI 40H 300GR', purchasePrice: 60480, sellingPrice: 64000 },
  { name: 'BIHUN WBI 40H 350G', purchasePrice: 57240, sellingPrice: 65000 },
  { name: 'BON CABE LV 10 60X 5GR BRS', purchasePrice: 181492, sellingPrice: 195000 },
  { name: 'BON CABE LV 15 5GR', purchasePrice: 181492, sellingPrice: 195000 },
  { name: 'BON CABE LV 30 4.5GR', purchasePrice: 181492, sellingPrice: 195000 },
  { name: 'BON CABE LV 50 3GR', purchasePrice: 181492, sellingPrice: 195000 },
  { name: 'CABE BUBUK SEDAP RASA 250GR', purchasePrice: 608000, sellingPrice: 648000 },
  { name: 'CABE BUBUK SEDAP RASA 25GR', purchasePrice: 411144, sellingPrice: 444000 },
  { name: 'CABE BUBUK SEDAP RASA 500GR', purchasePrice: 604980, sellingPrice: 644000 },
  { name: 'CUKA LOMBOK GANDARIA 150ML', purchasePrice: 258000, sellingPrice: 0 },
  { name: 'CUKA LOMBOK GANDARIA 80ML', purchasePrice: 162000, sellingPrice: 0 },
  { name: 'GARAM KELUARGA SANTRI 250GR', purchasePrice: 32000, sellingPrice: 38000 },
  { name: 'GARAM KOTAK 150GR', purchasePrice: 26000, sellingPrice: 28000 },
  { name: 'GARAM KOTAK 250GR', purchasePrice: 52000, sellingPrice: 58000 },
  { name: 'GARAM SANTRI 250GR ISI 20', purchasePrice: 26190, sellingPrice: 32000 },
  { name: 'ISI LAPIS KOMA 500', purchasePrice: 222000, sellingPrice: 236000 },
  { name: 'ISI LAPIS KOMA 800', purchasePrice: 215500, sellingPrice: 227500 },
  { name: 'JAGUNG LOS 10 X 100GR', purchasePrice: 120000, sellingPrice: 115000 },
  { name: 'JAM BLUEBERRY 250G', purchasePrice: 146400, sellingPrice: 170000 },
  { name: 'JAM BLUEBERRY 5KG', purchasePrice: 146400, sellingPrice: 158000 },
  { name: 'JAM MELON 250G', purchasePrice: 146400, sellingPrice: 170000 },
  { name: 'JAM MELON 5KG', purchasePrice: 129200, sellingPrice: 158000 },
  { name: 'JAM NANAS 250G', purchasePrice: 146400, sellingPrice: 170000 },
  { name: 'JAM NANAS 5KG', purchasePrice: 129200, sellingPrice: 158000 },
  { name: 'JAM STRAWBERRY 250G', purchasePrice: 146400, sellingPrice: 170000 },
  { name: 'JAM STRAWBERRY 5KG', purchasePrice: 146400, sellingPrice: 158000 },
  { name: 'KECAP ASIN LOMBOK 135ML', purchasePrice: 182400, sellingPrice: 0 },
  { name: 'KECAP D.O. INA 250 ML', purchasePrice: 95000, sellingPrice: 0 },
  { name: 'KECAP D.O. INA 500 ML', purchasePrice: 216000, sellingPrice: 0 },
  { name: 'KECAP D.O. INA 600 ML', purchasePrice: 220200, sellingPrice: 0 },
  { name: 'KECAP LOMBOK 250R', purchasePrice: 156000, sellingPrice: 0 },
  { name: 'KECAP LOMBOK 750GR', purchasePrice: 216000, sellingPrice: 0 },
  { name: 'KECAP LOMBOK ORANGE 135ML', purchasePrice: 146400, sellingPrice: 0 },
  { name: 'KECAP LOMBOK ORANGE 700ML', purchasePrice: 216000, sellingPrice: 0 },
  { name: 'KECAP MANIS SABI 620 ML', purchasePrice: 126000, sellingPrice: 158000 },
  { name: 'KECAP RED TURA 140ML', purchasePrice: 252000, sellingPrice: 264000 },
  { name: 'KECAP SEMAR 750GR', purchasePrice: 195000, sellingPrice: 0 },
  { name: 'KECAP TK 200 ML', purchasePrice: 172800, sellingPrice: 192000 },
  { name: 'KECAP TK 700 ML', purchasePrice: 130800, sellingPrice: 0 },
  { name: 'KBL B. CAHAYA KITA PUTIH', purchasePrice: 66000, sellingPrice: 85000 },
  { name: 'KBL B. CAHAYA KITA KUNING', purchasePrice: 66000, sellingPrice: 85000 },
  { name: 'KBL B. CAHAYA KITA MATANG', purchasePrice: 68000, sellingPrice: 93000 },
  { name: 'KBL B. CAHAYA KITA WARNA', purchasePrice: 66000, sellingPrice: 85000 },
  { name: 'KBL B. CAHAYA KITA WARNA SUPER', purchasePrice: 81000, sellingPrice: 88000 },
  { name: 'KBL BAWANG LATRANS OREN 2.5 K', purchasePrice: 36500, sellingPrice: 44000 },
  { name: 'KBL BAWANG LATRANS PUTIH 5 KG', purchasePrice: 56000, sellingPrice: 70000 },
  { name: 'KBL BAWANG LATRANS WARNA 2.5K', purchasePrice: 36500, sellingPrice: 44000 },
  { name: 'KBL BAWANG LATRANS WARNA 5 KG', purchasePrice: 56000, sellingPrice: 70000 },
  { name: 'KBL BB PERSAH. LING 2.5KG', purchasePrice: 38500, sellingPrice: 52500 },
  { name: 'KBL BINTANG SMPU OPEN 2.5KG', purchasePrice: 36000, sellingPrice: 49500 },
  { name: 'KBL BINTANG SMPU OPEN 4.5 KG', purchasePrice: 82000, sellingPrice: 97000 },
  { name: 'KBL BINTANG SMPU PUTIH 2.5KG', purchasePrice: 56000, sellingPrice: 69500 },
  { name: 'KBL BINTANG SMPU WARNA 2.5 KG', purchasePrice: 56000, sellingPrice: 69500 },
  { name: 'KBL BINTANG SMPU WARNA 4.5 KG', purchasePrice: 63000, sellingPrice: 97000 },
  { name: 'KBL BINTANG SMPU WRN K 2.5KG', purchasePrice: 55000, sellingPrice: 57000 },
  { name: 'KBL BWG PELANGI SATU LAUT 2KG', purchasePrice: 37000, sellingPrice: 49000 },
  { name: 'KBL BWG WARNA SATU LAUT 2KG', purchasePrice: 37000, sellingPrice: 49000 },
  { name: 'KBL BWG WARNA SATU LAUT 5KG', purchasePrice: 65000, sellingPrice: 77000 },
  { name: 'KBL CK MAWAR PUTIH 5KG', purchasePrice: 68000, sellingPrice: 93000 },
  { name: 'KBL CK MAWAR WARNA 5KG', purchasePrice: 68000, sellingPrice: 93000 },
  { name: 'KBL CK TEMA 4.5 KG', purchasePrice: 62000, sellingPrice: 88000 },
  { name: 'KBL GADIS OREN SATU LAUT 2KG', purchasePrice: 37000, sellingPrice: 49000 },
  { name: 'KBL MIE AYAM BANGKOK LATRANS', purchasePrice: 35000, sellingPrice: 44000 },
  { name: 'KBL SEMI KANCING LB', purchasePrice: 156000, sellingPrice: 170000 },
  { name: 'KBL SEMI KANCING SB', purchasePrice: 100000, sellingPrice: 120000 },
  { name: 'KBL UDANG LAGUAR 150G', purchasePrice: 6450, sellingPrice: 8000 },
  { name: 'KBL UDANG LAGUAR 5KG', purchasePrice: 133000, sellingPrice: 155000 },
  { name: 'KOBE BB GORENG LENGKUAS 80 GR', purchasePrice: 220267, sellingPrice: 258000 },
  { name: 'KOBE BUMBU GULAI', purchasePrice: 218019, sellingPrice: 246000 },
  { name: 'KOBE BUMBU OPOR AYAM', purchasePrice: 218019, sellingPrice: 246000 },
  { name: 'KOBE BUMBU RENDANG 20GR', purchasePrice: 180457, sellingPrice: 192000 },
  { name: 'KOBE CITRUK BBG SPY 1 10GR', purchasePrice: 187170, sellingPrice: 216000 },
  { name: 'KOBE NASI BEBEK 20GR', purchasePrice: 180457, sellingPrice: 192000 },
  { name: 'KOBE NASI KUNING 15GR', purchasePrice: 180457, sellingPrice: 192000 },
  { name: 'KOBE NASI UDUK', purchasePrice: 180457, sellingPrice: 192000 },
  { name: 'KOBE SELERA SAOS TIRAM 20GR', purchasePrice: 81792, sellingPrice: 97800 },
  { name: 'KOBE TEP. BAKWAN 70 GR', purchasePrice: 220267, sellingPrice: 264000 },
  { name: 'KOBE TEP. KENTUCKY 200GR', purchasePrice: 118943, sellingPrice: 132000 },
  { name: 'KOBE TEP. KENTUCKY 70 GR', purchasePrice: 220267, sellingPrice: 264000 },
  { name: 'KOBE TEP. PISANG 70GR', purchasePrice: 220267, sellingPrice: 264000 },
  { name: 'KOBE TEP. PUTIH 70GR', purchasePrice: 172198, sellingPrice: 192000 },
  { name: 'KOBE TEP. SERBAGUNA 200GR', purchasePrice: 118943, sellingPrice: 132000 },
  { name: 'KOBE TEP. SERBAGUNA 70GR', purchasePrice: 88103, sellingPrice: 132000 },
  { name: 'KOBE TEP. SERBAGUNA 70GR B', purchasePrice: 220267, sellingPrice: 264000 },
  { name: 'KOBE TEP. TEMPE 70GR', purchasePrice: 88103, sellingPrice: 132000 },
  { name: 'KOBE TEP. TEMPE 70GR B', purchasePrice: 220267, sellingPrice: 264000 },
  { name: 'KWETIAU DI JOL INDO 500.800', purchasePrice: 170000, sellingPrice: 182000 },
  { name: 'KWETIAU JAGO BANGKOK 500GR', purchasePrice: 140000, sellingPrice: 150000 },
  { name: 'MAK. SEPAT BANTAT 1KG', purchasePrice: 150000, sellingPrice: 157000 },
  { name: 'MAK. SEPAT MEKAR 1KG', purchasePrice: 145000, sellingPrice: 165000 },
  { name: 'MAKARONI BALON DIBU 1KG', purchasePrice: 145000, sellingPrice: 160000 },
  { name: 'MAKARONI DELON DIBU 1KG', purchasePrice: 192500, sellingPrice: 210000 },
  { name: 'MAKARONI DELON HUHU 1KG', purchasePrice: 184500, sellingPrice: 197000 },
  { name: 'MAKARONI LDS BANTAT 5KG', purchasePrice: 66000, sellingPrice: 75000 },
  { name: 'MAKARONI LDS MEKAR 5KG', purchasePrice: 66000, sellingPrice: 75000 },
  { name: 'MAKARONI OSCAR 1KG', purchasePrice: 178000, sellingPrice: 190000 },
  { name: 'MAKARONI OSCAR SPIRAL 1KG', purchasePrice: 178000, sellingPrice: 190000 },
  { name: 'MAKARONI SIMBAL LOS 1KG', purchasePrice: 0, sellingPrice: 80000 },
  { name: 'MCL ABG J/MAWAR/KNG KECIL', purchasePrice: 485156, sellingPrice: 520000 },
  { name: 'MCL ABG B/J/K/S/R/KSR', purchasePrice: 485156, sellingPrice: 520000 },
  { name: 'MCL AYAM/SAPI/SAPI/BBQ 100G', purchasePrice: 274158, sellingPrice: 295000 },
  { name: 'MCL AYAM/SAPI/BBQ 1KG', purchasePrice: 338057, sellingPrice: 365000 },
  { name: 'MCL AYAM/SAPI/BBQ 250G', purchasePrice: 285447, sellingPrice: 315000 },
  { name: 'MCL AYAM/SAPI/BBQ KECIL', purchasePrice: 487800, sellingPrice: 515000 },
  { name: 'MCL BALADO 250G', purchasePrice: 576000, sellingPrice: 622000 },
  { name: 'MCL BALADO KECIL', purchasePrice: 602208, sellingPrice: 654000 },
  { name: 'MCL JAGUNG 250G', purchasePrice: 576000, sellingPrice: 622000 },
  { name: 'MCL JAGUNG KECIL', purchasePrice: 602208, sellingPrice: 654000 },
  { name: 'MCL RAWIT 250G', purchasePrice: 240118, sellingPrice: 260000 },
  { name: 'MCL RAWIT DNG', purchasePrice: 146510, sellingPrice: 158000 },
  { name: 'MESES D.B. INA COKLAT 12KG', purchasePrice: 246300, sellingPrice: 300000 },
  { name: 'MESES D.B. INA COKLAT 250GR', purchasePrice: 253538, sellingPrice: 327000 },
  { name: 'MESES D.B. INA WARNA 250GR', purchasePrice: 267000, sellingPrice: 320000 },
  { name: 'MESES DJENG IWA 12KG', purchasePrice: 257040, sellingPrice: 290000 },
  { name: 'MI LIDI DEFENG/SEDAR N1', purchasePrice: 242100, sellingPrice: 270000 },
  { name: 'MI LIDI KECIL (D.JOKO) N1', purchasePrice: 242100, sellingPrice: 270000 },
  { name: 'MIE KERING 7 MANGKOK 500GR', purchasePrice: 0, sellingPrice: 70000 },
  { name: 'MIE KERING 7 MANGKOK KECIL', purchasePrice: 0, sellingPrice: 22500 },
  { name: 'MINYAK JULUK CUP 220ML', purchasePrice: 205000, sellingPrice: 215000 },
  { name: 'RUMPUT LAUT LOS 10 X 100GR', purchasePrice: 105000, sellingPrice: 115000 },
  { name: 'SAMBAL BAWANG MAHKOTA (10)', purchasePrice: 143709, sellingPrice: 145000 },
  { name: 'SAMBAL ULEG BAJAK', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG BAWANG', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG GORENG', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG IJO', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG KECOMBRANG', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG RAWIT', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG RENDANG', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG TERASI', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG TERI', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SAMBAL ULEG UDANG', purchasePrice: 113000, sellingPrice: 116000 },
  { name: 'SEDAN BEBEANG 1KG', purchasePrice: 167000, sellingPrice: 175000 },
  { name: 'SEDAN PIPA 1KG', purchasePrice: 167000, sellingPrice: 175000 },
  { name: 'SEDAN SPAGETI 1KG', purchasePrice: 205000, sellingPrice: 215000 },
  { name: 'SEDAN SPIRAL 1KG', purchasePrice: 167000, sellingPrice: 175000 },
  { name: 'SELAI COKLAT HAPPY 200G', purchasePrice: 6400, sellingPrice: 7000 },
  { name: 'SELAI COKLAT HAPPY 300GX48PCS', purchasePrice: 418000, sellingPrice: 540000 },
  { name: 'SELAI NANAS MASTER 10KG', purchasePrice: 0, sellingPrice: 215000 },
  { name: 'SELAI NANAS MASTER 250GR', purchasePrice: 0, sellingPrice: 140000 },
  { name: 'SERBU BINTANG GULA 220GR', purchasePrice: 194000, sellingPrice: 216000 },
  { name: 'SERBU BINTANG GULA 450GR', purchasePrice: 194000, sellingPrice: 216000 },
  { name: 'SERBU BINTANG GULA 800GR', purchasePrice: 194000, sellingPrice: 216000 },
  { name: 'SERBU BINTANG GULA RENCENG 35', purchasePrice: 77000, sellingPrice: 90000 },
  { name: 'SERBU BINTANG MINYAK BOTOL 20', purchasePrice: 102671, sellingPrice: 111000 },
  { name: 'SOHUN BULAT LAUT 250G', purchasePrice: 269000, sellingPrice: 295000 },
  { name: 'SOHUN BULAT LAUT 50G', purchasePrice: 150000, sellingPrice: 180000 },
  { name: 'SOVI MARGARIN 15KG', purchasePrice: 244500, sellingPrice: 268000 },
  { name: 'SOVI MARGARIN 200GR', purchasePrice: 265000, sellingPrice: 303000 },
  { name: 'STIK ES KRIM AFISI 500 PCS', purchasePrice: 262000, sellingPrice: 315000 },
  { name: 'SUMPIT BAMBU 700G ATQI', purchasePrice: 357500, sellingPrice: 420000 },
  { name: 'SUMPIT TUKIR 400 PANAH', purchasePrice: 301000, sellingPrice: 360000 },
  { name: 'TEP. MAIZENA 400 NYA', purchasePrice: 155000, sellingPrice: 167500 },
  { name: 'TEP. PANIR FROCO 10KG', purchasePrice: 130000, sellingPrice: 145000 },
  { name: 'TEP. PZ PANIR 250 GRAM', purchasePrice: 115000, sellingPrice: 130000 },
  { name: 'TUSUK CILOK AFISI 150GR', purchasePrice: 480000, sellingPrice: 575000 },
  { name: 'TUSUK CILOK MANAR', purchasePrice: 247000, sellingPrice: 300000 },
  { name: 'TUSUK DAGING 25CM', purchasePrice: 517500, sellingPrice: 615000 },
  { name: 'TUSUK DAGING 30CM', purchasePrice: 517500, sellingPrice: 615000 },
  { name: 'TUSUK GIGI AFISI BOTOL', purchasePrice: 576000, sellingPrice: 732000 },
  { name: 'TUSUK GIGI AFISI SACHET', purchasePrice: 420000, sellingPrice: 515000 },
  { name: 'TUSUK GIGI AFISI SPIRAL', purchasePrice: 450000, sellingPrice: 560000 },
  { name: 'TUSUK SATE AFISI 500GR', purchasePrice: 467500, sellingPrice: 555000 },
  { name: 'TUSUK SATE ATQI PUT 250GR', purchasePrice: 600000, sellingPrice: 715000 },
  { name: 'TUSUK SATE NAURA', purchasePrice: 292500, sellingPrice: 345000 }
];

async function importProducts() {
  const transaction = await sequelize.transaction();
  try {
    const tenantId = 1;
    const nonPkpTaxId = 2; // Non-PPN (Non PKP)

    console.log(`📦 Memulai import ${productsData.length} master barang (Non-PKP)...`);

    let createdCount = 0;
    const insertedList = [];

    for (let i = 0; i < productsData.length; i++) {
      const item = productsData[i];
      const sku = `PRD-${String(i + 1).padStart(6, '0')}`;

      const created = await Product.create({
        tenantId,
        taxId: nonPkpTaxId,
        sku,
        name: item.name.trim(),
        unit: 'karton',
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        description: null,
        metadata: {
          taxStatus: 'NON_PKP'
        }
      }, { transaction });

      insertedList.push({
        SKU: created.sku,
        Nama: created.name,
        'Harga Beli': `Rp ${Number(created.purchasePrice).toLocaleString('id-ID')}`,
        'Harga Jual': `Rp ${Number(created.sellingPrice).toLocaleString('id-ID')}`,
        'Pajak': 'Non-PPN (Non PKP)'
      });
      createdCount++;
    }

    await transaction.commit();

    console.log(`\n🎉 Berhasil menambahkan ${createdCount} produk ke database!`);
    console.table(insertedList.slice(0, 15));
    console.log(`... dan ${insertedList.length - 15} produk lainnya.`);

    process.exit(0);
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Terjadi kesalahan saat menginput produk:', err);
    process.exit(1);
  }
}

importProducts();
