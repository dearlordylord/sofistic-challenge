import type { TransactionFeedItem } from "@sofistic/api"
import type { CleanTransaction } from "@sofistic/transactions-shared"

export function toTransactionFeedItem(transaction: CleanTransaction): TransactionFeedItem {
  return {
    amountMinor: transaction.amountMinor,
    category: transaction.category,
    currency: transaction.currency,
    id: transaction.id,
    merchant: transaction.merchant,
    transactionDate: transaction.transactionDate
  }
}
