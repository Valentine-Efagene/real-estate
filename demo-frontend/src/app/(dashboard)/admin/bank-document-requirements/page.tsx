'use client';

import { useState, useMemo } from 'react';
import {
    useBankOrganizations,
    useBankDocumentRequirements,
    useCreateBankDocumentRequirement,
    useUpdateBankDocumentRequirement,
    useDeleteBankDocumentRequirement,
    type BankDocumentRequirement,
    type CreateBankDocumentRequirementInput,
    type BankDocumentModifier,
} from '@/lib/hooks/use-organizations';
import { usePaymentMethodsList, type PaymentMethodPhase } from '@/lib/hooks/use-payment-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Plus,
    Trash2,
    FileText,
    MoreVertical,
    Pencil,
    Building2,
    AlertCircle,
    CheckCircle,
    MinusCircle,
    ArrowUpCircle,
    Folder,
} from 'lucide-react';
import { toast } from 'sonner';

const MODIFIERS: { value: BankDocumentModifier; label: string; description: string; icon: React.ReactNode; color: string }[] = [
    {
        value: 'REQUIRED',
        label: 'Required',
        description: 'Bank requires this document (add if not in base plan)',
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'bg-green-100 text-green-800',
    },
    {
        value: 'STRICTER',
        label: 'Stricter',
        description: 'Bank has stricter version (e.g., 12 months instead of 6)',
        icon: <ArrowUpCircle className="h-4 w-4" />,
        color: 'bg-blue-100 text-blue-800',
    },
    {
        value: 'OPTIONAL',
        label: 'Optional',
        description: 'Bank makes this optional (override base if required)',
        icon: <MinusCircle className="h-4 w-4" />,
        color: 'bg-yellow-100 text-yellow-800',
    },
    {
        value: 'NOT_REQUIRED',
        label: 'Not Required',
        description: "Bank doesn't need this (skip even if in base)",
        icon: <AlertCircle className="h-4 w-4" />,
        color: 'bg-gray-100 text-gray-800',
    },
];

const COMMON_DOCUMENT_TYPES = [
    { value: 'ID_CARD', label: 'Valid ID Card' },
    { value: 'BANK_STATEMENT', label: 'Bank Statement' },
    { value: 'EMPLOYMENT_LETTER', label: 'Employment Letter' },
    { value: 'SALARY_SLIP', label: 'Salary Slip' },
    { value: 'TAX_CLEARANCE', label: 'Tax Clearance Certificate' },
    { value: 'UTILITY_BILL', label: 'Utility Bill (Address Proof)' },
    { value: 'PASSPORT', label: 'International Passport' },
    { value: 'CAC_CERTIFICATE', label: 'CAC Certificate (Business)' },
    { value: 'AUDITED_ACCOUNTS', label: 'Audited Accounts' },
    { value: 'PROPERTY_VALUATION', label: 'Property Valuation Report' },
    { value: 'OFFER_LETTER', label: 'Offer/Allocation Letter' },
    { value: 'OTHER', label: 'Other (Custom)' },
];

interface PhaseOption {
    id: string;
    name: string;
    phaseType: string;
    paymentMethodName: string;
    paymentMethodId: string;
}

// Add/Edit Requirement Dialog
function RequirementDialog({
    open,
    onOpenChange,
    organizationId,
    requirement,
    phases,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationId: string;
    requirement?: BankDocumentRequirement;
    phases: PhaseOption[];
}) {
    const isEdit = !!requirement;
    const [formData, setFormData] = useState<CreateBankDocumentRequirementInput>({
        phaseId: requirement?.phaseId || '',
        documentType: requirement?.documentType || '',
        documentName: requirement?.documentName || '',
        modifier: requirement?.modifier || 'REQUIRED',
        description: requirement?.description || undefined,
        expiryDays: requirement?.expiryDays ?? undefined,
        minFiles: requirement?.minFiles ?? undefined,
        maxFiles: requirement?.maxFiles ?? undefined,
        allowedMimeTypes: requirement?.allowedMimeTypes ?? undefined,
        priority: requirement?.priority ?? 100,
    });
    const [customDocType, setCustomDocType] = useState('');

    const createMutation = useCreateBankDocumentRequirement();
    const updateMutation = useUpdateBankDocumentRequirement();

    // Group phases by payment method for display
    const phasesByMethod = useMemo(() => {
        const grouped: Record<string, PhaseOption[]> = {};
        for (const phase of phases) {
            if (!grouped[phase.paymentMethodName]) {
                grouped[phase.paymentMethodName] = [];
            }
            grouped[phase.paymentMethodName].push(phase);
        }
        return grouped;
    }, [phases]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const finalDocType = formData.documentType === 'OTHER' ? customDocType : formData.documentType;
        if (!finalDocType) {
            toast.error('Document type is required');
            return;
        }
        if (!formData.documentName) {
            toast.error('Document name is required');
            return;
        }
        if (!formData.phaseId) {
            toast.error('Phase is required');
            return;
        }

        const payload = {
            ...formData,
            documentType: finalDocType.toUpperCase().replace(/\s+/g, '_'),
        };

        try {
            if (isEdit && requirement) {
                await updateMutation.mutateAsync({
                    organizationId,
                    requirementId: requirement.id,
                    data: payload,
                });
                toast.success('Requirement updated successfully');
            } else {
                await createMutation.mutateAsync({
                    organizationId,
                    data: payload,
                });
                toast.success('Requirement added successfully');
            }
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save requirement');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? 'Edit' : 'Add'} Document Requirement</DialogTitle>
                        <DialogDescription>
                            Define bank-specific document requirements for a specific phase.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Phase Selection */}
                        <div>
                            <Label>Phase (Payment Method → Phase) *</Label>
                            <Select
                                value={formData.phaseId}
                                onValueChange={(value) => setFormData({ ...formData, phaseId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a phase..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(phasesByMethod).map(([methodName, methodPhases]) => (
                                        <div key={methodName}>
                                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted">
                                                {methodName}
                                            </div>
                                            {methodPhases.map((phase) => (
                                                <SelectItem key={phase.id} value={phase.id}>
                                                    {phase.name} ({phase.phaseType})
                                                </SelectItem>
                                            ))}
                                        </div>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                Requirements are scoped to a specific phase within a payment method
                            </p>
                        </div>

                        {/* Document Type */}
                        <div>
                            <Label>Document Type *</Label>
                            <Select
                                value={formData.documentType}
                                onValueChange={(value) => setFormData({ ...formData, documentType: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMMON_DOCUMENT_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formData.documentType === 'OTHER' && (
                                <Input
                                    className="mt-2"
                                    value={customDocType}
                                    onChange={(e) => setCustomDocType(e.target.value)}
                                    placeholder="Enter custom document type"
                                />
                            )}
                        </div>

                        {/* Document Name */}
                        <div>
                            <Label>Display Name *</Label>
                            <Input
                                value={formData.documentName}
                                onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                                placeholder="e.g., 12 Months Bank Statement (Access Bank)"
                            />
                        </div>

                        {/* Modifier */}
                        <div>
                            <Label>Modifier *</Label>
                            <Select
                                value={formData.modifier}
                                onValueChange={(value: BankDocumentModifier) =>
                                    setFormData({ ...formData, modifier: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MODIFIERS.map((mod) => (
                                        <SelectItem key={mod.value} value={mod.value}>
                                            <div className="flex items-center gap-2">
                                                {mod.icon}
                                                <span>{mod.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                {MODIFIERS.find((m) => m.value === formData.modifier)?.description}
                            </p>
                        </div>

                        {/* Additional fields */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Min Files</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.minFiles ?? ''}
                                    onChange={(e) =>
                                        setFormData({ ...formData, minFiles: e.target.value ? parseInt(e.target.value) : undefined })
                                    }
                                    placeholder="1"
                                />
                            </div>
                            <div>
                                <Label>Max Files</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.maxFiles ?? ''}
                                    onChange={(e) =>
                                        setFormData({ ...formData, maxFiles: e.target.value ? parseInt(e.target.value) : undefined })
                                    }
                                    placeholder="1"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Description / Instructions</Label>
                            <Textarea
                                value={formData.description ?? ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value || undefined })}
                                placeholder="Bank-specific instructions for this document..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Add'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Requirement Card
function RequirementCard({
    requirement,
    organizationId,
    phases,
}: {
    requirement: BankDocumentRequirement;
    organizationId: string;
    phases: PhaseOption[];
}) {
    const [editOpen, setEditOpen] = useState(false);
    const deleteMutation = useDeleteBankDocumentRequirement();

    const modifier = MODIFIERS.find((m) => m.value === requirement.modifier);

    // Get phase info from requirement or lookup
    const phaseInfo = requirement.phase || phases.find(p => p.id === requirement.phaseId);
    const phaseName = phaseInfo
        ? 'paymentMethod' in phaseInfo
            ? `${phaseInfo.paymentMethod.name} → ${phaseInfo.name}`
            : `${phaseInfo.paymentMethodName} → ${phaseInfo.name}`
        : 'Unknown Phase';

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete this requirement?`)) return;
        try {
            await deleteMutation.mutateAsync({ organizationId, requirementId: requirement.id });
            toast.success('Requirement deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete requirement');
        }
    };

    return (
        <>
            <Card className="p-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{requirement.documentName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="flex items-center gap-1">
                                <Folder className="h-3 w-3" />
                                {phaseName}
                            </Badge>
                            <Badge variant="secondary" className="font-mono text-xs">
                                {requirement.documentType}
                            </Badge>
                            <Badge className={modifier?.color}>
                                {modifier?.icon}
                                <span className="ml-1">{modifier?.label}</span>
                            </Badge>
                        </div>
                        {requirement.description && (
                            <p className="text-sm text-muted-foreground">{requirement.description}</p>
                        )}
                        {(requirement.minFiles || requirement.maxFiles) && (
                            <p className="text-xs text-muted-foreground">
                                Files: {requirement.minFiles ?? 1} - {requirement.maxFiles ?? 1}
                            </p>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditOpen(true)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </Card>

            <RequirementDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                organizationId={organizationId}
                requirement={requirement}
                phases={phases}
            />
        </>
    );
}

// Bank Requirements Section
function BankRequirementsSection({
    organizationId,
    organizationName,
    phases,
}: {
    organizationId: string;
    organizationName: string;
    phases: PhaseOption[];
}) {
    const [addOpen, setAddOpen] = useState(false);
    const { data, isLoading, error } = useBankDocumentRequirements(organizationId);

    if (isLoading) {
        return <Skeleton className="h-40 w-full" />;
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="py-6">
                    <p className="text-destructive">{(error as Error).message}</p>
                </CardContent>
            </Card>
        );
    }

    const requirements = data?.requirements || [];

    // Group by payment method → phase
    const byPhase = requirements.reduce((acc, req) => {
        const phase = req.phase;
        const key = phase
            ? `${phase.paymentMethod.name} → ${phase.name}`
            : 'Unknown Phase';
        if (!acc[key]) acc[key] = [];
        acc[key].push(req);
        return acc;
    }, {} as Record<string, BankDocumentRequirement[]>);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        <CardTitle>{organizationName}</CardTitle>
                    </div>
                    <Button onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Requirement
                    </Button>
                </div>
                <CardDescription>
                    {requirements.length} custom document requirement{requirements.length !== 1 ? 's' : ''}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {requirements.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">
                            No custom requirements. This bank will use the base documentation plan for all phases.
                        </p>
                        <Button variant="outline" onClick={() => setAddOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Requirement
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(byPhase).map(([phasePath, reqs]) => (
                            <div key={phasePath}>
                                <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                    <Folder className="h-4 w-4" />
                                    {phasePath}
                                </h4>
                                <div className="space-y-2">
                                    {reqs.map((req) => (
                                        <RequirementCard
                                            key={req.id}
                                            requirement={req}
                                            organizationId={organizationId}
                                            phases={phases}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <RequirementDialog
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    organizationId={organizationId}
                    phases={phases}
                />
            </CardContent>
        </Card>
    );
}

// Main Page
export default function BankDocumentRequirementsPage() {
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const { data: banks, isLoading: banksLoading, error: banksError } = useBankOrganizations();
    const { data: paymentMethods, isLoading: methodsLoading } = usePaymentMethodsList();

    // Build a flat list of documentation phases from all payment methods
    const phases: PhaseOption[] = useMemo(() => {
        if (!paymentMethods) return [];
        const result: PhaseOption[] = [];
        for (const method of paymentMethods) {
            for (const phase of method.phases) {
                // Only include DOCUMENTATION phases
                if (phase.phaseCategory === 'DOCUMENTATION') {
                    result.push({
                        id: phase.id,
                        name: phase.name,
                        phaseType: phase.phaseType,
                        paymentMethodName: method.name,
                        paymentMethodId: method.id,
                    });
                }
            }
        }
        return result;
    }, [paymentMethods]);

    if (banksError) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Banks</CardTitle>
                        <CardDescription>{(banksError as Error).message}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const selectedBank = banks?.find((b) => b.id === selectedBankId);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Bank Document Requirements</h1>
                <p className="text-muted-foreground">
                    Configure bank-specific document requirements per phase. Each bank can have different
                    requirements for the same phase in different products (e.g., MREIF vs NHF).
                </p>
            </div>

            {/* Bank Selector */}
            <Card>
                <CardHeader>
                    <CardTitle>Select Bank</CardTitle>
                    <CardDescription>
                        Choose a bank to view and configure their document requirements.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {banksLoading || methodsLoading ? (
                        <Skeleton className="h-10 w-full max-w-md" />
                    ) : banks && banks.length > 0 ? (
                        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                            <SelectTrigger className="max-w-md">
                                <SelectValue placeholder="Select a bank..." />
                            </SelectTrigger>
                            <SelectContent>
                                {banks.map((bank) => (
                                    <SelectItem key={bank.id} value={bank.id}>
                                        {bank.name}
                                        {bank.bankCode && ` (${bank.bankCode})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <p className="text-muted-foreground">
                            No bank organizations found. Create a bank organization first.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Phase Info */}
            {phases.length === 0 && !methodsLoading && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardHeader>
                        <CardTitle className="text-amber-800">No Documentation Phases Found</CardTitle>
                        <CardDescription className="text-amber-700">
                            Create payment methods with DOCUMENTATION phases before configuring bank requirements.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Bank Requirements */}
            {selectedBankId && selectedBank && phases.length > 0 && (
                <BankRequirementsSection
                    organizationId={selectedBankId}
                    organizationName={selectedBank.name}
                    phases={phases}
                />
            )}

            {/* Reference */}
            <Card>
                <CardHeader>
                    <CardTitle>Understanding Modifiers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {MODIFIERS.map((mod) => (
                        <div key={mod.value} className="flex items-start gap-3">
                            <Badge className={mod.color}>
                                {mod.icon}
                                <span className="ml-1">{mod.label}</span>
                            </Badge>
                            <p className="text-sm text-muted-foreground">{mod.description}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
