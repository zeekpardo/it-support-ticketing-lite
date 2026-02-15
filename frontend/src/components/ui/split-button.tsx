import * as Headless from '@headlessui/react'
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

export interface SplitButtonOption {
  label: string
  value: string
}

interface SplitButtonProps {
  options: SplitButtonOption[]
  defaultValue?: string
  onAction: (value: string) => void
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  color?: 'dark/zinc' | 'blue' | 'green' | 'red' | 'zinc'
  className?: string
}

const colorMap = {
  'dark/zinc': {
    bg: 'bg-zinc-900 dark:bg-zinc-600',
    hover: 'hover:bg-zinc-800 dark:hover:bg-zinc-500',
    divider: 'border-zinc-700 dark:border-zinc-500',
    text: 'text-white',
  },
  blue: {
    bg: 'bg-blue-600',
    hover: 'hover:bg-blue-500',
    divider: 'border-blue-500',
    text: 'text-white',
  },
  green: {
    bg: 'bg-green-600',
    hover: 'hover:bg-green-500',
    divider: 'border-green-500',
    text: 'text-white',
  },
  red: {
    bg: 'bg-red-600',
    hover: 'hover:bg-red-500',
    divider: 'border-red-500',
    text: 'text-white',
  },
  zinc: {
    bg: 'bg-zinc-600',
    hover: 'hover:bg-zinc-500',
    divider: 'border-zinc-500',
    text: 'text-white',
  },
}

export function SplitButton({
  options,
  defaultValue,
  onAction,
  disabled = false,
  loading = false,
  loadingLabel = 'Loading...',
  color = 'dark/zinc',
  className,
}: SplitButtonProps) {
  const colors = colorMap[color]
  const activeOption = options.find(o => o.value === defaultValue) ?? options[0]
  const isDisabled = disabled || loading

  return (
    <div className={clsx('inline-flex items-stretch rounded-lg shadow-sm', className)}>
      {/* Main action button */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onAction(activeOption.value)}
        className={clsx(
          'relative inline-flex items-center rounded-l-lg border border-transparent px-3 py-1.5 text-sm font-semibold',
          colors.bg,
          colors.text,
          !isDisabled && colors.hover,
          isDisabled && 'opacity-50 cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        )}
      >
        {loading ? loadingLabel : activeOption.label}
      </button>

      {/* Dropdown toggle */}
      <Headless.Menu as="div" className="relative -ml-px flex">
        <Headless.MenuButton
          disabled={isDisabled}
          className={clsx(
            'relative inline-flex items-center rounded-r-lg border-l px-2',
            colors.bg,
            colors.text,
            colors.divider,
            !isDisabled && colors.hover,
            isDisabled && 'opacity-50 cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          )}
        >
          <ChevronDownIcon className="h-4 w-4" />
        </Headless.MenuButton>

        <Headless.MenuItems
          transition
          anchor="bottom end"
          className={clsx(
            '[--anchor-gap:4px]',
            'w-56 rounded-xl p-1',
            'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
            'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10',
            'transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0',
          )}
        >
          {options.map((option) => (
            <Headless.MenuItem key={option.value}>
              <button
                type="button"
                onClick={() => onAction(option.value)}
                className={clsx(
                  'group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white',
                  'data-focus:bg-blue-500 data-focus:text-white',
                )}
              >
                {option.value === activeOption.value ? (
                  <CheckIcon className="h-4 w-4 text-blue-500 group-data-focus:text-white" />
                ) : (
                  <span className="h-4 w-4" />
                )}
                {option.label}
              </button>
            </Headless.MenuItem>
          ))}
        </Headless.MenuItems>
      </Headless.Menu>
    </div>
  )
}
