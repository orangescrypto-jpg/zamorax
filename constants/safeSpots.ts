export interface SafeSpot {
  id: string
  name: string
  type: "police" | "mall" | "bank" | "fastfood" | "hospital"
  address: string
  state: string
  city: string
  lat: number
  lng: number
}

export const SAFE_SPOTS: SafeSpot[] = [
  // Lagos
  { id: "lag-1", name: "Ikeja Police Station", type: "police", address: "1 Oba Akinjobi Rd, Ikeja", state: "Lagos", city: "Ikeja", lat: 6.5955, lng: 3.3441 },
  { id: "lag-2", name: "The Palms Shopping Mall", type: "mall", address: "Lekki-Epe Expressway, Lekki", state: "Lagos", city: "Lekki", lat: 6.4281, lng: 3.4219 },
  { id: "lag-3", name: "Ikeja City Mall", type: "mall", address: "Obafemi Awolowo Way, Ikeja", state: "Lagos", city: "Ikeja", lat: 6.6018, lng: 3.3515 },
  { id: "lag-4", name: "Maryland Mall", type: "mall", address: "Ikorodu Rd, Maryland", state: "Lagos", city: "Maryland", lat: 6.5677, lng: 3.3726 },
  { id: "lag-5", name: "GTBank Headquarters", type: "bank", address: "635 Akin Adesola St, Victoria Island", state: "Lagos", city: "Victoria Island", lat: 6.4281, lng: 3.4219 },
  { id: "lag-6", name: "Shoprite Surulere", type: "mall", address: "Adeniran Ogunsanya, Surulere", state: "Lagos", city: "Surulere", lat: 6.5006, lng: 3.3571 },
  { id: "lag-7", name: "KFC Yaba", type: "fastfood", address: "Herbert Macaulay Way, Yaba", state: "Lagos", city: "Yaba", lat: 6.5098, lng: 3.3778 },
  { id: "lag-8", name: "Lagos Island Police Station", type: "police", address: "35 Lagos Island", state: "Lagos", city: "Lagos Island", lat: 6.4541, lng: 3.3947 },
  { id: "lag-9", name: "Blenco Supermarket Sangotedo", type: "mall", address: "Lekki-Epe Expressway, Sangotedo", state: "Lagos", city: "Ajah", lat: 6.4682, lng: 3.5679 },
  { id: "lag-10", name: "Shoprite Sangotedo", type: "mall", address: "Novare Mall, Sangotedo", state: "Lagos", city: "Ajah", lat: 6.4698, lng: 3.5701 },

  // Abuja
  { id: "abj-1", name: "Jabi Lake Mall", type: "mall", address: "Jabi Lake, Jabi", state: "FCT", city: "Jabi", lat: 9.0642, lng: 7.4536 },
  { id: "abj-2", name: "Ceddi Plaza", type: "mall", address: "Central Business District, Abuja", state: "FCT", city: "CBD", lat: 9.0579, lng: 7.4951 },
  { id: "abj-3", name: "Wuse Market Police Post", type: "police", address: "Wuse Market, Zone 5", state: "FCT", city: "Wuse", lat: 9.0689, lng: 7.4836 },
  { id: "abj-4", name: "Silverbird Galleria Abuja", type: "mall", address: "Central Business District", state: "FCT", city: "CBD", lat: 9.0543, lng: 7.4894 },
  { id: "abj-5", name: "Garki Police Station", type: "police", address: "Garki Area 11, Abuja", state: "FCT", city: "Garki", lat: 9.0412, lng: 7.4831 },
  { id: "abj-6", name: "KFC Wuse 2", type: "fastfood", address: "Aminu Kano Crescent, Wuse 2", state: "FCT", city: "Wuse 2", lat: 9.0756, lng: 7.4897 },
  { id: "abj-7", name: "Shoprite Lugbe", type: "mall", address: "Lugbe, Abuja", state: "FCT", city: "Lugbe", lat: 8.9977, lng: 7.3811 },

  // Port Harcourt
  { id: "ph-1", name: "Port Harcourt Mall", type: "mall", address: "Stadium Rd, Port Harcourt", state: "Rivers", city: "Port Harcourt", lat: 4.8242, lng: 7.0336 },
  { id: "ph-2", name: "GRA Police Station", type: "police", address: "GRA Phase 2, Port Harcourt", state: "Rivers", city: "Port Harcourt", lat: 4.8156, lng: 7.0122 },
  { id: "ph-3", name: "Rumuola Police Station", type: "police", address: "Rumuola, Port Harcourt", state: "Rivers", city: "Port Harcourt", lat: 4.8431, lng: 7.0231 },
  { id: "ph-4", name: "Genesis Centre", type: "mall", address: "Moscow Rd, Port Harcourt", state: "Rivers", city: "Port Harcourt", lat: 4.8315, lng: 7.0412 },

  // Kano
  { id: "kan-1", name: "Kano City Mall", type: "mall", address: "Maiduguri Rd, Kano", state: "Kano", city: "Kano", lat: 12.0022, lng: 8.5920 },
  { id: "kan-2", name: "Bompai Police Station", type: "police", address: "Bompai Rd, Kano", state: "Kano", city: "Kano", lat: 12.0145, lng: 8.5234 },
  { id: "kan-3", name: "Shoprite Kano", type: "mall", address: "Zoo Rd, Kano", state: "Kano", city: "Kano", lat: 11.9981, lng: 8.5177 },

  // Ibadan
  { id: "ibd-1", name: "Cocoa Mall Ibadan", type: "mall", address: "Ring Rd, Ibadan", state: "Oyo", city: "Ibadan", lat: 7.3775, lng: 3.9470 },
  { id: "ibd-2", name: "Challenge Police Station", type: "police", address: "Challenge, Ibadan", state: "Oyo", city: "Ibadan", lat: 7.3865, lng: 3.9012 },
  { id: "ibd-3", name: "Palms Ibadan", type: "mall", address: "Ring Rd, Ibadan", state: "Oyo", city: "Ibadan", lat: 7.3801, lng: 3.9489 },

  // Enugu
  { id: "enu-1", name: "Enugu Police HQ", type: "police", address: "Okpara Avenue, Enugu", state: "Enugu", city: "Enugu", lat: 6.4401, lng: 7.4986 },
  { id: "enu-2", name: "Coal City Mall", type: "mall", address: "Abakaliki Rd, Enugu", state: "Enugu", city: "Enugu", lat: 6.4598, lng: 7.5102 },

  // Benin City
  { id: "ben-1", name: "Ring Road Police Station", type: "police", address: "Ring Rd, Benin City", state: "Edo", city: "Benin City", lat: 6.3350, lng: 5.6037 },
  { id: "ben-2", name: "Uselu Market Area", type: "mall", address: "Uselu Lagos Rd, Benin", state: "Edo", city: "Benin City", lat: 6.3712, lng: 5.6198 },

  // Kaduna
  { id: "kad-1", name: "Kaduna Police HQ", type: "police", address: "Ahmadu Bello Way, Kaduna", state: "Kaduna", city: "Kaduna", lat: 10.5222, lng: 7.4383 },
  { id: "kad-2", name: "Polo Park Kaduna", type: "mall", address: "Kaduna", state: "Kaduna", city: "Kaduna", lat: 10.5105, lng: 7.4177 },

  // Owerri
  { id: "ow-1", name: "New Owerri Police Station", type: "police", address: "New Owerri, Imo", state: "Imo", city: "Owerri", lat: 5.4836, lng: 7.0259 },
  { id: "ow-2", name: "Relief Market Area", type: "mall", address: "Relief Market Rd, Owerri", state: "Imo", city: "Owerri", lat: 5.4712, lng: 7.0312 },

  // Warri
  { id: "war-1", name: "Warri Central Police Station", type: "police", address: "Okumagba Ave, Warri", state: "Delta", city: "Warri", lat: 5.5167, lng: 5.7502 },
  { id: "war-2", name: "Igbudu Market Area", type: "mall", address: "Igbudu, Warri", state: "Delta", city: "Warri", lat: 5.5098, lng: 5.7436 },

  // Abeokuta
  { id: "abk-1", name: "Kemta Police Station", type: "police", address: "Kemta, Abeokuta", state: "Ogun", city: "Abeokuta", lat: 7.1475, lng: 3.3619 },
  { id: "abk-2", name: "Kuto Market Area", type: "mall", address: "Kuto, Abeokuta", state: "Ogun", city: "Abeokuta", lat: 7.1557, lng: 3.3473 },

  // Uyo
  { id: "uyo-1", name: "Uyo Police HQ", type: "police", address: "Abak Rd, Uyo", state: "Akwa Ibom", city: "Uyo", lat: 5.0377, lng: 7.9128 },
  { id: "uyo-2", name: "Harbour Point Mall", type: "mall", address: "Udo Udoma Ave, Uyo", state: "Akwa Ibom", city: "Uyo", lat: 5.0512, lng: 7.9237 },
]

export const SPOT_TYPE_LABEL: Record<SafeSpot["type"], string> = {
  police: "Police Station",
  mall: "Shopping Mall",
  bank: "Bank",
  fastfood: "Fast Food",
  hospital: "Hospital",
}

export const SPOT_TYPE_COLOR: Record<SafeSpot["type"], string> = {
  police: "text-blue-600 bg-blue-50",
  mall: "text-purple-600 bg-purple-50",
  bank: "text-green-600 bg-green-50",
  fastfood: "text-orange-600 bg-orange-50",
  hospital: "text-red-600 bg-red-50",
}

export function getSpotsForState(state: string): SafeSpot[] {
  return SAFE_SPOTS.filter(s => s.state.toLowerCase() === state.toLowerCase())
}
