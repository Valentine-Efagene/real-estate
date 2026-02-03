'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Users, UserCircle, Building2, Landmark, Loader2 } from 'lucide-react';

// Demo personas matching the Chidi-Lekki mortgage scenario
const DEMO_PERSONAS = [
    {
        name: 'Adaeze',
        email: 'adaeze@mailsac.com',
        password: 'password123',
        role: 'Admin',
        roleColor: 'bg-purple-500',
        icon: UserCircle,
        description: 'QShelter operations manager',
    },
    {
        name: 'Chidi',
        email: 'chidi@mailsac.com',
        password: 'password123',
        role: 'Customer',
        roleColor: 'bg-green-500',
        icon: Users,
        description: 'First-time homebuyer',
    },
    {
        name: 'Emeka',
        email: 'emeka@mailsac.com',
        password: 'password123',
        role: 'Developer',
        roleColor: 'bg-blue-500',
        icon: Building2,
        description: 'Lekki Gardens developer rep',
    },
    {
        name: 'Nkechi',
        email: 'nkechi@mailsac.com',
        password: 'password123',
        role: 'Lender',
        roleColor: 'bg-amber-500',
        icon: Landmark,
        description: 'Access Bank loan officer',
    },
];

export function PersonaSwitcher() {
    const { user, login, logout, isLoading } = useAuth();
    const router = useRouter();
    const [switching, setSwitching] = useState(false);
    const [switchingTo, setSwitchingTo] = useState<string | null>(null);

    const currentPersona = DEMO_PERSONAS.find(p => p.email === user?.email);

    const handleSwitch = async (persona: (typeof DEMO_PERSONAS)[0]) => {
        if (persona.email === user?.email) return;

        setSwitching(true);
        setSwitchingTo(persona.name);

        try {
            // Logout current user
            if (user) {
                await logout();
            }

            // Login as new persona
            await login(persona.email, persona.password);

            // Redirect based on role
            if (persona.role === 'Admin') {
                router.push('/admin/dashboard');
            } else {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to switch persona:', error);
        } finally {
            setSwitching(false);
            setSwitchingTo(null);
        }
    };

    if (isLoading) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={switching}>
                    {switching ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Switching to {switchingTo}...
                        </>
                    ) : (
                        <>
                            <Users className="h-4 w-4" />
                            {currentPersona ? currentPersona.name : 'Demo Personas'}
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Switch Demo Persona</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DEMO_PERSONAS.map(persona => {
                    const Icon = persona.icon;
                    const isActive = persona.email === user?.email;

                    return (
                        <DropdownMenuItem
                            key={persona.email}
                            onClick={() => handleSwitch(persona)}
                            disabled={isActive || switching}
                            className="flex items-start gap-3 py-2"
                        >
                            <Icon className={`h-5 w-5 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div className="flex flex-col flex-1">
                                <div className="flex items-center gap-2">
                                    <span className={isActive ? 'font-medium' : ''}>{persona.name}</span>
                                    <Badge variant="secondary" className={`${persona.roleColor} text-white text-xs`}>
                                        {persona.role}
                                    </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">{persona.description}</span>
                            </div>
                            {isActive && <span className="text-xs text-green-600 mt-0.5">Active</span>}
                        </DropdownMenuItem>
                    );
                })}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Quick-switch between demo users to test the full mortgage flow
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
