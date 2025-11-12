export type MarketTemplate = 
  | "cricket_player_performance"
  | "cricket_match_result"
  | "politics_election"
  | "finance_price_target"
  | "custom_yesno";

export interface MarketTemplateConfig {
  id: MarketTemplate;
  name: string;
  category: string;
  fields: TemplateField[];
  questionPattern: string;
}

export interface TemplateField {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
  placeholder?: string;
  required: boolean;
}

export interface CreatorMarket {
  id: string;
  question: string;
  status: "pending" | "approved" | "open" | "resolved";
  volume: number;
  feesEarned: number;
  createdAt: string;
  template: MarketTemplate;
  outcome?: "yes" | "no";
}
