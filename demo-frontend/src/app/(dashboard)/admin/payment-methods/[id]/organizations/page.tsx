'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import {
    useOrgPaymentMethods,
    useEnrollOrgToPaymentMethod,
    useUpdateOrgPaymentMethod,
    useApplyForQualification,
    useDocumentWaivers,
    useAvailableDocuments,
    useCreateDocumentWaiver,
    useDeleteDocumentWaiver,
    type OrganizationPaymentMethod,
    type OrgPaymentMethodStatus,
    type OrganizationDocumentWaiver,
    type AvailableDocument,
} from '@/lib/hooks/use-org-payment-methods';
import { usePaymentMethod } from '@/lib/hooks/use-payment-config';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/lib/api/client';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Plus,
    Trash2,
    ArrowLeft,
    Building2,
    ShieldCheck,
    Play,
    FileX,
    Loader2,
    ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

function getStatusColor(status: OrgPaymentMethodStatus) {
    switch (status) {
        case 'PENDING': return 'bg-gray-100 text-gray-800';
        case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
        case 'QUALIFIED': return 'bg-green-100 text-green-800';
        case 'REJECTED': return 'bg-red-100 text-red-800';
        case 'SUSPENDED': return 'bg-amber-100 text-amber-800';
        case 'EXPIRED': return 'bg-orange-100 text-orange-800';
    }
}

// Waivers Section within an assignment detail view
function WaiversSection({
    paymentMethodId,
    assignmentId,
    status,
}: {
    paymentMethodId: string;
    assignmentId: string;
    status: OrgPaymentMethodStatus;
}) {
    const { data: waivers = [], isLoading: waiversLoading } = useDocumentWaivers(paymentMethodId, assignmentId);
    const { data: availableDocs = [], isLoading: docsLoading } = useAvailableDocuments(paymentMethodId, assignmentId);
    const createWaiverMutation = useCreateDocumentWaiver();
    const deleteWaiverMutation = useDeleteDocumentWaiver();

    const [addOpen, setAddOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState('');
    const [reason, setReason] = useState('');

    const isQualified = status === 'QUALIFIED';
    const waivableDocs = availableDocs.filter((d) => !d.alreadyWaived);

    const handleAddWaiver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoc) {
            toast.error('Select a document to waive');
            return;
        }
        try {
            await createWaiverMutation.mutateAsync({
                paymentMethodId,
                assignmentId,
                data: { documentType: selectedDoc, reason: reason || undefined },
            });
            toast.success('Document waiver created');
            setAddOpen(false);
            setSelectedDoc('');
            setReason('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create waiver');
        }
    };

    const handleDeleteWaiver = async (waiver: OrganizationDocumentWaiver) => {
        if (!confirm(`Remove waiver for "${waiver.documentName}"?`)) return;
        try {
            await deleteWaiverMutation.mutateAsync({
                paymentMethodId,
                assignmentId,
                waiverId: waiver.id,
            });
            toast.success('Waiver removed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove waiver');
        }
    };

    if (!isQualified) {
        return (
            <div className="text-sm text-muted-foreground italic py-4">
                Organization must be in QUALIFIED status to configure document waivers.
            </div>
        );
    }

    if (waiversLoading || docsLoading) {
        return <Skeleton className="h-24 w-full" />;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h4 className="font-medium">Document Waivers</h4>
                    <p className="text-sm text-muted-foreground">
                        Exempt this organization from specific document requirements
                    </p>
                </div>
                {waivableDocs.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Waiver
                    </Button>
                )}
            </div>

            {waivers.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                    <FileX className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No document waivers configured</p>
                    {waivableDocs.length > 0 && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => setAddOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" /> Add First Waiver
                        </Button>
                    )}
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="w-[60px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {waivers.map((waiver) => (
                            <TableRow key={waiver.id}>
                                <TableCell className="font-medium">{waiver.documentName}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs">{waiver.documentType}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {waiver.reason || '—'}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() => handleDeleteWaiver(waiver)}
                                        disabled={deleteWaiverMutation.isPending}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* Add Waiver Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleAddWaiver}>
                        <DialogHeader>
                            <DialogTitle>Add Document Waiver</DialogTitle>
                            <DialogDescription>
                                Select a document to waive for this organization.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div>
                                <Label>Document *</Label>
                                <Select value={selectedDoc} onValueChange={setSelectedDoc}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select document" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {waivableDocs.map((doc) => (
                                            <SelectItem key={doc.documentType} value={doc.documentType}>
                                                <div>
                                                    <span>{doc.documentName}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        ({doc.phaseName})
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Reason</Label>
                                <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Why is this document being waived?"
                                    rows={2}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createWaiverMutation.isPending}>
                                {createWaiverMutation.isPending ? 'Creating...' : 'Create Waiver'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Individual assignment card
function AssignmentCard({
    assignment,
    paymentMethodId,
}: {
    assignment: OrganizationPaymentMethod;
    paymentMethodId: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const applyMutation = useApplyForQualification();
    const updateMutation = useUpdateOrgPaymentMethod();

    const handleApply = async () => {
        try {
            await applyMutation.mutateAsync({ paymentMethodId, assignmentId: assignment.id });
            toast.success('Qualification started');
        } catch (error: any) {
            toast.error(error.message || 'Failed to start qualification');
        }
    };

    const handleStatusChange = async (newStatus: OrgPaymentMethodStatus) => {
        try {
            await updateMutation.mutateAsync({
                paymentMethodId,
                assignmentId: assignment.id,
                data: { status: newStatus },
            });
            toast.success(`Status updated to ${newStatus}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status');
        }
    };

    const orgName = assignment.organization?.name || 'Unknown Organization';
    const orgTypes = assignment.organization?.organizationTypes
        ?.map((ot) => ot.organizationType.code)
        .join(', ') || '';

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {orgName}
                        </CardTitle>
                        {orgTypes && (
                            <p className="text-xs text-muted-foreground">{orgTypes}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getStatusColor(assignment.status)}>
                            {assignment.status}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                        >
                            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 mb-3">
                    {assignment.status === 'PENDING' && (
                        <Button size="sm" onClick={handleApply} disabled={applyMutation.isPending}>
                            {applyMutation.isPending ? (
                                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Applying...</>
                            ) : (
                                <><Play className="h-3 w-3 mr-1" /> Start Qualification</>
                            )}
                        </Button>
                    )}
                    {assignment.status === 'IN_PROGRESS' && (
                        <Button size="sm" variant="default" onClick={() => handleStatusChange('QUALIFIED')} disabled={updateMutation.isPending}>
                            <ShieldCheck className="h-3 w-3 mr-1" /> Mark Qualified
                        </Button>
                    )}
                    {assignment.status !== 'SUSPENDED' && assignment.status !== 'REJECTED' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange('SUSPENDED')} disabled={updateMutation.isPending}>
                            Suspend
                        </Button>
                    )}
                    {assignment.status === 'SUSPENDED' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange('QUALIFIED')} disabled={updateMutation.isPending}>
                            Reinstate
                        </Button>
                    )}
                </div>

                {assignment.qualifiedAt && (
                    <p className="text-xs text-muted-foreground mb-2">
                        Qualified: {new Date(assignment.qualifiedAt).toLocaleDateString()}
                    </p>
                )}
                {assignment.notes && (
                    <p className="text-sm text-muted-foreground mb-2">Notes: {assignment.notes}</p>
                )}

                {/* Expandable waivers section */}
                {expanded && (
                    <div className="mt-4 pt-4 border-t">
                        <WaiversSection
                            paymentMethodId={paymentMethodId}
                            assignmentId={assignment.id}
                            status={assignment.status}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Minimal org type for the organization list
interface OrgOption {
    id: string;
    name: string;
}

export default function OrgPaymentMethodsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const paymentMethodId = resolvedParams.id;

    const { data: method, isLoading: methodLoading } = usePaymentMethod(paymentMethodId);
    const { data: assignments = [], isLoading: assignmentsLoading } = useOrgPaymentMethods(paymentMethodId);
    const enrollMutation = useEnrollOrgToPaymentMethod();

    // Fetch orgs for enrollment dropdown
    const { data: orgs = [] } = useQuery({
        queryKey: ['organizations', 'list-for-enroll'],
        queryFn: async () => {
            const response = await userApi.get<{ items: OrgOption[]; pagination: unknown }>('/organizations');
            if (!response.success) throw new Error('Failed to fetch organizations');
            return response.data!.items;
        },
    });

    const [enrollOpen, setEnrollOpen] = useState(false);
    const [selectedOrgId, setSelectedOrgId] = useState('');

    const enrolledOrgIds = new Set(assignments.map((a) => a.organizationId));
    const availableOrgs = orgs.filter((o) => !enrolledOrgIds.has(o.id));

    const handleEnroll = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrgId) {
            toast.error('Select an organization');
            return;
        }
        try {
            await enrollMutation.mutateAsync({
                paymentMethodId,
                data: { organizationId: selectedOrgId },
            });
            toast.success('Organization enrolled');
            setEnrollOpen(false);
            setSelectedOrgId('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to enroll organization');
        }
    };

    const isLoading = methodLoading || assignmentsLoading;

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" size="icon">
                        <Link href={`/admin/payment-methods/${paymentMethodId}/edit`}>
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Organization Enrollment</h1>
                        <p className="text-muted-foreground">
                            {method?.name || 'Payment Method'} — Manage which organizations can use this payment method
                        </p>
                    </div>
                </div>
                <Button onClick={() => setEnrollOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Enroll Organization
                </Button>
            </div>

            {/* Assignments */}
            {assignments.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">No organizations enrolled</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enroll organizations to allow them to use this payment method.
                        </p>
                        <Button onClick={() => setEnrollOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Enroll First Organization
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {assignments.map((assignment) => (
                        <AssignmentCard
                            key={assignment.id}
                            assignment={assignment}
                            paymentMethodId={paymentMethodId}
                        />
                    ))}
                </div>
            )}

            {/* Enroll Dialog */}
            <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleEnroll}>
                        <DialogHeader>
                            <DialogTitle>Enroll Organization</DialogTitle>
                            <DialogDescription>
                                Select an organization to enroll in this payment method.
                                If a qualification flow is configured for their org type, they will need to complete it.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label>Organization *</Label>
                            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select organization" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableOrgs.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                            {org.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {availableOrgs.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    All organizations are already enrolled.
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={enrollMutation.isPending || !selectedOrgId}>
                                {enrollMutation.isPending ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enrolling...</>
                                ) : (
                                    'Enroll'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
