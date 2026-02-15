import { Subheading } from '@/components/ui/heading'
import { PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { Ticket } from '../../hooks/useTicketDetail'

interface TicketMetadataProps {
  ticket: Ticket
  saving: boolean
  // Inline name editing
  editingName: boolean
  editFirstName: string
  editLastName: string
  firstNameRef: React.Ref<HTMLInputElement>
  setEditFirstName: (v: string) => void
  setEditLastName: (v: string) => void
  startEditingName: () => void
  cancelEditingName: () => void
  saveClientName: () => void
  handleNameKeyDown: (e: React.KeyboardEvent) => void
}

export function TicketMetadata({
  ticket,
  saving,
  editingName,
  editFirstName,
  editLastName,
  firstNameRef,
  setEditFirstName,
  setEditLastName,
  startEditingName,
  cancelEditingName,
  saveClientName,
  handleNameKeyDown,
}: TicketMetadataProps) {
  return (
    <>
      {/* Contact Info */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <Subheading>Contact Information</Subheading>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
            <dd>
              {editingName ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    ref={firstNameRef}
                    type="text"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="First"
                    disabled={saving}
                    className="w-0 flex-1 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2 py-1 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="Last"
                    disabled={saving}
                    className="w-0 flex-1 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2 py-1 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={saveClientName} disabled={saving} className="text-green-600 hover:text-green-700 dark:text-green-400">
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button onClick={cancelEditingName} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="group flex items-center gap-1.5">
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {ticket.firstName} {ticket.lastName}
                  </span>
                  <button
                    onClick={startEditingName}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <PencilSquareIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd>
              <a
                href={`mailto:${ticket.email}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {ticket.email}
              </a>
            </dd>
          </div>
          {ticket.phone && (
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Phone</dt>
              <dd>
                <a
                  href={`tel:${ticket.phone}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {ticket.phone}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Request Type</dt>
            <dd className="font-medium text-zinc-900 dark:text-white">
              {ticket.requestType.replace(/_/g, ' ')}
            </dd>
          </div>
        </dl>
      </div>

      {/* Client Account */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <Subheading>Client Account</Subheading>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Account Name</dt>
            <dd className="font-medium text-zinc-900 dark:text-white">
              {ticket.client.user.name}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Account Email</dt>
            <dd className="text-zinc-700 dark:text-zinc-300">
              {ticket.client.user.email}
            </dd>
          </div>
        </dl>
      </div>
    </>
  )
}
