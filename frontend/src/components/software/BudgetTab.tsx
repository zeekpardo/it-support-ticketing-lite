import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ComputerDesktopIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import type { SoftwareBudgetSummary } from '../../api/client'
import { getDaysUntilRenewal } from '../../hooks/useInboxSoftwareCatalog'

interface BudgetTabProps {
  budgetData: SoftwareBudgetSummary | null
  loading: boolean
}

export function BudgetTab({ budgetData, loading }: BudgetTabProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text>Loading budget data...</Text>
      </div>
    )
  }

  if (!budgetData || budgetData.softwareCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
        <CurrencyDollarIcon className="mx-auto h-12 w-12 text-zinc-400" />
        <Text className="mt-4 text-zinc-500">No cost data available. Add cost information to your software to see the budget overview.</Text>
      </div>
    )
  }

  const upcomingRenewals = budgetData.breakdown.filter(
    sw => sw.renewalDate && getDaysUntilRenewal(sw.renewalDate) >= 0 && getDaysUntilRenewal(sw.renewalDate) <= 30
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
          <Text className="text-sm text-zinc-500">Monthly Spend</Text>
          <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
            ${budgetData.totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
          <Text className="text-sm text-zinc-500">Yearly Spend</Text>
          <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
            ${budgetData.totalYearly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
          <Text className="text-sm text-zinc-500">Software with Costs</Text>
          <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
            {budgetData.softwareCount}
          </div>
        </div>
      </div>

      {/* Upcoming Renewals Alert */}
      {upcomingRenewals.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDaysIcon className="h-5 w-5 text-amber-600" />
            <Text className="font-medium text-amber-800 dark:text-amber-300">
              {upcomingRenewals.length} software renewal{upcomingRenewals.length > 1 ? 's' : ''} within 30 days
            </Text>
          </div>
          <div className="space-y-1">
            {upcomingRenewals.map(sw => {
              const days = getDaysUntilRenewal(sw.renewalDate!)
              return (
                <Text key={sw.id} className="text-sm text-amber-700 dark:text-amber-400">
                  {sw.name} - renews in {days} day{days !== 1 ? 's' : ''} (${sw.yearly.toFixed(2)}/yr)
                </Text>
              )
            })}
          </div>
        </div>
      )}

      {/* Cost Breakdown Table */}
      <div>
        <Subheading className="mb-4">Cost Breakdown</Subheading>
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Software</TableHeader>
                <TableHeader>Cost</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Users</TableHeader>
                <TableHeader>Monthly</TableHeader>
                <TableHeader>Yearly</TableHeader>
                <TableHeader>Renewal</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgetData.breakdown
                .sort((a, b) => b.yearly - a.yearly)
                .map((sw) => (
                  <TableRow key={sw.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sw.iconUrl ? (
                          <img src={sw.iconUrl} alt="" className="h-6 w-6 rounded object-cover" />
                        ) : (
                          <ComputerDesktopIcon className="h-6 w-6 text-zinc-400" />
                        )}
                        <span className="font-medium">{sw.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      ${sw.cost.toFixed(2)}{sw.billingCycle === 'MONTHLY' ? '/mo' : '/yr'}
                    </TableCell>
                    <TableCell>
                      {sw.costType === 'PER_USER' ? (
                        <Badge color="blue">Per User</Badge>
                      ) : sw.costType === 'PER_ORGANIZATION' ? (
                        <Badge color="zinc">Per Org</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{sw.users}</TableCell>
                    <TableCell className="font-medium">
                      ${sw.monthly.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${sw.yearly.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {sw.renewalDate ? (
                        <div className="flex items-center gap-1.5">
                          <Text className="text-sm">
                            {new Date(sw.renewalDate).toLocaleDateString()}
                          </Text>
                          {sw.autoRenewal && (
                            <Badge color="green" className="text-[10px]">Auto</Badge>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
