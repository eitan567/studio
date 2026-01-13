import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BookImage,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { placeholderImages } from '@/lib/placeholder-images.json';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const features = [
  {
    icon: <UploadCloud className="h-10 w-10 text-primary" />,
    title: 'Seamless Upload',
    description:
      'Upload from any device or connect directly to Google Photos. Your memories, ready in seconds.',
  },
  {
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    title: 'AI Curation',
    description:
      'Our intelligent algorithms group, sort, and layout your photos to tell the perfect story automatically.',
  },
  {
    icon: <BookImage className="h-10 w-10 text-primary" />,
    title: 'Print-Ready',
    description:
      'What you see is what you get. High-resolution, calibrated previews ensure your printed album looks flawless.',
  },
];

export default function LandingPage() {
  const heroImage = placeholderImages.find((img) => img.id === 'hero');

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full overflow-hidden py-24 md:py-32 lg:py-40 bg-background">
          <div className="absolute inset-0 z-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 blur-3xl" />
          </div>

          <div className="container relative z-10 px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-[1fr_500px] lg:gap-16 xl:grid-cols-[1fr_700px]">
              <div className="flex flex-col justify-center space-y-8">
                <div className="space-y-4">
                  <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                    Reimagining Photo Albums
                  </div>
                  <h1 className="font-headline text-5xl font-extrabold tracking-tight sm:text-6xl xl:text-7xl/none bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                    Albomit
                  </h1>
                  <p className="max-w-[600px] text-xl text-muted-foreground md:text-2xl leading-relaxed">
                    Turn your chaotic camera roll into a masterpiece.
                    <span className="block mt-2">Intelligent. Beautiful. Yours.</span>
                  </p>
                </div>
                <div className="flex flex-col gap-4 min-[400px]:flex-row">
                  <Button asChild size="lg" className="font-bold text-lg h-14 px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105">
                    <Link href="/signup">
                      Start Creating <ArrowRight className="ml-2 h-6 w-6" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="text-lg h-14 px-8 border-2">
                    <Link href="/dashboard">View Demo</Link>
                  </Button>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary to-purple-600 opacity-20 blur-2xl rounded-xl" />
                <Image
                  src="/hero-premium.png"
                  alt="Premium photobook preview"
                  width={800}
                  height={600}
                  className="relative rounded-2xl border-4 border-background shadow-2xl object-cover aspect-[4/3] rotate-2 transition-transform hover:rotate-0 duration-500"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-24 bg-muted/30">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
                Why albomit?
              </h2>
              <p className="max-w-[800px] text-muted-foreground md:text-xl/relaxed">
                We've combined professional design principles with modern AI to give you the power of a design studio, without the learning curve.
              </p>
            </div>
            <div className="grid max-w-6xl mx-auto gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="relative overflow-hidden border-none shadow-md bg-background/50 hover:bg-background transition-colors duration-300"
                >
                  <CardHeader>
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      {feature.icon}
                    </div>
                    <CardTitle className="font-headline text-2xl">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base text-muted-foreground">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-24 md:py-32 bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="container relative z-10 grid items-center justify-center gap-6 px-4 text-center md:px-6">
            <div className="space-y-4">
              <h2 className="font-headline text-4xl font-bold tracking-tighter md:text-5xl">
                Your Story Awaits
              </h2>
              <p className="mx-auto max-w-[600px] text-primary-foreground/80 md:text-xl/relaxed">
                Join thousands of creators who have already discovered the easiest way to make beautiful photobooks.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="w-full max-w-sm mx-auto font-bold text-lg h-12 shadow-xl">
              <Link href="/signup">
                Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
