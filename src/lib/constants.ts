import type { AssetSymbol, ChainNetwork, Sport } from "@/lib/types";

export const SPORTS: { value: Sport; label: string; emoji: string }[] = [
  { value: "football", label: "Football", emoji: "⚽" },
  { value: "cricket", label: "Cricket", emoji: "🏏" },
  { value: "basketball", label: "Basketball", emoji: "🏀" },
  { value: "tennis", label: "Tennis", emoji: "🎾" },
  { value: "esports", label: "Esports", emoji: "🎮" },
];

export const SPORT_LABEL: Record<Sport, string> = {
  football: "Football",
  cricket: "Cricket",
  basketball: "Basketball",
  tennis: "Tennis",
  esports: "Esports",
};

/** Networks and the assets each one settles. Mirrors the SQL CHECK constraint. */
export const NETWORKS: {
  value: ChainNetwork;
  label: string;
  assets: AssetSymbol[];
  explorer: string | null;
}[] = [
  {
    value: "robinhood",
    label: "Robinhood Chain",
    assets: ["ETH", "USDG"],
    explorer: null,
  },
  {
    value: "ethereum",
    label: "Ethereum",
    assets: ["USDC", "USDT", "ETH"],
    explorer: "https://etherscan.io/tx/",
  },
];

export const NETWORK_LABEL: Record<ChainNetwork, string> = {
  robinhood: "Robinhood Chain",
  ethereum: "Ethereum",
};

export function assetsForNetwork(network: ChainNetwork): AssetSymbol[] {
  return NETWORKS.find((n) => n.value === network)?.assets ?? [];
}

export const KYC_DOC_LABEL = {
  national_id: "National ID",
  passport: "Passport",
  driving_license: "Driving License",
} as const;

export const PAGE_SIZE = 20;

export const FAQ_ITEMS = [
  {
    q: "How do prediction markets work here?",
    a: "Every market asks a yes-or-no question about a real sporting event. YES and NO shares are priced in cents and always sum to 100¢ — that price is the market's implied probability. Buy the side you believe is underpriced. Winning shares settle at 1.00 USDG each, losing shares at zero.",
  },
  {
    q: "What does a trade cost?",
    a: "A flat platform fee between 0.30 and 1.00 USDG applies each time you open a position, and again if you cancel it. The exact figure is shown before you confirm, so you always know the cost up front.",
  },
  {
    q: "Can I cancel a prediction after placing it?",
    a: "Yes. You can cancel any open position while its market is still open and receive your stake back, minus the cancellation fee. Once a market closes for resolution, positions are locked until settlement.",
  },
  {
    q: "Which networks and assets can I deposit?",
    a: "Robinhood Chain supports ETH and USDG. Ethereum supports USDC, USDT and ETH. Submit your transaction hash after sending, and our team credits your balance once the transfer is confirmed on-chain.",
  },
  {
    q: "Why does my deposit address change?",
    a: "We rotate through a pool of custody addresses and show you one at random each visit. Always copy the address displayed on the deposit page for that specific transfer rather than reusing an old one.",
  },
  {
    q: "How does the bonus turnover requirement work?",
    a: "Bonus funds carry a wagering requirement — typically 5x the bonus amount. Your progress updates with every trade you place, and withdrawals unlock once the requirement is cleared. You can track exact progress on your wallet page.",
  },
  {
    q: "Do I need identity verification?",
    a: "Trading and deposits are open once your email is confirmed. KYC verification is required before your first withdrawal. Upload a government ID plus a live selfie and our team reviews it, usually within one business day.",
  },
  {
    q: "How do referral earnings work?",
    a: "Share your referral code and you earn a percentage of the platform fee on every trade your invitees place — for as long as they keep trading. Earnings land in your main balance automatically and are withdrawable.",
  },
] as const;
