export interface Board {
  id: number;
  slug: string;
  title: string;
  team_top: string;
  team_side: string;
  game_date: string;
  cost_per_square: number;
  venmo_handle: string;
  is_open: boolean;
  payout_mode: "percent" | "fixed";
  payouts: {
    q1: number;
    ht: number;
    q3: number;
    final: number;
  };
  lock_at: string;
  randomized_at: string | null;
  top_nums: number[] | null;
  side_nums: number[] | null;
  scores: {
    q1?: { top: number; side: number };
    ht?: { top: number; side: number };
    q3?: { top: number; side: number };
    final?: { top: number; side: number };
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: number;
  board_id: number;
  square_idx: number;
  buyer_name: string;
  email: string;
  venmo_handle: string | null;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBoardData {
  slug: string;
  title: string;
  team_top: string;
  team_side: string;
  game_date: string;
  cost_per_square: number;
  venmo_handle: string;
  is_open: boolean;
  payout_mode: "percent" | "fixed";
  payouts: {
    q1: number;
    ht: number;
    q3: number;
    final: number;
  };
  lock_at: string;
}

interface EmailParams {
  to: string;
  subject: string;
  html_body?: string;
  text_body?: string;
  reply_to?: string;
  customer_id?: string;
  broadcast?: boolean;
}

interface EmailResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

interface EmailService {
  send(params: EmailParams): Promise<EmailResult>;
}

export interface Env {
  DB: any;
  R2_BUCKET: any;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  EMAILS: EmailService;
  ENVIRONMENT?: string;
  RESEND_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}
