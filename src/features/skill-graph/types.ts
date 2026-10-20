export type SkillNode = {
  skill: string
  order: number
  cluster: number
  demand: number
  median: number | null
  p25: number | null
  p75: number | null
  weight: number | null
  regionDemand: number
}

/** Indices point into the skills array, which is already sorted by heatmap order. */
export type SkillPair = {
  a: number
  b: number
  count: number
  jaccard: number
  lift: number
  meanSalary: number
}

export type SkillGraphData = {
  skills: SkillNode[]
  pairs: SkillPair[]
  source: 'python' | 'sqlite'
  offers: number
}
