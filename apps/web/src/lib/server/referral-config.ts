/**
 * Referral System Configuration
 * Manages commission rates from environment variables
 */

export function getReferralCommissionRates() {
  return {
    1: parseFloat(process.env.REFERRAL_COMMISSION_T1 || '34') / 100, // 0.34
    2: parseFloat(process.env.REFERRAL_COMMISSION_T2 || '12') / 100, // 0.12
    3: parseFloat(process.env.REFERRAL_COMMISSION_T3 || '4') / 100, // 0.04
  }
}

export function getReferralCommissionRatesDisplay() {
  return {
    t1: parseFloat(process.env.REFERRAL_COMMISSION_T1 || '34'),
    t2: parseFloat(process.env.REFERRAL_COMMISSION_T2 || '12'),
    t3: parseFloat(process.env.REFERRAL_COMMISSION_T3 || '4'),
  }
}
