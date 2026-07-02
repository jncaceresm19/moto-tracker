import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import {
  users,
  motorcycles,
  maintenanceRecords,
  documents,
  kilometerHistory,
  motorcycleCatalogBrands,
  motorcycleCatalogModels,
  oilCatalogBrands,
  oilCatalogProducts,
  maintenanceTypes,
  notifications,
} from './schema';

// Create SQLite database
const sqlite = new Database('dev.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

// Helper to generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Seed motorcycle catalog brands
const motorcycleBrands = [
  { name: 'Honda', logoUrl: 'https://via.placeholder.com/100?text=Honda' },
  { name: 'Yamaha', logoUrl: 'https://via.placeholder.com/100?text=Yamaha' },
  { name: 'Kawasaki', logoUrl: 'https://via.placeholder.com/100?text=Kawasaki' },
  { name: 'Suzuki', logoUrl: 'https://via.placeholder.com/100?text=Suzuki' },
  { name: 'BMW', logoUrl: 'https://via.placeholder.com/100?text=BMW' },
  { name: 'Ducati', logoUrl: 'https://via.placeholder.com/100?text=Ducati' },
  { name: 'KTM', logoUrl: 'https://via.placeholder.com/100?text=KTM' },
  { name: 'Husqvarna', logoUrl: 'https://via.placeholder.com/100?text=Husqvarna' },
  { name: 'Triumph', logoUrl: 'https://via.placeholder.com/100?text=Triumph' },
  { name: 'Indian', logoUrl: 'https://via.placeholder.com/100?text=Indian' },
  { name: 'Harley-Davidson', logoUrl: 'https://via.placeholder.com/100?text=Harley' },
  { name: 'Aprilia', logoUrl: 'https://via.placeholder.com/100?text=Aprilia' },
  { name: 'Moto Guzzi', logoUrl: 'https://via.placeholder.com/100?text=Moto+Guzzi' },
  { name: 'MV Agusta', logoUrl: 'https://via.placeholder.com/100?text=MV+Agusta' },
  { name: 'Royal Enfield', logoUrl: 'https://via.placeholder.com/100?text=Royal+Enfield' },
  { name: 'Benelli', logoUrl: 'https://via.placeholder.com/100?text=Benelli' },
  { name: 'CFMoto', logoUrl: 'https://via.placeholder.com/100?text=CFMoto' },
  { name: 'GasGas', logoUrl: 'https://via.placeholder.com/100?text=GasGas' },
  { name: 'Beta', logoUrl: 'https://via.placeholder.com/100?text=Beta' },
  { name: 'Sherco', logoUrl: 'https://via.placeholder.com/100?text=Sherco' },
  { name: 'Fantic', logoUrl: 'https://via.placeholder.com/100?text=Fantic' },
  { name: 'Cagiva', logoUrl: 'https://via.placeholder.com/100?text=Cagiva' },
  { name: 'Bimota', logoUrl: 'https://via.placeholder.com/100?text=Bimota' },
  { name: 'Norton', logoUrl: 'https://via.placeholder.com/100?text=Norton' },
  { name: 'BSA', logoUrl: 'https://via.placeholder.com/100?text=BSA' },
  { name: 'Laverda', logoUrl: 'https://via.placeholder.com/100?text=Laverda' },
  { name: 'MZ', logoUrl: 'https://via.placeholder.com/100?text=MZ' },
  { name: 'Jawa', logoUrl: 'https://via.placeholder.com/100?text=Jawa' },
  { name: 'Yezdi', logoUrl: 'https://via.placeholder.com/100?text=Yezdi' },
  { name: 'TVS', logoUrl: 'https://via.placeholder.com/100?text=TVS' },
  { name: 'Bajaj', logoUrl: 'https://via.placeholder.com/100?text=Bajaj' },
  { name: 'Hero', logoUrl: 'https://via.placeholder.com/100?text=Hero' },
  { name: 'SWM', logoUrl: 'https://via.placeholder.com/100?text=SWM' },
  { name: 'UM', logoUrl: 'https://via.placeholder.com/100?text=UM' },
  { name: 'Hyosung', logoUrl: 'https://via.placeholder.com/100?text=Hyosung' },
  { name: 'Sym', logoUrl: 'https://via.placeholder.com/100?text=Sym' },
  { name: 'Kymco', logoUrl: 'https://via.placeholder.com/100?text=Kymco' },
  { name: 'Piaggio', logoUrl: 'https://via.placeholder.com/100?text=Piaggio' },
  { name: 'Vespa', logoUrl: 'https://via.placeholder.com/100?text=Vespa' },
  { name: 'Gilera', logoUrl: 'https://via.placeholder.com/100?text=Gilera' },
  { name: 'Derbi', logoUrl: 'https://via.placeholder.com/100?text=Derbi' },
  { name: 'Montesa', logoUrl: 'https://via.placeholder.com/100?text=Montesa' },
  { name: 'OSSA', logoUrl: 'https://via.placeholder.com/100?text=OSSA' },
  { name: 'Bultaco', logoUrl: 'https://via.placeholder.com/100?text=Bultaco' },
  { name: 'Sanglas', logoUrl: 'https://via.placeholder.com/100?text=Sanglas' },
  { name: 'Ningbo', logoUrl: 'https://via.placeholder.com/100?text=Ningbo' },
  { name: 'Zongshen', logoUrl: 'https://via.placeholder.com/100?text=Zongshen' },
  { name: 'Lifan', logoUrl: 'https://via.placeholder.com/100?text=Lifan' },
  { name: 'Loncin', logoUrl: 'https://via.placeholder.com/100?text=Loncin' },
  { name: 'Shineray', logoUrl: 'https://via.placeholder.com/100?text=Shineray' },
];

// Seed motorcycle catalog models (4 per brand)
const motorcycleModels = [
  // Honda
  { brandName: 'Honda', name: 'CBR600RR', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=CBR600RR' },
  { brandName: 'Honda', name: 'CBR1000RR', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=CBR1000RR' },
  { brandName: 'Honda', name: 'CB500F', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=CB500F' },
  { brandName: 'Honda', name: 'CRF450R', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=CRF450R' },
  // Yamaha
  { brandName: 'Yamaha', name: 'YZF-R6', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=YZF-R6' },
  { brandName: 'Yamaha', name: 'YZF-R1', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=YZF-R1' },
  { brandName: 'Yamaha', name: 'MT-07', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=MT-07' },
  { brandName: 'Yamaha', name: 'Ténéré 700', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Ténéré+700' },
  // Kawasaki
  { brandName: 'Kawasaki', name: 'Ninja ZX-6R', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Ninja+ZX-6R' },
  { brandName: 'Kawasaki', name: 'Ninja ZX-10R', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Ninja+ZX-10R' },
  { brandName: 'Kawasaki', name: 'Z900', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Z900' },
  { brandName: 'Kawasaki', name: 'KLR 650', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=KLR+650' },
  // Suzuki
  { brandName: 'Suzuki', name: 'GSX-R750', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=GSX-R750' },
  { brandName: 'Suzuki', name: 'GSX-R1000', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=GSX-R1000' },
  { brandName: 'Suzuki', name: 'V-Strom 650', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=V-Strom+650' },
  { brandName: 'Suzuki', name: 'DR-Z400SM', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=DR-Z400SM' },
  // BMW
  { brandName: 'BMW', name: 'S1000RR', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=S1000RR' },
  { brandName: 'BMW', name: 'R1250GS', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=R1250GS' },
  { brandName: 'BMW', name: 'F900R', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=F900R' },
  { brandName: 'BMW', name: 'G310R', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=G310R' },
  // Ducati
  { brandName: 'Ducati', name: 'Panigale V4', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Panigale+V4' },
  { brandName: 'Ducati', name: 'Monster', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Monster' },
  { brandName: 'Ducati', name: 'Multistrada V4', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Multistrada+V4' },
  { brandName: 'Ducati', name: 'Scrambler', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Scrambler' },
  // KTM
  { brandName: 'KTM', name: '1290 Super Duke R', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=1290+Super+Duke+R' },
  { brandName: 'KTM', name: '390 Duke', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=390+Duke' },
  { brandName: 'KTM', name: 'RC 390', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=RC+390' },
  { brandName: 'KTM', name: '890 Adventure', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=890+Adventure' },
  // Husqvarna
  { brandName: 'Husqvarna', name: 'Vitpilen 701', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Vitpilen+701' },
  { brandName: 'Husqvarna', name: 'Svartpilen 401', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Svartpilen+401' },
  { brandName: 'Husqvarna', name: 'FE 350', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=FE+350' },
  { brandName: 'Husqvarna', name: 'Norden 901', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Norden+901' },
  // Triumph
  { brandName: 'Triumph', name: 'Street Triple', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Street+Triple' },
  { brandName: 'Triumph', name: 'Speed Triple', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Speed+Triple' },
  { brandName: 'Triumph', name: 'Tiger 900', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Tiger+900' },
  { brandName: 'Triumph', name: 'Bonneville T120', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Bonneville+T120' },
  // Indian
  { brandName: 'Indian', name: 'Scout', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Scout' },
  { brandName: 'Indian', name: 'FTR 1200', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=FTR+1200' },
  { brandName: 'Indian', name: 'Chieftain', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Chieftain' },
  { brandName: 'Indian', name: 'FTR Rally', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=FTR+Rally' },
  // Harley-Davidson
  { brandName: 'Harley-Davidson', name: 'Sportster S', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Sportster+S' },
  { brandName: 'Harley-Davidson', name: 'Pan America', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Pan+America' },
  { brandName: 'Harley-Davidson', name: 'Street Glide', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Street+Glide' },
  { brandName: 'Harley-Davidson', name: 'Iron 883', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Iron+883' },
  // Aprilia
  { brandName: 'Aprilia', name: 'RSV4', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=RSV4' },
  { brandName: 'Aprilia', name: 'Tuono V4', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Tuono+V4' },
  { brandName: 'Aprilia', name: 'RS 660', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=RS+660' },
  { brandName: 'Aprilia', name: 'Tuareg 660', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Tuareg+660' },
  // Moto Guzzi
  { brandName: 'Moto Guzzi', name: 'V85 TT', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=V85+TT' },
  { brandName: 'Moto Guzzi', name: 'V100 Mandello', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=V100+Mandello' },
  { brandName: 'Moto Guzzi', name: 'V7', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=V7' },
  { brandName: 'Moto Guzzi', name: 'V9', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=V9' },
  // MV Agusta
  { brandName: 'MV Agusta', name: 'F3', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=F3' },
  { brandName: 'MV Agusta', name: 'Dragster', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Dragster' },
  { brandName: 'MV Agusta', name: 'Turismo Veloce', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Turismo+Veloce' },
  { brandName: 'MV Agusta', name: 'Rivale', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Rivale' },
  // Royal Enfield
  { brandName: 'Royal Enfield', name: 'Classic 350', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Classic+350' },
  { brandName: 'Royal Enfield', name: 'Meteor 350', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Meteor+350' },
  { brandName: 'Royal Enfield', name: 'Himalayan', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Himalayan' },
  { brandName: 'Royal Enfield', name: 'Interceptor 650', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Interceptor+650' },
  // Benelli
  { brandName: 'Benelli', name: 'TNT 300', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=TNT+300' },
  { brandName: 'Benelli', name: 'TRK 502', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=TRK+502' },
  { brandName: 'Benelli', name: 'Leoncino', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Leoncino' },
  { brandName: 'Benelli', name: '502C', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=502C' },
  // CFMoto
  { brandName: 'CFMoto', name: '300NK', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=300NK' },
  { brandName: 'CFMoto', name: '650NK', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=650NK' },
  { brandName: 'CFMoto', name: '400NK', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=400NK' },
  { brandName: 'CFMoto', name: '800MT', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=800MT' },
  // GasGas
  { brandName: 'GasGas', name: 'EC 300', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=EC+300' },
  { brandName: 'GasGas', name: 'SM 700', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=SM+700' },
  { brandName: 'GasGas', name: 'ES 700', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=ES+700' },
  { brandName: 'GasGas', name: 'MC 125', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=MC+125' },
  // Beta
  { brandName: 'Beta', name: 'RR 300', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=RR+300' },
  { brandName: 'Beta', name: 'RR 350', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=RR+350' },
  { brandName: 'Beta', name: 'RR 430', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=RR+430' },
  { brandName: 'Beta', name: 'RR 480', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=RR+480' },
  // Sherco
  { brandName: 'Sherco', name: 'SE 250', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=SE+250' },
  { brandName: 'Sherco', name: 'SE 300', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=SE+300' },
  { brandName: 'Sherco', name: 'SE 450', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=SE+450' },
  { brandName: 'Sherco', name: 'SE 500', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=SE+500' },
  // Fantic
  { brandName: 'Fantic', name: 'XEF 450', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=XEF+450' },
  { brandName: 'Fantic', name: 'XE 125', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=XE+125' },
  { brandName: 'Fantic', name: 'XEF 250', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=XEF+250' },
  { brandName: 'Fantic', name: 'XEF 500', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=XEF+500' },
  // Cagiva
  { brandName: 'Cagiva', name: 'Mito 125', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Mito+125' },
  { brandName: 'Cagiva', name: 'V-Raptor', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=V-Raptor' },
  { brandName: 'Cagiva', name: 'Gran Canyon', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Gran+Canyon' },
  { brandName: 'Cagiva', name: 'Elefant', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Elefant' },
  // Bimota
  { brandName: 'Bimota', name: 'DB8', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=DB8' },
  { brandName: 'Bimota', name: 'KB4', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=KB4' },
  { brandName: 'Bimota', name: 'Tesi H2', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Tesi+H2' },
  { brandName: 'Bimota', name: 'Bb3', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Bb3' },
  // Norton
  { brandName: 'Norton', name: 'Commando 961', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Commando+961' },
  { brandName: 'Norton', name: 'V4RR', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=V4RR' },
  { brandName: 'Norton', name: 'Atlas', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Atlas' },
  { brandName: 'Norton', name: 'Superlight', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Superlight' },
  // BSA
  { brandName: 'BSA', name: 'Gold Star', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Gold+Star' },
  { brandName: 'BSA', name: 'Bantam', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Bantam' },
  { brandName: 'BSA', name: 'A65', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=A65' },
  { brandName: 'BSA', name: 'Rocket 3', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Rocket+3' },
  // Laverda
  { brandName: 'Laverda', name: '750 S', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=750+S' },
  { brandName: 'Laverda', name: '1000', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=1000' },
  { brandName: 'Laverda', name: 'Ghost', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Ghost' },
  { brandName: 'Laverda', name: 'Jota', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Jota' },
  // MZ
  { brandName: 'MZ', name: 'Skorpion', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Skorpion' },
  { brandName: 'MZ', name: 'Baghira', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Baghira' },
  { brandName: 'MZ', name: 'Saxon', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Saxon' },
  { brandName: 'MZ', name: 'GN 250', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=GN+250' },
  // Jawa
  { brandName: 'Jawa', name: '300', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=300' },
  { brandName: 'Jawa', name: '42', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=42' },
  { brandName: 'Jawa', name: 'Perak', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Perak' },
  { brandName: 'Jawa', name: 'Yezdi Roadster', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Yezdi+Roadster' },
  // Yezdi
  { brandName: 'Yezdi', name: 'Adventure', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Adventure' },
  { brandName: 'Yezdi', name: 'Scrambler', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Scrambler' },
  { brandName: 'Yezdi', name: 'Roadster', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Roadster' },
  { brandName: 'Yezdi', name: 'Cafe Racer', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Cafe+Racer' },
  // TVS
  { brandName: 'TVS', name: 'Apache RR 310', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Apache+RR+310' },
  { brandName: 'TVS', name: 'Apache RTR 200', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Apache+RTR+200' },
  { brandName: 'TVS', name: 'Ronin', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Ronin' },
  { brandName: 'TVS', name: 'Stryker', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Stryker' },
  // Bajaj
  { brandName: 'Bajaj', name: 'Pulsar NS200', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Pulsar+NS200' },
  { brandName: 'Bajaj', name: 'Pulsar RS200', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Pulsar+RS200' },
  { brandName: 'Bajaj', name: 'Dominar 400', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Dominar+400' },
  { brandName: 'Bajaj', name: 'Avenger', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Avenger' },
  // Hero
  { brandName: 'Hero', name: 'Karizma ZMR', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Karizma+ZMR' },
  { brandName: 'Hero', name: 'Xpulse 200', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Xpulse+200' },
  { brandName: 'Hero', name: 'Mavrick 440', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Mavrick+440' },
  { brandName: 'Hero', name: 'Splendor', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Splendor' },
  // SWM
  { brandName: 'SWM', name: 'Silver Vase 440', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Silver+Vase+440' },
  { brandName: 'SWM', name: 'Gran Milano', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Gran+Milano' },
  { brandName: 'SWM', name: 'Superdual', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Superdual' },
  { brandName: 'SWM', name: 'RC 300', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=RC+300' },
  // UM
  { brandName: 'UM', name: 'Renegade Commando', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Renegade+Commando' },
  { brandName: 'UM', name: 'Renegade Sport', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Renegade+Sport' },
  { brandName: 'UM', name: 'Renegade Classic', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Renegade+Classic' },
  { brandName: 'UM', name: 'DTX 360', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=DTX+360' },
  // Hyosung
  { brandName: 'Hyosung', name: 'GT650', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=GT650' },
  { brandName: 'Hyosung', name: 'GT250', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=GT250' },
  { brandName: 'Hyosung', name: 'GD250N', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=GD250N' },
  { brandName: 'Hyosung', name: 'MS3-650', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=MS3-650' },
  // Sym
  { brandName: 'Sym', name: 'NH T', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=NH+T' },
  { brandName: 'Sym', name: 'Wolf', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Wolf' },
  { brandName: 'Sym', name: 'Maxsym', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Maxsym' },
  { brandName: 'Sym', name: 'Joymax', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Joymax' },
  // Kymco
  { brandName: 'Kymco', name: 'AK550', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=AK550' },
  { brandName: 'Kymco', name: 'Kymco Downtown', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Kymco+Downtown' },
  { brandName: 'Kymco', name: 'Kymco Agility', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Kymco+Agility' },
  { brandName: 'Kymco', name: 'Kymco Like', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Kymco+Like' },
  // Piaggio
  { brandName: 'Piaggio', name: 'MP3', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=MP3' },
  { brandName: 'Piaggio', name: 'Beverly', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Beverly' },
  { brandName: 'Piaggio', name: 'Liberty', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Liberty' },
  { brandName: 'Piaggio', name: 'Medley', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Medley' },
  // Vespa
  { brandName: 'Vespa', name: 'GTS 300', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=GTS+300' },
  { brandName: 'Vespa', name: 'Primavera', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Primavera' },
  { brandName: 'Vespa', name: 'Sprint', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Sprint' },
  { brandName: 'Vespa', name: 'Sei Giorni', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Sei+Giorni' },
  // Gilera
  { brandName: 'Gilera', name: 'DNA', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=DNA' },
  { brandName: 'Gilera', name: 'Nexus', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Nexus' },
  { brandName: 'Gilera', name: 'Stalker', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Stalker' },
  { brandName: 'Gilera', name: 'Runner', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Runner' },
  // Derbi
  { brandName: 'Derbi', name: 'Senda', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Senda' },
  { brandName: 'Derbi', name: 'Mulhacen', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Mulhacen' },
  { brandName: 'Derbi', name: 'Terra', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Terra' },
  { brandName: 'Derbi', name: 'Cross City', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Cross+City' },
  // Montesa
  { brandName: 'Montesa', name: 'Cota 4RT', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Cota+4RT' },
  { brandName: 'Montesa', name: 'Cota 300RR', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Cota+300RR' },
  { brandName: 'Montesa', name: 'Cota 4RT 260', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Cota+4RT+260' },
  { brandName: 'Montesa', name: 'Cota 4RT 300', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Cota+4RT+300' },
  // OSSA
  { brandName: 'OSSA', name: 'MAR', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=MAR' },
  { brandName: 'OSSA', name: 'Phantom', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Phantom' },
  { brandName: 'OSSA', name: 'Desert Phantom', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Desert+Phantom' },
  { brandName: 'OSSA', name: 'TR 280', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=TR+280' },
  // Bultaco
  { brandName: 'Bultaco', name: 'Brinco', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Brinco' },
  { brandName: 'Bultaco', name: 'Rapitan', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Rapitan' },
  { brandName: 'Bultaco', name: 'Matador', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Matador' },
  { brandName: 'Bultaco', name: 'Climber', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Climber' },
  // Sanglas
  { brandName: 'Sanglas', name: '400', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=400' },
  { brandName: 'Sanglas', name: '600', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=600' },
  { brandName: 'Sanglas', name: '350', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=350' },
  { brandName: 'Sanglas', name: '250', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=250' },
  // Ningbo
  { brandName: 'Ningbo', name: 'Focus', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Focus' },
  { brandName: 'Ningbo', name: 'Flow', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Flow' },
  { brandName: 'Ningbo', name: 'Spark', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=Spark' },
  { brandName: 'Ningbo', name: 'Flash', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=Flash' },
  // Zongshen
  { brandName: 'Zongshen', name: 'Cyclone', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=Cyclone' },
  { brandName: 'Zongshen', name: 'Napoleon', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=Napoleon' },
  { brandName: 'Zongshen', name: 'RX1', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=RX1' },
  { brandName: 'Zongshen', name: 'RX3', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=RX3' },
  // Lifan
  { brandName: 'Lifan', name: 'KPR', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=KPR' },
  { brandName: 'Lifan', name: 'LF200', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=LF200' },
  { brandName: 'Lifan', name: 'KPV', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=KPV' },
  { brandName: 'Lifan', name: 'K-Light', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=K-Light' },
  // Loncin
  { brandName: 'Loncin', name: 'LV200', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=LV200' },
  { brandName: 'Loncin', name: 'LX200', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=LX200' },
  { brandName: 'Loncin', name: 'LP200', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=LP200' },
  { brandName: 'Loncin', name: 'LB200', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=LB200' },
  // Shineray
  { brandName: 'Shineray', name: 'XY200', year: 2022, imageUrl: 'https://via.placeholder.com/300?text=XY200' },
  { brandName: 'Shineray', name: 'X5', year: 2023, imageUrl: 'https://via.placeholder.com/300?text=X5' },
  { brandName: 'Shineray', name: 'X6', year: 2021, imageUrl: 'https://via.placeholder.com/300?text=X6' },
  { brandName: 'Shineray', name: 'X7', year: 2024, imageUrl: 'https://via.placeholder.com/300?text=X7' },
];

// Seed oil catalog brands
const oilBrands = [
  { name: 'Motul' },
  { name: 'Castrol' },
  { name: 'Shell' },
  { name: 'Mobil' },
  { name: 'Repsol' },
  { name: 'Liqui Moly' },
  { name: 'Valvoline' },
  { name: 'Pennzoil' },
  { name: 'Total' },
  { name: 'Elf' },
  { name: 'Bardahl' },
  { name: 'Agip' },
  { name: 'Elf' },
  { name: 'Nynas' },
  { name: 'Fuchs' },
];

// Seed oil catalog products
const oilProducts = [
  // Motul
  { brandName: 'Motul', name: '7100 4T', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Motul', name: '5100 4T', viscosity: '10W-40', type: 'semi-synthetic' },
  { brandName: 'Motul', name: '3100 4T', viscosity: '10W-40', type: 'mineral' },
  { brandName: 'Motul', name: '300V', viscosity: '5W-30', type: 'synthetic' },
  // Castrol
  { brandName: 'Castrol', name: 'Power1', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Castrol', name: 'Power1', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Castrol', name: 'Activo', viscosity: '10W-30', type: 'mineral' },
  { brandName: 'Castrol', name: 'Power1 Racing', viscosity: '5W-40', type: 'synthetic' },
  // Shell
  { brandName: 'Shell', name: 'Helix Ultra', viscosity: '5W-30', type: 'synthetic' },
  { brandName: 'Shell', name: 'Helix HX7', viscosity: '10W-40', type: 'semi-synthetic' },
  { brandName: 'Shell', name: 'Helix HX5', viscosity: '15W-40', type: 'mineral' },
  { brandName: 'Shell', name: 'Advance Ultra', viscosity: '5W-40', type: 'synthetic' },
  // Mobil
  { brandName: 'Mobil', name: '1', viscosity: '5W-30', type: 'synthetic' },
  { brandName: 'Mobil', name: '1', viscosity: '5W-50', type: 'synthetic' },
  { brandName: 'Mobil', name: 'Super', viscosity: '10W-40', type: 'semi-synthetic' },
  { brandName: 'Mobil', name: 'Delvac', viscosity: '15W-40', type: 'mineral' },
  // Repsol
  { brandName: 'Repsol', name: 'Moto Rider', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Repsol', name: 'Moto Rider', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Repsol', name: 'Moto Rider', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Repsol', name: 'Moto Race', viscosity: '5W-40', type: 'synthetic' },
  // Liqui Moly
  { brandName: 'Liqui Moly', name: '4T 10W-40', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Liqui Moly', name: '4T 15W-50', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Liqui Moly', name: '4T 20W-50', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Liqui Moly', name: 'Race 10W-40', viscosity: '10W-40', type: 'synthetic' },
  // Valvoline
  { brandName: 'Valvoline', name: '4-Stroke', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Valvoline', name: '4-Stroke', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Valvoline', name: '4-Stroke', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Valvoline', name: 'Full Synthetic', viscosity: '5W-30', type: 'synthetic' },
  // Pennzoil
  { brandName: 'Pennzoil', name: 'Gold', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Pennzoil', name: 'Silver', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Pennzoil', name: 'Bronze', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Pennzoil', name: 'Platinum', viscosity: '5W-30', type: 'synthetic' },
  // Total
  { brandName: 'Total', name: 'Rubia', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Total', name: 'Rubia', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Total', name: 'Rubia', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Total', name: 'Quartz', viscosity: '5W-30', type: 'synthetic' },
  // Elf
  { brandName: 'Elf', name: 'Moto', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Elf', name: 'Moto', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Elf', name: 'Moto', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Elf', name: 'Synthese', viscosity: '5W-30', type: 'synthetic' },
  // Bardahl
  { brandName: 'Bardahl', name: 'XTC', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Bardahl', name: 'XTC', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Bardahl', name: 'XTC', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Bardahl', name: 'Synthetic', viscosity: '5W-30', type: 'synthetic' },
  // Agip
  { brandName: 'Agip', name: 'Diavol', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Agip', name: 'Diavol', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Agip', name: 'Diavol', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Agip', name: 'Eni', viscosity: '5W-30', type: 'synthetic' },
  // Nynas
  { brandName: 'Nynas', name: 'TT', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Nynas', name: 'TT', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Nynas', name: 'TT', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Nynas', name: 'TT', viscosity: '5W-30', type: 'synthetic' },
  // Fuchs
  { brandName: 'Fuchs', name: 'Silkolene', viscosity: '10W-40', type: 'synthetic' },
  { brandName: 'Fuchs', name: 'Silkolene', viscosity: '15W-50', type: 'semi-synthetic' },
  { brandName: 'Fuchs', name: 'Silkolene', viscosity: '20W-50', type: 'mineral' },
  { brandName: 'Fuchs', name: 'Silkolene', viscosity: '5W-30', type: 'synthetic' },
];

// Seed maintenance types
const maintenanceTypesData = [
  { name: 'oil_change', defaultKmInterval: 5000, defaultMonthInterval: 6, category: 'engine' },
  { name: 'tire_change', defaultKmInterval: 20000, defaultMonthInterval: 24, category: 'wheels' },
  { name: 'brake_check', defaultKmInterval: 10000, defaultMonthInterval: 12, category: 'brakes' },
  { name: 'chain_adjustment', defaultKmInterval: 1000, defaultMonthInterval: 1, category: 'drive' },
  { name: 'valve_adjustment', defaultKmInterval: 20000, defaultMonthInterval: 24, category: 'engine' },
  { name: 'coolant_flush', defaultKmInterval: 30000, defaultMonthInterval: 36, category: 'cooling' },
  { name: 'air_filter', defaultKmInterval: 10000, defaultMonthInterval: 12, category: 'engine' },
  { name: 'spark_plugs', defaultKmInterval: 10000, defaultMonthInterval: 12, category: 'engine' },
  { name: 'technical_review', defaultKmInterval: null, defaultMonthInterval: 12, category: 'inspection' },
  { name: 'circulation_permit', defaultKmInterval: null, defaultMonthInterval: 12, category: 'legal' },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await db.delete(notifications);
  await db.delete(kilometerHistory);
  await db.delete(documents);
  await db.delete(maintenanceRecords);
  await db.delete(motorcycles);
  await db.delete(motorcycleCatalogModels);
  await db.delete(motorcycleCatalogBrands);
  await db.delete(oilCatalogProducts);
  await db.delete(oilCatalogBrands);
  await db.delete(maintenanceTypes);
  await db.delete(users);

  // Seed motorcycle brands
  console.log('  Seeding motorcycle brands...');
  const brandIdMap = new Map<string, string>();
  for (const brand of motorcycleBrands) {
    const id = generateId();
    brandIdMap.set(brand.name, id);
    await db.insert(motorcycleCatalogBrands).values({
      id,
      name: brand.name,
      logoUrl: brand.logoUrl,
    });
  }

  // Seed motorcycle models
  console.log('  Seeding motorcycle models...');
  for (const model of motorcycleModels) {
    const brandId = brandIdMap.get(model.brandName);
    if (!brandId) continue;
    await db.insert(motorcycleCatalogModels).values({
      id: generateId(),
      brandId,
      name: model.name,
      year: model.year,
      imageUrl: model.imageUrl,
    });
  }

  // Seed oil brands
  console.log('  Seeding oil brands...');
  const oilBrandIdMap = new Map<string, string>();
  for (const brand of oilBrands) {
    const id = generateId();
    oilBrandIdMap.set(brand.name, id);
    await db.insert(oilCatalogBrands).values({
      id,
      name: brand.name,
    });
  }

  // Seed oil products
  console.log('  Seeding oil products...');
  for (const product of oilProducts) {
    const brandId = oilBrandIdMap.get(product.brandName);
    if (!brandId) continue;
    await db.insert(oilCatalogProducts).values({
      id: generateId(),
      brandId,
      name: product.name,
      viscosity: product.viscosity,
      type: product.type,
    });
  }

  // Seed maintenance types
  console.log('  Seeding maintenance types...');
  for (const type of maintenanceTypesData) {
    await db.insert(maintenanceTypes).values({
      id: generateId(),
      name: type.name,
      defaultKmInterval: type.defaultKmInterval,
      defaultMonthInterval: type.defaultMonthInterval,
      category: type.category,
    });
  }

  console.log('✅ Seeding completed!');
  console.log(`   ${motorcycleBrands.length} motorcycle brands`);
  console.log(`   ${motorcycleModels.length} motorcycle models`);
  console.log(`   ${oilBrands.length} oil brands`);
  console.log(`   ${oilProducts.length} oil products`);
  console.log(`   ${maintenanceTypesData.length} maintenance types`);
}

seed().catch(console.error);