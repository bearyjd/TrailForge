export type ConditionTag =
  | 'dry'
  | 'wet'
  | 'muddy'
  | 'icy'
  | 'snow'
  | 'closed'
  | 'overgrown';

export interface TrailRating {
  id: string;
  userId: string;
  osmTrailId: string;
  stars: number;
  review?: string;
  createdAt: string;
}

export interface TrailCondition {
  id: string;
  userId: string;
  osmTrailId: string;
  tag: ConditionTag;
  note?: string;
  createdAt: string;
}
