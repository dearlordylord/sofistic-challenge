import type { TransactionFeedItem } from "@sofistic/api"

type FeedCleanTransaction = {
  readonly amountMinor: string
  readonly category: string
  readonly currency: "CAD"
  readonly id: string
  readonly merchant: string
  readonly transactionDate: string
}

export function toTransactionFeedItem(transaction: FeedCleanTransaction): TransactionFeedItem {
  return {
    amountMinor: transaction.amountMinor,
    category: transaction.category,
    currency: transaction.currency,
    id: transaction.id,
    merchant: transaction.merchant,
    transactionDate: transaction.transactionDate
  }
}
