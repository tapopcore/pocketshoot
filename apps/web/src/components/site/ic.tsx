import {
  ArrowLeft, ArrowRight, Bell, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Coins, Crop, Download, Flag, Folder, Globe, House,
  Image as ImageIcon, Layers, LifeBuoy, Lock, LogOut, Mail, MessageCircle, MoreHorizontal, Palette, Plus, Receipt, RefreshCw, Ruler,
  Search, Settings, ShieldCheck, Smartphone, Store, Upload, UserRound, Users, Wand2, X, Zap, Box, Grid2x2,
} from "lucide-react";

const MAP = {
  arrow: ArrowRight, back: ArrowLeft, bell: Bell, camera: Camera, check: Check, chevd: ChevronDown, chevl: ChevronLeft, chev: ChevronRight,
  coins: Coins, crop: Crop, down: Download, flag: Flag, folder: Folder, globe: Globe, home: House, image: ImageIcon, layers: Layers,
  help: LifeBuoy, lock: Lock, logout: LogOut, mail: Mail, chat: MessageCircle, more: MoreHorizontal, palette: Palette, plus: Plus,
  receipt: Receipt, refresh: RefreshCw, ruler: Ruler, search: Search, cog: Settings, shield: ShieldCheck, phone: Smartphone, store: Store,
  upload: Upload, user: UserRound, users: Users, wand: Wand2, x: X, bolt: Zap, box: Box, grid: Grid2x2,
} as const;

export type IconName = keyof typeof MAP;
export function Ic({ n, size }: { n: IconName; size?: number }) {
  const C = MAP[n];
  return <C size={size} aria-hidden />;
}
