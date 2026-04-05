export type CarMake = {
  make: string;
  models: string[];
};

export const CAR_DATA: CarMake[] = [
  { make: "Acura", models: ["ILX", "MDX", "RDX", "TLX", "Integra"] },
  { make: "Audi", models: ["A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron", "RS5", "RS7"] },
  { make: "BMW", models: ["2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X7", "M3", "M5", "iX"] },
  { make: "Cadillac", models: ["CT4", "CT5", "Escalade", "XT4", "XT5", "XT6", "Lyriq"] },
  { make: "Chevrolet", models: ["Blazer", "Camaro", "Colorado", "Corvette", "Equinox", "Malibu", "Silverado", "Suburban", "Tahoe", "Traverse", "Trax"] },
  { make: "Chrysler", models: ["300", "Pacifica", "Voyager"] },
  { make: "Dodge", models: ["Challenger", "Charger", "Durango", "Hornet"] },
  { make: "Ferrari", models: ["296 GTB", "Roma", "SF90", "Portofino"] },
  { make: "Ford", models: ["Bronco", "Edge", "Escape", "Explorer", "F-150", "Fusion", "Maverick", "Mustang", "Ranger", "Transit"] },
  { make: "Genesis", models: ["G70", "G80", "G90", "GV70", "GV80"] },
  { make: "GMC", models: ["Acadia", "Canyon", "Sierra", "Terrain", "Yukon"] },
  { make: "Honda", models: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"] },
  { make: "Hyundai", models: ["Elantra", "Ioniq 5", "Ioniq 6", "Kona", "Palisade", "Santa Cruz", "Santa Fe", "Sonata", "Tucson"] },
  { make: "Infiniti", models: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"] },
  { make: "Jeep", models: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Renegade", "Wrangler"] },
  { make: "Kia", models: ["Carnival", "EV6", "K5", "Niro", "Seltos", "Sorento", "Soul", "Sportage", "Stinger", "Telluride"] },
  { make: "Lamborghini", models: ["Huracán", "Urus", "Revuelto"] },
  { make: "Land Rover", models: ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"] },
  { make: "Lexus", models: ["ES", "GX", "IS", "LC", "LS", "LX", "NX", "RX", "RZ", "UX"] },
  { make: "Lincoln", models: ["Aviator", "Corsair", "Nautilus", "Navigator"] },
  { make: "Maserati", models: ["Ghibli", "GranTurismo", "Grecale", "Levante", "Quattroporte"] },
  { make: "Mazda", models: ["CX-30", "CX-5", "CX-50", "CX-70", "CX-90", "Mazda3", "Mazda6", "MX-5 Miata"] },
  { make: "Mercedes-Benz", models: ["A-Class", "C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE", "GLS", "AMG GT", "EQS", "EQE"] },
  { make: "Mini", models: ["Clubman", "Convertible", "Countryman", "Hardtop"] },
  { make: "Mitsubishi", models: ["Eclipse Cross", "Outlander", "Outlander Sport"] },
  { make: "Nissan", models: ["Altima", "Armada", "Frontier", "Kicks", "Leaf", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa", "Z"] },
  { make: "Porsche", models: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan"] },
  { make: "Ram", models: ["1500", "2500", "3500", "ProMaster"] },
  { make: "Rivian", models: ["R1S", "R1T"] },
  { make: "Subaru", models: ["Ascent", "BRZ", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "Solterra", "WRX"] },
  { make: "Tesla", models: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"] },
  { make: "Toyota", models: ["4Runner", "bZ4X", "Camry", "Corolla", "GR86", "Highlander", "Land Cruiser", "Prius", "RAV4", "Sequoia", "Sienna", "Supra", "Tacoma", "Tundra", "Venza"] },
  { make: "Volkswagen", models: ["Atlas", "Golf", "ID.4", "Jetta", "Taos", "Tiguan"] },
  { make: "Volvo", models: ["C40", "S60", "S90", "V60", "XC40", "XC60", "XC90"] },
];

export const CAR_MAKES = CAR_DATA.map((c) => c.make);

export function getModelsForMake(make: string): string[] {
  return CAR_DATA.find((c) => c.make === make)?.models ?? [];
}
