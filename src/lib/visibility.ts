/**
 * The public portfolio rule, shared by the content schema and the public
 * query module: an entry is public only when it explicitly opts in with
 * `portfolioVisible: true` and its status is not one of these.
 */
export const NEVER_PUBLIC_STATUSES: readonly string[] = ["paused", "archived"];

export const isPublicData = (data: { portfolioVisible: boolean; status: string }): boolean =>
  data.portfolioVisible && !NEVER_PUBLIC_STATUSES.includes(data.status);
