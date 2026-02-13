import { Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  UserPlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { ProjectSoftwareDetailType } from './types'

interface AdminsSectionProps {
  software: ProjectSoftwareDetailType
  availableMembers: Array<{ id: string; user: { id: string; name: string; email: string } }>
  onOpenAddAdminModal: () => void
  onRemoveAdmin: (adminId: string) => void
  onUpdateAdminRole: (adminId: string, role: 'OWNER' | 'ADMIN') => void
}

export default function AdminsSection({
  software,
  availableMembers,
  onOpenAddAdminModal,
  onRemoveAdmin,
  onUpdateAdminRole,
}: AdminsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Subheading>Software Admins</Subheading>
        <Button outline onClick={onOpenAddAdminModal} disabled={availableMembers.length === 0}>
          <UserPlusIcon className="h-4 w-4" />
          Add Admin
        </Button>
      </div>
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Email</TableHeader>
              <TableHeader>Role</TableHeader>
              <TableHeader className="w-[100px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {software.admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">{admin.member.user.name}</TableCell>
                <TableCell className="text-zinc-500">{admin.member.user.email}</TableCell>
                <TableCell>
                  <Select
                    value={admin.role}
                    onChange={(e) => onUpdateAdminRole(admin.id, e.target.value as 'OWNER' | 'ADMIN')}
                    className="w-24"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button plain onClick={() => onRemoveAdmin(admin.id)}>
                    <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {software.admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                  No admins assigned
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
