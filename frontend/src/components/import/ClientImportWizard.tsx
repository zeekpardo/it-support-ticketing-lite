import { useState, useCallback } from 'react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '../ui/dialog'
import { Button } from '../ui/button'
import { Field, Label } from '../ui/fieldset'
import { Select } from '../ui/select'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../ui/table'
import { parseCSV, getCSVHeaders, autoDetectMappings, isValidEmail } from '../../utils/csv'
import { ArrowLeftIcon, ArrowUpTrayIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { api } from '../../api/client'

type WizardStep = 'upload' | 'mapping' | 'confirm' | 'results'

interface FieldMapping {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

interface ValidatedClient {
  firstName: string
  lastName: string
  email: string
  phone: string
  errors: string[]
  excluded: boolean
}

interface ImportResult {
  email: string
  status: 'created' | 'existing_added' | 'already_member' | 'error'
  message: string
}

interface ImportSummary {
  total: number
  created: number
  existingUsersAdded: number
  alreadyMembers: number
  failed: number
  magicLinksSent: number
}

interface ClientImportWizardProps {
  inboxId: string
  inboxName: string
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export function ClientImportWizard({ inboxId, inboxName, isOpen, onClose, onComplete }: ClientImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload')
  const [rawCsvData, setRawCsvData] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
    firstName: null,
    lastName: null,
    email: null,
    phone: null
  })
  const [validatedClients, setValidatedClients] = useState<ValidatedClient[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState('')

  const resetWizard = useCallback(() => {
    setStep('upload')
    setRawCsvData([])
    setCsvHeaders([])
    setFieldMapping({ firstName: null, lastName: null, email: null, phone: null })
    setValidatedClients([])
    setImporting(false)
    setImportResults([])
    setImportSummary(null)
    setError('')
  }, [])

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const headers = getCSVHeaders(content)
        const data = parseCSV(content)

        if (data.length === 0) {
          setError('The CSV file is empty or contains only headers')
          return
        }

        setCsvHeaders(headers)
        setRawCsvData(data)

        // Auto-detect field mappings
        const detectedMappings = autoDetectMappings(headers)
        setFieldMapping(detectedMappings as FieldMapping)

        setStep('mapping')
      } catch {
        setError('Failed to parse CSV file. Please check the format.')
      }
    }
    reader.onerror = () => {
      setError('Failed to read the file')
    }
    reader.readAsText(file)
  }

  const handleMappingChange = (field: keyof FieldMapping, value: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [field]: value || null
    }))
  }

  const validateAndProceed = () => {
    if (!fieldMapping.email) {
      setError('Email field mapping is required')
      return
    }

    setError('')
    const emailsSeen = new Set<string>()
    const validated: ValidatedClient[] = rawCsvData.map((row, index) => {
      const errors: string[] = []
      const firstName = fieldMapping.firstName ? row[fieldMapping.firstName]?.trim() || '' : ''
      const lastName = fieldMapping.lastName ? row[fieldMapping.lastName]?.trim() || '' : ''
      const email = fieldMapping.email ? row[fieldMapping.email]?.trim().toLowerCase() || '' : ''
      const phone = fieldMapping.phone ? row[fieldMapping.phone]?.trim() || '' : ''

      if (!firstName) errors.push('First name is required')
      if (!lastName) errors.push('Last name is required')
      if (!email) {
        errors.push('Email is required')
      } else if (!isValidEmail(email)) {
        errors.push('Invalid email format')
      } else if (emailsSeen.has(email)) {
        errors.push(`Duplicate email (row ${Array.from(emailsSeen).indexOf(email) + 1})`)
      }
      emailsSeen.add(email)

      return {
        firstName,
        lastName,
        email,
        phone,
        errors,
        excluded: false
      }
    })

    setValidatedClients(validated)
    setStep('confirm')
  }

  const toggleExclude = (index: number) => {
    setValidatedClients(prev => prev.map((client, i) =>
      i === index ? { ...client, excluded: !client.excluded } : client
    ))
  }

  const handleImport = async () => {
    const clientsToImport = validatedClients
      .filter(c => !c.excluded && c.errors.length === 0)
      .map(c => ({
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone || undefined
      }))

    if (clientsToImport.length === 0) {
      setError('No valid clients to import')
      return
    }

    setImporting(true)
    setError('')

    try {
      const response = await api.importClients(inboxId, clientsToImport)
      setImportResults(response.results)
      setImportSummary(response.summary)
      setStep('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import clients')
    } finally {
      setImporting(false)
    }
  }

  const handleFinish = () => {
    resetWizard()
    onComplete()
    onClose()
  }

  const validCount = validatedClients.filter(c => !c.excluded && c.errors.length === 0).length
  const errorCount = validatedClients.filter(c => !c.excluded && c.errors.length > 0).length

  return (
    <Dialog open={isOpen} onClose={handleClose} size="3xl">
      <DialogTitle>
        {step === 'upload' && 'Import Clients'}
        {step === 'mapping' && 'Map CSV Fields'}
        {step === 'confirm' && 'Confirm Import'}
        {step === 'results' && 'Import Complete'}
      </DialogTitle>

      <DialogBody>
        {/* Step 1: Upload CSV */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Upload a CSV file with client information to import into <strong>{inboxName}</strong>.
              The CSV should contain columns for first name, last name, email, and optionally phone.
            </p>

            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center">
              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-zinc-400" />
              <div className="mt-4">
                <label className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-500 font-medium">Choose a CSV file</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
                <p className="mt-1 text-sm text-zinc-500">or drag and drop</p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              <p className="font-medium">Expected CSV format:</p>
              <code className="block mt-1 p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                first_name,last_name,email,phone<br />
                John,Doe,john@example.com,555-1234
              </code>
            </div>
          </div>
        )}

        {/* Step 2: Map Fields */}
        {step === 'mapping' && (
          <div className="space-y-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Map the columns from your CSV to the required fields. Email is required.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>First Name *</Label>
                <Select
                  value={fieldMapping.firstName || ''}
                  onChange={(e) => handleMappingChange('firstName', e.target.value)}
                >
                  <option value="">-- Select column --</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>Last Name *</Label>
                <Select
                  value={fieldMapping.lastName || ''}
                  onChange={(e) => handleMappingChange('lastName', e.target.value)}
                >
                  <option value="">-- Select column --</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>Email * (required)</Label>
                <Select
                  value={fieldMapping.email || ''}
                  onChange={(e) => handleMappingChange('email', e.target.value)}
                >
                  <option value="">-- Select column --</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>Phone</Label>
                <Select
                  value={fieldMapping.phone || ''}
                  onChange={(e) => handleMappingChange('phone', e.target.value)}
                >
                  <option value="">-- Select column --</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Preview */}
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Preview (first 3 rows)
              </p>
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>First Name</TableHeader>
                    <TableHeader>Last Name</TableHeader>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Phone</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rawCsvData.slice(0, 3).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{fieldMapping.firstName ? row[fieldMapping.firstName] : '-'}</TableCell>
                      <TableCell>{fieldMapping.lastName ? row[fieldMapping.lastName] : '-'}</TableCell>
                      <TableCell>{fieldMapping.email ? row[fieldMapping.email] : '-'}</TableCell>
                      <TableCell>{fieldMapping.phone ? row[fieldMapping.phone] : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                {validCount} valid
              </span>
              {errorCount > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                  {errorCount} with errors
                </span>
              )}
              <span className="text-zinc-500">
                Total: {validatedClients.length} rows
              </span>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="max-h-80 overflow-y-auto">
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Phone</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {validatedClients.map((client, i) => (
                    <TableRow key={i} className={client.excluded ? 'opacity-50' : ''}>
                      <TableCell>
                        {client.excluded ? (
                          <span className="text-zinc-400">Excluded</span>
                        ) : client.errors.length > 0 ? (
                          <span className="text-red-600 dark:text-red-400 text-xs" title={client.errors.join(', ')}>
                            {client.errors[0]}
                          </span>
                        ) : (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        )}
                      </TableCell>
                      <TableCell>{client.firstName} {client.lastName}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleExclude(i)}
                          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        >
                          {client.excluded ? 'Include' : 'Exclude'}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {validCount} client{validCount !== 1 ? 's' : ''} will be imported and sent a magic link email to access the portal.
            </p>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 'results' && importSummary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importSummary.created}</p>
                <p className="text-sm text-green-700 dark:text-green-300">Created</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{importSummary.existingUsersAdded}</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Existing Added</p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{importSummary.alreadyMembers}</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">Already Members</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{importSummary.magicLinksSent}</p>
                <p className="text-sm text-purple-700 dark:text-purple-300">Emails Sent</p>
              </div>
            </div>

            {importSummary.failed > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <ExclamationTriangleIcon className="inline h-4 w-4 mr-1" />
                  {importSummary.failed} client{importSummary.failed !== 1 ? 's' : ''} failed to import
                </p>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto">
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Message</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importResults.map((result, i) => (
                    <TableRow key={i}>
                      <TableCell>{result.email}</TableCell>
                      <TableCell>
                        <span className={
                          result.status === 'created' ? 'text-green-600 dark:text-green-400' :
                          result.status === 'existing_added' ? 'text-blue-600 dark:text-blue-400' :
                          result.status === 'already_member' ? 'text-amber-600 dark:text-amber-400' :
                          'text-red-600 dark:text-red-400'
                        }>
                          {result.status.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-zinc-500">{result.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogBody>

      <DialogActions>
        {step === 'upload' && (
          <Button plain onClick={handleClose}>Cancel</Button>
        )}

        {step === 'mapping' && (
          <>
            <Button plain onClick={() => setStep('upload')}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </Button>
            <Button color="blue" onClick={validateAndProceed}>
              Continue
            </Button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <Button plain onClick={() => setStep('mapping')}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </Button>
            <Button
              color="blue"
              onClick={handleImport}
              disabled={importing || validCount === 0}
            >
              {importing ? 'Importing...' : `Import ${validCount} Client${validCount !== 1 ? 's' : ''}`}
            </Button>
          </>
        )}

        {step === 'results' && (
          <Button color="blue" onClick={handleFinish}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
