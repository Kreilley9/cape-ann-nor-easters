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

