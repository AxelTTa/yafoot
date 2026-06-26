export type CountryOption = {
  name: string;
  code: string;
  flag: string;
};

export const COUNTRIES: CountryOption[] = [
  { name: "Argentina", code: "ARG", flag: "🇦🇷" },
  { name: "Australia", code: "AUS", flag: "🇦🇺" },
  { name: "Austria", code: "AUT", flag: "🇦🇹" },
  { name: "Belgium", code: "BEL", flag: "🇧🇪" },
  { name: "Brazil", code: "BRA", flag: "🇧🇷" },
  { name: "Canada", code: "CAN", flag: "🇨🇦" },
  { name: "Chile", code: "CHI", flag: "🇨🇱" },
  { name: "Colombia", code: "COL", flag: "🇨🇴" },
  { name: "Costa Rica", code: "CRC", flag: "🇨🇷" },
  { name: "Croatia", code: "CRO", flag: "🇭🇷" },
  { name: "Czechia", code: "CZE", flag: "🇨🇿" },
  { name: "Denmark", code: "DEN", flag: "🇩🇰" },
  { name: "Ecuador", code: "ECU", flag: "🇪🇨" },
  { name: "Egypt", code: "EGY", flag: "🇪🇬" },
  { name: "England", code: "ENG", flag: "🏴" },
  { name: "France", code: "FRA", flag: "🇫🇷" },
  { name: "Germany", code: "GER", flag: "🇩🇪" },
  { name: "Ghana", code: "GHA", flag: "🇬🇭" },
  { name: "Greece", code: "GRE", flag: "🇬🇷" },
  { name: "Hungary", code: "HUN", flag: "🇭🇺" },
  { name: "Iceland", code: "ISL", flag: "🇮🇸" },
  { name: "Iran", code: "IRN", flag: "🇮🇷" },
  { name: "Ireland", code: "IRL", flag: "🇮🇪" },
  { name: "Italy", code: "ITA", flag: "🇮🇹" },
  { name: "Ivory Coast", code: "CIV", flag: "🇨🇮" },
  { name: "Japan", code: "JPN", flag: "🇯🇵" },
  { name: "Mexico", code: "MEX", flag: "🇲🇽" },
  { name: "Morocco", code: "MAR", flag: "🇲🇦" },
  { name: "Netherlands", code: "NED", flag: "🇳🇱" },
  { name: "New Zealand", code: "NZL", flag: "🇳🇿" },
  { name: "Nigeria", code: "NGA", flag: "🇳🇬" },
  { name: "Norway", code: "NOR", flag: "🇳🇴" },
  { name: "Paraguay", code: "PAR", flag: "🇵🇾" },
  { name: "Peru", code: "PER", flag: "🇵🇪" },
  { name: "Poland", code: "POL", flag: "🇵🇱" },
  { name: "Portugal", code: "POR", flag: "🇵🇹" },
  { name: "Qatar", code: "QAT", flag: "🇶🇦" },
  { name: "Saudi Arabia", code: "KSA", flag: "🇸🇦" },
  { name: "Scotland", code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Senegal", code: "SEN", flag: "🇸🇳" },
  { name: "Serbia", code: "SRB", flag: "🇷🇸" },
  { name: "South Africa", code: "RSA", flag: "🇿🇦" },
  { name: "South Korea", code: "KOR", flag: "🇰🇷" },
  { name: "Spain", code: "ESP", flag: "🇪🇸" },
  { name: "Sweden", code: "SWE", flag: "🇸🇪" },
  { name: "Switzerland", code: "SUI", flag: "🇨🇭" },
  { name: "Tunisia", code: "TUN", flag: "🇹🇳" },
  { name: "Turkey", code: "TUR", flag: "🇹🇷" },
  { name: "Ukraine", code: "UKR", flag: "🇺🇦" },
  { name: "United States", code: "USA", flag: "🇺🇸" },
  { name: "Uruguay", code: "URU", flag: "🇺🇾" },
  { name: "Wales", code: "WAL", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
];

export function findCountry(name: string | null | undefined) {
  if (!name) return null;
  return COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
}
