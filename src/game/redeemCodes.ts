export interface RedeemCodeReward {
  cash?: number
  carIds?: string[]
}

export interface RedeemCodeDefinition {
  code: string
  reusable: boolean
  reward: RedeemCodeReward
}

// Edit this list to add or change redeem codes.
// Codes are case-sensitive, so players must type them exactly as written here.
export const REDEEM_CODES: RedeemCodeDefinition[] = [
  {
    code: 'PravUnlimitedMoney1M',
    reusable: true,
    reward: { cash: 1000000 },
  },
  {
    code: 'PravSian',
    reusable: false,
    reward: { carIds: ['lamborghini-sian'] },
  },
  {
    code: 'PravSVJ',
    reusable: false,
    reward: { carIds: ['lamborghini-svj'] },
  },
  {
    code: 'PravHyperGarage',
    reusable: false,
    reward: {
      cash: 250000,
      carIds: ['lamborghini-sian', 'lamborghini-svj'],
    },
  },
  {
    code: 'PravMclarenP1',
    reusable: false,
    reward: { carIds: ['mclaren-p1'] },
  }
  { code: 'PravAventador',
    reusable: false,
    reward: { carIds: ['lamborghini-aventador'] },
  }

]
