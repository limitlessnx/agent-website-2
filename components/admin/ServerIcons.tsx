import type { CSSProperties } from "react";

const labels = {
  Activity: "AC",
  AlertCircle: "AC",
  AlertTriangle: "AL",
  ArrowLeft: "AL",
  ArrowRight: "AR",
  ArrowUp: "AU",
  ArrowUpRight: "AR",
  BarChart2: "BC",
  Bell: "BE",
  BellRing: "BR",
  BookOpen: "BO",
  Bot: "AI",
  Boxes: "BX",
  BrainCircuit: "BR",
  Briefcase: "BF",
  Building2: "BU",
  Cable: "CA",
  Calendar: "CA",
  CalendarCheck2: "CC",
  CalendarDays: "CA",
  Check: "OK",
  CheckCircle: "OK",
  CheckCircle2: "OK",
  CheckSquare: "CS",
  ChevronDown: "CH",
  ChevronRight: "CR",
  CircleAlert: "CA",
  CircleDashed: "CI",
  CircleDollarSign: "CD",
  ClipboardList: "CL",
  Clock: "CL",
  Clock3: "CL",
  CreditCard: "CC",
  Database: "DB",
  Download: "DO",
  Dumbbell: "DU",
  Edit3: "ED",
  ExternalLink: "EX",
  FileText: "FI",
  Filter: "FI",
  Flame: "FL",
  FlaskConical: "FC",
  Gauge: "GA",
  GitBranch: "GB",
  Globe2: "GL",
  Headphones: "HE",
  History: "HI",
  Home: "HO",
  Hotel: "HT",
  House: "HO",
  Image: "IM",
  ImagePlus: "IM",
  KeyRound: "KE",
  Layers: "LA",
  Layers3: "LA",
  LayoutDashboard: "LD",
  LifeBuoy: "LB",
  LineChart: "LC",
  Link2: "LI",
  Loader2: "LO",
  LoaderCircle: "LO",
  LockKeyhole: "LK",
  LogIn: "LI",
  Mail: "MA",
  MailCheck: "MC",
  Megaphone: "ME",
  Menu: "ME",
  MessageCircle: "MS",
  MessageSquare: "MS",
  MessageSquareText: "MT",
  MessagesSquare: "MS",
  Mic: "MI",
  Mic2: "MI",
  MicOff: "MO",
  Moon: "MO",
  Network: "NE",
  Pause: "PA",
  PauseCircle: "PC",
  Phone: "PH",
  PhoneCall: "PH",
  Play: "PY",
  PlugZap: "PL",
  Plus: "PL",
  PlusCircle: "PC",
  Radio: "RA",
  RefreshCw: "RF",
  RotateCcw: "RC",
  Rocket: "RO",
  Save: "SA",
  Search: "SE",
  Send: "SN",
  Settings: "SE",
  Settings2: "ST",
  ShieldCheck: "SH",
  ShoppingBag: "SB",
  ShoppingCart: "SC",
  SkipForward: "SK",
  SlidersHorizontal: "SL",
  Sparkles: "SP",
  Square: "SQ",
  Star: "ST",
  Stethoscope: "ST",
  Sun: "SU",
  Target: "TG",
  Trash2: "TR",
  TriangleAlert: "TA",
  Truck: "TR",
  User: "UR",
  UserCheck: "UC",
  UserRound: "UR",
  Users: "US",
  UsersRound: "UR",
  WalletCards: "WA",
  Workflow: "WF",
  Wrench: "WR",
  X: "X",
  XCircle: "XC",
  Zap: "ZA",
} as const;

type IconName = keyof typeof labels;

function makeIcon(name: IconName) {
  return function ServerIcon({
    size = 18,
    className,
    color,
    style,
  }: {
    size?: number;
    className?: string;
    color?: string;
    style?: CSSProperties;
  }) {
    return (
      <span
        aria-hidden="true"
        className={["server-icon", className].filter(Boolean).join(" ")}
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.45)), color, ...style }}
      >
        {labels[name]}
      </span>
    );
  };
}

export const Activity = makeIcon("Activity");
export const AlertCircle = makeIcon("AlertCircle");
export const AlertTriangle = makeIcon("AlertTriangle");
export const ArrowLeft = makeIcon("ArrowLeft");
export const ArrowRight = makeIcon("ArrowRight");
export const ArrowUp = makeIcon("ArrowUp");
export const ArrowUpRight = makeIcon("ArrowUpRight");
export const BarChart2 = makeIcon("BarChart2");
export const Bell = makeIcon("Bell");
export const BellRing = makeIcon("BellRing");
export const BookOpen = makeIcon("BookOpen");
export const Bot = makeIcon("Bot");
export const Boxes = makeIcon("Boxes");
export const BrainCircuit = makeIcon("BrainCircuit");
export const Briefcase = makeIcon("Briefcase");
export const Building2 = makeIcon("Building2");
export const Cable = makeIcon("Cable");
export const Calendar = makeIcon("Calendar");
export const CalendarCheck2 = makeIcon("CalendarCheck2");
export const CalendarDays = makeIcon("CalendarDays");
export const Check = makeIcon("Check");
export const CheckCircle = makeIcon("CheckCircle");
export const CheckCircle2 = makeIcon("CheckCircle2");
export const CheckSquare = makeIcon("CheckSquare");
export const ChevronDown = makeIcon("ChevronDown");
export const ChevronRight = makeIcon("ChevronRight");
export const CircleAlert = makeIcon("CircleAlert");
export const CircleDashed = makeIcon("CircleDashed");
export const CircleDollarSign = makeIcon("CircleDollarSign");
export const ClipboardList = makeIcon("ClipboardList");
export const Clock = makeIcon("Clock");
export const Clock3 = makeIcon("Clock3");
export const CreditCard = makeIcon("CreditCard");
export const Database = makeIcon("Database");
export const Download = makeIcon("Download");
export const Dumbbell = makeIcon("Dumbbell");
export const Edit3 = makeIcon("Edit3");
export const ExternalLink = makeIcon("ExternalLink");
export const FileText = makeIcon("FileText");
export const Filter = makeIcon("Filter");
export const Flame = makeIcon("Flame");
export const FlaskConical = makeIcon("FlaskConical");
export const Gauge = makeIcon("Gauge");
export const GitBranch = makeIcon("GitBranch");
export const Globe2 = makeIcon("Globe2");
export const Headphones = makeIcon("Headphones");
export const History = makeIcon("History");
export const Home = makeIcon("Home");
export const Hotel = makeIcon("Hotel");
export const House = makeIcon("House");
export const Image = makeIcon("Image");
export const ImagePlus = makeIcon("ImagePlus");
export const KeyRound = makeIcon("KeyRound");
export const Layers = makeIcon("Layers");
export const Layers3 = makeIcon("Layers3");
export const LayoutDashboard = makeIcon("LayoutDashboard");
export const LifeBuoy = makeIcon("LifeBuoy");
export const LineChart = makeIcon("LineChart");
export const Link2 = makeIcon("Link2");
export const Loader2 = makeIcon("Loader2");
export const LoaderCircle = makeIcon("LoaderCircle");
export const LockKeyhole = makeIcon("LockKeyhole");
export const LogIn = makeIcon("LogIn");
export const Mail = makeIcon("Mail");
export const MailCheck = makeIcon("MailCheck");
export const Megaphone = makeIcon("Megaphone");
export const Menu = makeIcon("Menu");
export const MessageCircle = makeIcon("MessageCircle");
export const MessageSquare = makeIcon("MessageSquare");
export const MessageSquareText = makeIcon("MessageSquareText");
export const MessagesSquare = makeIcon("MessagesSquare");
export const Mic = makeIcon("Mic");
export const Mic2 = makeIcon("Mic2");
export const MicOff = makeIcon("MicOff");
export const Moon = makeIcon("Moon");
export const Network = makeIcon("Network");
export const Pause = makeIcon("Pause");
export const PauseCircle = makeIcon("PauseCircle");
export const Phone = makeIcon("Phone");
export const PhoneCall = makeIcon("PhoneCall");
export const Play = makeIcon("Play");
export const PlugZap = makeIcon("PlugZap");
export const Plus = makeIcon("Plus");
export const PlusCircle = makeIcon("PlusCircle");
export const Radio = makeIcon("Radio");
export const RefreshCw = makeIcon("RefreshCw");
export const RotateCcw = makeIcon("RotateCcw");
export const Rocket = makeIcon("Rocket");
export const Save = makeIcon("Save");
export const Search = makeIcon("Search");
export const Send = makeIcon("Send");
export const Settings = makeIcon("Settings");
export const Settings2 = makeIcon("Settings2");
export const ShieldCheck = makeIcon("ShieldCheck");
export const ShoppingBag = makeIcon("ShoppingBag");
export const ShoppingCart = makeIcon("ShoppingCart");
export const SkipForward = makeIcon("SkipForward");
export const SlidersHorizontal = makeIcon("SlidersHorizontal");
export const Sparkles = makeIcon("Sparkles");
export const Square = makeIcon("Square");
export const Star = makeIcon("Star");
export const Stethoscope = makeIcon("Stethoscope");
export const Sun = makeIcon("Sun");
export const Target = makeIcon("Target");
export const Trash2 = makeIcon("Trash2");
export const TriangleAlert = makeIcon("TriangleAlert");
export const Truck = makeIcon("Truck");
export const User = makeIcon("User");
export const UserCheck = makeIcon("UserCheck");
export const UserRound = makeIcon("UserRound");
export const Users = makeIcon("Users");
export const UsersRound = makeIcon("UsersRound");
export const WalletCards = makeIcon("WalletCards");
export const Workflow = makeIcon("Workflow");
export const Wrench = makeIcon("Wrench");
export const X = makeIcon("X");
export const XCircle = makeIcon("XCircle");
export const Zap = makeIcon("Zap");
