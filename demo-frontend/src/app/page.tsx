import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BootstrapButton } from "@/components/demo/BootstrapButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">QS</span>
            </div>
            <span className="font-semibold text-lg">QShelter</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl md:text-6xl">
            Find Your Dream Home
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Discover premium properties and get flexible financing options.
            From browsing to ownership, we make your home buying journey seamless.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8">
                Browse Properties
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8 text-zinc-900 dark:text-zinc-50">
            Why Choose QShelter
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg">
                    🏠
                  </span>
                  Premium Properties
                </CardTitle>
                <CardDescription>
                  Curated selection of quality homes
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
                Browse verified properties from trusted developers across prime locations.
                Every listing is vetted for quality and legal compliance.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg">
                    💳
                  </span>
                  Flexible Financing
                </CardTitle>
                <CardDescription>
                  Mortgage and installment options
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
                Choose from multiple payment plans including outright purchase,
                installments, or mortgage financing with competitive rates.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg">
                    📄
                  </span>
                  Seamless Process
                </CardTitle>
                <CardDescription>
                  Digital documentation workflow
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
                Complete your application online. Upload documents, track approvals,
                and manage payments all from one dashboard.
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8 text-zinc-900 dark:text-zinc-50">
            How It Works
          </h2>
          <div className="grid gap-6 md:grid-cols-4 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Browse</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Explore available properties and find your perfect match
              </p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Apply</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Reserve your unit and complete the eligibility questionnaire
              </p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Verify</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Upload required documents for KYC verification
              </p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-semibold mb-2">Own</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Make payments and complete your property purchase
              </p>
            </div>
          </div>
        </div>

        {/* Developer Tools Section */}
        <div className="mb-16 border-2 border-dashed border-amber-300 rounded-2xl p-8 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🛠️</span>
            <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200">
              Developer Tools
            </h2>
            <span className="ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-1 rounded">
              Demo Only
            </span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            Use these tools to set up and test the platform. Bootstrap creates the initial tenant,
            admin user (Adaeze), and platform organization.
          </p>
          <div className="flex gap-4">
            <BootstrapButton />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-12">
          <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
            Ready to find your new home?
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
            Create an account to start browsing properties and apply for financing.
          </p>
          <Link href="/register">
            <Button size="lg" className="h-12 px-8">
              Get Started Today
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>© 2026 QShelter. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
