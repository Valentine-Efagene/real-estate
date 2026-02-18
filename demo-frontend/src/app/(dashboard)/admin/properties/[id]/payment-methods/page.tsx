'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProperty } from '@/lib/hooks/use-properties';
import {
    usePaymentMethodsList,
    usePropertyPaymentMethods,
    useLinkPaymentMethodToProperty,
    useUnlinkPaymentMethodFromProperty,
    type PaymentMethod,
} from '@/lib/hooks/use-payment-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Link as LinkIcon, ChevronRight, FileText, CreditCard, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

function LinkPaymentMethodDialog({ propertyId }: { propertyId: string }) {
    const [open, setOpen] = useState(false);
    const [selectedMethodId, setSelectedMethodId] = useState<string>('');

    const { data: allMethods = [] } = usePaymentMethodsList();
    const { data: linkedMethods = [] } = usePropertyPaymentMethods(propertyId);
    const linkMutation = useLinkPaymentMethodToProperty();

    // Filter out already linked methods
    const linkedIds = new Set(linkedMethods.map((l) => l.paymentMethodId));
    const availableMethods = allMethods.filter((m) => !linkedIds.has(m.id));

    const handleSubmit = async () => {
        if (!selectedMethodId) return;

        try {
            await linkMutation.mutateAsync({
                paymentMethodId: selectedMethodId,
                propertyId,
            });
            toast.success('Payment method linked to property');
            setOpen(false);
            setSelectedMethodId('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to link payment method');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Link Payment Method
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link Payment Method to Property</DialogTitle>
                    <DialogDescription>
                        Select a payment method to make it available for this property.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {availableMethods.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            All payment methods are already linked, or no payment methods exist.
                            <br />
                            <Link href="/admin/payment-methods" className="text-primary hover:underline">
                                Create a payment method first
                            </Link>
                        </p>
                    ) : (
                        <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMethods.map((method) => (
                                    <SelectItem key={method.id} value={method.id}>
                                        {method.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedMethodId || linkMutation.isPending}
                    >
                        {linkMutation.isPending ? 'Linking...' : 'Link Method'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LinkedPaymentMethodCard({
    link,
    propertyId,
}: {
    link: { id: string; paymentMethodId: string; paymentMethod: PaymentMethod };
    propertyId: string;
}) {
    const unlinkMutation = useUnlinkPaymentMethodFromProperty();
    const method = link.paymentMethod;

    const handleUnlink = async () => {
        if (!confirm(`Remove "${method.name}" from this property?`)) return;

        try {
            await unlinkMutation.mutateAsync({
                paymentMethodId: method.id,
                propertyId,
            });
            toast.success('Payment method unlinked from property');
        } catch (error: any) {
            toast.error(error.message || 'Failed to unlink payment method');
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'QUESTIONNAIRE':
                return <ClipboardList className="h-3 w-3" />;
            case 'DOCUMENTATION':
                return <FileText className="h-3 w-3" />;
            case 'PAYMENT':
                return <CreditCard className="h-3 w-3" />;
            default:
                return null;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'QUESTIONNAIRE':
                return 'bg-purple-100 text-purple-800';
            case 'DOCUMENTATION':
                return 'bg-blue-100 text-blue-800';
            case 'PAYMENT':
                return 'bg-green-100 text-green-800';
            default:
                return '';
        }
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                            {method.name}
                        </CardTitle>
                        <CardDescription>{method.description || 'No description'}</CardDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleUnlink}
                        disabled={unlinkMutation.isPending}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center flex-wrap gap-1">
                    {method.phases
                        ?.sort((a, b) => a.order - b.order)
                        .map((phase, index) => (
                            <div key={phase.id} className="flex items-center">
                                <Badge
                                    variant="outline"
                                    className={`flex items-center gap-1 text-xs ${getCategoryColor(phase.phaseCategory)}`}
                                >
                                    {getCategoryIcon(phase.phaseCategory)}
                                    {phase.name}
                                    {phase.percentOfPrice && ` (${phase.percentOfPrice}%)`}
                                </Badge>
                                {index < method.phases.length - 1 && (
                                    <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground" />
                                )}
                            </div>
                        ))}
                </div>
            </CardContent>
        </Card>
    );
}

export default function PropertyPaymentMethodsPage() {
    const params = useParams();
    const router = useRouter();
    const propertyId = params.id as string;

    const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
    const { data: linkedMethods, isLoading: linksLoading } = usePropertyPaymentMethods(propertyId);

    const isLoading = propertyLoading || linksLoading;

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (!property) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle>Property Not Found</CardTitle>
                        <CardDescription>
                            The property you&apos;re looking for doesn&apos;t exist.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{property.title}</h1>
                    <p className="text-muted-foreground">
                        {property.streetAddress}, {property.district}
                    </p>
                </div>
                <LinkPaymentMethodDialog propertyId={propertyId} />
            </div>

            {/* Property Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Property Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className="ml-2 font-medium">{property.propertyType}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Category:</span>
                            <span className="ml-2 font-medium">{property.category}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Status:</span>
                            <Badge className="ml-2" variant={property.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                                {property.status}
                            </Badge>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Variants:</span>
                            <span className="ml-2 font-medium">{property.variants?.length ?? '—'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Linked Payment Methods */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Linked Payment Methods</h2>
                {linkedMethods && linkedMethods.length > 0 ? (
                    <div className="grid gap-4">
                        {linkedMethods.map((link) => (
                            <LinkedPaymentMethodCard
                                key={link.id}
                                link={link}
                                propertyId={propertyId}
                            />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="text-center py-8">
                            <p className="text-muted-foreground mb-4">
                                No payment methods linked to this property yet.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Link payment methods to allow customers to apply for this property.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Help */}
            <Card>
                <CardHeader>
                    <CardTitle>About Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                        Payment methods define the customer journey for purchasing this property.
                        Each method has multiple phases like KYC verification, downpayment, and mortgage payments.
                    </p>
                    <p>
                        You can link multiple payment methods to give customers options (e.g., outright purchase vs. mortgage).
                    </p>
                    <div className="pt-2">
                        <Link href="/admin/payment-methods" className="text-primary hover:underline">
                            Manage Payment Methods →
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
