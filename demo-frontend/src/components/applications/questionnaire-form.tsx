'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useSubmitQuestionnaire, type QuestionnaireField } from '@/lib/hooks';

export type { QuestionnaireField };

interface QuestionnaireFormProps {
    applicationId: string;
    phaseId: string;
    fields: QuestionnaireField[];
    phaseName?: string;
    onSubmitSuccess?: () => void;
}

export function QuestionnaireForm({
    applicationId,
    phaseId,
    fields,
    phaseName = 'Questionnaire',
    onSubmitSuccess,
}: QuestionnaireFormProps) {
    const submitQuestionnaire = useSubmitQuestionnaire();

    // Initialize answers from existing answers or defaults
    const initialAnswers = useMemo(() => {
        const answers: Record<string, unknown> = {};
        fields.forEach((field) => {
            if (field.answer !== undefined && field.answer !== null) {
                answers[field.name] = field.answer;
            } else if (field.defaultValue !== undefined && field.defaultValue !== null) {
                answers[field.name] = field.defaultValue;
            } else {
                // Set empty defaults based on type
                switch (field.fieldType) {
                    case 'CHECKBOX':
                        answers[field.name] = false;
                        break;
                    case 'MULTI_SELECT':
                        answers[field.name] = [];
                        break;
                    default:
                        answers[field.name] = '';
                }
            }
        });
        return answers;
    }, [fields]);

    const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const updateAnswer = useCallback((fieldName: string, value: unknown) => {
        setAnswers((prev) => ({ ...prev, [fieldName]: value }));
        // Clear error when user types
        setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[fieldName];
            return newErrors;
        });
    }, []);

    // Sort fields by order
    const sortedFields = useMemo(
        () => [...fields].sort((a, b) => a.order - b.order),
        [fields]
    );

    // Validate required fields
    const validate = useCallback(() => {
        const newErrors: Record<string, string> = {};

        sortedFields.forEach((field) => {
            if (field.isRequired) {
                const value = answers[field.name];
                if (value === undefined || value === null || value === '') {
                    newErrors[field.name] = `${field.label} is required`;
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [sortedFields, answers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            // Convert answers to the format expected by the API
            const formattedAnswers = Object.entries(answers).map(([fieldName, value]) => ({
                fieldName,
                value: String(value), // API expects string values
            }));

            await submitQuestionnaire.mutateAsync({
                applicationId,
                phaseId,
                answers: formattedAnswers,
            });

            toast.success('Questionnaire submitted successfully');
            onSubmitSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to submit questionnaire');
        }
    };

    const renderField = (field: QuestionnaireField) => {
        const value = answers[field.name];
        const error = errors[field.name];

        switch (field.fieldType) {
            case 'TEXT':
            case 'EMAIL':
            case 'PHONE':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.name} className="flex items-center gap-1">
                            {field.label}
                            {field.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        {field.description && (
                            <p className="text-sm text-gray-500">{field.description}</p>
                        )}
                        <Input
                            id={field.name}
                            type={field.fieldType === 'EMAIL' ? 'email' : field.fieldType === 'PHONE' ? 'tel' : 'text'}
                            placeholder={field.placeholder || ''}
                            value={String(value || '')}
                            onChange={(e) => updateAnswer(field.name, e.target.value)}
                            className={error ? 'border-red-500' : ''}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'TEXTAREA':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.name} className="flex items-center gap-1">
                            {field.label}
                            {field.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        {field.description && (
                            <p className="text-sm text-gray-500">{field.description}</p>
                        )}
                        <Textarea
                            id={field.name}
                            placeholder={field.placeholder || ''}
                            value={String(value || '')}
                            onChange={(e) => updateAnswer(field.name, e.target.value)}
                            className={error ? 'border-red-500' : ''}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'NUMBER':
            case 'CURRENCY':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.name} className="flex items-center gap-1">
                            {field.label}
                            {field.isRequired && <span className="text-red-500">*</span>}
                            {field.fieldType === 'CURRENCY' && <span className="text-gray-400 text-sm">(₦)</span>}
                        </Label>
                        {field.description && (
                            <p className="text-sm text-gray-500">{field.description}</p>
                        )}
                        <Input
                            id={field.name}
                            type="number"
                            placeholder={field.placeholder || ''}
                            value={String(value || '')}
                            onChange={(e) => updateAnswer(field.name, e.target.value)}
                            className={error ? 'border-red-500' : ''}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'SELECT':
                const options = (field.validation as { options?: string[] })?.options || [];
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.name} className="flex items-center gap-1">
                            {field.label}
                            {field.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        {field.description && (
                            <p className="text-sm text-gray-500">{field.description}</p>
                        )}
                        <Select
                            value={String(value || '')}
                            onValueChange={(val) => updateAnswer(field.name, val)}
                        >
                            <SelectTrigger className={error ? 'border-red-500' : ''}>
                                <SelectValue placeholder={field.placeholder || 'Select an option'} />
                            </SelectTrigger>
                            <SelectContent>
                                {options.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option.replace(/_/g, ' ')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'CHECKBOX':
                return (
                    <div key={field.id} className="flex items-start space-x-3 space-y-0">
                        <Checkbox
                            id={field.name}
                            checked={Boolean(value)}
                            onCheckedChange={(checked) => updateAnswer(field.name, checked)}
                        />
                        <div className="space-y-1 leading-none">
                            <Label htmlFor={field.name} className="cursor-pointer">
                                {field.label}
                                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            {field.description && (
                                <p className="text-sm text-gray-500">{field.description}</p>
                            )}
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'DATE':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.name} className="flex items-center gap-1">
                            {field.label}
                            {field.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        {field.description && (
                            <p className="text-sm text-gray-500">{field.description}</p>
                        )}
                        <Input
                            id={field.name}
                            type="date"
                            value={String(value || '')}
                            onChange={(e) => updateAnswer(field.name, e.target.value)}
                            className={error ? 'border-red-500' : ''}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            default:
                // Fallback to text input
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.name} className="flex items-center gap-1">
                            {field.label}
                            {field.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        {field.description && (
                            <p className="text-sm text-gray-500">{field.description}</p>
                        )}
                        <Input
                            id={field.name}
                            placeholder={field.placeholder || ''}
                            value={String(value || '')}
                            onChange={(e) => updateAnswer(field.name, e.target.value)}
                            className={error ? 'border-red-500' : ''}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );
        }
    };

    if (fields.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="text-gray-500">No questions to answer for this phase.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{phaseName}</CardTitle>
                <CardDescription>
                    Please complete all required fields to proceed with your application.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {sortedFields.map((field) => renderField(field))}

                    <div className="flex justify-end pt-4">
                        <Button
                            type="submit"
                            disabled={submitQuestionnaire.isPending}
                            className="min-w-32"
                        >
                            {submitQuestionnaire.isPending ? 'Submitting...' : 'Submit Answers'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
