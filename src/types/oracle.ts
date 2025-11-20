export interface OracleMarketRule {
  id?: string;
  market_id?: string;
  event_template: string;
  match_id: string;
  match_name: string;
  match_date: string;
  entity_type: 'player' | 'team';
  entity_id: string;
  entity_name: string;
  stat_field: string;
  comparison_operator: '>' | '>=' | '==' | '<' | '<=';
  threshold_value: number;
  outcome_if_true: 'yes' | 'no';
  outcome_if_false: 'yes' | 'no';
  data_source_url: string;
  resolution_status?: 'pending' | 'resolved' | 'failed' | 'manual_review';
}

export interface EventTemplate {
  id: string;
  name: string;
  pattern: string;
  category: string;
}

export interface CricketMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
}

export interface CricketPlayer {
  id: string;
  name: string;
  role?: string;
  team?: string;
}

export interface StatOption {
  value: string;
  label: string;
  apiField: string;
}
